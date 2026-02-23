import crypto from "crypto";
import { kv } from "@vercel/kv";

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;

function parseQueryString(qs) {
  const params = new URLSearchParams(qs);
  const obj = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

// Telegram Mini Apps: validate initData server-side.
function checkTelegramInitData(initData, botToken, maxAgeSec = 24 * 3600) {
  const data = parseQueryString(initData);
  const receivedHash = data.hash;
  if (!receivedHash) return { ok: false, error: "no hash" };

  const authDate = Number(data.auth_date || 0);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!authDate || Math.abs(nowSec - authDate) > maxAgeSec) {
    return { ok: false, error: "auth_date expired" };
  }

  const keys = Object.keys(data).filter((k) => k !== "hash").sort();
  const dataCheckString = keys.map((k) => `${k}=${data[k]}`).join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(receivedHash, "hex");
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) return { ok: false, error: "bad hash" };

  let user = null;
  try {
    if (data.user) user = JSON.parse(data.user);
  } catch {
    return { ok: false, error: "bad user json" };
  }
  if (!user?.id) return { ok: false, error: "no user.id" };

  return { ok: true, userId: Number(user.id) };
}

export default async function handler(req, res) {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ error: "Server env missing: BOT_TOKEN" });
    }

    if (req.method !== "POST" && req.method !== "PUT") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};
    const initData = body.initData;
    if (!initData) return res.status(400).json({ error: "initData required" });

    const v = checkTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
    if (!v.ok) return res.status(401).json({ error: v.error });

    const userId = v.userId;
    const key = `state:${userId}`;

    if (req.method === "POST") {
      // LOAD
      const state = (await kv.get(key)) || null;
      return res.status(200).json({ state, updatedAt: null });
    }

    // SAVE
    const state = body.state;
    if (!state) return res.status(400).json({ error: "state required" });

    await kv.set(key, state);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
