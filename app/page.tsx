"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, getDocs, where } from "firebase/firestore";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };
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

  // BUG 1 FIX: Hosters only when isLive=true and cleanup
  useEffect(() => {
    const unsubHosts = onSnapshot(collection(db, "live_rooms"), s => {
      const all = s.docs.map(d => d.data() as any);
      // Only show if isLive true AND not me
      setLiveHosts(all.filter(h=> h.isLive === true && h.nickname !== nicknameRef.current));
    });
    return () => unsubHosts();
  }, [nickname]);

  // BUG 3 FIX: Chat per room - clears when offline
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
          if(data.gift && data.user !== nicknameRef.current){
            triggerGift(data.gift);
          }
        }
      });
    });
    return () => unsub();
  }, [currentRoom]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}) },[chat]);

  const triggerGift = (emoji: string) => {
    let type = "heart";
    if(emoji==="🚀") type="rocket";
    if(emoji==="👑") type="crown";
    if(emoji==="💎") type="diamond";
    if(emoji==="🔥") type="fire";
    if(emoji==="🌹") type="heart";
    const count = type==="heart" ? 6 : 1;
    for(let i=0;i<count;i++){
      setTimeout(()=>{
        const id = Math.random().toString(36).slice(2)+i;
        const x = Math.random()*70+10;
        setGifts(g=>[...g, { id, emoji, x, type }]);
        setTimeout(()=> setGifts(g=>g.filter(f=>f.id!==id)), 3000);
      }, i*100);
    }
  };

  const saveNickname = () => {
    const clean = tempNick.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    if(clean.length<3) return alert("Min 3");
    localStorage.setItem("loomi_nickname", clean);
    nicknameRef.current = clean;
    setNickname(clean);
  };

  // BUG 2 FIX: Audience CAN see camera now
  const goLive = async () => {
    try {
      pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
      const stream = await navigator.mediaDevices.getUserMedia({video:{width:640, height:480, facingMode:"user"}, audio:true});
      streamRef.current = stream;
      if(videoRef.current){ videoRef.current.srcObject = stream; await videoRef.current.play().catch(()=>{}); }
      setIsLive(true); setWatching(null); setTab("live");
      await setDoc(doc(db, "live_rooms", nicknameRef.current), { nickname: nicknameRef.current, isLive:true, createdAt: serverTimestamp() });

      onSnapshot(collection(db, `live_rooms/${nicknameRef.current}/viewers`), async snap => {
        for(const change of snap.docChanges()){
          if(change.type==="added"){
            const viewerId = change.doc.id;
            const data = change.doc.data() as any;
            if(!data.offer || pcsRef.current.has(viewerId)) continue;
            const pc = new RTCPeerConnection(ICE);
            pcsRef.current.set(viewerId, pc);
            stream.getTracks().forEach(t=> pc.addTrack(t, stream));
            pc.onicecandidate = e => { if(e.candidate) addDoc(collection(db, `live_rooms/${nicknameRef.current}/viewers/${viewerId}/candidates_host`), { candidate: e.candidate.toJSON() }); };
            onSnapshot(collection(db, `live_rooms/${nicknameRef.current}/viewers/${viewerId}/candidates_viewer`), s => {
              s.docChanges().forEach(async ch=>{ if(ch.type==="added"){ try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{} } });
            });
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await updateDoc(doc(db, `live_rooms/${nicknameRef.current}/viewers/${viewerId}`), { answer: { sdp: answer.sdp, type: answer.type } });
          }
        }
      });
    } catch(e:any){ alert("Allow cam/mic"); }
  };

  const stopLive = async () => {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    setIsLive(false);
    if(videoRef.current) videoRef.current.srcObject=null;
    try{
      const viewersSnap = await getDocs(collection(db, `live_rooms/${nicknameRef.current}/viewers`));
      for (const d of viewersSnap.docs) await deleteDoc(d.ref);
      // BUG 3: clear chat of this room when offline
      const chatSnap = await getDocs(query(collection(db, "live_chat"), where("room", "==", nicknameRef.current)));
      for (const d of chatSnap.docs) await deleteDoc(d.ref);
      await deleteDoc(doc(db, "live_rooms", nicknameRef.current));
    }catch{}
    setChat([]);
  };

  const watchHost = async (hostNick: string) => {
    if(isLive) await stopLive();
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    remoteStreamRef.current = new MediaStream();
    setWatching(hostNick); setTab("live");
    const pc = new RTCPeerConnection(ICE);
    pcsRef.current.set(hostNick, pc);
    if(remoteRef.current) remoteRef.current.srcObject = remoteStreamRef.current;
    pc.ontrack = (e) => {
      remoteStreamRef.current?.addTrack(e.track);
      if(remoteRef.current && remoteStreamRef.current){
        remoteRef.current.srcObject = remoteStreamRef.current;
        remoteRef.current.play().catch(()=>{ if(remoteRef.current){ remoteRef.current.muted=true; remoteRef.current.play(); } });
      }
    };
    pc.onicecandidate = e => { if(e.candidate) addDoc(collection(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}/candidates_viewer`), { candidate: e.candidate.toJSON() }); };
    onSnapshot(collection(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}/candidates_host`), s => {
      s.docChanges().forEach(async ch=>{ if(ch.type==="added"){ try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{} } });
    });
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(doc(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}`), { viewer: nicknameRef.current, offer: { sdp: offer.sdp, type: offer.type }, createdAt: serverTimestamp() });
    onSnapshot(doc(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}`), async snap => {
      const data=snap.data() as any; if(data?.answer && pc.signalingState==="have-local-offer"){ await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); }
    });
  };

  const stopWatching = async () => {
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    if(remoteRef.current) remoteRef.current.srcObject=null;
    remoteStreamRef.current = new MediaStream();
    const w=watching; setWatching(null);
    try{ if(w) await deleteDoc(doc(db, `live_rooms/${w}/viewers/${nicknameRef.current}`)); }catch{}
    setChat([]);
  };

  const sendChat = async () => { 
    if(!input.trim() || !currentRoom) return; 
    const t=input.trim(); setInput(""); 
    await addDoc(collection(db,"live_chat"), { room: currentRoom, user:nicknameRef.current, msg:t, createdAt: serverTimestamp() }); 
  };
  
  // BUG 4 FIX: Gifts now clickable with z-index and pointer events
  const sendGift = async (cost:number, emoji:string) => {
    if(!currentRoom) return alert("Go live or watch first");
    if(keys < cost) { setShowRecharge(true); return; }
    if(cost>0){ const newKeys = keys - cost; setKeys(newKeys); localStorage.setItem("loomi_keys", newKeys.toString()); }
    triggerGift(emoji);
    await addDoc(collection(db,"live_chat"), { room: currentRoom, user:nicknameRef.current, msg:`sent ${emoji}`, gift:emoji, cost, createdAt: serverTimestamp() });
  };

  const rankings = useMemo(()=>{
    const map:Record<string,number>={};
    chat.forEach((c:any)=>{ if(c.gift) map[c.user]=(map[c.user]||0)+(c.cost||1); });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([user,pts],i)=>({user,pts,rank:i+1}));
  },[chat]);

  if(!nickname) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center max-w-[430px] mx-auto p-6">
      <div className="w-full"><h1 className="text-[32px] font-black">Loomi ✨ Username</h1><p className="text-xs text-zinc-500 mt-1">Will appear in LIVE, rankings, balance</p><input value={tempNick} onChange={e=>setTempNick(e.target.value)} placeholder="your name" className="w-full mt-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-4" /><button onClick={saveNickname} className="w-full mt-4 bg-white text-black py-4 rounded-2xl font-black">Continue</button></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-[430px] mx-auto relative overflow-hidden">
      
      {/* TOP TIKTOK STYLE TABS - BUG 5 */}
      <div className="flex justify-around border-b border-zinc-800 bg-black text-[12px] font-bold">
        <button onClick={()=>setTab("live")} className={`py-3 px-2 ${tab==="live"?"border-b-2 border-white text-white":"text-zinc-500"}`}>LIVE</button>
        <button onClick={()=>setTab("discover")} className={`py-3 px-2 ${tab==="discover"?"border-b-2 border-white":"text-zinc-500"}`}>Discover</button>
        <button onClick={()=>setTab("ranking")} className={`py-3 px-2 ${tab==="ranking"?"border-b-2 border-white":"text-zinc-500"}`}>Rankings</button>
        <button onClick={()=>setTab("balance")} className={`py-3 px-2 ${tab==="balance"?"border-b-2 border-white":"text-zinc-500"}`}>Balance</button>
      </div>

      <div className="flex justify-between items-center p-2 bg-black text-xs">
        <span className="font-black">@{nickname}</span>
        <div className="flex gap-2"><span className="bg-zinc-800 px-2 py-1 rounded-full">🪙 {keys}</span><button onClick={()=>{ localStorage.clear(); location.reload(); }} className="bg-zinc-800 px-2 py-1 rounded-full">Logout</button></div>
      </div>

      {/* LIVE VIEW - TikTok live layout */}
      <div className={`relative bg-zinc-900 w-full overflow-hidden ${tab==="live" ? "flex-1 flex flex-col" : "hidden"}`}>
        <div className="relative flex-1 aspect-[9/14] overflow-hidden">
          <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isLive ? "block" : "hidden"}`} />
          <video ref={remoteRef} autoPlay playsInline className={`w-full h-full object-cover bg-black ${watching ? "block" : "hidden"}`} />
          
          {/* Gifts overlay - pointer-events-none so gifts don't block clicks */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
            {gifts.map(g=>(
              <div key={g.id} className="absolute bottom-20 text-3xl animate-heart" style={{ left: `${g.x}%` }}>{g.emoji}</div>
            ))}
          </div>

          {/* TikTok Live Header */}
          {(isLive || watching) && (
            <>
              <div className="absolute top-2 left-2 right-2 flex justify-between z-20">
                <div className="bg-black/60 px-2 py-1 rounded-full text-xs flex items-center gap-1">@{watching||nickname} ❤️ {chat.length}</div>
                <div className="flex gap-1"><div className="bg-black/60 px-2 py-1 rounded-full text-xs">{liveHosts.length+1} viewers</div><button onClick={()=> isLive ? stopLive() : stopWatching()} className="bg-black/60 w-6 h-6 rounded-full flex items-center justify-center">✕</button></div>
              </div>
              <div className="absolute top-10 left-2 bg-black/60 px-2 py-0.5 rounded-full text-[10px] z-20">Daily Ranking</div>
              <div className="absolute top-10 right-2 bg-blue-600/80 px-2 py-0.5 rounded-full text-[10px] z-20">Gallery 3/10</div>
            </>
          )}

          {!isLive && !watching && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black z-10">
              <button onClick={goLive} className="bg-white text-black px-10 py-4 rounded-full font-black text-lg">🔴 GO LIVE</button>
              <p className="mt-3 text-zinc-500 text-xs">{liveHosts.length} live now</p>
            </div>
          )}
        </div>

        {/* Chat area - TikTok style */}
        <div className="bg-black p-2 h-[20vh] overflow-y-auto space-y-1">
          {chat.map((c,i)=><p key={i} className="text-[13px]"><span className="text-zinc-500 font-bold">@{c.user}:</span> {c.msg}</p>)}
          <div ref={chatEndRef} />
        </div>

        {/* BUG 4 FIX: Gifts bar clickable - high z-index */}
        <div className="bg-zinc-900 border-t border-zinc-800 p-2 flex gap-2 overflow-x-auto relative z-30">
          <button onClick={()=>sendGift(0,"❤️")} className="min-w-[64px] bg-zinc-800 rounded-xl py-2 text-xs font-bold active:scale-95">❤️<br/>FREE</button>
          <button onClick={()=>sendGift(1,"🌹")} className="min-w-[64px] bg-zinc-800 rounded-xl py-2 text-xs font-bold active:scale-95">🌹<br/>1 🪙</button>
          <button onClick={()=>sendGift(5,"🚀")} className="min-w-[64px] bg-zinc-800 rounded-xl py-2 text-xs font-bold active:scale-95">🚀<br/>5 🪙</button>
          <button onClick={()=>sendGift(10,"👑")} className="min-w-[64px] bg-zinc-800 rounded-xl py-2 text-xs font-bold active:scale-95">👑<br/>10</button>
          <button onClick={()=>sendGift(50,"💎")} className="min-w-[64px] bg-purple-600 rounded-xl py-2 text-xs font-bold active:scale-95">💎<br/>50</button>
          <button onClick={()=>sendGift(100,"🔥")} className="min-w-[64px] bg-orange-600 rounded-xl py-2 text-xs font-bold active:scale-95">🔥<br/>100</button>
        </div>

        <div className="p-2 flex gap-2 bg-black border-t border-zinc-800 relative z-30">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendChat()} className="flex-1 bg-zinc-800 rounded-full px-4 py-2.5 text-sm" placeholder={currentRoom ? `Chat in @${currentRoom}` : "Go live first"} />
          <button onClick={sendChat} className="bg-white text-black px-5 rounded-full text-sm font-black active:scale-95">Send</button>
        </div>
      </div>

      {/* DISCOVER TAB - TikTok discover layout */}
      {tab==="discover" && (
        <div className="flex-1 bg-black overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-bold mb-2">Discover LIVE - Users who entered username appear here</p>
            <div className="flex gap-3 overflow-x-auto">
              <div className="text-center min-w-[56px]"><div onClick={goLive} className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center font-black cursor-pointer">+</div><p className="text-[11px] mt-1">Go LIVE</p></div>
              {liveHosts.map((h:any)=>(
                <div key={h.nickname} onClick={()=>watchHost(h.nickname)} className="text-center min-w-[56px] cursor-pointer"><div className="w-14 h-14 rounded-full bg-red-600 border-2 border-pink-500 flex items-center justify-center animate-pulse">🔴</div><p className="text-[11px] mt-1 truncate w-14">@{h.nickname}</p></div>
              ))}
            </div>
          </div>
          <div className="bg-zinc-900 h-64 flex items-center justify-center text-zinc-500 text-sm">LIVE Preview Area (like PUBG gameplay)</div>
        </div>
      )}

      {/* RANKING TAB - like your screenshots */}
      {tab==="ranking" && (
        <div className="flex-1 bg-white text-black flex flex-col">
          <div className="flex gap-2 p-3 border-b">
            <button onClick={()=>setRankingTab("viewers")} className={`px-4 py-1.5 rounded-full text-xs font-bold ${rankingTab==="viewers"?"bg-black text-white":"bg-zinc-100"}`}>Top viewers</button>
            <button onClick={()=>setRankingTab("guardian")} className={`px-4 py-1.5 rounded-full text-xs font-bold ${rankingTab==="guardian"?"bg-black text-white":"bg-zinc-100"}`}>Guardian</button>
          </div>
          {rankingTab==="viewers" ? (
            <div className="flex-1 overflow-y-auto p-3">
              {rankings.length===0 ? <p className="text-xs text-zinc-400 text-center mt-10">No viewers yet - usernames who send gifts will appear here automatically</p> :
                rankings.map(r=>(
                  <div key={r.user} className="flex items-center gap-3 py-2 border-b border-zinc-100">
                    <span className="w-6 font-black">{r.rank}</span>
                    <div className="w-10 h-10 rounded-full bg-zinc-200"></div>
                    <div className="flex-1"><p className="text-sm font-bold">@{r.user}</p>{r.rank===1 && <span className="text-[10px] bg-pink-100 text-pink-600 px-1 rounded">No.{r.rank}</span>}</div>
                    <span className="text-sm font-bold">{r.pts} pts</span>
                  </div>
                ))
              }
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="text-7xl">🦌</div>
              <h2 className="font-black text-xl mt-3">Guardian</h2>
              <p className="text-xs text-zinc-500 mt-2">The #1 sender becomes Guardian. Usernames from gifts show here.</p>
              <button onClick={()=>sendGift(100,"🛡️")} className="mt-4 bg-yellow-100 px-6 py-3 rounded-full text-xs font-bold">Send Guardian Pledge (100)</button>
            </div>
          )}
        </div>
      )}

      {/* BALANCE TAB - like your screenshot */}
      {tab==="balance" && (
        <div className="flex-1 bg-[#f8f5f7] text-black p-3 space-y-3 overflow-y-auto">
          <div className="text-center py-6"><p className="text-xs">Estimated balance</p><p className="text-4xl font-black">{keys} 🪙</p><p className="text-xs text-zinc-500">ZAR 0.00</p></div>
          <div className="bg-white rounded-2xl p-4 flex justify-between items-center"><div><p className="text-sm font-bold">Coins</p><p className="text-xs text-zinc-500">@{nickname}</p></div><button onClick={()=>setShowRecharge(true)} className="text-xs bg-black text-white px-3 py-1 rounded-full">Get Coins</button></div>
          <div className="bg-white rounded-2xl p-4"><p className="text-sm font-bold">Transactions</p><p className="text-xs text-zinc-500 mt-1">Purchase of Coins: will show here</p></div>
        </div>
      )}

      {showRecharge && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end"><div className="flex-1 bg-black/60" onClick={()=>setShowRecharge(false)}></div><div className="bg-white text-black rounded-t-[24px] p-4"><h2 className="text-center font-black">Recharge</h2><div className="grid grid-cols-3 gap-2 mt-4">{[{c:5,r:"R 1,35"},{c:30,r:"R 8,09"},{c:40,r:"R 10,79"},{c:50,r:"R 13,45"},{c:70,r:"R 18,85"},{c:139,r:"R 37,39"}].map(p=><div key={p.c} onClick={()=>{ setKeys(k=>k+p.c); localStorage.setItem("loomi_keys",(keys+p.c).toString()); }} className="border rounded-xl p-3 text-center cursor-pointer active:scale-95"><p className="font-black">🪙 {p.c}</p><p className="text-xs">{p.r}</p></div>)}</div><button onClick={()=>setShowRecharge(false)} className="w-full mt-4 bg-black text-white py-3 rounded-full font-black">Close</button></div></div>
      )}

      <style>{`
        @keyframes heartFloat{0%{transform:translateY(0) scale(0.3);opacity:0}15%{opacity:1}100%{transform:translateY(-80vh);opacity:0}}
        .animate-heart{animation:heartFloat 3s ease-out forwards}
      `}</style>
    </div>
  );
}
