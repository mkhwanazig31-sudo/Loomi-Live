"use client";
import { useEffect, useState, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";

const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function LoomiLive() {
  const [nickname, setNickname] = useState("");
  const [tempNick, setTempNick] = useState("");
  const [keys, setKeys] = useState(100);
  const [chat, setChat] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [liveHosts, setLiveHosts] = useState<any[]>([]);
  const [watching, setWatching] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("loomi_nickname");
    if (saved) setNickname(saved);
    const q = query(collection(db, "live_chat"), orderBy("createdAt", "asc"), limit(150));
    const unsubChat = onSnapshot(q, s => setChat(s.docs.map(d => d.data())));
    const unsubHosts = onSnapshot(collection(db, "live_rooms"), s => {
      const all = s.docs.map(d => d.data());
      setLiveHosts(all.filter((h:any)=> h.nickname !== nickname));
    });
    return () => { unsubChat(); unsubHosts(); };
  }, [nickname]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}) },[chat]);

  const saveNickname = () => {
    const clean = tempNick.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    if(clean.length<3) return alert("Min 3");
    localStorage.setItem("loomi_nickname", clean);
    setNickname(clean);
  };

  // HOST: Go Live + create offer
  const goLive = async () => {
    try {
      if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
      streamRef.current = stream;
      if(videoRef.current){ videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setIsLive(true); setWatching(null);
      
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      pc.onicecandidate = async e => {
        if(e.candidate){
          await addDoc(collection(db, `live_rooms/${nickname}/candidates`), { candidate: e.candidate.toJSON(), from: nickname });
        }
      };
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await setDoc(doc(db, "live_rooms", nickname), { 
        nickname, isLive:true, offer: { sdp: offer.sdp, type: offer.type }, createdAt: serverTimestamp() 
      });

      // Listen for answer from viewer
      onSnapshot(doc(db, "live_rooms", nickname), async snap => {
        const data = snap.data();
        if(data?.answer && pc.signalingState !== "stable"){
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      });
      onSnapshot(collection(db, `live_rooms/${nickname}/candidates`), snap => {
        snap.docChanges().forEach(async change => {
          if(change.type === "added"){
            const c = change.doc.data();
            if(c.from !== nickname){
              try{ await pc.addIceCandidate(new RTCIceCandidate(c.candidate)); }catch{}
            }
          }
        });
      });

    } catch(e){ console.log(e); alert("Allow cam + mic, and close chat bubbles"); }
  };

  const stopLive = async () => {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    pcRef.current?.close();
    setIsLive(false);
    if(videoRef.current) videoRef.current.srcObject = null;
    try{ await deleteDoc(doc(db, "live_rooms", nickname)); }catch{}
  };

  // VIEWER: Watch host's real video
  const watchHost = async (hostNick: string) => {
    if(isLive) await stopLive();
    setWatching(hostNick);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    
    pc.ontrack = e => { if(remoteVideoRef.current){ remoteVideoRef.current.srcObject = e.streams[0]; } };
    pc.onicecandidate = async e => {
      if(e.candidate){
        await addDoc(collection(db, `live_rooms/${hostNick}/candidates`), { candidate: e.candidate.toJSON(), from: nickname });
      }
    };

    const roomSnap = await getDoc(doc(db, "live_rooms", hostNick));
    const offer = roomSnap.data()?.offer;
    if(!offer) return alert("Host not live anymore");
    
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(doc(db, "live_rooms", hostNick), { answer: { sdp: answer.sdp, type: answer.type } });

    onSnapshot(collection(db, `live_rooms/${hostNick}/candidates`), snap => {
      snap.docChanges().forEach(async change => {
        if(change.type === "added"){
          const c = change.doc.data();
          if(c.from !== nickname){
            try{ await pc.addIceCandidate(new RTCIceCandidate(c.candidate)); }catch{}
          }
        }
      });
    });
  };

  const sendChat = async () => {
    if(!input.trim()) return;
    const t=input.trim(); setInput("");
    await addDoc(collection(db,"live_chat"), { user:nickname, msg:t, createdAt: serverTimestamp() });
  };

  if(!nickname) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center max-w-[430px] mx-auto p-6">
      <div className="w-full">
        <h1 className="text-[28px] font-black">Pick alias</h1>
        <input value={tempNick} onChange={e=>setTempNick(e.target.value)} placeholder="kat" className="w-full mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3" />
        <button onClick={saveNickname} className="w-full mt-4 bg-white text-black py-3 rounded-xl font-black">Continue</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-[430px] mx-auto">
      <div className="flex justify-between p-3 border-b border-zinc-800"><span className="font-bold">@{nickname}</span><span className={`px-2 py-0.5 rounded text-xs ${isLive ? "bg-red-600" : watching ? "bg-blue-600" : "bg-zinc-700"}`}>{isLive ? "● LIVE" : watching ? `Watching @${watching}` : "Offline"}</span></div>

      <div className="relative bg-zinc-900 aspect-[9/11] w-full overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isLive ? "block" : "hidden"}`} />
        <video ref={remoteVideoRef} autoPlay playsInline className={`w-full h-full object-cover ${watching ? "block" : "hidden"}`} />
        
        {!isLive && !watching && (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <button onClick={goLive} className="bg-white text-black px-8 py-3 rounded-full font-black">🔴 GO LIVE</button>
            {liveHosts.length>0 && <p className="mt-3 text-yellow-400 text-xs">{liveHosts.length} LIVE - tap Hosters</p>}
          </div>
        )}
        {watching && <button onClick={()=>{ setWatching(null); pcRef.current?.close(); }} className="absolute top-3 right-3 bg-black/60 px-3 py-1 rounded-full text-xs">✕ Stop</button>}
        {isLive && <button onClick={stopLive} className="absolute top-3 right-3 bg-black/60 px-3 py-1 rounded-full text-xs">✕ Stop</button>}
      </div>

      <div className="flex gap-2 p-2 bg-zinc-900">
        <div className="font-bold text-xs">👑 Hosters ({1+liveHosts.length})</div>
      </div>
      <div className="flex gap-3 p-2 overflow-x-auto border-b border-zinc-800">
        <div className="text-center"><div className={`w-12 h-12 rounded-full ${isLive ? "bg-yellow-400" : "bg-zinc-800"} flex items-center justify-center`}>You</div><p className="text-[11px]">You</p></div>
        {liveHosts.map((h:any)=>(
          <div key={h.nickname} onClick={()=>watchHost(h.nickname)} className="text-center cursor-pointer"><div className="w-12 h-12 rounded-full bg-red-600 animate-pulse flex items-center justify-center">🔴</div><p className="text-[11px]">@{h.nickname}</p></div>
        ))}
      </div>

      <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[25vh]">
        {chat.map((c,i)=><p key={i} className="text-[13px]"><span className="text-zinc-500">@{c.user}:</span> {c.msg}</p>)}
        <div ref={chatEndRef} />
      </div>
      <div className="p-2 flex gap-2 border-t border-zinc-800">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendChat()} className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm" placeholder={watching ? `Chat with @${watching}` : "Chat..."} />
        <button onClick={sendChat} className="bg-white text-black px-4 rounded-full text-sm font-bold">Send</button>
      </div>
    </div>
  );
        }
