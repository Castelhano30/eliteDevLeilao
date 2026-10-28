import Busboy from "busboy";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  LOT_IMAGE_MAX_BYTES,
  LOT_IMAGE_MAX_COUNT,
  LOT_PAYLOAD_MAX_BYTES,
  LOT_TEXT,
  LOT_UPLOAD_MAX_BYTES,
} from "@lanceauto/shared";
import { AppError } from "../errors";
import { sniffImageType } from "../infra/image-sniff";

/** Foto já conferida pelos bytes. O nome e o `Content-Type` da parte nunca chegam até aqui. */
export interface UploadedImage {
  data: Buffer;
  mime: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Fotos do `POST /lots` multipart, na ordem enviada (a primeira é a capa). Vazio no corpo JSON. */
      lotImages?: UploadedImage[];
    }
  }
}

/** Folga para as fronteiras e cabeçalhos das partes (fotos até 20 MiB, mais o `payload`). */
const MULTIPART_OVERHEAD_BYTES = 16 * 1024;
const BODY_CAP_BYTES = LOT_UPLOAD_MAX_BYTES + LOT_PAYLOAD_MAX_BYTES + MULTIPART_OVERHEAD_BYTES;
/** Depois de recusar, o resto do corpo é descartado (o cliente só lê a resposta ao terminar de enviar); passou disto, corta a conexão. */
const DRAIN_CAP_BYTES = 4 * BODY_CAP_BYTES;

const tooLarge = () => new AppError("PAYLOAD_TOO_LARGE", undefined, LOT_TEXT.uploadTooLarge);
const imageError = (message: string) => new AppError("VALIDATION", { fields: { images: message } });
const payloadError = () => new AppError("VALIDATION", undefined, LOT_TEXT.payloadMissing);

/**
 * Lê o `multipart/form-data` do `POST /lots` em memória (campo `payload` com o JSON do lote e partes `images`), e
 * entrega `req.body` e `req.lotImages`. Corpo JSON passa direto. Roda depois de auth, papel e limitador, então
 * quem não pode criar lote nunca tem o corpo lido. Aborta ao passar de qualquer limite e responde no envelope.
 */
export function lotUpload(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.is("multipart/form-data")) {
      next();
      return;
    }
    let finished = false;
    let rawBytes = 0;
    req.on("data", (chunk: Buffer) => {
      rawBytes += chunk.length;
      if (finished) {
        if (rawBytes > DRAIN_CAP_BYTES) req.destroy();
      } else if (rawBytes > BODY_CAP_BYTES) {
        fail(tooLarge());
      }
    });
    req.on("error", () => fail(payloadError()));

    /** Recusa: para de interpretar, descarta o resto do corpo e responde no envelope. */
    function fail(err: AppError) {
      if (finished) return;
      finished = true;
      req.unpipe(parser);
      parser?.removeAllListeners();
      parser?.on("error", () => undefined);
      req.resume();
      next(err);
    }

    let parser: Busboy.Busboy | undefined;
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > BODY_CAP_BYTES) {
      fail(tooLarge());
      return;
    }

    try {
      parser = Busboy({
        headers: req.headers,
        defParamCharset: "utf8",
        limits: {
          // O busboy corta ao atingir o limite, não ao passar dele: um byte a mais deixa o tamanho exato valer.
          fieldSize: LOT_PAYLOAD_MAX_BYTES + 1,
          fields: 8,
          // Uma a mais que o teto, só para saber que passou dele.
          files: LOT_IMAGE_MAX_COUNT + 1,
          fileSize: LOT_IMAGE_MAX_BYTES + 1,
          parts: 16,
        },
      });
    } catch {
      fail(payloadError());
      return;
    }
    const form = parser;

    let payload: string | null = null;
    let fileCount = 0;
    const slots: Buffer[] = [];
    const pendingFiles: Promise<void>[] = [];

    form.on("field", (name, value, info) => {
      if (name !== "payload") return;
      if (info.valueTruncated || payload !== null) {
        fail(payloadError());
        return;
      }
      payload = value;
    });

    form.on("file", (name, stream, _info) => {
      fileCount += 1;
      if (name !== "images") {
        stream.resume();
        return;
      }
      if (fileCount > LOT_IMAGE_MAX_COUNT) {
        stream.resume();
        fail(imageError(LOT_TEXT.imagesTooMany));
        return;
      }
      const index = slots.length;
      slots.push(Buffer.alloc(0));
      const chunks: Buffer[] = [];
      pendingFiles.push(
        new Promise<void>((resolve) => {
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("limit", () => {
            fail(imageError(LOT_TEXT.imageTooBig));
            resolve();
          });
          stream.on("error", () => resolve());
          stream.on("end", () => {
            slots[index] = Buffer.concat(chunks);
            resolve();
          });
        }),
      );
    });

    form.on("filesLimit", () => fail(imageError(LOT_TEXT.imagesTooMany)));
    form.on("partsLimit", () => fail(payloadError()));
    form.on("fieldsLimit", () => fail(payloadError()));
    form.on("error", () => fail(payloadError()));

    form.on("close", () => {
      void Promise.all(pendingFiles).then(() => {
        if (finished) return;
        const images: UploadedImage[] = [];
        for (const slot of slots) {
          // Vazio ou de outro tipo: recusa pelos bytes, nunca pelo cabeçalho da parte.
          const mime = sniffImageType(slot);
          if (slot.length === 0 || mime === null) {
            fail(imageError(LOT_TEXT.imageType));
            return;
          }
          images.push({ data: slot, mime });
        }
        let body: unknown;
        try {
          body = payload === null ? undefined : JSON.parse(payload);
        } catch {
          body = undefined;
        }
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          fail(payloadError());
          return;
        }
        finished = true;
        req.body = body;
        req.lotImages = images;
        next();
      });
    });

    req.pipe(form);
  };
}
