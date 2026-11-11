"use client";
import { useEffect, useState } from "react";

declare global { 
  interface Window { 
    PaystackPop: any 
  } 
}

export default function BuyKeys(){
  const [ready, setReady] = useState(false);
  
  useEffect(()=>{
    // Load Paystack script
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = ()=> setReady(true);
    document.body.appendChild(script);

    return ()=>{
      // cleanup
      try { document.body.removeChild(script); } catch {}
    }
  },[]);

  const pay = (keys:number, rand:number)=>{
    if(!ready || !window.PaystackPop){
      alert("Paystack still loading... wait 2 seconds and try again");
      return;
    }

    if(!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY){
      alert("Missing Paystack Public Key in Vercel envs");
      return;
    }
    
    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: `user${Date.now()}@loomilive.com`,
      amount: rand * 100, // Paystack uses kobo/cents: R100 = 10000
      currency: "ZAR",
      ref: `LOOMI-${Date.now()}`,
      metadata: { 
        custom_fields: [
          { display_name: "Product", variable_name: "product", value: `${keys} Loomi Keys` },
          { display_name: "App", variable_name: "app", value: "Loomi Live" }
        ] 
      },
      callback: function(response:any){ 
        console.log("Payment ref:", response.reference);
        const current = parseInt(localStorage.getItem("loomi_keys") || "0");
        const total = current + keys;
        localStorage.setItem("loomi_keys", String(total)); 
        alert(`✅ Added ${keys} Loomi Keys! Ref: ${response.reference}`); 
        window.location.href="/"; 
      },
      onClose: function(){ 
        console.log("Payment window closed");
      }
    }); 

    handler.openIframe();
  };

  return(
    <div className="min-h-screen bg-black text-white max-w-[430px] mx-auto p-6">
      <div className="mt-2">
        <h1 className="text-2xl font-bold">Get Loomi Keys 🔑</h1>
        <p className="text-zinc-400 text-sm mt-1">Unlock Mansion VIP & Premium Stickers</p>
      </div>

      <div className="mt-6 space-y-3">
        <button 
          onClick={()=>pay(100,100)} 
          className="w-full bg-zinc-900 p-4 rounded-xl flex justify-between items-center border border-zinc-800 active:scale-[0.98] transition"
        >
          <span className="font-medium">100 Keys</span>
          <b className="text-lg">R100</b>
        </button>

        <button 
          onClick={()=>pay(320,280)} 
          className="w-full bg-white text-black p-4 rounded-xl flex justify-between items-center font-bold border-2 border-yellow-400 active:scale-[0.98] transition shadow-[0_0_20px_rgba(250,204,21,0.3)]"
        >
          <span>320 Keys +20 Bonus 🔥 Most Popular</span>
          <b className="text-lg">R280</b>
        </button>

        <button 
          onClick={()=>pay(1100,900)} 
          className="w-full bg-zinc-900 p-4 rounded-xl flex justify-between items-center border border-zinc-800 active:scale-[0.98] transition"
        >
          <span className="font-medium">1100 Keys +100 Bonus</span>
          <b className="text-lg">R900</b>
        </button>
      </div>

      <div className="mt-8 text-center">
        {!ready ? (
          <p className="text-xs text-yellow-400 animate-pulse">Loading Paystack secure checkout...</p>
        ) : (
          <p className="text-xs text-green-400">✅ Paystack ready - Pay with Card, EFT, Scan to Pay</p>
        )}
      </div>

      <p className="text-[11px] text-zinc-500 mt-6 text-center leading-relaxed">
        Secure payment via Paystack<br/>
        Purchase of virtual Loomi Keys, not adult content<br/>
        Keys are non-refundable virtual currency for Loomi Live
      </p>

      <button 
        onClick={()=> window.location.href="/"} 
        className="w-full mt-8 text-sm text-zinc-400 underline"
      >
        ← Back to Live
      </button>
    </div>
  )
}
