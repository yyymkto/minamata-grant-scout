import { bytesToHex } from "./crypto";

const PBKDF2_ITERATIONS = 310000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_ALGORITHM = "PBKDF2";
const PBKDF2_HASH = "SHA-256";

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("invalid hex");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

async function derivePbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    PBKDF2_ALGORITHM,
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: PBKDF2_ALGORITHM,
      hash: PBKDF2_HASH,
      salt: toArrayBuffer(salt),
      iterations,
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );
  return bytesToHex(new Uint8Array(bits));
}

// Legacy salt:sha256 format support was removed on 2026-03-11.
// All passwords were upgraded to PBKDF2-SHA256 on login.
// If any legacy hashes remain in the DB, users must use password reset.

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${hashHex}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [scheme, iterationRaw, saltHex, hashHex] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterationRaw || !saltHex || !hashHex) {
    return false;
  }

  const iterations = Number.parseInt(iterationRaw, 10);
  if (!Number.isFinite(iterations) || iterations < 100000) return false;

  const salt = hexToBytes(saltHex);
  const computedHex = await derivePbkdf2(password, salt, iterations);
  return constantTimeEquals(hashHex, computedHex);
}
