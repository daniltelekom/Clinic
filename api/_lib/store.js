import { kv } from "@vercel/kv";

export async function loadState(userId){
  return (await kv.get(`state:${userId}`)) || null;
}

export async function saveState(userId, state){
  await kv.set(`state:${userId}`, state);

  // ✅ регистрируем пользователя в общем списке
  await kv.sadd("users:all", String(userId));
}

export async function saveStarsPayment(txId, data){
  await kv.set(`starsPay:${txId}`, data);
}

export async function loadStarsPayment(txId){
  return (await kv.get(`starsPay:${txId}`)) || null;
}

// защита от двойной выдачи Stars
export async function markTxProcessed(txId){
  const key = `starsTx:${txId}`;
  const exists = await kv.get(key);

  if (exists) return false;

  await kv.set(key, 1);
  return true;
}
