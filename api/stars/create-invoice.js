export default async function handler(req, res){

  if(req.method !== "POST"){
    return res.status(405).json({ ok:false });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;

  try{
    const { productId } = req.body;

    const prices = [{
      label: "Legendary Chest",
      amount: 25
    }];

    const tg = await fetch(
      `https://api.telegram.org/bot${8336464311:AAGhKAYMDjDAg-tdVPHQWBOgG6IwJo2TM9g}/createInvoiceLink`,
      {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          title: "Легендарный сундук",
          description: "Очень редкая штука",
          payload: `stars:${productId}:${Date.now()}`,
          currency: "XTR",
          prices,
          provider_token: ""
        })
      }
    ).then(r=>r.json());

    if(!tg.ok) throw new Error(tg.description);

    res.json({
      ok:true,
      invoiceLink: tg.result
    });

  }catch(e){
    res.json({
      ok:false,
      error: e.message
    });
  }
}
