"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };
type Fly = { id: string; emoji: string; x: number; type: string };

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
  const [debug, setDebug] = useState("");
  const [gifts, setGifts] = useState<Fly[]>([]);
  const [vip, setVip] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("loomi_nickname");
    if (saved) setNickname(saved);
    const savedKeys = localStorage.getItem("loomi_keys");
    if(savedKeys) setKeys(parseInt(savedKeys));
    const q = query(collection(db, "live_chat"), orderBy("createdAt", "asc"), limit(150));
    const unsubChat = onSnapshot(q, s => {
      const msgs = s.docs.map(d => d.data());
      setChat(msgs);
      s.docChanges().forEach(change => {
        if(change.type==="added"){
          const data = change.doc.data();
          if(data.gift && data.user !== nickname){
            triggerGift(data.gift, data.cost || 0);
          }
        }
      });
    });
    const unsubHosts = onSnapshot(collection(db, "live_rooms"), s => {
      const all = s.docs.map(d => d.data());
      setLiveHosts(all.filter((h:any)=> h.nickname !== nickname && h.isLive));
    });
    return () => { unsubChat(); unsubHosts(); };
  }, [nickname]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}) },[chat]);

  const triggerGift = (emoji: string, cost: number = 0) => {
    let type = "heart";
    if(emoji==="🚀") type="rocket";
    if(emoji==="👑") type="crown";
    if(emoji==="💎") type="diamond";
    if(emoji==="🔥") type="fire";

    // SWEET & SOUR: spawn multiple for bigger gifts
    const count = type==="heart" ? 6 : type==="rocket" ? 1 : type==="crown" ? 2 : type==="diamond" ? 4 : 5;
    
    for(let i=0;i<count;i++){
      setTimeout(()=>{
        const id = Math.random().toString(36).slice(2)+i;
        const x = Math.random()*70+10;
        setGifts(g=>[...g, { id, emoji, x, type }]);
        setTimeout(()=> setGifts(g=>g.filter(f=>f.id!==id)), 3200);
      }, i*120);
    }
    setHearts(h=>h+count);
  };

  const saveNickname = () => {
    const clean = tempNick.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    if(clean.length<3) return alert("Min 3");
    localStorage.setItem("loomi_nickname", clean);
    setNickname(clean);
  };

  const goLive = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
      streamRef.current = stream;
      if(videoRef.current){ videoRef.current.srcObject = stream; await videoRef.current.play().catch(()=>{}); }
      setIsLive(true); setWatching(null);
      await setDoc(doc(db, "live_rooms", nickname), { nickname, isLive:true, createdAt: serverTimestamp() });
      setDebug("LIVE");
      onSnapshot(collection(db, `live_rooms/${nickname}/viewers`), async snap => {
        for(const change of snap.docChanges()){
          if(change.type==="added"){
            const viewerId = change.doc.id;
            const data = change.doc.data();
            if(!data.offer || pcsRef.current.has(viewerId)) continue;
            const pc = new RTCPeerConnection(ICE);
            pcsRef.current.set(viewerId, pc);
            stream.getTracks().forEach(t=> pc.addTrack(t, stream));
            pc.onicecandidate = e => { if(e.candidate) addDoc(collection(db, `live_rooms/${nickname}/viewers/${viewerId}/candidates_host`), { candidate: e.candidate.toJSON() }); };
            onSnapshot(collection(db, `live_rooms/${nickname}/viewers/${viewerId}/candidates_viewer`), s => {
              s.docChanges().forEach(async ch=>{ if(ch.type==="added"){ try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{} } });
            });
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await updateDoc(doc(db, `live_rooms/${nickname}/viewers/${viewerId}`), { answer: { sdp: answer.sdp, type: answer.type } });
          }
        }
      });
    } catch(e:any){ alert("Allow cam"); }
  };

  const stopLive = async () => {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    setIsLive(false); setDebug("");
    if(videoRef.current) videoRef.current.srcObject=null;
    try{ await deleteDoc(doc(db, "live_rooms", nickname)); }catch{}
  };

  const watchHost = async (hostNick: string) => {
    if(isLive) await stopLive();
    setWatching(hostNick); setDebug(`Playing @${hostNick}`);
    const pc = new RTCPeerConnection(ICE);
    pcsRef.current.set(hostNick, pc);
    pc.ontrack = e => { if(remoteRef.current){ remoteRef.current.srcObject = e.streams[0]; remoteRef.current.play().catch(()=>{}); } };
    pc.onicecandidate = e => { if(e.candidate) addDoc(collection(db, `live_rooms/${hostNick}/viewers/${nickname}/candidates_viewer`), { candidate: e.candidate.toJSON() }); };
    onSnapshot(collection(db, `live_rooms/${hostNick}/viewers/${nickname}/candidates_host`), s => {
      s.docChanges().forEach(async ch=>{ if(ch.type==="added"){ try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{} } });
    });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(doc(db, `live_rooms/${hostNick}/viewers/${nickname}`), { viewer: nickname, offer: { sdp: offer.sdp, type: offer.type }, createdAt: serverTimestamp() });
    onSnapshot(doc(db, `live_rooms/${hostNick}/viewers/${nickname}`), async snap => {
      const data=snap.data(); if(data?.answer && pc.signalingState==="have-local-offer"){ await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); }
    });
  };

  const stopWatching = async () => {
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    if(remoteRef.current) remoteRef.current.srcObject=null;
    const w=watching; setWatching(null); setDebug("");
    try{ if(w) await deleteDoc(doc(db, `live_rooms/${w}/viewers/${nickname}`)); }catch{}
  };

  const sendChat = async () => { if(!input.trim()) return; const t=input.trim(); setInput(""); await addDoc(collection(db,"live_chat"), { user:nickname, msg:t, createdAt: serverTimestamp() }); };
  
  const sendGift = async (cost:number, emoji:string) => {
    if(keys < cost) return alert("Need more keys! 🪙");
    if(cost>0){ const newKeys = keys - cost; setKeys(newKeys); localStorage.setItem("loomi_keys", newKeys.toString()); }
    triggerGift(emoji, cost);
    await addDoc(collection(db,"live_chat"), { user:nickname, msg:`sent ${emoji}`, gift:emoji, cost, createdAt: serverTimestamp() });
  };

  if(!nickname) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center max-w-[430px] mx-auto p-6">
      <div className="w-full"><h1 className="text-[32px] font-black">Loomi ✨ Pick alias</h1><input value={tempNick} onChange={e=>setTempNick(e.target.value)} placeholder="kat" className="w-full mt-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-4" /><button onClick={saveNickname} className="w-full mt-4 bg-white text-black py-4 rounded-2xl font-black">Continue</button></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-[430px] mx-auto relative overflow-hidden">
      <div className="flex justify-between items-center p-3 border-b border-zinc-800 z-20 bg-black">
        <span className="font-black">@{nickname} {vip && "👑"}</span>
        <div className="flex gap-2">
          <span className="bg-zinc-800 px-2 py-1 rounded-full text-xs">🪙 {keys}</span>
          <span className="bg-zinc-800 px-2 py-1 rounded-full text-xs">❤️ {hearts}</span>
        </div>
      </div>

      <div className="relative bg-zinc-900 aspect-[9/12] w-full overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isLive ? "block" : "hidden"}`} />
        <video ref={remoteRef} autoPlay playsInline className={`w-full h-full object-cover bg-black ${watching ? "block" : "hidden"}`} />
        
        {/* SWEET & SOUR GIFT LAYER */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {gifts.map(g=>{
            if(g.type==="heart") return <div key={g.id} className="absolute bottom-10 animate-heart text-3xl" style={{ left: `${g.x}%` }}>❤️</div>;
            if(g.type==="rocket") return <div key={g.id} className="absolute bottom-0 animate-rocket text-5xl" style={{ left: `${g.x}%` }}>🚀<div className="text-xs">💨💨💨</div></div>;
            if(g.type==="crown") return <div key={g.id} className="absolute bottom-10 animate-crown text-5xl" style={{ left: `${g.x}%` }}>👑<div className="absolute -top-2 -right-2 text-sm animate-sparkle">✨✨</div></div>;
            if(g.type==="diamond") return <div key={g.id} className="absolute bottom-0 animate-diamond text-4xl" style={{ left: `${g.x}%` }}>💎</div>;
            if(g.type==="fire") return <div key={g.id} className="absolute bottom-0 animate-fire text-5xl w-full text-center" style={{ left: 0 }}>🔥🔥🔥</div>;
            return null;
          })}
        </div>

        {!isLive && !watching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black z-10">
            <button onClick={goLive} className="bg-white text-black px-10 py-4 rounded-full font-black text-lg">🔴 GO LIVE</button>
            <p className="mt-3 text-zinc-500 text-xs">{liveHosts.length} live now</p>
          </div>
        )}
        {debug && <div className="absolute bottom-3 left-3 right-3 bg-black/70 px-3 py-1 rounded-full text-[11px] text-yellow-300 text-center z-20">{debug}</div>}
        {isLive && <button onClick={stopLive} className="absolute top-3 right-3 bg-black/70 px-4 py-1.5 rounded-full text-xs z-20">✕ Stop</button>}
        {watching && <button onClick={stopWatching} className="absolute top-3 right-3 bg-black/70 px-4 py-1.5 rounded-full text-xs z-20">✕ Stop</button>}
      </div>

      <div className="flex gap-2 p-2 bg-zinc-950 border-b border-zinc-800"><div className="font-black text-xs">👑 Hosters ({1+liveHosts.length})</div></div>
      <div className="flex gap-3 p-2 overflow-x-auto bg-zinc-950 border-b border-zinc-800">
        <div className="text-center min-w-[52px]"><div className={`w-12 h-12 rounded-full ${isLive ? "bg-yellow-400 text-black" : "bg-zinc-800"} flex items-center justify-center font-bold`}>You</div><p className="text-[11px]">You</p></div>
        {liveHosts.map((h:any)=>(<div key={h.nickname} onClick={()=>watchHost(h.nickname)} className="text-center cursor-pointer min-w-[52px]"><div className="w-12 h-12 rounded-full bg-red-600 animate-pulse flex items-center justify-center">🔴</div><p className="text-[11px]">@{h.nickname}</p></div>))}
      </div>

      <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[16vh] bg-black">
        {chat.map((c,i)=><p key={i} className="text-[13px]"><span className="text-zinc-500 font-bold">@{c.user}:</span> {c.msg}</p>)}<div ref={chatEndRef} />
      </div>

      <div className="bg-zinc-900 border-t border-zinc-800 p-2 flex gap-2 overflow-x-auto">
        <button onClick={()=>sendGift(0,"❤️")} className="min-w-[68px] bg-zinc-800 rounded-xl py-2.5 text-xs font-bold active:scale-95 transition">❤️<br/>FREE</button>
        <button onClick={()=>sendGift(5,"🚀")} className="min-w-[68px] bg-zinc-800 rounded-xl py-2.5 text-xs font-bold active:scale-95">🚀<br/>5 🪙</button>
        <button onClick={()=>sendGift(10,"👑")} className="min-w-[68px] bg-zinc-800 rounded-xl py-2.5 text-xs font-bold active:scale-95">👑<br/>10 🪙</button>
        <button onClick={()=>sendGift(50,"💎")} className="min-w-[68px] bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl py-2.5 text-xs font-bold active:scale-95">💎<br/>50 🪙</button>
        <button onClick={()=>sendGift(100,"🔥")} className="min-w-[68px] bg-gradient-to-br from-orange-500 to-red-600 rounded-xl py-2.5 text-xs font-bold active:scale-95">🔥<br/>100 🪙</button>
      </div>

      <div className="p-2 flex gap-2 bg-black border-t border-zinc-800">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendChat()} className="flex-1 bg-zinc-800 rounded-full px-4 py-2.5 text-sm" placeholder="Chat..." />
        <button onClick={sendChat} className="bg-white text-black px-5 rounded-full text-sm font-black">Send</button>
      </div>

      <style>{`
        @keyframes heartFloat {
          0% { transform: translateY(0) scale(0.3) rotate(-15deg); opacity:0; }
          15% { opacity:1; transform: translateY(-10vh) scale(1.1) rotate(10deg); }
          50% { transform: translateY(-45vh) scale(1.3) rotate(-10deg) translateX(10px); }
          100% { transform: translateY(-90vh) scale(0.8) rotate(15deg) translateX(-10px); opacity:0; }
        }
        @keyframes rocketLaunch {
          0% { transform: translateY(100vh) scale(0.5); }
          20% { transform: translateY(50vh) scale(1.2) rotate(-5deg); }
          100% { transform: translateY(-120vh) scale(1.5) rotate(10deg); }
        }
        @keyframes crownDrop {
          0% { transform: translateY(-20vh) scale(0) rotate(0deg); }
          30% { transform: translateY(20vh) scale(1.4) rotate(180deg); }
          60% { transform: translateY(40vh) scale(1) rotate(360deg); }
          100% { transform: translateY(90vh) scale(0.8) rotate(720deg); opacity:0; }
        }
        @keyframes diamondFall {
          0% { transform: translateY(-10vh) translateX(0) rotate(0deg) scale(0.5); opacity:0; }
          10% { opacity:1; }
          100% { transform: translateY(100vh) translateX(30px) rotate(720deg) scale(1.2); opacity:0; }
        }
        @keyframes fireShake {
          0%,100% { transform: translateY(0) scale(1); }
          25% { transform: translateY(-5vh) scale(1.2) translateX(-5px); }
          50% { transform: translateY(-20vh) scale(1.4) translateX(5px); }
          75% { transform: translateY(-50vh) scale(1.1) translateX(-5px); }
          100% { transform: translateY(-90vh) scale(0); opacity:0; }
        }
        @keyframes sparkle { 0%,100%{opacity:0; transform:scale(0)} 50%{opacity:1; transform:scale(1.5)} }
        .animate-heart { animation: heartFloat 3s ease-out forwards; }
        .animate-rocket { animation: rocketLaunch 2.2s ease-out forwards; }
        .animate-crown { animation: crownDrop 3s ease-in-out forwards; }
        .animate-diamond { animation: diamondFall 2.8s ease-in forwards; }
        .animate-fire { animation: fireShake 2.5s ease-out forwards; }
        .animate-sparkle { animation: sparkle 0.6s infinite; }
      `}</style>
    </div>
  );
      }
