"use client";
import { useState } from "react";

export default function DevBoard() {
  const tasks = [
    { name: "Paystack ZAR Payments", status: "done", note: "✅ Working - tested R100" },
    { name: "Streaming UI Layout", status: "done", note: "✅ LIVE header, chat, gifts" },
    { name: "Keys Balance (localStorage)", status: "done", note: "✅ Shows 100-165 keys" },
    { name: "Mansion VIP Unlock (30 keys)", status: "done", note: "✅ Deducts keys + shows VIP LIVE" },
    { name: "Tailwind CSS Fix", status: "doing", note: "🔄 Needs globals.css + config" },
    { name: "Fix Route Swap / and /buy-keys", status: "doing", note: "🔄 You swapped files" },
    { name: "Agora SDK Camera", status: "todo", note: "⏳ Next - host video" },
    { name: "Real Backend (Supabase)", status: "todo", note: "⏳ Save keys to database" },
    { name: "Go Live Paystack", status: "todo", note: "⏳ Replace test keys with live keys" },
  ];

  return (
    <div className="min-h-screen bg-black text-white max-w-[430px] mx-auto p-4">
      <h1 className="text-xl font-bold">🛠️ Loomi Dev Board</h1>
      <p className="text-zinc-500 text-xs mt-1">What we are working on - loomi-live-qaba.vercel.app</p>

      <div className="mt-6 space-y-3">
        {tasks.map((t,i)=>(
          <div key={i} className={`p-3 rounded-xl border flex justify-between items-center ${
            t.status==="done" ? "bg-green-950/30 border-green-900" :
            t.status==="doing" ? "bg-yellow-950/30 border-yellow-800" :
            "bg-zinc-900 border-zinc-800"
          }`}>
            <div>
              <p className="font-bold text-sm">{t.name}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{t.note}</p>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
              t.status==="done" ? "bg-green-600" :
              t.status==="doing" ? "bg-yellow-500 text-black" :
              "bg-zinc-700"
            }`}>{t.status.toUpperCase()}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-zinc-900 p-3 rounded-xl">
          <p className="text-zinc-500">Current Keys</p>
          <p className="text-lg font-bold">{typeof window !== 'undefined' ? localStorage.getItem("loomi_keys") || "0" : "0"} Keys</p>
        </div>
        <div className="bg-zinc-900 p-3 rounded-xl">
          <p className="text-zinc-500">VIP Status</p>
          <p className="text-lg font-bold">{typeof window !== 'undefined' && localStorage.getItem("loomi_vip")==="true" ? "👑 VIP" : "Free"}</p>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button onClick={()=>window.location.href="/"} className="flex-1 bg-white text-black py-2 rounded-xl font-bold text-sm">Go to Live App</button>
        <button onClick={()=>window.location.href="/buy-keys"} className="flex-1 bg-zinc-800 py-2 rounded-xl font-bold text-sm border border-zinc-700">Go to Buy Keys</button>
      </div>

      <p className="text-[10px] text-zinc-600 text-center mt-8">Loomi Live Dev - Update this board as we ship</p>
    </div>
  )
        }
