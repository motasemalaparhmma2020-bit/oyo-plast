/**
 * Web Push Notifications — Native VAPID Implementation
 * Uses Node.js built-in `crypto` (P-256 / ES256) — no external packages needed.
 * Push messages are payload-less (wake-up signal). The SW shows default Arabic notification.
 * When web-push package becomes available, swap sendWebPush() body with webpush.sendNotification().
 */
import crypto from "crypto";
import { pool } from "../db";

export interface PushSubscription {
  endpoint: string;
  keys: { auth: string; p256dh: string };
}

interface VapidKeys {
  publicKey: string;  // base64url, 65-byte uncompressed P-256 point (04 || x || y)
  privateKey: string; // base64url, 32-byte EC scalar
}

let _cachedKeys: VapidKeys | null = null;

// ── VAPID key lifecycle ─────────────────────────────────────────────────────
export async function getOrCreateVapidKeys(): Promise<VapidKeys> {
  if (_cachedKeys) return _cachedKeys;

  try {
    const r = await pool.query(
      `SELECT value FROM app_config WHERE key='vapid_keys' LIMIT 1`,
    );
    if (r.rows.length > 0) {
      _cachedKeys = JSON.parse(r.rows[0].value) as VapidKeys;
      return _cachedKeys;
    }
  } catch {}

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();

  const keys: VapidKeys = {
    publicKey: ecdh.getPublicKey().toString("base64url"),   // 65 bytes
    privateKey: ecdh.getPrivateKey().toString("base64url"), // 32 bytes
  };

  try {
    await pool.query(
      `INSERT INTO app_config (key, value) VALUES ('vapid_keys', $1)
       ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify(keys)],
    );
  } catch {}

  _cachedKeys = keys;
  return keys;
}

export async function getVapidPublicKey(): Promise<string> {
  const k = await getOrCreateVapidKeys();
  return k.publicKey;
}

// ── VAPID JWT (ES256 / P-256) ───────────────────────────────────────────────
function buildVapidJWT(privB64: string, pubB64: string, audience: string): string {
  const hdr = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const pld = Buffer.from(JSON.stringify({
    aud: audience,
    exp: now + 43_200, // 12h
    sub: "mailto:info@oyoplast.com",
  })).toString("base64url");

  const unsigned = `${hdr}.${pld}`;

  const pubRaw = Buffer.from(pubB64, "base64url"); // 65 bytes: 04 || x || y
  const jwk = {
    kty: "EC", crv: "P-256",
    d: privB64,
    x: pubRaw.slice(1, 33).toString("base64url"),
    y: pubRaw.slice(33, 65).toString("base64url"),
  };
  const privKey = crypto.createPrivateKey({ key: jwk as any, format: "jwk" });

  const signer = crypto.createSign("SHA256");
  signer.update(unsigned);
  const der = signer.sign(privKey);

  // DER → raw r‖s (64 bytes)
  // SEQUENCE: 30 LL, then INTEGER: 02 LL [00?] r, then INTEGER: 02 LL [00?] s
  // P-256 max total length ≤ 72 bytes — always short form (single-byte length)
  let off = 2; // skip 0x30 (SEQUENCE tag) + 1-byte length
  off++;        // skip 0x02 (INTEGER tag)
  const rLen = der[off++];
  const r = der.slice(off, off + rLen); off += rLen;
  off++;        // skip 0x02 (INTEGER tag)
  const sLen = der[off++];
  const s = der.slice(off, off + sLen);

  // Remove potential 0x00 sign-extension prefix that DER adds when MSB is 1
  const rClean = r.length > 32 ? r.slice(r.length - 32) : r;
  const sClean = s.length > 32 ? s.slice(s.length - 32) : s;

  const rBuf = Buffer.alloc(32); rClean.copy(rBuf, 32 - rClean.length);
  const sBuf = Buffer.alloc(32); sClean.copy(sBuf, 32 - sClean.length);

  return `${unsigned}.${Buffer.concat([rBuf, sBuf]).toString("base64url")}`;
}

// ── Send a single payload-less push (wake-up signal) ───────────────────────
export async function sendWebPush(sub: PushSubscription): Promise<void> {
  try {
    const keys = await getOrCreateVapidKeys();
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = buildVapidJWT(keys.privateKey, keys.publicKey, audience);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt},k=${keys.publicKey}`,
        TTL: "86400",
        Urgency: "normal",
      },
    });

    if (res.status === 404 || res.status === 410) {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE endpoint=$1`,
        [sub.endpoint],
      ).catch(() => {});
      console.info("[push] removed expired subscription");
    } else if (!res.ok && res.status !== 201) {
      const txt = await res.text().catch(() => "");
      console.warn(`[push] ${res.status}:`, txt.slice(0, 120));
    }
  } catch (e) {
    console.warn("[push] send error:", (e as Error).message?.slice(0, 80));
  }
}

// ── Send push to every subscription of a user ──────────────────────────────
export async function sendPushToUser(userId: string): Promise<void> {
  try {
    const r = await pool.query(
      `SELECT endpoint, auth_key, p256dh_key FROM push_subscriptions WHERE user_id=$1`,
      [userId],
    );
    if (!r.rows.length) return;
    await Promise.allSettled(
      r.rows.map((row) =>
        sendWebPush({ endpoint: row.endpoint, keys: { auth: row.auth_key, p256dh: row.p256dh_key } }),
      ),
    );
  } catch (e) {
    console.warn("[push] sendPushToUser error:", (e as Error).message);
  }
}
