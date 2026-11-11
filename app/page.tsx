"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc } from "firebase/firestore";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
type Fly = { id: string; emoji: string; x: number };

export default function LoomiLive() {
  const [nickname, setNickname] = useState("");
  const [tempNick, setTempNick] = useState("");
  const [keys, setKeys] = useState(100);
  const [chat, setChat] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [liveHosts, setLiveHosts] = useState<any[]>([]);
  const [watching, setWatching] = useState<string | null>(null);
  const [debug, setDebug] = useState("");
  const [gifts, setGifts] = useState<Fly[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("loomi_nickname");
    if (saved) setNickname(saved);
    const q = query(collection(db, "live_chat"), orderBy("createdAt", "asc"), limit(150));
    const unsubChat = onSnapshot(q, s => setChat(s.docs.map(d => d.data())));
    const unsubHosts = onSnapshot(collection(db, "live_rooms"), s => {
      const all = s.docs.map(d => d.data());
      setLiveHosts(all.filter((h:any)=> h.nickname !== nickname && h.isLive));
    });
    return () => { unsubChat(); unsubHosts(); };
  }, [nickname]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}) },[chat]);

  const fly = (emoji: string) => {
    const id = Math.random().toString(36).slice(2);
    const x = Math.random()*70+10;
    setGifts(g=>[...g, {id, emoji, x}]);
    setTimeout(()=> setGifts(g=>g.filter(i=>i.id!==id)), 2500);
  };

  const saveNickname = () => {
    const clean = tempNick.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    if(clean.length<3) return alert("Min 3");
    localStorage.setItem("loomi_nickname", clean);
    setNickname(clean);
  };

  // HOST
  const goLive = async () => {
    try {
      setDebug("Starting cam...");
      const stream = await navigator.mediaDevices.getUserMedia({video:{ facingMode:"user", width:640, height:480 }, audio:true});
      streamRef.current = stream;
      if(videoRef.current){ videoRef.current.srcObject = stream; await videoRef.current.play().catch(()=>{}); }
      setIsLive(true); setWatching(null);
      await setDoc(doc(db, "live_rooms", nickname), { nickname, isLive:true, createdAt: serverTimestamp() });
      setDebug("LIVE! Waiting viewers");

      // Listen for ANY viewer
      onSnapshot(collection(db, `live_rooms/${nickname}/viewers`), async snap => {
        for(const change of snap.docChanges()){
          if(change.type==="added" || change.type==="modified"){
            const viewerId = change.doc.id;
            const data = change.doc.data();
            if(!data.offer) continue;
            
            // If we already have PC for this viewer, skip if already connected
            if(pcsRef.current.has(viewerId) && pcsRef.current.get(viewerId)?.connectionState==="connected") continue;

            // Create new PC for this viewer
            if(!pcsRef.current.has(viewerId)){
              const pc = new RTCPeerConnection(ICE);
              pcsRef.current.set(viewerId, pc);
              stream.getTracks().forEach(t=> pc.addTrack(t, stream));
              setDebug(`@ ${viewerId} wants to watch... connecting`);

              pc.onicecandidate = e => {
                if(e.candidate) addDoc(collection(db, `live_rooms/${nickname}/viewers/${viewerId}/candidates_host`), { candidate: e.candidate.toJSON() });
              };
              pc.onconnectionstatechange = () => setDebug(`To @${viewerId}: ${pc.connectionState}`);

              // Listen for viewer ICE
              onSnapshot(collection(db, `live_rooms/${nickname}/viewers/${viewerId}/candidates_viewer`), s => {
                s.docChanges().forEach(async ch=>{
                  if(ch.type==="added"){
                    try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{}
                  }
                });
              });

              await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              // Update with answer
              const { updateDoc } = await import("firebase/firestore");
              await updateDoc(doc(db, `live_rooms/${nickname}/viewers/${viewerId}`), { answer: { sdp: answer.sdp, type: answer.type } });
            }
          }
        }
      });

    } catch(e:any){ setDebug("Cam error: "+e.message); alert("Allow cam/mic + close bubbles"); }
  };

  const stopLive = async () => {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    setIsLive(false); setDebug("");
    if(videoRef.current) videoRef.current.srcObject=null;
    try{ await deleteDoc(doc(db, "live_rooms", nickname)); }catch{}
  };

  // VIEWER
  const watchHost = async (hostNick: string) => {
    try{
      if(isLive) await stopLive();
      setWatching(hostNick);
      setDebug(`Connecting to @${hostNick}...`);

      const pc = new RTCPeerConnection(ICE);
      pcsRef.current.set(hostNick, pc);

      pc.ontrack = e => {
        setDebug(`Got video from @${hostNick}!`);
        if(remoteRef.current){
          remoteRef.current.srcObject = e.streams[0];
          remoteRef.current.play().then(()=>setDebug("Playing @"+hostNick)).catch(()=>setDebug("TAP VIDEO TO PLAY"));
        }
      };
      pc.onconnectionstatechange = () => setDebug(`${pc.connectionState} to @${hostNick}`);
      pc.onicecandidate = e => {
        if(e.candidate) addDoc(collection(db, `live_rooms/${hostNick}/viewers/${nickname}/candidates_viewer`), { candidate: e.candidate.toJSON() });
      };

      // Listen host ICE
      onSnapshot(collection(db, `live_rooms/${hostNick}/viewers/${nickname}/candidates_host`), s => {
        s.docChanges().forEach(async ch=>{
          if(ch.type==="added"){
            try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{}
          }
        });
      });

      const offer = await pc.createOffer({ offerToReceiveVideo:true, offerToReceiveAudio:true });
      await pc.setLocalDescription(offer);
      await setDoc(doc(db, `live_rooms/${hostNick}/viewers/${nickname}`), { viewer: nickname, offer: { sdp: offer.sdp, type: offer.type }, createdAt: serverTimestamp() });

      // Wait answer
      onSnapshot(doc(db, `live_rooms/${hostNick}/viewers/${nickname}`), async snap => {
        const data=snap.data();
        if(data?.answer && pc.signalingState==="have-local-offer"){
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          setDebug("Answer received, connecting...");
        }
      });

    }catch(e:any){ setDebug("Watch error: "+e.message); }
  };

  const stopWatching = async () => {
    pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
    if(remoteRef.current) remoteRef.current.srcObject=null;
    const w=watching; setWatching(null); setDebug("");
    try{ if(w) await deleteDoc(doc(db, `live_rooms/${w}/viewers/${nickname}`)); }catch{}
  };

  const sendChat = async () => { if(!input.trim()) return; const t=input.trim(); setInput(""); await addDoc(collection(db,"live_chat"), { user:nickname, msg:t, createdAt: serverTimestamp() }); };
  const sendGift = async (cost:number, emoji:string) => { if(keys<cost) return alert("Need keys"); if(cost>0) setKeys(k=>k-cost); fly(emoji); await addDoc(collection(db,"live_chat"), { user:nickname, msg:`sent ${emoji}`, gift:emoji, createdAt: serverTimestamp() }); };

  if(!nickname) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center max-w-[430px] mx-auto p-6">
      <div className="w-full"><h1 className="text-[28px] font-black">Pick alias</h1><input value={tempNick} onChange={e=>setTempNick(e.target.value)} placeholder="kat" className="w-full mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3" /><button onClick={saveNickname} className="w-full mt-4 bg-white text-black py-3 rounded-xl font-black">Continue</button></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-[430px] mx-auto relative">
      <div className="flex justify-between p-3 border-b border-zinc-800"><span className="font-bold">@{nickname} 🪙{keys}</span><span className={`px-2 py-0.5 rounded text-xs ${isLive ? "bg-red-600" : watching ? "bg-blue-600" : "bg-zinc-700"}`}>{isLive ? "● LIVE" : watching ? `Watching @${watching}` : "Offline"}</span></div>

      <div className="relative bg-zinc-900 aspect-[9/12] w-full overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isLive ? "block" : "hidden"}`} />
        <video ref={remoteRef} autoPlay playsInline muted={false} onClick={e=> (e.target as HTMLVideoElement).play()} className={`w-full h-full object-cover bg-black ${watching ? "block" : "hidden"}`} />
        
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {gifts.map(g=><div key={g.id} className="absolute bottom-0 animate-fly text-4xl" style={{ left: `${g.x}%` }}>{g.emoji}</div>)}
        </div>

        {!isLive && !watching && (<div className="w-full h-full flex flex-col items-center justify-center"><button onClick={goLive} className="bg-white text-black px-8 py-3 rounded-full font-black">🔴 GO LIVE</button></div>)}
        {debug && <div className="absolute bottom-3 left-3 right-3 bg-black/80 px-3 py-1.5 rounded text-[11px] text-yellow-300 text-center">{debug}</div>}
        {isLive && <button onClick={stopLive} className="absolute top-3 right-3 bg-black/60 px-3 py-1 rounded-full text-xs">✕ Stop</button>}
        {watching && <button onClick={stopWatching} className="absolute top-3 right-3 bg-black/70 px-3 py-1 rounded-full text-xs">✕ Stop</button>}
      </div>

      <div className="flex gap-2 p-2 bg-zinc-900"><div className="font-bold text-xs">👑 Hosters ({1+liveHosts.length})</div></div>
      <div className="flex gap-3 p-2 overflow-x-auto border-b border-zinc-800">
        <div className="text-center"><div className={`w-12 h-12 rounded-full ${isLive ? "bg-yellow-400" : "bg-zinc-800"} flex items-center justify-center`}>You</div><p className="text-[11px]">You</p></div>
        {liveHosts.map((h:any)=>(<div key={h.nickname} onClick={()=>watchHost(h.nickname)} className="text-center cursor-pointer"><div className="w-12 h-12 rounded-full bg-red-600 animate-pulse flex items-center justify-center">🔴</div><p className="text-[11px]">@{h.nickname}</p></div>))}
      </div>

      <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[18vh]">
        {chat.map((c,i)=><p key={i} className="text-[13px]"><span className="text-zinc-500">@{c.user}:</span> {c.msg}</p>)}<div ref={chatEndRef} />
      </div>

      <div className="bg-zinc-900 border-t border-zinc-800 p-2 flex gap-2 overflow-x-auto">
        <button onClick={()=>sendGift(0,"❤️")} className="min-w-[60px] bg-zinc-800 rounded-xl py-2 text-xs font-bold">❤️<br/>FREE</button>
        <button onClick={()=>sendGift(5,"🚀")} className="min-w-[60px] bg-zinc-800 rounded-xl py-2 text-xs">🚀 5🪙</button>
        <button onClick={()=>sendGift(10,"👑")} className="min-w-[60px] bg-zinc-800 rounded-xl py-2 text-xs">👑 10🪙</button>
        <button onClick={()=>sendGift(50,"💎")} className="min-w-[60px] bg-purple-600 rounded-xl py-2 text-xs">💎 50🪙</button>
      </div>

      <div className="p-2 flex gap-2 border-t border-zinc-800">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendChat()} className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm" placeholder="Chat..." />
        <button onClick={sendChat} className="bg-white text-black px-4 rounded-full text-sm font-bold">Send</button>
      </div>

      <style>{`@keyframes fly{0%{transform:translateY(0) scale(0.5);opacity:0}15%{opacity:1}100%{transform:translateY(-90vh) scale(1.5);opacity:0}}.animate-fly{animation:fly 2.5s ease-out forwards}`}</style>
    </div>
  );
                      }
