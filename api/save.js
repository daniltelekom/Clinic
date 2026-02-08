import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function parseQueryString(qs) {
  const params = new URLSearchParams(qs);
  const obj = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

// Telegram Mini Apps: validate initData server-side. 4
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

async function sb(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

export default async function handler(req, res) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Server env missing" });
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

    if (req.method === "POST") {
      // LOAD
      const url = `${SUPABASE_URL}/rest/v1/saves?user_id=eq.${userId}&select=state_json,updated_at`;
      const r = await sb(url, { method: "GET" });
      if (!r.ok) return res.status(r.status).json({ error: r.text });

      const rows = JSON.parse(r.text);
      const row = rows?.[0] || null;
      return res.status(200).json({ state: row?.state_json || null, updatedAt: row?.updated_at || null });
    }

    // SAVE
    const state = body.state;
    if (!state) return res.status(400).json({ error: "state required" });

    const url = `${SUPABASE_URL}/rest/v1/saves?on_conflict=user_id`;
    const r = await sb(url, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        state_json: state,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!r.ok) return res.status(r.status).json({ error: r.text });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
