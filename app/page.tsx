"use client";
import { useState } from "react";
import Link from "next/link";

export default function LoomiFeed() {
  const [keys, setKeys] = useState(0);
  const [chat, setChat] = useState("");
  const messages = [
    { user: "@kaito_za", text: "Yo bruvv 🔥", color: "text-purple-400" },
    { user: "@lebza__", text: "You peng!", color: "text-orange-400" },
    { user: "@ga_rankuwa", text: "Ga-Rankuwa stand up!", color: "text-green-400" },
  ];
  return (
    <div className="min-h-screen bg-black text-white max-w-[430px] mx-auto border-x border-zinc-800">
      <div className="p-3 flex justify-between bg-zinc-900">
        <span className="bg-red-500 px-2 py-1 rounded text-xs font-bold">LIVE • Loomi Live</span>
        <span className="text-xs">👁 342 watching • 🪙 {keys} Keys</span>
      </div>
      <div className="h-[48vh] bg-zinc-800 flex items-center justify-center relative">
        <p className="text-zinc-500">Host Camera [Agora SDK here]</p>
        <div className="absolute right-2 bottom-2 flex flex-col gap-3 text-center">
          <button>❤️<br/><span className="text-xs">12.4k</span></button>
          <button>💬<br/><span className="text-xs">892</span></button>
          <button>🎁<br/><span className="text-xs">Gifts</span></button>
        </div>
      </div>
      <div className="p-3 bg-zinc-900 border-y border-zinc-800">
        <div className="flex justify-between text-sm">
          <span>🏠 Unlock Mansion</span><span className="text-yellow-400">70%</span>
        </div>
        <div className="w-full bg-zinc-700 h-2 rounded mt-2"><div className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded" style={{width:"70%"}}></div></div>
      </div>
      <div className="p-3 h-[28vh] overflow-y-auto">
        <p className="text-[10px] tracking-widest text-zinc-500">PUBLIC CHAT</p>
        {messages.map((m,i)=><p key={i} className="text-sm mt-2"><span className={m.color}>{m.user}</span>: {m.text}</p>)}
      </div>
      <div className="p-3 flex gap-2">
        <input value={chat} onChange={e=>setChat(e.target.value)} placeholder="Say something on Loomi..." className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm"/>
        <button className="bg-white text-black px-4 rounded-full">Send</button>
      </div>
      <div className="p-3 grid grid-cols-6 gap-2 text-center text-xs">
        <div className="bg-zinc-800 p-2 rounded">🔥<br/>FREE</div>
        <div className="bg-zinc-800 p-2 rounded">😍<br/>FREE</div>
        <div className="bg-zinc-800 p-2 rounded">👍<br/>FREE</div>
        <div className="bg-zinc-700 p-2 rounded opacity-50">🔒<br/>PREMIUM</div>
        <div className="bg-zinc-700 p-2 rounded opacity-50">👑<br/>PREMIUM</div>
        <div className="bg-zinc-700 p-2 rounded opacity-50">💎<br/>PREMIUM</div>
      </div>
      <div className="p-3 sticky bottom-0 bg-black">
        <Link href="/buy-keys"><button className="w-full bg-gradient-to-r from-red-500 to-pink-500 py-4 rounded-full font-bold">👑 Unlock Mansion VIP — 30 Loomi Keys</button></Link>
      </div>
    </div>
  );
}
