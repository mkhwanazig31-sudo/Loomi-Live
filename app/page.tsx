"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, getDoc, updateDoc } from "firebase/firestore";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

type GiftFly = { id: string; emoji: string; x: number };

export default function LoomiLive() {
  const [nickname, setNickname] = useState("");
  const [tempNick, setTempNick] = useState("");
  const [keys, setKeys] = useState(100);
  const [hearts, setHearts] = useState(12);
  const [chat, setChat] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [liveHosts, setLiveHosts] = useState<any[]>([]);
  const [watching, setWatching] = useState<string | null>(null);
  const [gifts, setGifts] = useState<GiftFly[]>([]);
  const [vip, setVip] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("loomi_nickname");
    if (saved) setNickname(saved);
    const q = query(collection(db, "live_chat"), orderBy("createdAt", "asc"), limit(150));
    const unsubChat = onSnapshot(q, s => {
      const msgs = s.docs.map(d => d.data());
      setChat(msgs);
      // if gift msg, fly it
      const last = msgs[msgs.length-1];
      if(last?.gift) triggerFly(last.gift);
    });
    const unsubHosts = onSnapshot(collection(db, "live_rooms"), s => {
      const all = s.docs.map(d => d.data());
      setLiveHosts(all.filter((h:any)=> h.nickname !== nickname && h.isLive));
    });
    return () => { unsubChat(); unsubHosts(); };
  }, [nickname]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}) },[chat]);

  const triggerFly = (emoji: string) => {
    const id = Math.random().toString(36).slice(2);
    const x = Math.random()*70 + 10;
    setGifts(g=>[...g, { id, emoji, x }]);
    setTimeout(()=> setGifts(g=>g.filter(i=>i.id!==id)), 2500);
    setHearts(h=>h+1);
  };

  const saveNickname = () => {
    const clean = tempNick.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    if(clean.length<3) return alert("Min 3 chars");
    localStorage.setItem("loomi_nickname", clean);
    setNickname(clean);
  };

  const goLive = async () => {
    try {
      if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
      streamRef.current = stream;
      if(videoRef.current){ videoRef.current.srcObject = stream; await videoRef.current.play().catch(()=>{}); }
      setIsLive(true); setWatching(null);
      await setDoc(doc(db, "live_rooms", nickname), { nickname, isLive:true, createdAt: serverTimestamp() });
      
      onSnapshot(collection(db, `live_rooms/${nickname}/viewers`), async snap => {
        for(const change of snap.docChanges()){
          if(change.type==="added"){
            const viewerId = change.doc.id;
            const vd = change.doc.data();
            if(vd.offer && !pcsRef.current.has(viewerId)){
              const pc = new RTCPeerConnection(ICE);
              pcsRef.current.set(viewerId, pc);
              stream.getTracks().forEach(tr=> pc.addTrack(tr, stream));
              pc.onicecandidate = e => { if(e.candidate) addDoc(collection(db, `live_rooms/${nickname}/viewers/${viewerId}/candidates`), { candidate: e.candidate.toJSON(), from: nickname }); };
              await pc.setRemoteDescription(new RTCSessionDescription(vd.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await updateDoc(doc(db, `live_rooms/${nickname}/viewers/${viewerId}`), { answer: { sdp: answer.sdp, type: answer.type } });
            }
          }
        }
      });
    } catch(e:any){ alert("Allow cam/mic + close bubbles"); }
  };

  const stopLive = async () => {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    setIsLive(false);
    if(videoRef.current) videoRef.current.srcObject=null;
    try{ await deleteDoc(doc(db, "live_rooms", nickname)); }catch{}
  };

  const watchHost = async (hostNick: string) => {
    if(isLive) await stopLive();
    setWatching(hostNick);
    const pc = new RTCPeerConnection(ICE);
    pcsRef.current.set(hostNick, pc);
    pc.ontrack = e => { if(remoteRef.current){ remoteRef.current.srcObject = e.streams[0]; remoteRef.current.play().catch(()=>{}); } };
    pc.onicecandidate = e => { if(e.candidate) addDoc(collection(db, `live_rooms/${hostNick}/viewers/${nickname}/candidates`), { candidate: e.candidate.toJSON(), from: nickname }); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(doc(db, `live_rooms/${hostNick}/viewers/${nickname}`), { viewer: nickname, offer: { sdp: offer.sdp, type: offer.type }, createdAt: serverTimestamp() });
    onSnapshot(doc(db, `live_rooms/${hostNick}/viewers/${nickname}`), async snap => {
      const data=snap.data(); if(data?.answer && pc.signalingState!=="stable"){ await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); }
    });
    onSnapshot(collection(db, `live_rooms/${hostNick}/viewers/${nickname}/candidates`), snap => {
      snap.docChanges().forEach(async ch=>{ if(ch.type==="added"){ const d=ch.doc.data(); if(d.from!==nickname){ try{ await pc.addIceCandidate(new RTCIceCandidate(d.candidate)); }catch{} } } });
    });
  };

  const stopWatching = async () => {
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    if(remoteRef.current) remoteRef.current.srcObject=null;
    const w=watching; setWatching(null);
    try{ if(w) await deleteDoc(doc(db, `live_rooms/${w}/viewers/${nickname}`)); }catch{}
  };

  const sendChat = async () => { if(!input.trim()) return; const t=input.trim(); setInput(""); await addDoc(collection(db,"live_chat"), { user:nickname, msg:t, createdAt: serverTimestamp() }); };
  
  const sendGift = async (cost:number, emoji:string) => {
    if(cost>0 && keys < cost) return alert("Not enough keys! Top up 🪙");
    if(cost>0) setKeys(k=>k-cost);
    triggerFly(emoji);
    await addDoc(collection(db,"live_chat"), { user:nickname, msg:`sent ${emoji}`, gift:emoji, cost, createdAt: serverTimestamp() });
  };

  if(!nickname) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center max-w-[430px] mx-auto p-6">
      <div className="w-full"><h1 className="text-[32px] font-black">Loomi ✨ Pick alias</h1><input value={tempNick} onChange={e=>setTempNick(e.target.value)} placeholder="kat" className="w-full mt-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-lg" /><button onClick={saveNickname} className="w-full mt-4 bg-white text-black py-4 rounded-2xl font-black text-lg">Continue</button></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-[430px] mx-auto relative overflow-hidden">
      {/* TOP BAR */}
      <div className="flex justify-between items-center p-3 border-b border-zinc-800 bg-black/90 z-10">
        <span className="font-black">@{nickname}</span>
        <div className="flex gap-2 items-center">
          <span className="bg-zinc-800 px-2 py-1 rounded-full text-xs">🪙 {keys}</span>
          <span className="bg-zinc-800 px-2 py-1 rounded-full text-xs">❤️ {hearts}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${isLive ? "bg-red-600" : watching ? "bg-blue-600" : "bg-zinc-700"}`}>{isLive ? "● LIVE" : watching ? `Watching @${watching}` : "Offline"}</span>
        </div>
      </div>

      {/* VIDEO AREA */}
      <div className="relative bg-zinc-900 aspect-[9/12] w-full overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isLive ? "block" : "hidden"}`} />
        <video ref={remoteRef} autoPlay playsInline onClick={e=> (e.target as HTMLVideoElement).play()} className={`w-full h-full object-cover bg-black ${watching ? "block" : "hidden"}`} />

        {/* FLYING GIFTS LAYER */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {gifts.map(g=>(
            <div key={g.id} className="absolute bottom-0 animate-fly text-4xl" style={{ left: `${g.x}%` }}>{g.emoji}</div>
          ))}
        </div>

        {!isLive && !watching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
            <button onClick={goLive} className="bg-white text-black px-10 py-4 rounded-full font-black text-lg shadow-xl">🔴 GO LIVE</button>
            <p className="mt-3 text-zinc-400 text-xs">{liveHosts.length} live now • Tap Hosters below</p>
            {!vip && <button onClick={()=>setVip(true)} className="mt-6 bg-yellow-500 text-black px-5 py-2 rounded-full text-xs font-black">👑 Unlock VIP (50 🪙)</button>}
          </div>
        )}
        {isLive && <button onClick={stopLive} className="absolute top-3 right-3 bg-black/70 px-4 py-1.5 rounded-full text-xs z-20">✕ Stop</button>}
        {watching && <button onClick={stopWatching} className="absolute top-3 right-3 bg-black/70 px-4 py-1.5 rounded-full text-xs z-20">✕ Stop</button>}
        {watching && <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] z-20">Tap video if black</div>}
      </div>

      {/* HOSTERS */}
      <div className="flex gap-2 p-2 bg-zinc-950 border-b border-zinc-800"><div className="font-black text-xs">👑 Hosters ({1+liveHosts.length})</div><div className="ml-auto text-[10px] text-zinc-500">{vip ? "VIP ✨" : ""}</div></div>
      <div className="flex gap-3 p-2 overflow-x-auto bg-zinc-950 border-b border-zinc-800">
        <div className="text-center min-w-[52px]"><div className={`w-12 h-12 rounded-full ${isLive ? "bg-yellow-400 text-black" : "bg-zinc-800"} flex items-center justify-center font-bold`}>You</div><p className="text-[11px] mt-1">You</p></div>
        {liveHosts.map((h:any)=>(<div key={h.nickname} onClick={()=>watchHost(h.nickname)} className="text-center cursor-pointer min-w-[52px]"><div className="w-12 h-12 rounded-full bg-red-600 animate-pulse flex items-center justify-center">🔴</div><p className="text-[11px] mt-1">@{h.nickname}</p></div>))}
      </div>

      {/* CHAT */}
      <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[20vh] bg-black">
        {chat.map((c,i)=><p key={i} className="text-[13px] leading-5"><span className="text-zinc-500 font-bold">@{c.user}:</span> {c.msg} {c.gift && <span>{c.gift}</span>}</p>)}
        <div ref={chatEndRef} />
      </div>

      {/* GIFT BAR - NEW */}
      <div className="bg-zinc-900 border-t border-zinc-800 p-2 flex gap-2 overflow-x-auto">
        <button onClick={()=>sendGift(0, "❤️")} className="min-w-[70px] bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold">❤️<br/>FREE</button>
        <button onClick={()=>sendGift(5, "🚀")} className="min-w-[70px] bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold">🚀<br/>5 🪙</button>
        <button onClick={()=>sendGift(10, "👑")} className="min-w-[70px] bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold">👑<br/>10 🪙</button>
        <button onClick={()=>sendGift(50, "💎")} className="min-w-[70px] bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl px-3 py-2 text-xs font-bold">💎<br/>50 🪙</button>
        <button onClick={()=>sendGift(100, "🔥")} className="min-w-[70px] bg-gradient-to-br from-yellow-500 to-red-600 rounded-xl px-3 py-2 text-xs font-bold">🔥<br/>100 🪙</button>
        <button onClick={()=>{ if(keys<50) return alert("Need 50 keys"); setKeys(k=>k-50); setVip(true); triggerFly("👑"); }} className="min-w-[70px] bg-yellow-500 text-black rounded-xl px-3 py-2 text-xs font-black">VIP<br/>50 🪙</button>
      </div>

      {/* CHAT INPUT */}
      <div className="p-2 flex gap-2 bg-black border-t border-zinc-800">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendChat()} className="flex-1 bg-zinc-800 rounded-full px-4 py-2.5 text-sm outline-none" placeholder={watching ? `Chat with @${watching}...` : "Say something..."} />
        <button onClick={sendChat} className="bg-white text-black px-5 rounded-full text-sm font-black">Send</button>
      </div>

      <style>{`
        @keyframes fly {
          0% { transform: translateY(0) scale(0.5) rotate(-10deg); opacity:0; }
          15% { opacity:1; transform: translateY(-20vh) scale(1.2) rotate(10deg); }
          100% { transform: translateY(-90vh) scale(1.5) rotate(-10deg); opacity:0; }
        }
        .animate-fly { animation: fly 2.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
