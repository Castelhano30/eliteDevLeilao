import type { ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { startFakeServer, type FakeServer } from "../../test/helpers/fake-server";
import { IMAGE_MAX_BYTES, makeImageStore } from "./image-store";
import { isBlockedAddress, unmapIPv4 } from "./ip-policy";

const servers: FakeServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(100 * 1024, 7)]);

function sendImage(res: ServerResponse, type = "image/png", body: Buffer = PNG) {
  res.writeHead(200, { "Content-Type": type, "Content-Length": body.length });
  res.end(body);
}

async function imageServer(host = "127.0.0.1") {
  const s = await startFakeServer((req, res) => {
    if (req.url === "/a.png") return sendImage(res);
    if (req.url === "/page.html") return sendImage(res, "text/html; charset=utf-8", Buffer.from("<html></html>"));
    if (req.url === "/logo.svg") return sendImage(res, "image/svg+xml", Buffer.from("<svg/>"));
    if (req.url === "/big.png") return sendImage(res, "image/png", Buffer.alloc(IMAGE_MAX_BYTES + 512 * 1024, 1));
    if (req.url === "/stream.png") {
      // sem Content-Length, mandando além do teto
      res.writeHead(200, { "Content-Type": "image/png" });
      const chunk = Buffer.alloc(512 * 1024, 2);
      for (let i = 0; i < 10; i += 1) res.write(chunk);
      return res.end();
    }
    res.writeHead(404).end();
  }, host);
  servers.push(s);
  return s;
}

const UA = "LanceAuto/teste";

describe("ip-policy (§5.3)", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.8",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "[::1]",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
    "nao-e-ip",
  ])("recusa %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "200.147.67.142", "172.32.0.1", "2001:4860:4860::8888", "::ffff:8.8.8.8"])("aceita %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  it("desfaz o IPv4 mapeado nas duas formas", () => {
    expect(unmapIPv4("::ffff:7f00:1")).toBe("127.0.0.1");
    expect(unmapIPv4("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(unmapIPv4("2001::1")).toBeNull();
  });
});

describe("image-store", () => {
  it("sucesso com servidor local (allowPrivate) guarda bytes e MIME", async () => {
    const s = await imageServer();
    const store = makeImageStore({ userAgent: UA, allowPrivate: true, allowedPorts: [s.port] });
    const image = await store.download(`${s.url}/a.png`);
    expect(image?.mime).toBe("image/png");
    expect(image?.data.equals(PNG)).toBe(true);
  });

  it("recusa MIME errado, SVG, acima de 4 MB e streaming sem fim", async () => {
    const s = await imageServer();
    const store = makeImageStore({ userAgent: UA, allowPrivate: true, allowedPorts: [s.port] });
    for (const path of ["/page.html", "/logo.svg", "/big.png", "/stream.png", "/nada.png"]) {
      expect(await store.download(`${s.url}${path}`)).toBeNull();
    }
  });

  it("porta fora de 80/443 não conecta", async () => {
    const s = await imageServer();
    const store = makeImageStore({ userAgent: UA, allowPrivate: true });
    expect(await store.download(`${s.url}/a.png`)).toBeNull();
    expect(s.hits).toHaveLength(0);
  });

  it("AC-2.18: IP literal privado (v4, decimal, hex, mapeado) com a política de produção não conecta", async () => {
    const s = await imageServer();
    const store = makeImageStore({ userAgent: UA, allowedPorts: [s.port] });
    for (const host of ["127.0.0.1", "2130706433", "0x7f.0.0.1", "[::ffff:7f00:1]", "[::ffff:127.0.0.1]"]) {
      expect(await store.download(`http://${host}:${s.port}/a.png`)).toBeNull();
    }
    expect(s.hits).toHaveLength(0);
  });

  it("AC-2.18: [::1] com a política de produção não conecta", async () => {
    const s = await imageServer("::1").catch(() => null);
    if (!s) return; // máquina sem IPv6 de loopback
    const store = makeImageStore({ userAgent: UA, allowedPorts: [s.port] });
    expect(await store.download(`http://[::1]:${s.port}/a.png`)).toBeNull();
    expect(s.hits).toHaveLength(0);
  });

  it("AC-2.18: nome que resolve para IP privado não conecta", async () => {
    const s = await imageServer();
    const store = makeImageStore({
      userAgent: UA,
      allowedPorts: [s.port],
      resolver: async () => [{ address: "127.0.0.1", family: 4 }],
    });
    expect(await store.download(`http://fotos.exemplo.test:${s.port}/a.png`)).toBeNull();
    expect(s.hits).toHaveLength(0);
  });

  it("AC-2.18: redirecionamento para endereço privado é revalidado e não conecta", async () => {
    const target = await imageServer("::1").catch(() => null);
    const origin = await startFakeServer((_req, res) => {
      res.writeHead(302, { Location: target ? `http://[::1]:${target.port}/a.png` : "http://169.254.169.254/latest/meta-data" });
      res.end();
    });
    servers.push(origin);
    // Só a origem (127.0.0.1) é liberada; o destino do redirect segue a política de produção.
    const store = makeImageStore({
      userAgent: UA,
      allowedPorts: [origin.port, target?.port ?? 80],
      allowPrivate: (address) => address === "127.0.0.1",
    });
    expect(await store.download(`${origin.url}/x`)).toBeNull();
    expect(origin.hits).toHaveLength(1);
    if (target) expect(target.hits).toHaveLength(0);
  });

  it("mais de 3 redirecionamentos falha", async () => {
    const s = await startFakeServer((req, res) => {
      const n = Number((req.url ?? "/0").slice(1));
      res.writeHead(302, { Location: `/${n + 1}` }).end();
    });
    servers.push(s);
    const store = makeImageStore({ userAgent: UA, allowPrivate: true, allowedPorts: [s.port] });
    expect(await store.download(`${s.url}/0`)).toBeNull();
    expect(s.hits).toHaveLength(4);
  });
});
