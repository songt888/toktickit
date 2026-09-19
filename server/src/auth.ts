import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { PrismaClient, UserRole } from "@prisma/client";
import { getPrisma } from "./prisma.js";

export const SESSION_COOKIE_NAME = "toktickit_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const AUTH_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
} as const;

export type SafeUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
};

export type AuthenticatedRequest = Request & {
  authUser?: SafeUser;
};

export function toSafeUser(user: SafeUser): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required.";
  if (password.length < 12 || password.length > 128) {
    return "Password must be between 12 and 128 characters.";
  }
  if (!/\S/.test(password)) return "Password cannot be whitespace only.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  return null;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function sessionTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readSessionToken(request: Request): string | null {
  const cookieHeader = request.header("Cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value) || null;
    } catch {
      return null;
    }
  }

  return null;
}

export function hasSessionCookie(request: Request): boolean {
  const cookieHeader = request.header("Cookie");
  return Boolean(
    cookieHeader?.split(";").some((part) => part.trim().startsWith(`${SESSION_COOKIE_NAME}=`)),
  );
}

function sessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function setSessionCookie(response: Response, token: string): void {
  response.setHeader("Set-Cookie", sessionCookie(token, SESSION_TTL_MS / 1000));
}

export function clearSessionCookie(response: Response): void {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}

export async function createSession(
  database: Pick<PrismaClient, "authSession">,
  userId: number,
  response: Response,
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await database.authSession.create({
    data: {
      userId,
      tokenHash: sessionTokenHash(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  setSessionCookie(response, token);
}

export async function getSessionUser(
  database: Pick<PrismaClient, "authSession">,
  request: Request,
): Promise<SafeUser | null> {
  const token = readSessionToken(request);
  if (!token) return null;

  const session = await database.authSession.findUnique({
    where: { tokenHash: sessionTokenHash(token) },
    include: { user: { select: AUTH_USER_SELECT } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;

  if (!session.user.isActive) {
    await database.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  return toSafeUser(session.user);
}

export async function revokeCurrentSession(
  database: Pick<PrismaClient, "authSession">,
  request: Request,
): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;

  await database.authSession.updateMany({
    where: {
      tokenHash: sessionTokenHash(token),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export function requireSession(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): void {
  void getSessionUser(getPrisma(), request)
    .then((user) => {
      if (!user) {
        response.status(401).json({ error: "Authentication required" });
        return;
      }
      request.authUser = user;
      response.locals.authUser = user;
      next();
    })
    .catch(() => response.status(500).json({ error: "Unable to validate session" }));
}

export function requirePasswordChangeComplete(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): void {
  if (request.authUser?.mustChangePassword) {
    response.status(403).json({ error: "Password change required" });
    return;
  }
  next();
}

export function allowedOrigins(): Set<string> {
  const configured = process.env.CLIENT_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean);
  return new Set(configured?.length ? configured : ["http://localhost:5173", "http://127.0.0.1:5173"]);
}

export function hasAllowedOrigin(request: Request): boolean {
  const origin = request.header("Origin");
  return !origin || allowedOrigins().has(origin);
}
