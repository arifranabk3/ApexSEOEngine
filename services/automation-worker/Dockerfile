FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY services ./services

ENV NODE_ENV=production
ENV WORKER_PORT=4100
ENV DISABLE_EMBEDDED_PGLITE=true

EXPOSE 4100

CMD ["npx", "tsx", "services/automation-worker/worker-server.ts"]

