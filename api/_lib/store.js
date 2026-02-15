export async function loadUserState(userId){
  const key = `state:${userId}`;
  const s = await kv.get(key);
  return s || null;
}

export async function saveUserState(userId, state){
  const key = `state:${userId}`;
  await kv.set(key, state);
}

export async function markTxProcessed(txId){
  // чтобы не выдать награду дважды
  const key = `starsTx:${txId}`;
  const exists = await kv.get(key);
  if(exists) return false;
  await kv.set(key, 1);
  return true;
}
