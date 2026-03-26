import { Express } from "express";
import crypto from "crypto";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  const hashToVerify = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === hashToVerify;
}

export function setupAuth(app: Express) {
  return;
}
