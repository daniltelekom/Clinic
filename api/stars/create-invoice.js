export default async function handler(req, res){
  if(req.method !== "POST"){
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try{
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if(!BOT_TOKEN) return res.status(500).json({ ok:false, error:"BOT_TOKEN is missing" });

    const { productId } = req.body || {};
    if(!productId) return res.status(400).json({ ok:false, error:"productId is required" });

    // мини-каталог (потом расширишь)
    const CATALOG = {
      chest_doctors_stars: { title:"Сундук с доктором", desc:"Новый доктор или редкий бонус.", stars:25 },
      coins_pack_s:        { title:"Монеты: мешок",      desc:"+1000 монет",                stars:15 },
      bio_pack_s:          { title:"Биоматериал: ящик",  desc:"+10 биоматериала",           stars:20 },
    };

    const item = CATALOG[productId];
    if(!item) return res.status(400).json({ ok:false, error:"Unknown productId" });

    const prices = [{ label: item.title, amount: item.stars }]; // XTR: amount = Stars

    const tgResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        title: item.title,
        description: item.desc,
        payload: `stars:${productId}:${Date.now()}`,
        currency: "XTR",
        prices
        // provider_token для Stars НЕ нужен, оставляем пустым/убираем
      })
    });

    const tg = await tgResp.json();
    if(!tg.ok) throw new Error(tg.description || "Telegram error");

    return res.json({ ok:true, invoiceLink: tg.result });

  }catch(e){
    return res.status(500).json({ ok:false, error: String(e.message || e) });
  }
}
