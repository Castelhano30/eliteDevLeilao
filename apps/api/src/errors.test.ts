import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppError, errorHandler, notFoundHandler } from "./errors";
import { createLogger } from "./infra/logger";
import { requestContext } from "./middleware/request-context";

function buildApp() {
  const lines: string[] = [];
  const logger = createLogger("info", { write: (line: string) => void lines.push(line) });
  const app = express();
  app.use(requestContext(logger));
  app.use(express.json());
  app.get("/boom", () => {
    throw new Error("segredo interno");
  });
  app.get("/invalido", () => {
    throw new AppError("VALIDATION", { fields: { email: "x" } });
  });
  app.post("/eco", (req, res) => res.json(req.body));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, lines };
}

describe("envelope de erro", () => {
  it("AC-0.5: erro genérico vira INTERNAL 500 sem stack, e o log leva o requestId", async () => {
    const { app, lines } = buildApp();
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "INTERNAL", message: "Algo travou do nosso lado. Tente de novo em instantes." },
    });
    expect(JSON.stringify(res.body)).not.toContain("segredo interno");
    const requestId = res.headers["x-request-id"];
    expect(requestId).toBeTruthy();
    expect(lines.some((l) => l.includes(String(requestId)) && l.includes("segredo interno"))).toBe(true);
  });

  it("AC-0.6: AppError(VALIDATION) responde 400 com details.fields", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/invalido");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(res.body.error.details).toEqual({ fields: { email: "x" } });
  });

  it("rota inexistente volta NOT_FOUND 404 no envelope", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/nada");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("JSON malformado volta VALIDATION 400, não 500", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/eco").set("Content-Type", "application/json").send("{ruim");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("corpo acima de 100 KB vira 413 no envelope, sem log de erro", async () => {
    const { app, lines } = buildApp();
    const res = await request(app).post("/eco").send({ blob: "x".repeat(120 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: { code: "PAYLOAD_TOO_LARGE", message: "A requisição passou de 100 KB. Envie menos dados." } });
    expect(lines.join("")).not.toContain("erro não tratado");
  });
});
