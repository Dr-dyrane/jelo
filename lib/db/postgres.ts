import 'server-only';

import postgres from 'postgres';

let client: ReturnType<typeof postgres> | undefined;

function connectionString() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
}

export function hasPostgresConfig() {
  return /^postgres(?:ql)?:\/\//.test(connectionString() ?? '');
}

export function getPostgresClient() {
  const configuredUrl = connectionString();

  if (!configuredUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL is required for Neon access.');
  }

  if (!client) {
    client = postgres(configuredUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return client;
}
