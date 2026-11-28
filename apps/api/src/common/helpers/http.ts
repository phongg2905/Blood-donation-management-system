import { z } from 'zod';
import { parseDomain } from './domain-validation';
import type { Request } from 'express';

/** `:id`-style params are never repeated in this app's routes, so this is always a single string despite Express typing params as `string | string[]`. */
export function paramId(req: Request, name = 'id'): string {
  const value = req.params[name];
  return parseDomain(z.object({ [name]: z.string().uuid() }), {
    [name]: Array.isArray(value) ? value[0] : value,
  })[name]!;
}
