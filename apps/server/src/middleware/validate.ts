import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/AppError.js';

type Part = 'params' | 'query' | 'body';
type Schemas = Partial<Record<Part, z.ZodType>>;

export interface ValidationIssue {
  location: Part;
  path: string;
  message: string;
}

const PARTS: Part[] = ['params', 'query', 'body'];

/**
 * Validates req.params / req.query / req.body with Zod and replaces them with the
 * parsed values (coerced, defaults applied, unknown keys stripped).
 * Controllers type their request with z.infer<typeof schema> of the same schema.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const issues: ValidationIssue[] = [];
    const parsed: Partial<Record<Part, unknown>> = {};

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (result.success) {
        parsed[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({
            location: part,
            path: issue.path.map(String).join('.'),
            message: issue.message,
          });
        }
      }
    }

    if (issues.length > 0) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request', issues));
      return;
    }

    if ('body' in parsed) req.body = parsed.body;
    if ('params' in parsed) req.params = parsed.params as Request['params'];
    if ('query' in parsed) {
      // Express 5: req.query is a getter on the prototype, so plain assignment fails.
      // Define an own property on this request instance instead.
      Object.defineProperty(req, 'query', {
        value: parsed.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  };
}
