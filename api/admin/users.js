import { kv } from "@vercel/kv";

export default async function handler(req, res){
  if(req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });

  const ADMIN_KEY = process.env.ADMIN_KEY;
  if(!ADMIN_KEY) return res.status(500).json({ ok:false, error:"ADMIN_KEY missing" });

  const { key } = req.body || {};
  if(key !== ADMIN_KEY) return res.status(401).json({ ok:false, error:"bad key" });

  // вернём список всех зарегистрированных юзеров
  const ids = await kv.smembers("users:all"); // массив строк userId

  return res.status(200).json({ ok:true, count: ids.length, ids });
}
