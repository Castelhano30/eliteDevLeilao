import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export type FakeHandler = (req: IncomingMessage, res: ServerResponse) => void;

export interface FakeServer {
  url: string;
  port: number;
  /** Caminhos recebidos, na ordem. */
  hits: string[];
  setHandler(handler: FakeHandler): void;
  close(): Promise<void>;
}

/** Servidor HTTP local para fazer de FIPE, Wikipedia ou origem de imagem nos testes. */
export async function startFakeServer(handler: FakeHandler = (_req, res) => res.end(), host = "127.0.0.1"): Promise<FakeServer> {
  let current = handler;
  const hits: string[] = [];
  const sockets = new Set<import("node:net").Socket>();
  const server: Server = createServer((req, res) => {
    hits.push(req.url ?? "");
    current(req, res);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, host, resolve));
  const { port } = server.address() as AddressInfo;
  const shownHost = host.includes(":") ? `[${host}]` : host;
  return {
    url: `http://${shownHost}:${port}`,
    port,
    hits,
    setHandler(next) {
      current = next;
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

export function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Um endereço onde ninguém escuta: conexão recusada na hora. */
export async function deadUrl(): Promise<string> {
  const server = await startFakeServer();
  const url = server.url;
  await server.close();
  return url;
}

/** Respostas da FIPE v2 no formato conferido no dia 1. */
export const FIPE = {
  brands: [
    { code: "59", name: "VW - VolksWagen" },
    { code: "56", name: "Toyota" },
    { code: "23", name: "GM - Chevrolet" },
  ],
  models: [
    { code: "2204", name: "Corolla XEi 2.0" },
    { code: "2205", name: "Hilux SRV 2.8" },
  ],
  years: [
    { code: "32000-5", name: "32000 Flex" },
    { code: "2015-5", name: "2015 Flex" },
    { code: "2014-5", name: "2014 Flex" },
  ],
  detail: {
    vehicleType: 1,
    price: "R$ 80.061,00",
    brand: "Toyota",
    model: "Corolla XEi 2.0",
    modelYear: 2015,
    fuel: "Flex",
    codeFipe: "002118-8",
    referenceMonth: "outubro de 2026",
    fuelAcronym: "F",
  },
};

/** Handler que imita a FIPE: brands → models → years → detalhe; ids fora da lista dão 404. */
export const fipeHandler: FakeHandler = (req, res) => {
  const path = req.url ?? "";
  if (path === "/cars/brands") return json(res, 200, FIPE.brands);
  if (/^\/cars\/brands\/(56|59|23)\/models$/.test(path)) return json(res, 200, FIPE.models);
  if (/^\/cars\/brands\/(56|59)\/models\/2204\/years$/.test(path)) return json(res, 200, FIPE.years);
  if (path === "/cars/brands/56/models/2204/years/2015-5") return json(res, 200, FIPE.detail);
  if (path === "/cars/brands/59/models/2204/years/2015-5") {
    return json(res, 200, { ...FIPE.detail, brand: "VW - VolksWagen", model: "Gol 1.0 MPI", codeFipe: "005340-6" });
  }
  return json(res, 404, { error: "recurso não encontrado para a referência informada" });
};
