import { loadState, saveState, markTxProcessed } from "../_lib/store.js";

const CATALOG = {
  chest_doctor: { stars: 25 },
  coins_1000:   { stars: 15 },
  bio_10:       { stars: 20 },
};

// TODO: подставь реальные id докторов из твоей игры
const DOCTOR_POOL = ["doc_plague", "doc_herbal", "doc_surgeon", "doc_priest", "doc_alchemist"];

function parsePayload(payload){
  // stars|uid:123|prod:coins_1000|n:abc
  const parts = String(payload || "").split("|");
  if(parts[0] !== "stars") return null;

  const map = {};
  for(const p of parts.slice(1)){
    const [k,v] = p.split(":");
    map[k] = v;
  }
  if(!map.uid || !map.prod) return null;

  return { userId: map.uid, productId: map.prod };
}

function pickRandom(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function ensureStateShape(s){
  s.coins = Number(s.coins || 0);
  s.biomaterial = Number(s.biomaterial || 0);
  s.doctorsOwned = s.doctorsOwned || {};
}

function grantDoctorRandom(s){
  const id = pickRandom(DOCTOR_POOL);
  s.doctorsOwned[id] = true;
  return id;
}

async function grantProduct(userId, productId){
  const s = await loadState(userId);
  if(!s) throw new Error("State not found for userId=" + userId);

  ensureStateShape(s);

  if(productId === "coins_1000") s.coins += 1000;
  else if(productId === "bio_10") s.biomaterial += 10;
  else if(productId === "chest_doctor") grantDoctorRandom(s);
  else throw new Error("Unknown productId: " + productId);

  await saveState(userId, s);
}

export default async function handler(req, res){
  if(req.method !== "POST") return res.status(405).send("POST only");

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if(!BOT_TOKEN) return res.status(500).send("BOT_TOKEN missing");

  try{
    const update = req.body || {};

    // 1) pre_checkout_query надо подтверждать
    if(update.pre_checkout_query){
      const q = update.pre_checkout_query;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ pre_checkout_query_id: q.id, ok: true })
      });

      return res.status(200).json({ ok:true, step:"pre_checkout_ok" });
    }

    // 2) successful_payment -> выдаём
    const pay = update?.message?.successful_payment;
    if(pay){
      const txId = pay.telegram_payment_charge_id || pay.provider_payment_charge_id;
      if(!txId) throw new Error("txId missing");

      const first = await markTxProcessed(txId);
      if(!first) return res.status(200).json({ ok:true, duplicate:true });

      const parsed = parsePayload(pay.invoice_payload);
      if(!parsed) throw new Error("Bad payload: " + pay.invoice_payload);

      const { userId, productId } = parsed;

      if(pay.currency !== "XTR") throw new Error("Bad currency: " + pay.currency);

      const expected = CATALOG[productId]?.stars;
      if(!expected) throw new Error("Unknown product in payment: " + productId);

      if(Number(pay.total_amount) !== Number(expected)){
        throw new Error(`Bad amount: got ${pay.total_amount}, expected ${expected}`);
      }

      await grantProduct(userId, productId);

      return res.status(200).json({ ok:true, granted:true, productId, userId });
    }

    return res.status(200).json({ ok:true, ignored:true });

  }catch(e){
    console.log("WEBHOOK ERROR:", e);
    return res.status(200).json({ ok:false, error:e.message });
  }
}
