function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  betterAuthSecret: required("BETTER_AUTH_SECRET"),
  betterAuthUrl: process.env.BETTER_AUTH_URL?.trim() || `http://localhost:${process.env.PORT ?? 8080}`,
  webAppUrl: process.env.WEB_APP_URL?.trim() || "http://localhost:3000",
};
