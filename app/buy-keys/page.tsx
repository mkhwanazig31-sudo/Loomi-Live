"use client";
import { useEffect, useState } from "react";
declare global { interface Window { PaystackPop: any } }

export default function BuyKeys(){
  const [ready, setReady] = useState(false);
  useEffect(()=>{
    const s=document.createElement("script");
    s.src="https://js.paystack.co/v1/inline.js";
    s.onload=()=>setReady(true);
    document.body.appendChild(s);
  },[]);

  const pay = (keys:number, rand:number)=>{
    if(!ready) return alert("Loading...");
    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: `user${Date.now()}@loomilive.com`,
      amount: rand*100,
      currency: "ZAR",
      ref: `LOOMI-${Date.now()}`,
      metadata: { custom_fields: [{ display_name: "Loomi Keys", variable_name: "loomi_keys", value: `${keys}` }] },
      callback: (res:any)=>{
        const current = parseInt(localStorage.getItem("loomi_keys")||"0");
        localStorage.setItem("loomi_keys", String(current+keys));
        alert(`✅ Added ${keys} Keys! Ref: ${res.reference}`);
        window.location.href="/";
      },
      onClose: ()=>{}
    }); handler.openIframe();
  };

  return(
    <div className="min-h-screen bg-black text-white max-w-[430px] mx-auto p-6">
      <h1 className="text-2xl font-bold">Get Loomi Keys 🔑</h1>
      <p className="text-zinc-400 text-sm mt-1">Unlock Mansion VIP & Premium Stickers</p>
      <div className="mt-6 space-y-3">
        <button onClick={()=>pay(100,100)} className="w-full bg-zinc-900 p-4 rounded-xl flex justify-between border border-zinc-800"><span>100 Keys</span><b>R100</b></button>
        <button onClick={()=>pay(320,280)} className="w-full bg-white text-black p-4 rounded-xl flex justify-between font-bold border-2 border-yellow-400"><span>320 Keys +20 Bonus 🔥 Most Popular</span><b>R280</b></button>
        <button onClick={()=>pay(1100,900)} className="w-full bg-zinc-900 p-4 rounded-xl flex justify-between border border-zinc-800"><span>1100 Keys +100 Bonus</span><b>R900</b></button>
      </div>
      <p className="text-center text-xs mt-4">{ready ? "✅ Paystack ready - Card, EFT, Scan to Pay" : "Loading..."}</p>
      <p className="text-[11px] text-zinc-500 mt-6 text-center">Secure via Paystack • Virtual Loomi Keys</p>
      <button onClick={()=>window.location.href="/"} className="w-full mt-8 text-sm text-zinc-400 underline">← Back to Live</button>
    </div>
  )
}
