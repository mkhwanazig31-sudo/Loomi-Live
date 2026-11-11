"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, getDocs } from "firebase/firestore";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function LoomiStructure() {
  const [nickname, setNickname] = useState("");
  const [tempNick, setTempNick] = useState("");
  const [tab, setTab] = useState<"profile"|"live"|"discover"|"balance"|"ranking">("profile");
  const [rankingTab, setRankingTab] = useState<"viewers"|"guardian">("viewers");
  const [showGifts, setShowGifts] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [keys, setKeys] = useState(0);
  const [chat, setChat] = useState<any[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [liveHosts, setLiveHosts] = useState<any[]>([]);
  const [watching, setWatching] = useState<string|null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const nicknameRef = useRef("");
  const remoteStreamRef = useRef(new MediaStream());

  useEffect(()=>{ nicknameRef.current=nickname },[nickname]);
  useEffect(()=>{
    const saved=localStorage.getItem("loomi_nickname");
    if(saved){ setNickname(saved); nicknameRef.current=saved; }
    onSnapshot(query(collection(db,"live_chat"),orderBy("createdAt","asc"),limit(150)),s=>setChat(s.docs.map(d=>d.data())));
    onSnapshot(collection(db,"live_rooms"),s=>setLiveHosts(s.docs.map(d=>d.data() as any)));
  },[]);

  const rankings = useMemo(()=>{
    const map:Record<string,number>={};
    chat.forEach((c:any)=>{ if(c.gift) map[c.user]=(map[c.user]||0)+(c.cost||1); });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([user,pts],i)=>({user,pts,rank:i+1}));
  },[chat]);

  const saveNick=()=>{
    const clean=tempNick.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    if(clean.length<3) return alert("Min 3 chars");
    localStorage.setItem("loomi_nickname",clean); nicknameRef.current=clean; setNickname(clean);
  };

  const goLive=async()=>{
    const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    streamRef.current=stream;
    if(videoRef.current){ videoRef.current.srcObject=stream; await videoRef.current.play(); }
    setIsLive(true); setTab("live");
    await setDoc(doc(db,"live_rooms",nicknameRef.current),{nickname:nicknameRef.current,isLive:true,createdAt:serverTimestamp()});
    onSnapshot(collection(db,`live_rooms/${nicknameRef.current}/viewers`),async snap=>{
      for(const ch of snap.docChanges()){
        if(ch.type==="added"){
          const id=ch.doc.id; const data=ch.doc.data() as any;
          if(!data.offer||pcsRef.current.has(id)) continue;
          const pc=new RTCPeerConnection(ICE); pcsRef.current.set(id,pc);
          stream.getTracks().forEach(t=>pc.addTrack(t,stream));
          pc.onicecandidate=e=>{ if(e.candidate) addDoc(collection(db,`live_rooms/${nicknameRef.current}/viewers/${id}/candidates_host`),{candidate:e.candidate.toJSON()}); };
          onSnapshot(collection(db,`live_rooms/${nicknameRef.current}/viewers/${id}/candidates_viewer`),s=>{
            s.docChanges().forEach(async c=>{ if(c.type==="added"){ try{ await pc.addIceCandidate(new RTCIceCandidate(c.doc.data().candidate)); }catch{} } });
          });
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const ans=await pc.createAnswer(); await pc.setLocalDescription(ans);
          await updateDoc(doc(db,`live_rooms/${nicknameRef.current}/viewers/${id}`),{answer:{sdp:ans.sdp,type:ans.type}});
        }
      }
    });
  };

  const stopLive=async()=>{
    streamRef.current?.getTracks().forEach(t=>t.stop());
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    setIsLive(false); if(videoRef.current) videoRef.current.srcObject=null;
    try{ const s=await getDocs(collection(db,`live_rooms/${nicknameRef.current}/viewers`)); s.forEach(d=>deleteDoc(d.ref)); await deleteDoc(doc(db,"live_rooms",nicknameRef.current)); }catch{}
  };

  const watchHost=async(host:string)=>{
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    remoteStreamRef.current=new MediaStream(); setWatching(host); setTab("live");
    const pc=new RTCPeerConnection(ICE); pcsRef.current.set(host,pc);
    if(remoteRef.current) remoteRef.current.srcObject=remoteStreamRef.current;
    pc.ontrack=e=>{ remoteStreamRef.current.addTrack(e.track); if(remoteRef.current){ remoteRef.current.srcObject=remoteStreamRef.current; remoteRef.current.play().catch(()=>{}); } };
    pc.onicecandidate=e=>{ if(e.candidate) addDoc(collection(db,`live_rooms/${host}/viewers/${nicknameRef.current}/candidates_viewer`),{candidate:e.candidate.toJSON()}); };
    onSnapshot(collection(db,`live_rooms/${host}/viewers/${nicknameRef.current}/candidates_host`),s=>{
      s.docChanges().forEach(async ch=>{ if(ch.type==="added"){ try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{} } });
    });
    pc.addTransceiver("video",{direction:"recvonly"}); pc.addTransceiver("audio",{direction:"recvonly"});
    const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
    await setDoc(doc(db,`live_rooms/${host}/viewers/${nicknameRef.current}`),{viewer:nicknameRef.current,offer:{sdp:offer.sdp,type:offer.type},createdAt:serverTimestamp()});
    onSnapshot(doc(db,`live_rooms/${host}/viewers/${nicknameRef.current}`),async snap=>{
      const data=snap.data() as any; if(data?.answer && pc.signalingState==="have-local-offer") await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    });
  };

  const sendGift=async(cost:number,emoji:string)=>{
    if(keys<cost){ setShowRecharge(true); return; }
    if(cost>0) setKeys(k=>k-cost);
    await addDoc(collection(db,"live_chat"),{user:nicknameRef.current,msg:`sent ${emoji}`,gift:emoji,cost,createdAt:serverTimestamp()});
  };

  if(!nickname) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 max-w-[430px] mx-auto">
      <div className="w-full">
        <h1 className="text-[30px] font-black">Enter Username</h1>
        <p className="text-sm text-zinc-500 mt-1">This name will appear in LIVE, rankings, etc</p>
        <input value={tempNick} onChange={e=>setTempNick(e.target.value)} placeholder="your username" className="w-full mt-6 bg-zinc-100 rounded-2xl p-4 border" />
        <button onClick={saveNick} className="w-full mt-4 bg-black text-white py-4 rounded-2xl font-black">Continue</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-black flex flex-col max-w-[430px] mx-auto relative">

      {/* TABS HEADER - structure like TikTok */}
      <div className="flex justify-around border-b text-[13px] font-bold">
        <button onClick={()=>setTab("profile")} className={`py-3 ${tab==="profile"?"border-b-2 border-black":"text-zinc-400"}`}>Profile</button>
        <button onClick={()=>setTab("discover")} className={`py-3 ${tab==="discover"?"border-b-2 border-black":"text-zinc-400"}`}>Discover LIVE</button>
        <button onClick={()=>setTab("live")} className={`py-3 ${tab==="live"?"border-b-2 border-black":"text-zinc-400"}`}>LIVE</button>
        <button onClick={()=>setTab("ranking")} className={`py-3 ${tab==="ranking"?"border-b-2 border-black":"text-zinc-400"}`}>Rankings</button>
        <button onClick={()=>setTab("balance")} className={`py-3 ${tab==="balance"?"border-b-2 border-black":"text-zinc-400"}`}>Balance</button>
      </div>

      {/* PROFILE TAB - generic structure, no names */}
      {tab==="profile" && (
        <div className="flex-1 p-4">
          <div className="flex justify-between">
            <div><h1 className="text-2xl font-black">@{nickname}</h1><p className="text-xs text-zinc-500">ID: {nickname}</p></div>
            <div className="w-16 h-16 rounded-full bg-zinc-200 flex items-center justify-center font-bold">YOU</div>
          </div>
          <div className="flex gap-4 mt-3 text-sm"><span><b>0</b> Following</span><span><b>0</b> Followers</span><span><b>0</b> Likes</span></div>
          <div className="flex gap-2 mt-4"><button onClick={goLive} className="border px-4 py-1.5 rounded-full text-xs font-bold">Go LIVE</button><button onClick={()=>setTab("balance")} className="border px-4 py-1.5 rounded-full text-xs">Balance</button></div>
          <div className="mt-6 grid grid-cols-3 gap-1">{[1,2,3,4,5,6].map(i=><div key={i} className="aspect-[3/4] bg-zinc-100"></div>)}</div>
        </div>
      )}

      {/* DISCOVER LIVE TAB - structure only */}
      {tab==="discover" && (
        <div className="flex-1 bg-white">
          <div className="p-3">
            <div className="flex gap-3 overflow-x-auto">
              <div className="text-center min-w-[60px]"><div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center text-xs">Go LIVE</div><p className="text-[11px] mt-1">Go LIVE</p></div>
              {/* HERE USERS WHO ENTERED USERNAME APPEAR */}
              {liveHosts.map((h:any)=>(
                <div key={h.nickname} onClick={()=>watchHost(h.nickname)} className="text-center min-w-[60px] cursor-pointer"><div className="w-14 h-14 rounded-full bg-red-500 border-2 border-pink-500 flex items-center justify-center text-white text-xs">LIVE</div><p className="text-[11px] mt-1 truncate w-14">@{h.nickname}</p></div>
              ))}
              {/* If no one live, show current user as example */}
              {liveHosts.length===0 && <div className="text-center min-w-[60px]"><div className="w-14 h-14 rounded-full bg-zinc-200"></div><p className="text-[11px] mt-1">@{nickname}</p></div>}
            </div>
          </div>
          <div className="bg-black h-64 flex items-center justify-center text-white text-sm">LIVE Preview Area (gameplay + face cam layout)</div>
          <p className="text-center text-xs text-zinc-500 mt-2">Find LIVE videos from creators you follow above</p>
        </div>
      )}

      {/* LIVE TAB - generic TikTok live structure */}
      {tab==="live" && (
        <div className="flex-1 bg-black relative flex flex-col">
          <div className="flex-1 relative bg-zinc-900">
            <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isLive?"block":"hidden"}`} />
            <video ref={remoteRef} autoPlay playsInline className={`w-full h-full object-cover ${watching?"block":"hidden"}`} />
            <div className="absolute top-2 left-2 right-2 flex justify-between z-10">
              <div className="bg-black/60 text-white px-2 py-1 rounded-full text-xs">@{watching||nickname} • ❤️ {chat.length}</div>
              <div className="flex gap-2"><div className="bg-black/60 text-white px-2 py-1 rounded-full text-xs">{liveHosts.length+1} viewers</div><button onClick={()=>{ if(isLive) stopLive(); setWatching(null); }} className="bg-black/60 text-white w-6 h-6 rounded-full">✕</button></div>
            </div>
            <div className="absolute top-10 left-2 bg-black/60 text-white px-2 py-0.5 rounded-full text-[10px]">Ranking Tag</div>
            <div className="absolute top-10 right-2 bg-black/60 text-white px-2 py-0.5 rounded-full text-[10px]">Gallery 0/10</div>
            {!isLive && !watching && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40"><button onClick={goLive} className="bg-white text-black px-6 py-2 rounded-full font-bold">Start LIVE</button></div>
            )}
          </div>
          <div className="bg-black text-white p-2 flex gap-2">
            <input placeholder="Type..." className="flex-1 bg-zinc-800 rounded-full px-3 py-1.5 text-xs" />
            <button onClick={()=>setShowGifts(true)} className="bg-zinc-800 px-3 rounded-full text-xs">🎁</button>
            <button onClick={()=>setTab("ranking")} className="bg-zinc-800 px-3 rounded-full text-xs">🏆</button>
          </div>
        </div>
      )}

      {/* RANKINGS TAB - structure only, usernames fill automatically */}
      {tab==="ranking" && (
        <div className="flex-1 bg-white flex flex-col">
          <div className="flex gap-2 p-3 border-b">
            <button onClick={()=>setRankingTab("viewers")} className={`px-4 py-1.5 rounded-full text-xs font-bold ${rankingTab==="viewers"?"bg-black text-white":"bg-zinc-100"}`}>Top viewers</button>
            <button onClick={()=>setRankingTab("guardian")} className={`px-4 py-1.5 rounded-full text-xs font-bold ${rankingTab==="guardian"?"bg-black text-white":"bg-zinc-100"}`}>Guardian</button>
          </div>
          {rankingTab==="viewers" ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {rankings.length===0 ? <p className="text-xs text-zinc-400 text-center mt-10">No viewers yet - send gifts and you will appear here</p> : 
                rankings.map(r=>(
                  <div key={r.user} className="flex items-center gap-3">
                    <span className="w-5 text-sm font-bold">{r.rank}</span>
                    <div className="w-10 h-10 rounded-full bg-zinc-200"></div>
                    <div className="flex-1"><p className="text-sm font-bold">@{r.user}</p>{r.rank===1 && <span className="text-[10px] bg-pink-100 px-1 rounded">No.1</span>}</div>
                    <span className="text-sm">{r.pts}</span>
                  </div>
                ))
              }
              <div className="border-t pt-3 mt-4 flex items-center gap-3">
                <span className="font-bold">1</span><div className="w-10 h-10 rounded-full bg-zinc-800"></div><div className="flex-1"><p className="text-sm font-bold">@{rankings[0]?.user||nickname}</p><p className="text-xs text-zinc-500">{rankings[0]?.pts||0} points ahead</p></div><button onClick={()=>setShowGifts(true)} className="bg-pink-600 text-white px-3 py-1.5 rounded-full text-xs">Send Gift</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="text-6xl">🦌</div>
              <h2 className="font-black mt-3">Become Guardian</h2>
              <p className="text-xs text-zinc-500 mt-1">Structure: #1 sender becomes Guardian. Usernames who send most will show here.</p>
              <button onClick={()=>sendGift(100,"🛡️")} className="mt-4 bg-yellow-100 px-4 py-2 rounded-full text-xs font-bold">Send Pledge to join</button>
            </div>
          )}
        </div>
      )}

      {/* BALANCE TAB - generic structure */}
      {tab==="balance" && (
        <div className="flex-1 bg-[#f8f5f7] p-3 space-y-3 overflow-y-auto">
          <div className="text-center py-4"><p className="text-xs">Estimated balance</p><p className="text-3xl font-black">{keys} Coins</p><p className="text-xs text-zinc-500">0.00 ZAR</p></div>
          <div className="bg-white rounded-2xl p-3 flex justify-between"><span className="text-sm">Coins</span><button onClick={()=>setShowRecharge(true)} className="text-xs">Get Coins →</button></div>
          <div className="bg-white rounded-2xl p-3"><p className="text-sm font-bold">Transactions</p><p className="text-xs text-zinc-500">Will show purchases here</p></div>
          <div className="bg-white rounded-2xl p-3"><p className="text-sm font-bold">Rewards</p><p className="text-xs">LIVE rewards / Monetisation / Campaigns</p></div>
        </div>
      )}

      {/* GIFT SHEET - generic */}
      {showGifts && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end"><div className="flex-1 bg-black/40" onClick={()=>setShowGifts(false)}></div><div className="bg-zinc-900 rounded-t-[20px] p-3 grid grid-cols-4 gap-3"><div onClick={()=>sendGift(1,"🌹")} className="text-center bg-zinc-800 rounded-xl p-2"><div className="text-2xl">🌹</div><p className="text-[10px] text-white">Rose 1</p></div><div onClick={()=>sendGift(5,"💎")} className="text-center bg-zinc-800 rounded-xl p-2"><div className="text-2xl">💎</div><p className="text-[10px] text-white">5</p></div><div onClick={()=>sendGift(100,"🛡️")} className="text-center bg-zinc-800 rounded-xl p-2"><div className="text-2xl">🛡️</div><p className="text-[10px] text-white">100</p></div><button onClick={()=>setShowRecharge(true)} className="col-span-4 bg-white text-black py-2 rounded-full text-xs font-bold mt-2">Recharge</button></div></div>
      )}

      {showRecharge && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end"><div className="flex-1 bg-black/40" onClick={()=>setShowRecharge(false)}></div><div className="bg-white rounded-t-[20px] p-4"><h2 className="text-center font-black">Recharge</h2><div className="grid grid-cols-3 gap-2 mt-3">{[5,30,40,50,70,139].map(c=><div key={c} onClick={()=>setKeys(k=>k+c)} className="border rounded-xl p-3 text-center"><p className="font-bold">🪙 {c}</p><p className="text-xs">R {c*0.27}</p></div>)}</div><button onClick={()=>setShowRecharge(false)} className="w-full mt-4 bg-black text-white py-3 rounded-full font-bold">Close</button></div></div>
      )}
    </div>
  );
      }
