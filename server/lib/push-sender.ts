/**
 * Web Push Notifications — web-push library (encrypted payload)
 * Uses web-push npm package for RFC 8291-compliant AES-128-GCM payload encryption.
 * VAPID keys auto-generated on first startup and stored in app_config table.
 */
import crypto from "crypto";
import { pool } from "../db";

export interface PushSubscription {
  endpoint: string;
  keys: { auth: string; p256dh: string };
}

export interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
}

interface VapidKeys {
  publicKey: string;  // base64url, 65-byte uncompressed P-256 point
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

  // Generate using web-push (VAPID spec)
  try {
    const wp: any = await import("web-push");
    const webpush = wp.default ?? wp;
    const keys = webpush.generateVAPIDKeys();
    _cachedKeys = { publicKey: keys.publicKey, privateKey: keys.privateKey };
  } catch {
    // Fallback: generate with Node.js native crypto
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.generateKeys();
    _cachedKeys = {
      publicKey: ecdh.getPublicKey().toString("base64url"),
      privateKey: ecdh.getPrivateKey().toString("base64url"),
    };
  }

  try {
    await pool.query(
      `INSERT INTO app_config (key, value) VALUES ('vapid_keys', $1)
       ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify(_cachedKeys)],
    );
  } catch {}

  return _cachedKeys!;
}

export async function getVapidPublicKey(): Promise<string> {
  const k = await getOrCreateVapidKeys();
  return k.publicKey;
}

// ── Send a push notification with encrypted payload (RFC 8291) ──────────────
export async function sendWebPush(sub: PushSubscription, payload?: PushPayload): Promise<void> {
  try {
    const keys = await getOrCreateVapidKeys();
    const wp: any = await import("web-push");
    const webpush = wp.default ?? wp;

    webpush.setVapidDetails("mailto:info@oyoplast.com", keys.publicKey, keys.privateKey);

    const data = {
      title: payload?.title || "أويو بلاست",
      body: payload?.body || "لديك إشعار جديد",
      icon: payload?.icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      url: payload?.url || "/",
      dir: "rtl",
      lang: "ar",
    };

    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { auth: sub.keys.auth, p256dh: sub.keys.p256dh },
      },
      JSON.stringify(data),
      { TTL: 86400, urgency: "normal" },
    );
  } catch (e: any) {
    const msg: string = e?.message || String(e);
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE endpoint=$1`,
        [sub.endpoint],
      ).catch(() => {});
      console.info("[push] removed expired subscription");
    } else {
      console.warn("[push] send error:", msg.slice(0, 120));
    }
  }
}

// ── Send push to every subscription of a user ──────────────────────────────
export async function sendPushToUser(userId: string, payload?: PushPayload): Promise<void> {
  try {
    const r = await pool.query(
      `SELECT endpoint, auth_key, p256dh_key FROM push_subscriptions WHERE user_id=$1`,
      [userId],
    );
    if (!r.rows.length) return;
    await Promise.allSettled(
      r.rows.map((row) =>
        sendWebPush(
          { endpoint: row.endpoint, keys: { auth: row.auth_key, p256dh: row.p256dh_key } },
          payload,
        ),
      ),
    );
  } catch (e) {
    console.warn("[push] sendPushToUser error:", (e as Error).message);
  }
}
