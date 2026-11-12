require("dotenv").config();

// sequelize-cli picks the block named by NODE_ENV.
// Neon provides one connection string (DATABASE_URL, needs SSL); otherwise use the DB_* parts.
const db = process.env.DATABASE_URL
  ? {
      use_env_variable: "DATABASE_URL",
      dialect: "postgres",
      dialectOptions: { ssl: { require: true } },
    }
  : {
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      dialect: "postgres",
    };

module.exports = {
  dev: db,
  prod: db,
  production: db,
};
