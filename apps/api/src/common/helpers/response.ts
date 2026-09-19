import type { Response } from 'express';
import {
  DEFAULTS,
  ERROR_MESSAGES,
  type ApiFailure,
  type ApiFieldErrors,
  type ApiListSuccess,
  type ApiSuccess,
  type ErrorCode,
  type PaginationMeta,
} from '@blood/shared-types';

/**
 * Uniform success envelope: `{ success: true, data }`.
 * Lists add `meta` and never repurpose `data`.
 */
export const successResponse = <T>(data: T): ApiSuccess<T> => ({
  success: true,
  data,
});

export const listResponse = <T>(
  data: T[],
  meta: PaginationMeta,
): ApiListSuccess<T> => ({
  success: true,
  data,
  meta,
});

/** Uniform failure envelope: `{ success: false, error: { code, message, fields } }`. */
export const failureResponse = (
  code: ErrorCode,
  message?: string,
  fields: ApiFieldErrors | null = null,
): ApiFailure => ({
  success: false,
  error: { code, message: message ?? ERROR_MESSAGES[code], fields },
});

export interface PaginationInput {
  page?: number | undefined;
  limit?: number | undefined;
}

export interface ResolvedPagination extends PaginationMeta {
  skip: number;
  take: number;
}

/** Validates and clamps pagination input so every list endpoint behaves alike. */
export function resolvePagination(
  input: PaginationInput = {},
): ResolvedPagination {
  const page = clampInteger(input.page, DEFAULTS.paginationPage, 1);
  const limit = clampInteger(
    input.limit,
    DEFAULTS.paginationLimit,
    1,
    DEFAULTS.paginationMaxLimit,
  );
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    total: 0,
    totalPages: 0,
  };
}

export function paginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

/** Builds the `fields` payload for VALIDATION_ERROR responses. */
export const zodFields = (
  issues: readonly { path: PropertyKey[]; message: string }[],
): ApiFieldErrors => {
  const fields: ApiFieldErrors = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join('.') || '_';
    if (!(path in fields)) fields[path] = issue.message;
  }
  return fields;
};

export const sendSuccess = <T>(res: Response, data: T, status = 200): void => {
  res.status(status).json(successResponse(data));
};

export const sendCreated = <T>(res: Response, data: T): void => {
  sendSuccess(res, data, 201);
};

export const sendList = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
): void => {
  res.status(200).json(listResponse(data, paginationMeta(page, limit, total)));
};

function clampInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max?: number,
): number {
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return fallback;
  }
  if (value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}
