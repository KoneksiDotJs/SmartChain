FROM node:24-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --workspace=apps/web --include-workspace-root

COPY apps/web ./apps/web

RUN npm --workspace=apps/web run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --omit=dev --workspace=apps/web --include-workspace-root

COPY --from=builder --chown=node:node /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=node:node /app/apps/web/next.config.ts ./apps/web/next.config.ts
COPY --from=builder --chown=node:node /app/apps/web/package.json ./apps/web/package.json

RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["npm", "--workspace=apps/web", "run", "start"]
