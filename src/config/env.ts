import dotenv from "dotenv";

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env variable: ${key}`);
  }
  return value;
}

export const ENV = {
  PORT: Number(process.env.PORT || 4000),
  NODE_ENV: required("NODE_ENV"),

  JWT: {
    ACCESS_SECRET: required("ACCESS_SECRET"),
    REFRESH_SECRET: required("REFRESH_SECRET"),
  },

  // Neon provides one connection string (DATABASE_URL); without it, use the separate DB_* parts
  DB: process.env.DATABASE_URL
    ? { URL: process.env.DATABASE_URL }
    : {
        URL: undefined,
        HOST: required("DB_HOST"),
        PORT: Number(required("DB_PORT")),
        NAME: required("DB_NAME"),
        USER: required("DB_USER"),
        PASS: required("DB_PASS"),
      },
} as const;
