import { afterEach, describe, expect, it } from "vitest";
import { FIPE, deadUrl, fipeHandler, json, startFakeServer, type FakeServer } from "../../test/helpers/fake-server";
import { AppError } from "../errors";
import { FakeClock } from "./clock";
import { CACHE_TTL_MS, ExternalCache, ExternalUnavailableError } from "./external-cache";
import { makeFipeCatalog } from "./fipe";
import { createLogger } from "./logger";
import { makeWikipedia, pickImageUrl } from "./wikipedia";

const servers: FakeServer[] = [];
async function server(...args: Parameters<typeof startFakeServer>) {
  const s = await startFakeServer(...args);
  servers.push(s);
  return s;
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

const newCache = (clock = new FakeClock("2026-10-23T12:00:00.000Z"), maxEntries?: number) =>
  new ExternalCache({ clock, source: "teste", logger: createLogger("silent"), maxEntries });

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return "OK";
  } catch (err) {
    return err instanceof AppError ? `${err.code}:${JSON.stringify(err.details ?? null)}` : String(err);
  }
}

describe("ExternalCache", () => {
  it("hit, vencido + falha serve o vencido, vencido + sucesso troca (AC-2.8b)", async () => {
    const clock = new FakeClock("2026-10-23T12:00:00.000Z");
    const cache = newCache(clock);
    let calls = 0;
    const ok = (value: string) => async () => {
      calls += 1;
      return { found: true as const, value };
    };
    const fail = async () => {
      calls += 1;
      throw new ExternalUnavailableError();
    };

    expect((await cache.get("k", ok("v1"))).result).toEqual({ found: true, value: "v1" });
    expect((await cache.get("k", fail)).result).toEqual({ found: true, value: "v1" });
    expect(calls).toBe(1); // dentro do TTL nem chama

    clock.advance(CACHE_TTL_MS + 1);
    const stale = await cache.get("k", fail);
    expect(stale).toMatchObject({ result: { found: true, value: "v1" }, stale: true });
    expect(stale.fetchedAt.toISOString()).toBe("2026-10-23T12:00:00.000Z");

    const fresh = await cache.get("k", ok("v2"));
    expect(fresh).toMatchObject({ result: { found: true, value: "v2" }, stale: false });
    expect(fresh.fetchedAt.toISOString()).toBe("2026-10-24T12:00:00.001Z");
  });

  it("vazio + falha sobe o erro e não cacheia o UNAVAILABLE", async () => {
    const cache = newCache();
    await expect(cache.get("k", async () => Promise.reject(new ExternalUnavailableError()))).rejects.toBeInstanceOf(ExternalUnavailableError);
    expect(cache.size).toBe(0);
    expect((await cache.get("k", async () => ({ found: true as const, value: 1 }))).result).toEqual({ found: true, value: 1 });
  });

  it("'não achou' é cacheado", async () => {
    const cache = newCache();
    let calls = 0;
    const load = async () => {
      calls += 1;
      return { found: false as const };
    };
    await cache.get("k", load);
    await cache.get("k", load);
    expect(calls).toBe(1);
  });

  it("não passa de 500 chaves e descarta a mais antiga", async () => {
    const cache = newCache(undefined, 500);
    for (let i = 0; i < 501; i += 1) await cache.get(`k${i}`, async () => ({ found: true as const, value: i }));
    expect(cache.size).toBe(500);
    let reloaded = false;
    await cache.get("k0", async () => {
      reloaded = true;
      return { found: true as const, value: 0 };
    });
    expect(reloaded).toBe(true);
  });
});

describe("adaptador da FIPE", () => {
  it("normaliza marcas (nome limpo, ordem pt-BR), modelos, anos sem Zero Km e detalhe", async () => {
    const fipe = await server(fipeHandler);
    const catalog = makeFipeCatalog({ baseUrl: fipe.url, cache: newCache() });
    expect(await catalog.brands()).toEqual([
      { id: "23", name: "Chevrolet" },
      { id: "56", name: "Toyota" },
      { id: "59", name: "Volkswagen" },
    ]);
    expect(await catalog.years("56", "2204")).toEqual([
      { id: "2015-5", name: "2015 Flex" },
      { id: "2014-5", name: "2014 Flex" },
    ]);
    const detail = await catalog.detail("56", "2204", "2015-5");
    expect(detail.car).toEqual({
      brand: "Toyota",
      model: "Corolla XEi 2.0",
      year: 2015,
      fuel: "Flex",
      referencePriceCents: 8_006_100,
      referenceMonth: "2026-10",
      codeFipe: "002118-8",
    });
    expect(detail.raw).toEqual(FIPE.detail);
  });

  it("manda o token só se existir", async () => {
    const seen: (string | undefined)[] = [];
    const fipe = await server((req, res) => {
      seen.push(req.headers["x-subscription-token"] as string | undefined);
      json(res, 200, FIPE.brands);
    });
    await makeFipeCatalog({ baseUrl: fipe.url, cache: newCache() }).brands();
    await makeFipeCatalog({ baseUrl: fipe.url, token: "segredo", cache: newCache() }).brands();
    expect(seen).toEqual([undefined, "segredo"]);
  });

  it("AC-2.4: 404 não repete e vira NOT_FOUND", async () => {
    const fipe = await server(fipeHandler);
    const catalog = makeFipeCatalog({ baseUrl: fipe.url, cache: newCache() });
    expect(await codeOf(catalog.detail("56", "9999", "2015-5"))).toBe("NOT_FOUND:null");
    expect(fipe.hits).toHaveLength(1);
  });

  it("ano Zero Km (32000-*) no detalhe → NOT_FOUND sem chamar a FIPE", async () => {
    const fipe = await server(fipeHandler);
    const catalog = makeFipeCatalog({ baseUrl: fipe.url, cache: newCache() });
    expect(await codeOf(catalog.detail("56", "2204", "32000-5"))).toBe("NOT_FOUND:null");
    expect(fipe.hits).toHaveLength(0);
  });

  it("5xx repete uma vez e então 503 EXTERNAL_UNAVAILABLE {source:FIPE}", async () => {
    const fipe = await server((_req, res) => json(res, 502, {}));
    const catalog = makeFipeCatalog({ baseUrl: fipe.url, cache: newCache() });
    expect(await codeOf(catalog.brands())).toBe('EXTERNAL_UNAVAILABLE:{"source":"FIPE"}');
    expect(fipe.hits).toHaveLength(2);
  });

  it("AC-2.8b: 429 não repete; serve o vencido ou dá 503", async () => {
    const clock = new FakeClock("2026-10-23T12:00:00.000Z");
    const cache = newCache(clock);
    const fipe = await server((_req, res) => json(res, 429, {}));
    const catalog = makeFipeCatalog({ baseUrl: fipe.url, cache });
    expect(await codeOf(catalog.brands())).toBe('EXTERNAL_UNAVAILABLE:{"source":"FIPE"}');
    expect(fipe.hits).toHaveLength(1);

    fipe.setHandler(fipeHandler);
    await catalog.brands();
    clock.advance(CACHE_TTL_MS + 1);
    fipe.setHandler((_req, res) => json(res, 429, {}));
    expect((await catalog.brands()).map((b) => b.name)).toEqual(["Chevrolet", "Toyota", "Volkswagen"]);
    expect(fipe.hits).toHaveLength(3);
  });

  it("timeout conta como falha e repete uma vez", async () => {
    const fipe = await server(() => undefined); // nunca responde
    const catalog = makeFipeCatalog({ baseUrl: fipe.url, cache: newCache(), timeoutMs: 150 });
    expect(await codeOf(catalog.brands())).toBe('EXTERNAL_UNAVAILABLE:{"source":"FIPE"}');
    expect(fipe.hits).toHaveLength(2);
  });

  it("AC-2.5: 5 chamadas simultâneas com cache vazio fazem 1 requisição", async () => {
    const fipe = await server((req, res) => setTimeout(() => fipeHandler(req, res), 50));
    const catalog = makeFipeCatalog({ baseUrl: fipe.url, cache: newCache() });
    const results = await Promise.all(Array.from({ length: 5 }, () => catalog.brands()));
    expect(results.every((r) => r.length === 3)).toBe(true);
    expect(fipe.hits).toHaveLength(1);
  });

  it("host morto e cache vazio: 503", async () => {
    const catalog = makeFipeCatalog({ baseUrl: await deadUrl(), cache: newCache() });
    expect(await codeOf(catalog.brands())).toBe('EXTERNAL_UNAVAILABLE:{"source":"FIPE"}');
  });
});

describe("adaptador da Wikipedia", () => {
  const UA = "LanceAuto/teste";
  const summary = (title: string, extra: Record<string, unknown> = {}) => ({
    type: "standard",
    title,
    extract: `O ${title} é um automóvel.`,
    thumbnail: { source: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${title}.jpg/330px-${title}.jpg?utm_source=x` },
    originalimage: { source: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${title}.jpg`, width: 4000 },
    content_urls: { desktop: { page: `https://pt.wikipedia.org/wiki/${title}` } },
    ...extra,
  });

  it("acha pela marca + modelo, reescreve a miniatura para 1280 px e manda o User-Agent", async () => {
    const agents: string[] = [];
    const wiki = await server((req, res) => {
      agents.push(String(req.headers["user-agent"]));
      if (req.url === "/api/rest_v1/page/summary/Toyota_Corolla") return json(res, 200, summary("Toyota_Corolla"));
      json(res, 404, {});
    });
    const port = makeWikipedia({ baseUrl: wiki.url, userAgent: UA, cache: newCache() });
    expect(await port.suggest("Toyota", "Corolla XEi 2.0")).toEqual({
      status: "FOUND",
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Toyota_Corolla.jpg/1280px-Toyota_Corolla.jpg",
        credit: 'Foto: Wikipedia, artigo "Toyota Corolla" (licença Creative Commons, veja a página do artigo)',
        creditUrl: "https://pt.wikipedia.org/wiki/Toyota_Corolla",
      },
    });
    expect(agents).toEqual([UA]);
  });

  it("só o modelo vale se o resumo falar de veículo; desambiguação é ignorada", async () => {
    const wiki = await server((req, res) => {
      if (req.url === "/api/rest_v1/page/summary/Volkswagen_Gol") return json(res, 200, summary("X", { type: "disambiguation" }));
      if (req.url === "/api/rest_v1/page/summary/Gol") return json(res, 200, summary("Gol", { extract: "Gol é uma companhia aérea." }));
      json(res, 404, {});
    });
    const port = makeWikipedia({ baseUrl: wiki.url, userAgent: UA, cache: newCache() });
    expect(await port.suggest("VW - VolksWagen", "Gol 1.0 MPI")).toEqual({ status: "NOT_FOUND" });
    expect(wiki.hits).toEqual(["/api/rest_v1/page/summary/Volkswagen_Gol", "/api/rest_v1/page/summary/Gol"]);
  });

  it("AC-2.6: artigo inexistente → NOT_FOUND (cacheado); fora do ar → UNAVAILABLE (não cacheado)", async () => {
    const wiki = await server((_req, res) => json(res, 404, {}));
    const cache = newCache();
    const port = makeWikipedia({ baseUrl: wiki.url, userAgent: UA, cache });
    expect(await port.suggest("Toyota", "Corolla")).toEqual({ status: "NOT_FOUND" });
    expect(await port.suggest("Toyota", "Corolla")).toEqual({ status: "NOT_FOUND" });
    expect(wiki.hits).toHaveLength(2); // 2 candidatos, uma vez cada

    const dead = makeWikipedia({ baseUrl: await deadUrl(), userAgent: UA, cache: newCache() });
    expect(await dead.suggest("Toyota", "Corolla")).toEqual({ status: "UNAVAILABLE" });
  });

  it("falha de rede no 1º candidato encerra na hora, sem tentar o seguinte", async () => {
    const wiki = await server(() => undefined);
    const port = makeWikipedia({ baseUrl: wiki.url, userAgent: UA, cache: newCache(), timeoutMs: 150 });
    expect(await port.suggest("Toyota", "Corolla")).toEqual({ status: "UNAVAILABLE" });
    expect(wiki.hits).toHaveLength(1);
  });

  it("pickImageUrl: original pequena, miniatura reescrita, original até 1600 sem miniatura", () => {
    expect(pickImageUrl({ originalimage: { source: "https://u/a.jpg", width: 1000 } })).toBe("https://u/a.jpg");
    expect(pickImageUrl({ originalimage: { source: "https://u/a.jpg", width: 1500 } })).toBe("https://u/a.jpg");
    expect(pickImageUrl({ originalimage: { source: "https://u/a.jpg", width: 2000 } })).toBeNull();
    expect(
      pickImageUrl({ thumbnail: { source: "https://u/thumb/a/ab/F.svg/330px-F.svg.png?x=1" }, originalimage: { source: "https://u/a/ab/F.svg", width: 300 } }),
    ).toBe("https://u/thumb/a/ab/F.svg/1280px-F.svg.png");
  });
});
