// /api/stars/create-invoice.js
export default async function handler(req, res){
  if(req.method !== "POST"){
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try{
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if(!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");

    const { productId, userId } = req.body || {};
    if(!productId) throw new Error("productId is missing");
    if(!userId) throw new Error("userId is missing"); // будем передавать из клиента

    // Каталог Stars-товаров (цены в звёздах)
    const CATALOG = {
      chest_doctor: { title:"Сундук с доктором", desc:"Новый доктор (рандом).", stars: 25 },
      coins_1000:   { title:"+1000 монет",        desc:"Деньги на твои сомнительные решения.", stars: 15 },
      bio_10:       { title:"+10 биоматериала",   desc:"Свежак. Почти.", stars: 20 },
    };

    const item = CATALOG[productId];
    if(!item) throw new Error("Unknown productId: " + productId);

    // payload: зашьём userId + productId + nonce
    // (payload вернётся в successful_payment)
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    const payload = `stars|uid:${userId}|prod:${productId}|n:${nonce}`;

    const body = {
      title: item.title,
      description: item.desc,
      payload,
      currency: "XTR",
      prices: [{ label: item.title, amount: item.stars }],
      // provider_token НЕ отправляем для Stars
    };

    const tg = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(body)
    }).then(r=>r.json());

    if(!tg.ok) throw new Error(tg.description || "Telegram API error");

    return res.json({ ok:true, invoiceLink: tg.result });

  }catch(e){
    return res.status(200).json({ ok:false, error: e.message });
  }
}
