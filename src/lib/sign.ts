import { createHmac, randomBytes, randomUUID } from "node:crypto";

export function newSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** Delivers exactly the bytes we sign. */
export function signBody(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}
