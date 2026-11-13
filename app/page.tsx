"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, getDocs, where } from "firebase/firestore";
const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" }, { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }, { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }] };
type Fly = { id: string; emoji: string; x: number; type: string };

export default function LoomiLive() {
  const [nickname, setNickname] = useState("");
  const [tempNick, setTempNick] = useState("");
  const [keys, setKeys] = useState(100);
  const [chat, setChat] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [liveHosts, setLiveHosts] = useState<any[]>([]);
  const [watching, setWatching] = useState<string | null>(null);
  const [gifts, setGifts] = useState<Fly[]>([]);
  const [tab, setTab] = useState<"live"|"discover"|"ranking"|"balance">("live");
  const [showGifts, setShowGifts] = useState(false);
  const [rankingTab, setRankingTab] = useState<"viewers"|"guardian">("viewers");
  const [showRecharge, setShowRecharge] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const nicknameRef = useRef<string>("");
  const remoteStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => { nicknameRef.current = nickname; }, [nickname]);
  useEffect(() => {
    if (typeof window !== "undefined") remoteStreamRef.current = new MediaStream();
    const saved = localStorage.getItem("loomi_nickname");
    if (saved) { setNickname(saved); nicknameRef.current = saved; }
    const savedKeys = localStorage.getItem("loomi_keys");
    if(savedKeys) setKeys(parseInt(savedKeys));
  }, []);
  useEffect(() => {
    const unsubHosts = onSnapshot(collection(db, "live_rooms"), s => {
      const all = s.docs.map(d => d.data() as any);
      setLiveHosts(all.filter(h=> h.isLive === true && h.nickname !== nicknameRef.current));
    });
    return () => unsubHosts();
  }, [nickname]);
  const currentRoom = useMemo(() => {
    if (isLive) return nicknameRef.current;
    if (watching) return watching;
    return null;
  }, [isLive, watching]);
  useEffect(() => {
    if (!currentRoom) { setChat([]); return; }
    const q = query(collection(db, "live_chat"), where("room", "==", currentRoom), orderBy("createdAt", "asc"), limit(100));
    const unsub = onSnapshot(q, s => {
      const msgs = s.docs.map(d => d.data());
      setChat(msgs);
      s.docChanges().forEach(change => {
        if(change.type==="added"){
          const data = change.doc.data() as any;
          if(data.gift && data.user !== nicknameRef.current){ triggerGift(data.gift); }
        }
      });
    });
    return () => unsub();
  }, [currentRoom]);
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}) },[chat]);
  const triggerGift = (emoji: string) => {
    let type = "heart"; if(emoji==="🚀") type="rocket"; if(emoji==="👑") type="crown"; if(emoji==="💎") type="diamond"; if(emoji==="🔥") type="fire"; if(emoji==="🌹") type="heart";
    const count = type==="heart" ? 6 : 1;
    for(let i=0;i<count;i++){ setTimeout(()=>{ const id = Math.random().toString(36).slice(2)+i; const x = Math.random()*70+10; setGifts(g=>[...g, { id, emoji, x, type }]); setTimeout(()=> setGifts(g=>g.filter(f=>f.id!==id)), 3000); }, i*100); }
  };
  const saveNickname = () => { const clean = tempNick.trim().toLowerCase().replace(/[^a-z0-9_]/g,""); if(clean.length<3) return alert("Min 3"); localStorage.setItem("loomi_nickname", clean); nicknameRef.current = clean; setNickname(clean); };
  const goLive = async () => {
    try {
      pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
      const stream = await navigator.mediaDevices.getUserMedia({video:{width:640, height:480, facingMode:"user"}, audio:true});
      streamRef.current = stream; if(videoRef.current){ videoRef.current.srcObject = stream; await videoRef.current.play().catch(()=>{}); }
      setIsLive(true); setWatching(null); setTab("live");
      await setDoc(doc(db, "live_rooms", nicknameRef.current), { nickname: nicknameRef.current, isLive:true, createdAt: serverTimestamp() });
      onSnapshot(collection(db, `live_rooms/${nicknameRef.current}/viewers`), async snap => {
        for(const change of snap.docChanges()){ if(change.type==="added"){ const viewerId = change.doc.id; const data = change.doc.data() as any; if(!data.offer || pcsRef.current.has(viewerId)) continue; const pc = new RTCPeerConnection(ICE); pcsRef.current.set(viewerId, pc); stream.getTracks().forEach(t=> pc.addTrack(t, stream)); pc.onicecandidate = e => { if(e.candidate) addDoc(collection(db, `live_rooms/${nicknameRef.current}/viewers/${viewerId}/candidates_host`), { candidate: e.candidate.toJSON() }); }; onSnapshot(collection(db, `live_rooms/${nicknameRef.current}/viewers/${viewerId}/candidates_viewer`), s => { s.docChanges().forEach(async ch=>{ if(ch.type==="added"){ try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{} } }); }); await pc.setRemoteDescription(new RTCSessionDescription(data.offer)); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); await updateDoc(doc(db, `live_rooms/${nicknameRef.current}/viewers/${viewerId}`), { answer: { sdp: answer.sdp, type: answer.type } }); } }
      });
    } catch(e:any){ alert("Allow cam/mic"); }
  };
  const stopLive = async () => {
    streamRef.current?.getTracks().forEach(t=>t.stop()); pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear(); setIsLive(false); if(videoRef.current) videoRef.current.srcObject=null;
    try{ const viewersSnap = await getDocs(collection(db, `live_rooms/${nicknameRef.current}/viewers`)); for (const d of viewersSnap.docs) await deleteDoc(d.ref); const chatSnap = await getDocs(query(collection(db, "live_chat"), where("room", "==", nicknameRef.current))); for (const d of chatSnap.docs) await deleteDoc(d.ref); await deleteDoc(doc(db, "live_rooms", nicknameRef.current)); }catch{} setChat([]);
  };
  const watchHost = async (hostNick: string) => {
    if(isLive) await stopLive(); pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear(); remoteStreamRef.current = new MediaStream(); setWatching(hostNick); setTab("live");
    const pc = new RTCPeerConnection(ICE); pcsRef.current.set(hostNick, pc); if(remoteRef.current) remoteRef.current.srcObject = remoteStreamRef.current;
    pc.ontrack = (e) => { remoteStreamRef.current?.addTrack(e.track); if(remoteRef.current && remoteStreamRef.current){ remoteRef.current.srcObject = remoteStreamRef.current; remoteRef.current.play().catch(()=>{ if(remoteRef.current){ remoteRef.current.muted=true; remoteRef.current.play(); } }); } };
    pc.onicecandidate = e => { if(e.candidate) addDoc(collection(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}/candidates_viewer`), { candidate: e.candidate.toJSON() }); };
    onSnapshot(collection(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}/candidates_host`), s => { s.docChanges().forEach(async ch=>{ if(ch.type==="added"){ try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{} } }); });
    pc.addTransceiver("video", { direction: "recvonly" }); pc.addTransceiver("audio", { direction: "recvonly" }); const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    await setDoc(doc(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}`), { viewer: nicknameRef.current, offer: { sdp: offer.sdp, type: offer.type }, createdAt: serverTimestamp() });
    onSnapshot(doc(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}`), async snap => { const data=snap.data() as any; if(data?.answer && pc.signalingState==="have-local-offer"){ await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); } });
  };
  const stopWatching = async () => { pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear(); if(remoteRef.current) remoteRef.current.srcObject=null; remoteStreamRef.current = new MediaStream(); const w=watching; setWatching(null); try{ if(w) await deleteDoc(doc(db, `live_rooms/${w}/viewers/${nicknameRef.current}`)); }catch{} setChat([]); };
  const sendChat = async () => { if(!input.trim() || !currentRoom) return; const t=input.trim(); setInput(""); await addDoc(collection(db,"live_chat"), { room: currentRoom, user:nicknameRef.current, msg:t, createdAt: serverTimestamp() }); };
  const sendGift = async (cost:number, emoji:string) => { if(!currentRoom) return alert("Go live or watch first"); if(keys < cost) { setShowRecharge(true); return; } if(cost>0){ const newKeys = keys - cost; setKeys(newKeys); localStorage.setItem("loomi_keys", newKeys.toString()); } triggerGift(emoji); await addDoc(collection(db,"live_chat"), { room: currentRoom, user:nicknameRef.current, msg:`sent ${emoji}`, gift:emoji, cost, createdAt: serverTimestamp() }); };
  const rankings = useMemo(()=>{ const map:Record<string,number>={}; chat.forEach((c:any)=>{ if(c.gift) map[c.user]=(map[c.user]||0)+(c.cost||1); }); return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([user,pts],i)=>({user,pts,rank:i+1})); },[chat]);

  if(!nickname) return (
    <div className="min-h-screen bg-[#150826] text-white flex items-center justify-center max-w-[430px] mx-auto p-6">
      <div className="w-full text-center"><p className="text-[11px] tracking-[0.3em] text-[#FFD700] font-black">LOOMI-LIVE</p><h1 className="text-[32px] font-black mt-2">Loomi ✨ Username</h1><p className="text-xs text-white/50 mt-1">Will appear in LIVE, rankings, balance</p><input value={tempNick} onChange={e=>setTempNick(e.target.value)} placeholder="your name" className="w-full mt-6 bg-[#241040] border border-[#3A1B63] rounded-2xl p-4 text-white placeholder:text-white/40 outline-none focus:border-[#FFD700]" /><button onClick={saveNickname} className="w-full mt-4 bg-[#FFD700] text-black py-4 rounded-2xl font-black">Continue</button></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#150826] text-white flex flex-col max-w-[430px] mx-auto relative overflow-hidden">
      {/* LOOMI-LIVE HEADER - like mockup */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1 bg-[#150826]">
        <div><p className="text-[11px] tracking-[0.3em] text-[#FFD700] font-black leading-none">MANSION</p><h1 className="text-[22px] font-black leading-none mt-0.5">LOOMI-LIVE</h1></div>
        <div className="flex items-center gap-2"><span className="bg-[#241040] border border-[#3A1B63] px-3 py-1.5 rounded-full text-xs font-bold">🪙 {keys}</span><button onClick={()=>setShowDashboard(true)} className="w-8 h-8 bg-[#241040] border border-[#3A1B63] rounded-full text-sm">☰</button></div>
      </div>
      <div className="flex justify-between items-center border-b border-[#3A1B63] bg-[#150826] px-4">
        <div className="flex gap-5 text-[12px] font-bold">
          <button onClick={()=>setTab("live")} className={`py-3 ${tab==="live"?"border-b-2 border-[#FFD700] text-white":"text-white/50"}`}>LIVE</button>
          <button onClick={()=>setTab("discover")} className={`py-3 ${tab==="discover"?"border-b-2 border-[#FFD700]":"text-white/50"}`}>Discover</button>
          <button onClick={()=>setTab("ranking")} className={`py-3 ${tab==="ranking"?"border-b-2 border-[#FFD700]":"text-white/50"}`}>Rankings</button>
          <button onClick={()=>setTab("balance")} className={`py-3 ${tab==="balance"?"border-b-2 border-[#FFD700]":"text-white/50"}`}>Balance</button>
        </div>
      </div>

      <div className="flex justify-between items-center px-4 py-2 bg-[#150826] text-xs">
        <span className="font-black">@{nickname} <span className="text-[#FFD700] text-[10px]">• LIVE</span></span>
        <button onClick={()=>{ localStorage.clear(); location.reload(); }} className="bg-[#241040] border border-[#3A1B63] px-3 py-1 rounded-full text-white/70">Logout</button>
      </div>

      <div className={`relative bg-[#1E0B36] w-full overflow-hidden ${tab==="live" ? "flex-1 flex flex-col pb-[70px]" : "hidden"}`}>
        <div className="relative flex-1 aspect-[9/14] overflow-hidden">
          <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isLive ? "block" : "hidden"}`} />
          <video ref={remoteRef} autoPlay playsInline className={`w-full h-full object-cover bg-black ${watching ? "block" : "hidden"}`} />
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
            {gifts.map(g=>(<div key={g.id} className="absolute bottom-20 text-3xl animate-heart" style={{ left: `${g.x}%` }}>{g.emoji}</div>))}
          </div>
          {(isLive || watching) && (
            <>
              <div className="absolute top-2 left-2 right-2 flex justify-between z-20">
                <div className="bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-xs flex items-center gap-1">🔴 @{watching||nickname} ❤️ {chat.length}</div>
                <div className="flex gap-1"><div className="bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-xs">{liveHosts.length+1} viewers</div><button onClick={()=> isLive ? stopLive() : stopWatching()} className="bg-black/60 w-6 h-6 rounded-full flex items-center justify-center">✕</button></div>
              </div>
              <div className="absolute top-10 left-2 bg-black/60 px-2.5 py-1 rounded-full text-[10px] z-20">Daily Ranking</div>
              <div className="absolute top-10 right-2 bg-[#FFD700] text-black px-2.5 py-1 rounded-full text-[10px] font-black z-20">Gallery 3/10</div>
            </>
          )}
          {!isLive && !watching && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1E0B36] to-black z-10">
              <p className="text-[11px] tracking-[0.25em] text-[#FFD700] font-black mb-2">LOOMI-LIVE</p>
              <button onClick={goLive} className="bg-[#FFD700] text-black px-10 py-4 rounded-full font-black text-lg shadow-[0_0_30px_rgba(255,215,0,0.4)]">🔴 GO LIVE</button>
              <p className="mt-3 text-white/50 text-xs">{liveHosts.length} live now</p>
            </div>
          )}
        </div>
        <div className="bg-[#150826] p-2 h-[20vh] overflow-y-auto space-y-1">
          {chat.map((c,i)=><p key={i} className="text-[13px]"><span className="text-[#FFD700] font-bold">@{c.user}:</span> <span className="text-white/90">{c.msg}</span></p>)}
          <div ref={chatEndRef} />
        </div>
        {/* GIFT BAR - mockup style */}
        <div className="bg-[#241040] border-t border-[#3A1B63] p-2 flex gap-2 overflow-x-auto relative z-30">
          <button onClick={()=>sendGift(0,"❤️")} className="min-w-[64px] bg-[#150826] border border-[#3A1B63] rounded-xl py-2 text-xs font-bold active:scale-95">❤️<br/><span className="text-white/60">FREE</span></button>
          <button onClick={()=>sendGift(1,"🌹")} className="min-w-[64px] bg-[#150826] border border-[#3A1B63] rounded-xl py-2 text-xs font-bold active:scale-95">🌹<br/>1 🪙</button>
          <button onClick={()=>sendGift(5,"🚀")} className="min-w-[64px] bg-[#150826] border border-[#3A1B63] rounded-xl py-2 text-xs font-bold active:scale-95">🚀<br/>5 🪙</button>
          <button onClick={()=>sendGift(10,"👑")} className="min-w-[64px] bg-[#150826] border border-[#3A1B63] rounded-xl py-2 text-xs font-bold active:scale-95">👑<br/>10</button>
          <button onClick={()=>sendGift(50,"💎")} className="min-w-[64px] bg-[#FFD700] text-black rounded-xl py-2 text-xs font-black active:scale-95">💎<br/>50</button>
          <button onClick={()=>sendGift(100,"🔥")} className="min-w-[64px] bg-orange-600 rounded-xl py-2 text-xs font-bold active:scale-95">🔥<br/>100</button>
        </div>
        <div className="p-2 flex gap-2 bg-[#150826] border-t border-[#3A1B63] relative z-30">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendChat()} className="flex-1 bg-[#241040] border border-[#3A1B63] rounded-full px-4 py-2.5 text-sm outline-none placeholder:text-white/40" placeholder={currentRoom ? `Chat in @${currentRoom}` : "Go live first"} />
          <button onClick={sendChat} className="bg-[#FFD700] text-black px-5 rounded-full text-sm font-black active:scale-95">Send</button>
        </div>
      </div>

      {tab==="discover" && (
        <div className="flex-1 bg-[#150826] overflow-y-auto pb-[70px]">
          <div className="p-3">
            <p className="text-xs font-bold mb-2 text-[#FFD700]">Discover LIVE - Users who entered username appear here</p>
            <div className="flex gap-3 overflow-x-auto">
              <div className="text-center min-w-[56px]"><div onClick={goLive} className="w-14 h-14 rounded-full bg-[#FFD700] text-black flex items-center justify-center font-black cursor-pointer">+</div><p className="text-[11px] mt-1">Go LIVE</p></div>
              {liveHosts.map((h:any)=>(
                <div key={h.nickname} onClick={()=>watchHost(h.nickname)} className="text-center min-w-[56px] cursor-pointer"><div className="w-14 h-14 rounded-full bg-red-600 border-2 border-[#FFD700] flex items-center justify-center animate-pulse">🔴</div><p className="text-[11px] mt-1 truncate w-14">@{h.nickname}</p></div>
              ))}
            </div>
          </div>
          <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl mx-3 h-64 flex items-center justify-center text-white/40 text-sm">LIVE Preview Area</div>
        </div>
      )}

      {tab==="ranking" && (
        <div className="flex-1 bg-[#150826] text-white flex flex-col pb-[70px]">
          <div className="flex gap-2 p-3 border-b border-[#3A1B63]">
            <button onClick={()=>setRankingTab("viewers")} className={`px-4 py-1.5 rounded-full text-xs font-bold ${rankingTab==="viewers"?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>Top viewers</button>
            <button onClick={()=>setRankingTab("guardian")} className={`px-4 py-1.5 rounded-full text-xs font-bold ${rankingTab==="guardian"?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>Guardian</button>
          </div>
          {rankingTab==="viewers" ? (
            <div className="flex-1 overflow-y-auto p-3">
              {rankings.length===0 ? <p className="text-xs text-white/40 text-center mt-10">No viewers yet</p> :
                rankings.map(r=>(
                  <div key={r.user} className="flex items-center gap-3 py-2 border-b border-[#3A1B63]">
                    <span className="w-6 font-black text-[#FFD700]">{r.rank}</span><div className="w-10 h-10 rounded-full bg-[#241040] border border-[#3A1B63]"></div>
                    <div className="flex-1"><p className="text-sm font-bold">@{r.user}</p></div><span className="text-sm font-bold text-[#FFD700]">{r.pts} pts</span>
                  </div>
                ))
              }
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center"><div className="text-7xl">🦌</div><h2 className="font-black text-xl mt-3">Guardian</h2><p className="text-xs text-white/50 mt-2">The #1 sender becomes Guardian</p><button onClick={()=>sendGift(100,"🛡️")} className="mt-4 bg-[#FFD700] text-black px-6 py-3 rounded-full text-xs font-black">Send Guardian Pledge (100)</button></div>
          )}
        </div>
      )}

      {tab==="balance" && (
        <div className="flex-1 bg-[#150826] text-white p-3 space-y-3 overflow-y-auto pb-[70px]">
          <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl text-center py-6"><p className="text-xs text-white/60">Estimated balance</p><p className="text-4xl font-black text-[#FFD700]">{keys} 🪙</p><p className="text-xs text-white/50">ZAR 0.00</p></div>
          <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl p-4 flex justify-between items-center"><div><p className="text-sm font-bold">Coins</p><p className="text-xs text-white/50">@{nickname}</p></div><button onClick={()=>setShowRecharge(true)} className="text-xs bg-[#FFD700] text-black px-3 py-1.5 rounded-full font-black">Get Coins</button></div>
          <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl p-4"><p className="text-sm font-bold">Transactions</p><p className="text-xs text-white/50 mt-1">Purchase of Coins: will show here</p></div>
        </div>
      )}

      {showRecharge && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end"><div className="flex-1 bg-black/60" onClick={()=>setShowRecharge(false)}></div><div className="bg-white text-black rounded-t-[24px] p-4"><h2 className="text-center font-black">Recharge - Loomi-Live</h2><div className="grid grid-cols-3 gap-2 mt-4">{[{c:5,r:"R 1,35"},{c:30,r:"R 8,09"},{c:40,r:"R 10,79"},{c:50,r:"R 13,45"},{c:70,r:"R 18,85"},{c:139,r:"R 37,39"}].map(p=><div key={p.c} onClick={()=>{ setKeys(k=>k+p.c); localStorage.setItem("loomi_keys",(keys+p.c).toString()); }} className="border rounded-xl p-3 text-center cursor-pointer active:scale-95"><p className="font-black">🪙 {p.c}</p><p className="text-xs">{p.r}</p></div>)}</div><button onClick={()=>setShowRecharge(false)} className="w-full mt-4 bg-black text-white py-3 rounded-full font-black">Close</button></div></div>
      )}

      {showDashboard && (
        <div className="absolute inset-0 z-[100] flex">
          <div className="flex-1 bg-black/60" onClick={()=>setShowDashboard(false)}></div>
          <div className="w-[78%] max-w-[320px] bg-[#150826] border-l border-[#3A1B63] h-full overflow-y-auto p-3 space-y-3">
            <div className="flex justify-between items-center p-1"><p className="font-black text-white">@{nickname}</p><button onClick={()=>setShowDashboard(false)} className="text-white text-xl">✕</button></div>
            <div onClick={()=>{setTab("balance"); setShowDashboard(false);}} className="bg-[#241040] border border-[#3A1B63] rounded-2xl p-3.5 flex justify-between items-center cursor-pointer"><div className="flex items-center gap-3"><span>🪪</span><p className="font-bold text-[14px] text-white">Balance</p></div><span className="text-white/40">›</span></div>
            <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl divide-y divide-[#3A1B63]">
              <div className="p-3.5 flex justify-between items-center"><div className="flex gap-3 items-center"><span>🕐</span><p className="text-[14px] font-bold text-white">Activity centre</p></div><span className="text-white/40">›</span></div>
              <div className="p-3.5 flex justify-between items-center"><div className="flex gap-3 items-center"><span>⬇️</span><p className="text-[14px] font-bold text-white">Offline videos</p></div><span className="text-white/40">›</span></div>
              <div className="p-3.5 flex justify-between items-center"><div className="flex gap-3 items-center"><span>🎵</span><p className="text-[14px] font-bold text-white">Your Music</p></div><span className="text-white/40">›</span></div>
            </div>
            <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl p-3.5 flex justify-between items-center"><div className="flex gap-3 items-center"><span>🔳</span><p className="text-[14px] font-bold text-white">Your QR code</p></div><span className="text-white/40">›</span></div>
            <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl divide-y divide-[#3A1B63]">
              <div className="p-3.5 flex justify-between items-center"><div className="flex gap-3 items-center"><span>💡</span><p className="text-[14px] font-bold text-white">Creator Search Insights</p></div><span className="text-white/40">›</span></div>
              <div className="p-3.5 flex justify-between items-center"><div className="flex gap-3 items-center"><span>👥⭐</span><p className="text-[14px] font-bold text-white">Loomi Studio</p></div><span className="text-white/40">›</span></div>
              <div className="p-3.5 flex justify-between items-center"><div className="flex gap-3 items-center"><span>🔥</span><p className="text-[14px] font-bold text-white">Promote</p></div><span className="text-white/40">›</span></div>
              <div className="p-3.5 flex justify-between items-center"><div className="flex gap-3 items-center"><span className="text-[10px] border px-1">AD</span><p className="text-[14px] font-bold text-white">Ads Manager</p></div><span className="text-white/40">›</span></div>
            </div>
            <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl p-3.5 flex justify-between items-center"><div className="flex gap-3 items-center"><span>⚙️</span><p className="text-[14px] font-bold text-white">Settings and privacy</p></div><span className="text-white/40">›</span></div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-[#150826] border-t border-[#3A1B63] flex justify-around items-center py-2.5 z-[60]">
        <button onClick={()=>setTab("live")} className={`flex flex-col items-center ${tab==="live"?"text-[#FFD700]":"text-white/50"}`}><span className="text-[20px]">🏠</span><span className="text-[9px] font-bold">LIVE</span></button>
        <button onClick={()=>setTab("discover")} className={`flex flex-col items-center ${tab==="discover"?"text-[#FFD700]":"text-white/50"}`}><span className="text-[20px]">🔍</span><span className="text-[9px]">Discover</span></button>
        <button onClick={goLive} className="bg-[#FFD700] text-black w-12 h-8 rounded-lg flex items-center justify-center font-black text-xl">+</button>
        <button onClick={()=>setTab("ranking")} className={`flex flex-col items-center ${tab==="ranking"?"text-[#FFD700]":"text-white/50"}`}><span className="text-[20px]">🏆</span><span className="text-[9px]">Rankings</span></button>
        <button onClick={()=>setTab("balance")} className={`flex flex-col items-center ${tab==="balance"?"text-[#FFD700]":"text-white/50"}`}><span className="text-[20px]">👤</span><span className="text-[9px]">Balance</span></button>
      </div>

      <style>{`
        @keyframes heartFloat{0%{transform:translateY(0) scale(0.3);opacity:0}15%{opacity:1}100%{transform:translateY(-80vh);opacity:0}}
        .animate-heart{animation:heartFloat 3s ease-out forwards}
      `}</style>
    </div>
  );
}
