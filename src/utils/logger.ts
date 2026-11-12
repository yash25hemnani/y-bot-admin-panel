import pino from "pino";

// Pretty output locally; plain JSON in production (pino-pretty is a dev dependency)
export const logger = pino(
  process.env.NODE_ENV === "production"
    ? {}
    : { transport: { target: "pino-pretty" } },
);
