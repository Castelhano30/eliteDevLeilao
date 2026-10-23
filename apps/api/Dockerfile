# Contexto de build: a raiz do monorepo (ver docker-compose.yml).
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
# O lockfile cobre os três workspaces; o web entra só com o package.json para o npm ci resolver.
COPY apps/web/package.json apps/web/package.json
RUN npm ci

# O generate vem antes: o código da API importa tipos do client gerado.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build -w packages/shared \
  && npm run build -w apps/api

CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && (npx tsx apps/api/prisma/seed.ts || echo seed-falhou-subindo-sem-ele) && node apps/api/dist/server.js"]
