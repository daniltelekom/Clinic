import { kv } from "@vercel/kv";

export async function loadState(userId){
  return (await kv.get(`state:${userId}`)) || null;
}

export async function saveState(userId, state){
  await kv.set(`state:${userId}`, state);
}

// защита от двойной выдачи (одну оплату обработать 1 раз)
export async function markTxProcessed(txId){
  const key = `starsTx:${txId}`;
  const exists = await kv.get(key);
  if(exists) return false;
  await kv.set(key, 1);
  return true;
}
