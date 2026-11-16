import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { prisma } from './lib/prisma.js';

const env = loadEnv();
const app = createApp(prisma);

const server = app.listen(env.port, () => {
  console.log(`SmartChain Modular Monolith API listening on http://localhost:${env.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; shutting down SmartChain API...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
