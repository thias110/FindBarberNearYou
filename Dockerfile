# syntax=docker/dockerfile:1
# Image multi-stage : deux cibles (`app` = API Node, `web` = Nginx SPA).
# Construire via `docker compose build` (voir docker-compose.yml).

# ---------- Dépendances (workspaces npm) ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
COPY client/package.json client/package.json
RUN npm ci

# ---------- Build serveur (bundled shared) ----------
FROM deps AS server-build
COPY tsconfig.base.json ./
COPY server server
COPY shared shared
RUN npm run build --workspace server

# ---------- Build client (SPA) ----------
FROM deps AS client-build
COPY tsconfig.base.json ./
COPY client client
COPY shared shared
# Démo : API en same-origin via Nginx → le client appelle /api en relatif.
# (valeur vide ≠ absent : le client retombe sur http://localhost:4000 sinon)
RUN printf 'VITE_API_URL=\n' > .env.production
RUN npm run build --workspace client

# ---------- Image API ----------
FROM node:22-alpine AS app
ENV NODE_ENV=production
WORKDIR /app
# node_modules complet (inclut les dev deps — image de démo, pas optimisée).
COPY --from=deps /app/node_modules ./node_modules
COPY --from=server-build /app/server/dist ./server/dist
RUN mkdir -p /app/data/uploads
VOLUME /app/data/uploads
EXPOSE 4000
CMD ["node", "server/dist/index.js"]

# ---------- Image web (Nginx SPA + proxy /api et /uploads) ----------
FROM nginx:1.27-alpine AS web
COPY --from=client-build /app/client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
