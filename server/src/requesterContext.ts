import { Request } from "express";

export const REQUESTER_CONTEXT_ERROR = "Requester context is required";

export function parseRequesterId(request: Request): number | null {
  const header = request.header("X-Requester-Id");
  if (!header) return null;

  const value = header.trim();
  if (!/^\d+$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
