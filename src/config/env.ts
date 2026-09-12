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

  DB: {
    HOST: required("DB_HOST"),
    PORT: Number(required("DB_PORT")),
    NAME: required("DB_NAME"),
    USER: required("DB_USER"),
    PASS: required("DB_PASS"),
  },
} as const;
