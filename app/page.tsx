"use client";
import { useEffect, useState, useRef } from "react";

export default function LoomiLive() {
  const [keys, setKeys] = useState(0);
  const [chat, setChat] = useState([
    { user: "kaito_za", msg: "Yo bruvv 🔥" },
    { user: "lebza__", msg: "You peng!" },
    { user: "viewer_01", msg: "Let's gooo!" },
  ]);
  const [input, setInput] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [hearts, setHearts] = useState(12.4);
  const [isLive, setIsLive] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setKeys(parseInt(localStorage.getItem("loomi_keys") || "0"));
    setIsVip(localStorage.getItem("loomi_vip") === "true");
  }, []);

  const goLive = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsLive(true);
      setChat(prev => [...prev, { user: "system", msg: "🔴 You are LIVE!" }]);
    } catch (e) {
      alert("Camera blocked bro - Allow camera + mic in browser settings");
    }
  };

  const stopLive = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsLive(false);
  };

  const switchCam = async () => {
    setFacing(f => f === "user" ? "environment" : "user");
    setTimeout(goLive, 100);
  };

  const sendChat = () => {
    if(!input.trim()) return;
    setChat([...chat, { user: "you", msg: input }]);
    setInput("");
  };

  const unlockVip = () => {
    if(keys < 30){
      if(confirm("You need 30 Keys. Buy now?")) window.location.href="/buy-keys";
      return;
    }
    const newKeys = keys - 30;
    localStorage.setItem("loomi_keys", String(newKeys));
    localStorage.setItem("loomi_vip", "true");
    setKeys(newKeys);
    setIsVip(true);
  };

  const sendGift = (cost: number) => {
    if(keys < cost){
      alert("Not enough Keys");
      window.location.href="/buy-keys";
      return;
    }
    const newKeys = keys - cost;
    localStorage.setItem("loomi_keys", String(newKeys));
    setKeys(newKeys);
    setHearts(h => +(h+0.1).toFixed(1));
    setChat([...chat, { user: "you", msg: `Sent ${cost} Keys gift! 🎁` }]);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-[430px] mx-auto relative overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-black/90 sticky top-0 z-20 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className={`text-white text-[11px] px-2 py-0.5 rounded font-bold ${isLive ? "bg-red-600 animate-pulse" : "bg-zinc-700"}`}>{isLive ? "● LIVE" : "LIVE"}</span>
          <span className="font-bold text-sm">loomi-live</span>
          <span className="text-zinc-400 text-xs">👁️ 342 watching</span>
        </div>
        <button onClick={()=>window.location.href="/buy-keys"} className="bg-zinc-800 border border-yellow-500/50 px-3 py-1 rounded-full text-xs font-bold">
          🪙 {keys} Keys
        </button>
      </div>

      <div className="relative bg-zinc-900 aspect-[9/12] w-full flex items-center justify-center overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isLive ? "block" : "hidden"}`} />
        
        {!isLive && (
          <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-black flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-zinc-700 border-2 border-white/20 mb-3" />
            <p className="text-white/60 text-sm">Host Camera</p>
            {isVip && <p className="mt-2 bg-yellow-400 text-black text-xs px-3 py-1 rounded-full font-bold">👑 loomi-live VIP</p>}
            <button onClick={goLive} className="mt-6 bg-white text-black px-8 py-3 rounded-full font-black text-sm shadow-xl">
              🔴 GO LIVE
            </button>
          </div>
        )}

        {isLive && (
          <>
            <div className="absolute top-3 left-3 bg-red-600 px-2 py-1 rounded text-[11px] font-bold animate-pulse">● LIVE {hearts}k</div>
            <div className="absolute top-3 right-3 flex gap-2">
              <button onClick={switchCam} className="bg-black/60 px-2 py-1 rounded-full text-xs">🔄 Flip</button>
              <button onClick={stopLive} className="bg-black/60 px-2 py-1 rounded-full text-xs">✕ Stop</button>
            </div>
            {isVip && <p className="absolute bottom-3 left-3 bg-yellow-400 text-black text-xs px-3 py-1 rounded-full font-bold">👑 VIP</p>}
          </>
        )}
      </div>

      <div className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto max-h-[22vh]">
        <p className="text-[11px] text-zinc-500 font-bold">PUBLIC CHAT</p>
        {chat.map((c,i)=><p key={i} className="text-[13px]"><span className="text-zinc-500">@{c.user}:</span> {c.msg}</p>)}
      </div>

      <div className="flex gap-2 px-3 py-2 bg-zinc-900/80 border-t border-zinc-800">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendChat()} placeholder="Say something..." className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm outline-none"/>
        <button onClick={sendChat} className="bg-white text-black px-4 rounded-full text-sm font-bold">Send</button>
      </div>

      <div className="px-2 py-2 bg-black border-t border-zinc-800">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={()=>sendGift(0)} className="min-w-[60px] bg-zinc-900 rounded-xl py-2 border border-zinc-800">🔥<span className="text-[10px] block">FREE</span></button>
          <button onClick={()=>sendGift(0)} className="min-w-[60px] bg-zinc-900 rounded-xl py-2 border border-zinc-800">😍<span className="text-[10px] block">FREE</span></button>
          <button onClick={()=>sendGift(5)} className="min-w-[60px] bg-zinc-800 rounded-xl py-2 border border-yellow-900/50">🔒<span className="text-[10px] block">5 Keys</span></button>
          <button onClick={()=>sendGift(10)} className="min-w-[60px] bg-zinc-800 rounded-xl py-2 border border-yellow-900/50">👑<span className="text-[10px] block">10 Keys</span></button>
          <button onClick={()=>sendGift(20)} className="min-w-[60px] bg-zinc-800 rounded-xl py-2 border border-yellow-900/50">💎<span className="text-[10px] block">20 Keys</span></button>
        </div>
        <button onClick={unlockVip} className={`w-full mt-3 py-3 rounded-xl font-bold text-sm ${isVip ? "bg-green-600" : "bg-gradient-to-r from-yellow-400 to-orange-500 text-black"}`}>
          {isVip ? "✅ VIP Unlocked" : "👑 Unlock VIP — 30 Keys"}
        </button>
      </div>
    </div>
  );
              }
