"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc } from "firebase/firestore";

export default function LoomiLive() {
  const [nickname, setNickname] = useState<string>("");
  const [tempNick, setTempNick] = useState("");
  const [keys, setKeys] = useState(0);
  const [tab, setTab] = useState<"hosters" | "audience">("hosters");
  const [chat, setChat] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [hearts, setHearts] = useState(12.4);
  const [isLive, setIsLive] = useState(false);
  const [liveHosts, setLiveHosts] = useState<any[]>([]);
  const [watching, setWatching] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedNick = localStorage.getItem("loomi_nickname");
    if (savedNick) setNickname(savedNick);
    setKeys(parseInt(localStorage.getItem("loomi_keys") || "100"));
    setIsVip(localStorage.getItem("loomi_vip") === "true");

    const q = query(collection(db, "live_chat"), orderBy("createdAt", "asc"), limit(150));
    const unsubChat = onSnapshot(q, (snap) => setChat(snap.docs.map(d => d.data())));

    const unsubHosts = onSnapshot(collection(db, "live_rooms"), (snap) => {
      setLiveHosts(snap.docs.map(d => d.data()).filter((h:any)=> h.nickname !== nickname));
    });
    return () => { unsubChat(); unsubHosts(); };
  }, [nickname]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}) },[chat]);

  const saveNickname = async () => {
    const clean = tempNick.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    if(clean.length<3) return alert("Min 3 letters");
    localStorage.setItem("loomi_nickname", clean);
    setNickname(clean);
    try { await setDoc(doc(db,"users_public",clean), {nickname:clean, createdAt: serverTimestamp()}); } catch{}
  };

  const goLive = async () => {
    try {
      if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:facing}, audio:true});
      streamRef.current = stream;
      if(videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setIsLive(true); setWatching(null);
      await setDoc(doc(db,"live_rooms",nickname), {nickname, isLive:true, startedAt: serverTimestamp()});
    } catch { alert("Allow camera + mic"); }
  };

  const stopLive = async () => {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    setIsLive(false);
    if(videoRef.current) videoRef.current.srcObject = null;
    try { await deleteDoc(doc(db,"live_rooms",nickname)); } catch{}
  };

  const switchCam = async () => { setFacing(f=> f==="user" ? "environment" : "user"); setTimeout(goLive, 150); };
  const watchHost = (nick:string) => { if(isLive) stopLive(); setWatching(nick); };

  const sendChat = async () => {
    if(!input.trim()) return;
    const t=input.trim(); setInput("");
    await addDoc(collection(db,"live_chat"), {user:nickname, msg:t, createdAt: serverTimestamp()});
  };
  const sendGift = (cost:number) => {
    if(keys<cost) return alert("Not enough Keys");
    const n=keys-cost; localStorage.setItem("loomi_keys", String(n)); setKeys(n); setHearts(h=>+(h+0.1).toFixed(1));
  };
  const unlockVip = () => {
    if(keys<30){ if(confirm("Need 30 Keys?")) window.location.href="/buy-keys"; return; }
    const n=keys-30; localStorage.setItem("loomi_keys", String(n)); localStorage.setItem("loomi_vip","true"); setKeys(n); setIsVip(true);
  };

  if(!nickname) return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center max-w-[430px] mx-auto p-6">
      <h1 className="text-[28px] font-black mb-2">Pick your alias</h1>
      <p className="text-zinc-500 text-[13px] mb-6">Public = nickname only. Private stays in Firebase Auth.</p>
      <div className="relative w-full"><span className="absolute left-4 top-3.5 text-zinc-500">@</span>
      <input value={tempNick} onChange={e=>setTempNick(e.target.value)} placeholder="kaito_za" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-4 py-3 outline-none" maxLength={15}/></div>
      <button onClick={saveNickname} className="w-full mt-4 bg-white text-black py-3.5 rounded-xl font-black">Continue →</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-[430px] mx-auto">
      <div className="flex items-center justify-between px-3 py-2 bg-black sticky top-0 z-20 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className={`text-white text-[11px] px-2 py-0.5 rounded font-bold ${isLive ? "bg-red-600 animate-pulse" : watching ? "bg-blue-600" : "bg-zinc-700"}`}>{isLive ? "● LIVE" : watching ? `👀 @${watching}` : "LIVE"}</span>
          <span className="font-bold text-sm">@{nickname}</span>
        </div>
        <div className="bg-zinc-800 border border-yellow-500/50 px-3 py-1 rounded-full text-xs font-bold">🪙 {keys}</div>
      </div>

      <div className="relative bg-zinc-900 aspect-[9/11] w-full overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isLive ? "block" : "hidden"}`} />
        {!isLive && !watching && (
          <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-black flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-zinc-700 border-2 border-white/20 mb-3 flex items-center justify-center text-2xl">👑</div>
            <p className="text-white/60 text-sm">@{nickname}</p>
            <button onClick={goLive} className="mt-6 bg-white text-black px-8 py-3 rounded-full font-black text-sm">🔴 GO LIVE</button>
            {liveHosts.length>0 && <p className="mt-3 text-yellow-400 text-xs animate-pulse">{liveHosts.length} LIVE NOW - tap Hosters</p>}
          </div>
        )}
        {watching && (
          <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-black flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-2xl animate-pulse">🔴</div>
            <h2 className="mt-4 font-black">Watching @{watching}</h2>
            <p className="text-zinc-400 text-xs mt-2">Real video stream next step: WebRTC. Chat works now.</p>
            <button onClick={()=>setWatching(null)} className="mt-6 bg-zinc-800 px-6 py-2 rounded-full text-sm">✕ Stop</button>
            <button onClick={goLive} className="mt-3 bg-white text-black px-6 py-2 rounded-full text-sm font-bold">🔴 Go Live Yourself</button>
          </div>
        )}
        {isLive && (
          <>
            <div className="absolute top-3 left-3 bg-red-600 px-2 py-1 rounded text-[11px] font-bold animate-pulse">● LIVE {hearts}k</div>
            <div className="absolute top-3 right-3 flex gap-2">
              <button onClick={switchCam} className="bg-black/60 px-3 py-1 rounded-full text-xs">🔄 Flip</button>
              <button onClick={stopLive} className="bg-black/60 px-3 py-1 rounded-full text-xs">✕ Stop</button>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2 px-3 py-2 bg-zinc-900 border-t border-zinc-800">
        <button onClick={()=>setTab("hosters")} className={`px-4 py-1.5 rounded-full text-xs font-bold ${tab==="hosters" ? "bg-white text-black" : "bg-zinc-800 text-zinc-400"}`}>👑 Hosters ({1+liveHosts.length})</button>
        <button onClick={()=>setTab("audience")} className={`px-4 py-1.5 rounded-full text-xs font-bold ${tab==="audience" ? "bg-white text-black" : "bg-zinc-800 text-zinc-400"}`}>👥 Audience</button>
      </div>

      {tab==="hosters" && (
        <div className="px-3 py-2 bg-black flex gap-3 overflow-x-auto border-b border-zinc-800">
          <div className="flex flex-col items-center min-w-[60px]">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg border-2 ${isLive ? "bg-yellow-400 border-yellow-400 text-black" : "bg-zinc-800 border-zinc-700"}`}>👑</div>
            <p className="text-[11px] mt-1">You</p>
          </div>
          {liveHosts.map((h:any)=>(
            <div key={h.nickname} onClick={()=>watchHost(h.nickname)} className="flex flex-col items-center min-w-[60px] cursor-pointer">
              <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 bg-red-600 border-red-500 animate-pulse">🔴</div>
              <p className="text-[11px] mt-1">@{h.nickname}</p>
              <p className="text-[8px] text-red-400">LIVE - Tap</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto max-h-[20vh] bg-black">
        {chat.map((c,i)=><p key={i} className="text-[13px]"><span className="text-zinc-500">@{c.user}:</span> {c.msg}</p>)}
        <div ref={chatEndRef} />
      </div>

      <div className="px-3 py-2 bg-zinc-900/80 border-t border-zinc-800">
        <div className="flex gap-2">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendChat()} placeholder={watching ? `Chat with @${watching}...` : `Chat as @${nickname}...`} className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm outline-none"/>
          <button onClick={sendChat} className="bg-white text-black px-4 rounded-full text-sm font-bold">Send</button>
        </div>
      </div>
      <div className="px-2 py-2 bg-black border-t border-zinc-800">
        <div className="flex gap-2 overflow-x-auto">
          <button onClick={()=>sendGift(0)} className="min-w-[60px] bg-zinc-900 rounded-xl py-2 border border-zinc-800">🔥<span className="text-[10px] block">FREE</span></button>
          <button onClick={()=>sendGift(5)} className="min-w-[60px] bg-zinc-800 rounded-xl py-2">💎<span className="text-[10px] block">5 Keys</span></button>
          <button onClick={()=>sendGift(10)} className="min-w-[60px] bg-zinc-800 rounded-xl py-2">👑<span className="text-[10px] block">10 Keys</span></button>
        </div>
        <button onClick={unlockVip} className={`w-full mt-3 py-3 rounded-xl font-bold text-sm ${isVip ? "bg-green-600" : "bg-gradient-to-r from-yellow-400 to-orange-500 text-black"}`}>{isVip ? "✅ VIP Unlocked" : "👑 Unlock VIP — 30 Keys"}</button>
      </div>
    </div>
  );
}
