import { lookup as dnsLookup } from "node:dns/promises";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { isBlockedAddress } from "./ip-policy";

export interface ResolvedAddress {
  address: string;
  family: number;
}

/** Resolve um nome de host em endereços (injetável nos testes). */
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface ImageStoreOptions {
  userAgent: string;
  resolver?: Resolver;
  allowedPorts?: number[];
  /** Produção: `false`. Nos testes de sucesso com servidor local, `true` (ou um filtro por endereço). */
  allowPrivate?: boolean | ((address: string) => boolean);
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface DownloadedImage {
  data: Buffer;
  mime: string;
}

/** Baixa a imagem do lote; `null` quando recusa ou falha (o lote nasce sem imagem). */
export interface ImageDownloader {
  download(url: string): Promise<DownloadedImage | null>;
}

export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const defaultResolver: Resolver = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

class Refused extends Error {}

/**
 * Download seguro (R-2.5, §5.3): só http/https em 80/443, IP literal validado antes de conectar,
 * nome de host validado no `lookup` do próprio socket (sem janela para troca de DNS), revalidação a cada
 * redirecionamento (máx. 3), sem proxy, timeout total de 4 s, teto de 4 MB, só jpeg/png/webp/gif.
 */
export function makeImageStore({
  userAgent,
  resolver = defaultResolver,
  allowedPorts = [80, 443],
  allowPrivate = false,
  timeoutMs = 4_000,
  maxBytes = IMAGE_MAX_BYTES,
  maxRedirects = 3,
}: ImageStoreOptions): ImageDownloader {
  const permitted = (address: string) => {
    if (typeof allowPrivate === "function") return allowPrivate(address) || !isBlockedAddress(address);
    return allowPrivate || !isBlockedAddress(address);
  };

  const lookup: LookupFunction = (hostname, options, callback) => {
    resolver(hostname).then(
      (addresses) => {
        const usable = addresses.filter((entry) => permitted(entry.address));
        if (addresses.length === 0 || usable.length !== addresses.length) {
          callback(new Refused(`endereço recusado para ${hostname}`), "", 0);
          return;
        }
        if (options.all) callback(null, usable);
        else callback(null, usable[0]!.address, usable[0]!.family);
      },
      (err: NodeJS.ErrnoException) => callback(err, "", 0),
    );
  };

  function check(raw: string): URL {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Refused("protocolo");
    const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
    if (!allowedPorts.includes(port)) throw new Refused("porta");
    // IP literal (o WHATWG URL já normaliza 2130706433 e 0x7f.1 para 127.0.0.1): o lookup não roda, então valida aqui.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) !== 0 && !permitted(host)) throw new Refused("ip");
    return url;
  }

  function request(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
    const client = url.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
      const req = client.request(
        url,
        { method: "GET", agent: false, lookup, signal, headers: { "User-Agent": userAgent, Accept: ALLOWED_IMAGE_TYPES.join(", ") } },
        resolve,
      );
      req.on("error", reject);
      req.end();
    });
  }

  async function readBody(res: IncomingMessage): Promise<Buffer> {
    const declared = Number(res.headers["content-length"]);
    if (Number.isFinite(declared) && declared > maxBytes) throw new Refused("grande demais");
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of res) {
      const buffer = chunk as Buffer;
      total += buffer.length;
      if (total > maxBytes) {
        res.destroy();
        throw new Refused("grande demais");
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  return {
    async download(raw) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let url = check(raw);
        for (let hop = 0; ; hop += 1) {
          const res = await request(url, controller.signal);
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            if (hop >= maxRedirects) return null;
            url = check(new URL(res.headers.location, url).toString());
            continue;
          }
          if (status !== 200) {
            res.resume();
            return null;
          }
          const mime = String(res.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
          if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
            res.destroy();
            return null;
          }
          const data = await readBody(res);
          return data.length > 0 ? { data, mime } : null;
        }
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
