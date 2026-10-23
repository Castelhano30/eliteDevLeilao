# Contexto de build: a raiz do monorepo (ver docker-compose.yml).
FROM node:24-slim
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# O lockfile cobre os três workspaces; a api entra só com o package.json para o npm ci resolver.
COPY apps/api/package.json apps/api/package.json
RUN npm ci

# O Next embute NEXT_PUBLIC_* no build.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build -w packages/shared && npm run build -w apps/web

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "apps/web"]
