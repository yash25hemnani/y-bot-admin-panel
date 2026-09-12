import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { logger } from "../utils/logger";

export const validate =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      return next();
    } catch (err: any) {
      logger.error(err);
      return res.status(400).json({
        error: "Validation failed",
        details: err.errors,
      });
    }
  };