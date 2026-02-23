import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    const ADMIN_KEY = process.env.ADMIN_KEY;
    if (!ADMIN_KEY) throw new Error("ADMIN_KEY is missing in env");

    const { key, userId, coins = 0, biomaterial = 0 } = req.body || {};
    if (key !== ADMIN_KEY) return res.status(403).json({ ok: false, error: "Forbidden" });

    const uid = Number(userId);
    if (!uid) return res.status(400).json({ ok: false, error: "userId required" });

    const stateKey = `state:${uid}`;
    let s = (await kv.get(stateKey)) || { coins: 0, biomaterial: 0, doctorsOwned: {} };

    // нормализуем форму
    s.coins = Number(s.coins || 0);
    s.biomaterial = Number(s.biomaterial || 0);
    s.doctorsOwned = s.doctorsOwned || {};

    s.coins += Number(coins || 0);
    s.biomaterial += Number(biomaterial || 0);

    await kv.set(stateKey, s);

    return res.status(200).json({ ok: true, userId: uid, state: s });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e?.message || String(e) });
  }
}
