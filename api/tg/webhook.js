// /api/tg/webhook.js
import { loadUserState, saveUserSta8from "./_lib/store.js";

const CATALOG = {
  chest_doctor: { stars: 25 },
  coins_1000:   { stars: 15 },
  bio_10:       { stars: 20 },
};

// Подстрой под свои реальные id докторов (те, что у тебя уже есть в state)
// Если у тебя доктора хранятся иначе, поменяешь 2 строчки в grantDoctorRandom().
const DOCTOR_POOL = [
  "doc_plague", "doc_herbal", "doc_surgeon", "doc_priest", "doc_alchemist"
];

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

function ensureBasics(state){
  state.coins = Number(state.coins || 0);
  state.biomaterial = Number(state.biomaterial || 0);
  state.doctorsOwned = state.doctorsOwned || {}; // если у тебя иначе, поправишь тут
}

function grantDoctorRandom(state){
  const id = pickRandom(DOCTOR_POOL);
  state.doctorsOwned[id] = true;
  return id;
}

async function grantProduct(userId, productId){
  const s = await loadUserState(userId);
  if(!s) throw new Error("User state not found for uid=" + userId);

  ensureBasics(s);

  if(productId === "coins_1000"){
    s.coins += 1000;
  } else if(productId === "bio_10"){
    s.biomaterial += 10;
  } else if(productId === "chest_doctor"){
    grantDoctorRandom(s);
  } else {
    throw new Error("Unknown productId for grant: " + productId);
  }

  await saveUserState(userId, s);
}

export default async function handler(req, res){
  if(req.method !== "POST"){
    return res.status(405).send("Method not allowed");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if(!BOT_TOKEN) return res.status(500).send("BOT_TOKEN missing");

  try{
    const update = req.body || {};

    // 1) pre_checkout_query надо подтверждать
    if(update.pre_checkout_query){
      const q = update.pre_checkout_query;

      // Можно тут дополнительно валидировать payload/сумму
      const ok = true;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          pre_checkout_query_id: q.id,
          ok,
          error_message: ok ? undefined : "Payment rejected"
        })
      });

      return res.status(200).json({ ok:true });
    }

    // 2) успешная оплата
    const msg = update.message;
    const pay = msg?.successful_payment;
    if(pay){
      // Защита от двойной выдачи
      // В successful_payment есть telegram_payment_charge_id
      const txId = pay.telegram_payment_charge_id || pay.provider_payment_charge_id;
      if(!txId) throw new Error("txId missing in successful_payment");

      const firstTime = await markTxProcessed(txId);
      if(!firstTime){
        // уже обработали
        return res.status(200).json({ ok:true, duplicate:true });
      }

      const parsed = parsePayload(pay.invoice_payload);
      if(!parsed) throw new Error("Bad payload: " + pay.invoice_payload);

      const { userId, productId } = parsed;

      // Проверим валюту и сумму
      if(pay.currency !== "XTR") throw new Error("Unexpected currency: " + pay.currency);

      const expected = CATALOG[productId]?.stars;
      if(!expected) throw new Error("Unknown product in payment: " + productId);

      if(Number(pay.total_amount) !== Number(expected)){
        throw new Error(`Bad amount: got ${pay.total_amount}, expected ${expected}`);
      }

      // Выдача товара
      await grantProduct(userId, productId);

      return res.status(200).json({ ok:true, granted:true });
    }

    return res.status(200).json({ ok:true, ignored:true });

  }catch(e){
    console.log("WEBHOOK ERROR:", e);
    return res.status(200).json({ ok:false, error: e.message });
  }
}
