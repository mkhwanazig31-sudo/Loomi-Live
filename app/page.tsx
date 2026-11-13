"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, useMemo } from "react";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, getDocs, where } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" }, { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }, { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }] };
type Fly = { id: string; emoji: string; x: number; type: string };
type Post = { id: string; creator: string; caption: string; mediaUrl: string; mediaType?: string; isLocked: boolean; price: number; likes: number; likedBy?: string[]; unlockedBy?: string[]; createdAt?: any; postType?: string };
type Floater = { id: string; user: string; msg: string; top: number; duration: number; color: string };

export default function LoomiLive() {
  // ===== AUTH =====
  const [authUser, setAuthUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authMode, setAuthMode] = useState<"login"|"signup">("signup");
  const [authError, setAuthError] = useState("");

  const [nickname, setNickname] = useState("");
  const [tempNick, setTempNick] = useState("");
  const [keys, setKeys] = useState(100);
  const [chat, setChat] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [liveHosts, setLiveHosts] = useState<any[]>([]);
  const [watching, setWatching] = useState<string | null>(null);
  const [gifts, setGifts] = useState<Fly[]>([]);
  // FEED FIRST NOW
  const [tab, setTab] = useState<"live"|"discover"|"ranking"|"balance"|"feed">("feed");
  const [rankingTab, setRankingTab] = useState<"viewers"|"guardian">("viewers");
  const [showRecharge, setShowRecharge] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postCaption, setPostCaption] = useState("");
  const [postMedia, setPostMedia] = useState("");
  const [postLocked, setPostLocked] = useState(false);
  const [postPrice, setPostPrice] = useState(20);
  const [postType, setPostType] = useState<"post"|"meme"|"video">("post");
  // ===== FEED HOT FEATURES =====
  const [feedFilter, setFeedFilter] = useState<"foryou"|"following"|"trending"|"saved">("foryou");
  const [savedPosts, setSavedPosts] = useState<string[]>(()=>{ try{ return JSON.parse(localStorage.getItem("loomi_saved")||"[]"); }catch{ return []; } });
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [showVipModal, setShowVipModal] = useState(false);
  const [vipPrice, setVipPrice] = useState(100);
  const [vipActive, setVipActive] = useState(false);
  const [vipWith, setVipWith] = useState<string | null>(null);
  const [vipSeconds, setVipSeconds] = useState(0);
  const [vipIncoming, setVipIncoming] = useState<any | null>(null);
  const [vipStatus, setVipStatus] = useState("");
  const [showCashout, setShowCashout] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState(100);
  const [bankName, setBankName] = useState("Capitec");
  const [accountNum, setAccountNum] = useState("");
  const [accountName, setAccountName] = useState("");
  const [cashouts, setCashouts] = useState<any[]>([]);
  const [unlockEarnings, setUnlockEarnings] = useState(0);
  const [tipEarnings, setTipEarnings] = useState(0);
  const [vipEarnings, setVipEarnings] = useState(0);
  const [giftEarnings, setGiftEarnings] = useState(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [showFloaters, setShowFloaters] = useState(true);
  const [chatError, setChatError] = useState("");
  const [camError, setCamError] = useState("");
  const [blockedUsers, setBlockedUsers] = useState<string[]>(()=>{ try{ return JSON.parse(localStorage.getItem("loomi_blocked")||"[]"); }catch{ return []; } });
  const [showSafety, setShowSafety] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("Rude / Harassment");
  const [following, setFollowing] = useState<string[]>(()=>{ try{ return JSON.parse(localStorage.getItem("loomi_following")||"[]"); }catch{ return []; } });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifiedLive, setNotifiedLive] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [userCategory, setUserCategory] = useState(()=> { try{ return localStorage.getItem("loomi_category") || "Chat"; }catch{ return "Chat"; } });
  const [dailyClaimed, setDailyClaimed] = useState(()=> { try{ return localStorage.getItem("loomi_daily") === new Date().toDateString(); }catch{ return false; } });
  const [showWelcome, setShowWelcome] = useState(()=> { try{ return !localStorage.getItem("loomi_seen_welcome"); }catch{ return false; } });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const nicknameRef = useRef<string>("");
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const seenChatRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user)=>{
      setAuthLoading(false);
      if(user){
        setAuthUser(user);
        try{
          const snap = await getDocs(query(collection(db, "loomi_users"), where("uid","==", user.uid)));
          if(!snap.empty){
            const data = snap.docs[0].data() as any;
            setNickname(data.username); nicknameRef.current = data.username; localStorage.setItem("loomi_nickname", data.username);
            if(data.keys !== undefined){ setKeys(data.keys); localStorage.setItem("loomi_keys", data.keys.toString()); }
            if(data.category) setUserCategory(data.category);
            if(data.following) { setFollowing(data.following); localStorage.setItem("loomi_following", JSON.stringify(data.following)); }
          }
        }catch(e){ console.log("profile load", e); }
      } else { setAuthUser(null); setNickname(""); nicknameRef.current = ""; }
    });
    return ()=>unsub();
  }, []);

  const handleAuth = async () => {
    setAuthError("");
    if(!authEmail.includes("@")) return setAuthError("Enter a real email like you@gmail.com");
    if(authPass.length < 6) return setAuthError("Password must be 6+ characters");
    try{
      if(authMode==="signup"){
        const clean = tempNick.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
        if(clean.length < 3) return setAuthError("Pick username min 3 letters - e.g. thabo");
        const q = query(collection(db, "loomi_users"), where("username","==", clean));
        const snap = await getDocs(q);
        if(!snap.empty) return setAuthError(`@${clean} already taken - pick another`);
        const cred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPass);
        await setDoc(doc(db, "loomi_users", cred.user.uid), { uid: cred.user.uid, username: clean, email: authEmail.trim().toLowerCase(), keys: 100, category: "Chat", following: [], createdAt: serverTimestamp() });
        setNickname(clean); nicknameRef.current = clean;
      } else { await signInWithEmailAndPassword(auth, authEmail.trim(), authPass); }
    }catch(e:any){
      if(e.code==="auth/email-already-in-use") setAuthError("This email already has account - tap Login below");
      else if(e.code==="auth/invalid-credential" || e.code==="auth/wrong-password") setAuthError("Wrong email or password - try again");
      else if(e.code==="auth/user-not-found") setAuthError("No account with this email - tap Create one");
      else setAuthError(e.message || "Auth error - try again");
    }
  };
  const handleLogout = async () => { try{ await signOut(auth); }catch{} localStorage.clear(); location.reload(); };

  useEffect(() => { nicknameRef.current = nickname; }, [nickname]);
  useEffect(() => { if (typeof window !== "undefined") remoteStreamRef.current = new MediaStream(); }, []);
  useEffect(() => { if(isLive && streamRef.current && videoRef.current){ videoRef.current.srcObject = streamRef.current; videoRef.current.muted = true; videoRef.current.play().catch(()=>{}); } }, [isLive]);
  useEffect(() => {
    const unsubHosts = onSnapshot(collection(db, "live_rooms"), s => {
      const all = s.docs.map(d => d.data() as any);
      setLiveHosts(all.filter(h=> h.isLive === true && h.nickname !== nicknameRef.current));
    }, (e)=>console.log("hosts error", e));
    return () => unsubHosts();
  }, [nickname]);
  useEffect(()=>{
    liveHosts.forEach((h:any)=>{
      if(following.includes(h.nickname) && !notifiedLive.has(h.nickname)){
        setNotifiedLive(prev=>new Set(prev).add(h.nickname));
        setNotifications(prev=>[{ id: Date.now().toString()+h.nickname, text: `@${h.nickname} is LIVE now 🔴`, user: h.nickname, time: Date.now() }, ...prev].slice(0,20));
      }
    });
    setNotifiedLive(prev=>{ const next = new Set<string>(); liveHosts.forEach((h:any)=>{ if(prev.has(h.nickname)) next.add(h.nickname); }); return next; });
  }, [liveHosts, following]);
  useEffect(() => {
    const q = query(collection(db, "loomi_posts"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(q, s => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as Post))), ()=>{});
    return () => unsub();
  }, []);
  // Load comments for posts
  useEffect(() => {
    const q = query(collection(db, "loomi_post_comments"), orderBy("createdAt", "desc"), limit(200));
    const unsub = onSnapshot(q, s => {
      const map: Record<string, any[]> = {};
      s.docs.forEach(d => { const data = d.data() as any; const pid = data.postId; if(!map[pid]) map[pid]=[]; map[pid].push({ id: d.id, ...data }); });
      setPostComments(map);
    }, ()=>{});
    return () => unsub();
  }, []);
  useEffect(() => {
    if(!nickname) return;
    const q1 = query(collection(db, "loomi_unlocks"), where("creator", "==", nickname));
    const u1 = onSnapshot(q1, s => setUnlockEarnings(s.docs.reduce((sum,d)=>sum+((d.data() as any).amount||0),0)), ()=>{});
    const q2 = query(collection(db, "loomi_tips"), where("creator", "==", nickname));
    const u2 = onSnapshot(q2, s => setTipEarnings(s.docs.reduce((sum,d)=>sum+((d.data() as any).amount||0),0)), ()=>{});
    const q3 = query(collection(db, "loomi_private"), where("host", "==", nickname), where("status", "==", "accepted"));
    const u3 = onSnapshot(q3, s => setVipEarnings(s.docs.reduce((sum,d)=>sum+((d.data() as any).price||0),0)), ()=>{});
    const q4 = query(collection(db, "loomi_cashouts"), where("user", "==", nickname), orderBy("createdAt", "desc"), limit(20));
    const u4 = onSnapshot(q4, s => setCashouts(s.docs.map(d=>({id:d.id, ...d.data()} as any))), ()=>{});
    return ()=>{ u1(); u2(); u3(); u4(); };
  }, [nickname]);
  useEffect(() => {
    if(!nickname) return;
    const q = query(collection(db, "loomi_private"), where("host", "==", nickname));
    const unsub = onSnapshot(q, s => {
      s.docChanges().forEach(ch => {
        const d = { id: ch.doc.id, ...ch.doc.data() } as any;
        if(ch.type==="added" && d.status==="pending") setVipIncoming(d);
        if(ch.type==="modified" && d.status==="accepted" && d.viewer===nickname){ setVipActive(true); setVipWith(d.host); setVipSeconds(300); setVipStatus("Private accepted!"); }
        if(ch.type==="modified" && d.status==="declined" && d.viewer===nickname) setVipStatus("Host declined private");
        if(ch.type==="modified" && d.status==="ended") { setVipActive(false); setVipWith(null); setVipSeconds(0); }
      });
    }, ()=>{});
    return () => unsub();
  }, [nickname]);
  useEffect(() => { if(!vipActive) return; const t = setInterval(()=>{ setVipSeconds(s=>{ if(s<=1){ endVip(); return 0; } return s-1; }); },1000); return ()=>clearInterval(t); }, [vipActive]);
  const currentRoom = useMemo(() => { if (isLive) return nickname; if (watching) return watching; return null; }, [isLive, watching, nickname]);
  useEffect(() => { setChat([]); setFloaters([]); seenChatRef.current.clear(); }, [currentRoom]);
  useEffect(() => {
    if (!currentRoom) { setChat([]); setFloaters([]); return; }
    const q = query(collection(db, "live_chat"), where("room", "==", currentRoom), limit(100));
    const unsub = onSnapshot(q, s => {
      setChatError("");
      const msgs = s.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a,b)=>{ const ta = a.createdAt?.seconds || a.ts || 0; const tb = b.createdAt?.seconds || b.ts || 0; return ta - tb; });
      setChat(msgs);
      s.docChanges().forEach(change => {
        if(change.type==="added"){
          const data = change.doc.data() as any; const key = change.doc.id;
          if(data.gift && data.user !== nicknameRef.current){ triggerGift(data.gift); }
          if(!seenChatRef.current.has(key) && !data.gift && !blockedUsers.includes(data.user)){ seenChatRef.current.add(key); addFloater(data.user, data.msg); }
        }
      });
    }, (err)=>{ console.log("CHAT LISTEN ERROR:", err); setChatError("Chat blocked by Firebase Rules - paste firestore.rules file"); });
    return () => unsub();
  }, [currentRoom]);
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}) },[chat]);
  const addFloater = (user: string, msg: string) => {
    const colors = ["#FFD700","#fff","#FF6B9D","#7CFFB2","#7CC7FF"];
    const id = Math.random().toString(36).slice(2); const top = 12 + Math.random()*45; const duration = 5 + Math.random()*3; const color = colors[Math.floor(Math.random()*colors.length)];
    setFloaters(f=>[...f.slice(-8), { id, user, msg, top, duration, color }]);
    setTimeout(()=> setFloaters(f=>f.filter(x=>x.id!==id)), (duration+0.5)*1000);
  };
  const triggerGift = (emoji: string) => {
    let type = "heart"; if(emoji==="🚀") type="rocket"; if(emoji==="👑") type="crown"; if(emoji==="💎") type="diamond"; if(emoji==="🔥") type="fire"; if(emoji==="🌹") type="heart";
    const count = type==="heart" ? 6 : 1;
    for(let i=0;i<count;i++){ setTimeout(()=>{ const id = Math.random().toString(36).slice(2)+i; const x = Math.random()*70+10; setGifts(g=>[...g, { id, emoji, x, type }]); setTimeout(()=> setGifts(g=>g.filter(f=>f.id!==id)), 3000); }, i*100); }
  };
  const goLive = async () => {
    try {
      setCamError("");
      if(streamRef.current){ streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current = null; }
      if(videoRef.current) videoRef.current.srcObject = null;
      pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear();
      setChat([]); setFloaters([]); seenChatRef.current.clear();
      const stream = await navigator.mediaDevices.getUserMedia({video:{width:640, height:480, facingMode:"user"}, audio:true});
      stream.getTracks().forEach(t=>{ t.enabled = true; }); streamRef.current = stream;
      if(videoRef.current){ videoRef.current.srcObject = stream; videoRef.current.muted = true; videoRef.current.playsInline = true; try{ await videoRef.current.play(); }catch(e){ console.log("play error", e); } }
      setIsLive(true); setWatching(null); setTab("live");
      setTimeout(()=>{ if(videoRef.current && streamRef.current){ videoRef.current.srcObject = streamRef.current; videoRef.current.play().catch(()=>{}); } }, 300);
      await setDoc(doc(db, "live_rooms", nicknameRef.current), { nickname: nicknameRef.current, isLive:true, category: userCategory, createdAt: serverTimestamp() });
      onSnapshot(collection(db, `live_rooms/${nicknameRef.current}/viewers`), async snap => {
        for(const change of snap.docChanges()){ if(change.type==="added"){ const viewerId = change.doc.id; const data = change.doc.data() as any; if(!data.offer || pcsRef.current.has(viewerId)) continue; const pc = new RTCPeerConnection(ICE); pcsRef.current.set(viewerId, pc); stream.getTracks().forEach(t=> pc.addTrack(t, stream)); pc.onicecandidate = e => { if(e.candidate) addDoc(collection(db, `live_rooms/${nicknameRef.current}/viewers/${viewerId}/candidates_host`), { candidate: e.candidate.toJSON() }); }; onSnapshot(collection(db, `live_rooms/${nicknameRef.current}/viewers/${viewerId}/candidates_viewer`), s => { s.docChanges().forEach(async ch=>{ if(ch.type==="added"){ try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{} } }); }); await pc.setRemoteDescription(new RTCSessionDescription(data.offer)); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); await updateDoc(doc(db, `live_rooms/${nicknameRef.current}/viewers/${viewerId}`), { answer: { sdp: answer.sdp, type: answer.type } }); } }
      });
    } catch(e:any){
      console.log("CAM ERROR", e);
      if(e.name==="NotAllowedError") setCamError("Camera blocked - tap lock icon in browser > Allow Camera > Refresh");
      else if(e.name==="NotFoundError") setCamError("No camera found on this device");
      else if(e.name==="NotReadableError") setCamError("Camera busy - close WhatsApp / Instagram camera, then retry");
      else setCamError("Camera error: " + e.message);
      alert("Allow cam/mic - " + e.message);
    }
  };
  const stopLive = async () => {
    streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current = null; pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear(); setIsLive(false); if(videoRef.current) videoRef.current.srcObject=null;
    try{ const viewersSnap = await getDocs(collection(db, `live_rooms/${nicknameRef.current}/viewers`)); for (const d of viewersSnap.docs) await deleteDoc(d.ref); const chatSnap = await getDocs(query(collection(db, "live_chat"), where("room", "==", nicknameRef.current))); for (const d of chatSnap.docs) await deleteDoc(d.ref); await deleteDoc(doc(db, "live_rooms", nicknameRef.current)); }catch{} setChat([]); setFloaters([]); seenChatRef.current.clear(); setVipActive(false); setVipWith(null);
  };
  const watchHost = async (hostNick: string) => {
    if(isLive) await stopLive(); pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear(); remoteStreamRef.current = new MediaStream(); setWatching(hostNick); setTab("live"); setChat([]); setFloaters([]); seenChatRef.current.clear();
    const pc = new RTCPeerConnection(ICE); pcsRef.current.set(hostNick, pc); if(remoteRef.current) remoteRef.current.srcObject = remoteStreamRef.current;
    pc.ontrack = (e) => { remoteStreamRef.current?.addTrack(e.track); if(remoteRef.current && remoteStreamRef.current){ remoteRef.current.srcObject = remoteStreamRef.current; remoteRef.current.play().catch(()=>{ if(remoteRef.current){ remoteRef.current.muted=true; remoteRef.current.play(); } }); } };
    pc.onicecandidate = e => { if(e.candidate) addDoc(collection(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}/candidates_viewer`), { candidate: e.candidate.toJSON() }); };
    onSnapshot(collection(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}/candidates_host`), s => { s.docChanges().forEach(async ch=>{ if(ch.type==="added"){ try{ await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().candidate)); }catch{} } }); });
    pc.addTransceiver("video", { direction: "recvonly" }); pc.addTransceiver("audio", { direction: "recvonly" }); const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    await setDoc(doc(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}`), { viewer: nicknameRef.current, offer: { sdp: offer.sdp, type: offer.type }, createdAt: serverTimestamp() });
    onSnapshot(doc(db, `live_rooms/${hostNick}/viewers/${nicknameRef.current}`), async snap => { const data=snap.data() as any; if(data?.answer && pc.signalingState==="have-local-offer"){ await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); } });
  };
  const stopWatching = async () => { pcsRef.current.forEach(pc=>pc.close()); pcsRef.current.clear(); if(remoteRef.current) remoteRef.current.srcObject=null; remoteStreamRef.current = new MediaStream(); const w=watching; setWatching(null); try{ if(w) await deleteDoc(doc(db, `live_rooms/${w}/viewers/${nicknameRef.current}`)); }catch{} setChat([]); setFloaters([]); seenChatRef.current.clear(); setVipActive(false); setVipWith(null); };
  const blockUser = (user: string) => { if(!blockedUsers.includes(user)){ const next = [...blockedUsers, user]; setBlockedUsers(next); localStorage.setItem("loomi_blocked", JSON.stringify(next)); } setShowSafety(null); alert(`@${user} blocked - you won't see their chat`); };
  const unblockUser = (user: string) => { const next = blockedUsers.filter(u=>u!==user); setBlockedUsers(next); localStorage.setItem("loomi_blocked", JSON.stringify(next)); };
  const reportUser = async (user: string) => { try{ await addDoc(collection(db, "loomi_reports"), { reporter: nicknameRef.current, reported: user, room: currentRoom, reason: reportReason, createdAt: serverTimestamp() }); }catch(e){ console.log(e); } setShowSafety(null); alert(`Reported @${user} for ${reportReason}`); };
  const toggleFollow = async (user: string) => {
    if(user===nickname) return; const isFollowing = following.includes(user); const next = isFollowing ? following.filter(u=>u!==user) : [...following, user];
    setFollowing(next); localStorage.setItem("loomi_following", JSON.stringify(next));
    if(authUser) { try{ await updateDoc(doc(db, "loomi_users", authUser.uid), { following: next }); }catch{} }
    if(!isFollowing){ try{ await addDoc(collection(db, "loomi_follows"), { follower: nicknameRef.current, following: user, createdAt: serverTimestamp() }); }catch{} setNotifications(prev=>[{ id: Date.now().toString(), text: `You followed @${user} ✅`, user, time: Date.now() }, ...prev].slice(0,20)); }
  };
  const claimDaily = () => { if(dailyClaimed) return; const newKeys = keys + 10; setKeys(newKeys); localStorage.setItem("loomi_keys", newKeys.toString()); localStorage.setItem("loomi_daily", new Date().toDateString()); setDailyClaimed(true); alert("🎉 Daily Bonus +10 🪙 claimed! Come back tomorrow."); };
  const shareApp = async () => { const text = `Join me on LOOMI-LIVE 🔴✨ - Live, Chat, Earn! My username is @${nickname} - ${window.location.origin}`; try{ if(navigator.share){ await navigator.share({ title: "LOOMI-LIVE", text, url: window.location.origin }); } else { await navigator.clipboard.writeText(text); alert("Link copied! Share it on WhatsApp / TikTok"); } }catch{ try{ await navigator.clipboard.writeText(text); alert("Link copied!"); }catch{} } };
  const sendChat = async () => {
    const t = input.trim(); if(!t) return; const room = currentRoom || (isLive ? nickname : watching); if(!room) return alert("Go LIVE or watch someone first to comment"); const myUser = nicknameRef.current || nickname; setInput("");
    const localMsg = { id: "local-"+Date.now(), room, user: myUser, msg: t, createdAt: { seconds: Date.now()/1000 } }; setChat(prev => [...prev, localMsg]); addFloater(myUser, t);
    try { await addDoc(collection(db,"live_chat"), { room, user: myUser, msg: t, createdAt: serverTimestamp(), ts: Date.now() }); } catch(e:any) { console.log("CHAT SAVE ERROR:", e); setChatError("Saved locally only - check Firestore Rules"); }
  };
  const sendGift = async (cost:number, emoji:string) => { if(!currentRoom) return alert("Go live or watch first"); if(keys < cost) { setShowRecharge(true); return; } if(cost>0){ const newKeys = keys - cost; setKeys(newKeys); localStorage.setItem("loomi_keys", newKeys.toString()); } triggerGift(emoji); try{ await addDoc(collection(db,"live_chat"), { room: currentRoom, user:nicknameRef.current, msg:`sent ${emoji}`, gift:emoji, cost, createdAt: serverTimestamp(), ts: Date.now() }); }catch{} };

  // ===== FEED LOGIC - HOT =====
  const isVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("video") || url.includes("tiktok") || url.includes("youtube") || url.includes("youtu.be");
  const getMediaType = (url: string, type: string) => { if(type==="video") return "video"; if(!url) return "text"; if(isVideoUrl(url)) return "video"; return "image"; };
  const createPost = async () => {
    if(!postCaption.trim() && !postMedia.trim()) return alert("Add caption or media");
    const mediaType = getMediaType(postMedia.trim(), postType);
    await addDoc(collection(db, "loomi_posts"), { creator: nicknameRef.current, caption: postCaption.trim(), mediaUrl: postMedia.trim(), mediaType, postType: postType, isLocked: postLocked, price: postLocked ? postPrice : 0, likes: 0, likedBy: [], unlockedBy: [], createdAt: serverTimestamp() });
    setPostCaption(""); setPostMedia(""); setPostLocked(false); setPostPrice(20); setPostType("post"); setShowCreatePost(false);
  };
  const unlockPost = async (p: Post) => {
    if(p.unlockedBy?.includes(nicknameRef.current) || p.creator === nicknameRef.current) return;
    if(keys < p.price){ setShowRecharge(true); return; }
    const newKeys = keys - p.price; setKeys(newKeys); localStorage.setItem("loomi_keys", newKeys.toString());
    await updateDoc(doc(db, "loomi_posts", p.id), { unlockedBy: [...(p.unlockedBy||[]), nicknameRef.current] });
    await addDoc(collection(db, "loomi_unlocks"), { user: nicknameRef.current, creator: p.creator, postId: p.id, amount: p.price, createdAt: serverTimestamp() });
  };
  const likePost = async (p: Post) => {
    const already = p.likedBy?.includes(nicknameRef.current);
    const newLiked = already ? (p.likedBy||[]).filter(u=>u!==nicknameRef.current) : [...(p.likedBy||[]), nicknameRef.current];
    await updateDoc(doc(db, "loomi_posts", p.id), { likes: Math.max(0, (p.likes||0) + (already ? -1 : 1)), likedBy: newLiked });
  };
  const tipPost = async (p: Post) => { await sendGift(5, "💎"); await addDoc(collection(db, "loomi_tips"), { sender: nicknameRef.current, creator: p.creator, postId: p.id, amount: 5, createdAt: serverTimestamp() }); };
  const toggleSavePost = (id: string) => { const next = savedPosts.includes(id) ? savedPosts.filter(x=>x!==id) : [...savedPosts, id]; setSavedPosts(next); localStorage.setItem("loomi_saved", JSON.stringify(next)); };
  const sharePost = async (p: Post) => { const text = `🔥 Check this on LOOMI-LIVE by @${p.creator}: ${p.caption} - ${window.location.origin}`; try{ if(navigator.share) await navigator.share({ title: "LOOMI-LIVE", text, url: window.location.origin }); else { await navigator.clipboard.writeText(text); alert("Post link copied! Share on WhatsApp / TikTok"); } }catch{ await navigator.clipboard.writeText(text); alert("Post link copied!"); } };
  const sendPostComment = async (postId: string) => {
    const t = commentInput.trim(); if(!t) return;
    await addDoc(collection(db, "loomi_post_comments"), { postId, user: nicknameRef.current, msg: t, createdAt: serverTimestamp() });
    setCommentInput("");
  };
  const requestPrivate = async () => {
    if(!watching) return alert("Watch someone first"); if(keys < vipPrice){ setShowRecharge(true); return; }
    const newKeys = keys - vipPrice; setKeys(newKeys); localStorage.setItem("loomi_keys", newKeys.toString());
    await addDoc(collection(db, "loomi_private"), { host: watching, viewer: nicknameRef.current, price: vipPrice, status: "pending", createdAt: serverTimestamp() });
    setShowVipModal(false); setVipStatus("Request sent - waiting for host...");
  };
  const acceptVip = async () => { if(!vipIncoming) return; await updateDoc(doc(db, "loomi_private", vipIncoming.id), { status: "accepted" }); setVipActive(true); setVipWith(vipIncoming.viewer); setVipSeconds(300); setVipIncoming(null); };
  const declineVip = async () => { if(!vipIncoming) return; await updateDoc(doc(db, "loomi_private", vipIncoming.id), { status: "declined" }); setVipIncoming(null); };
  const endVip = async () => { setVipActive(false); setVipWith(null); setVipSeconds(0); const q = query(collection(db, "loomi_private"), where("host", "==", nicknameRef.current), where("status", "==", "accepted")); const snap = await getDocs(q); for(const d of snap.docs) await updateDoc(d.ref, { status: "ended" }); };
  const totalEarnings = unlockEarnings + tipEarnings + vipEarnings + giftEarnings;
  const requestCashout = async () => { if(cashoutAmount < 50) return alert("Min 50 coins to cashout"); if(!accountNum.trim() || !accountName.trim()) return alert("Add bank details"); await addDoc(collection(db, "loomi_cashouts"), { user: nicknameRef.current, amount: cashoutAmount, bankName, accountNum, accountName, status: "pending", createdAt: serverTimestamp() }); setShowCashout(false); alert("Cashout request sent! Paid weekly."); };
  const rankings = useMemo(()=>{ const map:Record<string,number>={}; chat.forEach((c:any)=>{ if(c.gift) map[c.user]=(map[c.user]||0)+(c.cost||1); }); return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([user,pts],i)=>({user,pts,rank:i+1})); },[chat]);
  const fmtTime = (s:number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const categories = ["All","Girls","Boys","Music","Chat","Gaming","Dancing"];
  const getCategoryFor = (name: string) => { const cats = ["Girls","Boys","Music","Chat","Gaming","Dancing"]; let sum = 0; for(let i=0;i<name.length;i++) sum+=name.charCodeAt(i); return cats[sum % cats.length]; };
  const filteredHosts = liveHosts.filter((h:any)=>{ const matchesSearch = h.nickname.toLowerCase().includes(searchQuery.toLowerCase()); const hostCat = h.category || getCategoryFor(h.nickname); const matchesCat = selectedCategory==="All" || hostCat===selectedCategory; return matchesSearch && matchesCat; });
  // FEED FILTERING
  const trendingTags = useMemo(()=>{
    const counts: Record<string, number> = {};
    posts.forEach(p=>{ const tags = p.caption.match(/#\w+/g); if(tags) tags.forEach(t=> counts[t.toLowerCase()] = (counts[t.toLowerCase()]||0)+1); });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([tag, count])=>({ tag, count }));
  }, [posts]);
  const filteredPosts = useMemo(()=>{
    let base = posts.filter(p=>{
      if(searchQuery) return p.creator.toLowerCase().includes(searchQuery.toLowerCase()) || p.caption.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    });
    if(feedFilter==="following") base = base.filter(p=> following.includes(p.creator) || p.creator===nickname);
    if(feedFilter==="saved") base = base.filter(p=> savedPosts.includes(p.id));
    if(feedFilter==="trending") base = [...base].sort((a,b)=>(b.likes||0)-(a.likes||0)).slice(0,30);
    return base;
  }, [posts, searchQuery, feedFilter, following, savedPosts, nickname]);
  const renderHashtags = (text: string) => text.split(" ").map((w,i)=> w.startsWith("#") ? <span key={i} className="text-[#FFD700] font-bold">{w} </span> : w+" ");

  if(authLoading) return (<div className="min-h-screen bg-[#150826] text-white flex items-center justify-center max-w-[430px] mx-auto"><p className="font-black text-[#FFD700]">LOOMI-LIVE loading...</p></div>);
  if(!authUser) return (
    <div className="min-h-screen bg-[#150826] text-white flex items-center justify-center max-w-[430px] mx-auto p-6">
      <div className="w-full">
        <p className="text-[11px] tracking-[0.3em] text-[#FFD700] font-black text-center">LOOMI-LIVE</p>
        <h1 className="text-[28px] font-black mt-2 text-center">{authMode==="signup" ? "Create Account ✨" : "Welcome Back 🔴"}</h1>
        <p className="text-xs text-white/50 mt-1 text-center">Your own account like TikTok - coins & followers saved</p>
        {authMode==="signup" && <input value={tempNick} onChange={e=>setTempNick(e.target.value)} placeholder="@username - e.g. thabo" className="w-full mt-6 bg-[#241040] border border-[#3A1B63] rounded-2xl p-4 text-white placeholder:text-white/40 outline-none focus:border-[#FFD700]" />}
        <input value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="Email - you@gmail.com" type="email" className="w-full mt-3 bg-[#241040] border border-[#3A1B63] rounded-2xl p-4 text-white placeholder:text-white/40 outline-none focus:border-[#FFD700]" />
        <input value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="Password - min 6 chars" type="password" className="w-full mt-3 bg-[#241040] border border-[#3A1B63] rounded-2xl p-4 text-white placeholder:text-white/40 outline-none focus:border-[#FFD700]" />
        {authError && <p className="mt-3 bg-red-600/20 border border-red-500 rounded-xl p-3 text-xs text-center text-red-300">{authError}</p>}
        <button onClick={handleAuth} className="w-full mt-4 bg-[#FFD700] text-black py-4 rounded-2xl font-black">{authMode==="signup" ? "Create Account" : "Login"}</button>
        <button onClick={()=>{ setAuthMode(authMode==="signup"?"login":"signup"); setAuthError(""); }} className="w-full mt-3 text-[#FFD700] text-xs underline">{authMode==="signup" ? "Already have account? Login" : "No account? Create one"}</button>
        <p className="text-[11px] text-white/40 text-center mt-4">By continuing you agree to be nice. No stealing usernames. 🛡️</p>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-[#150826] text-white flex flex-col max-w-[430px] mx-auto relative overflow-hidden ${vipActive?"ring-4 ring-[#FFD700]":""}`}>
      <div className="flex justify-between items-center px-4 pt-3 pb-1 bg-[#150826]">
        <div><p className="text-[11px] tracking-[0.3em] text-[#FFD700] font-black leading-none">MANSION</p><h1 className="text-[22px] font-black leading-none mt-0.5">LOOMI-LIVE</h1></div>
        <div className="flex items-center gap-2">
          <button onClick={()=>{ setShowNotifs(true); }} className="relative w-8 h-8 bg-[#241040] border border-[#3A1B63] rounded-full text-sm">🔔{notifications.length>0 && <span className="absolute -top-1 -right-1 bg-red-500 text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">{notifications.length}</span>}</button>
          <span className="bg-[#241040] border border-[#3A1B63] px-3 py-1.5 rounded-full text-xs font-bold">🪙 {keys}</span>
          <button onClick={()=>setShowDashboard(true)} className="w-8 h-8 bg-[#241040] border border-[#3A1B63] rounded-full text-sm">☰</button>
        </div>
      </div>
      {/* TOP TABS - FEED FIRST */}
      <div className="flex justify-between items-center border-b border-[#3A1B63] bg-[#150826] px-4 overflow-x-auto">
        <div className="flex gap-5 text-[12px] font-bold whitespace-nowrap">
          <button onClick={()=>setTab("feed")} className={`py-3 ${tab==="feed"?"border-b-2 border-[#FFD700] text-white":"text-white/50"}`}>FEED ✨</button>
          <button onClick={()=>setTab("live")} className={`py-3 ${tab==="live"?"border-b-2 border-[#FFD700] text-white":"text-white/50"}`}>LIVE</button>
          <button onClick={()=>setTab("discover")} className={`py-3 ${tab==="discover"?"border-b-2 border-[#FFD700]":"text-white/50"}`}>Discover</button>
          <button onClick={()=>setTab("ranking")} className={`py-3 ${tab==="ranking"?"border-b-2 border-[#FFD700]":"text-white/50"}`}>Rankings</button>
          <button onClick={()=>setTab("balance")} className={`py-3 ${tab==="balance"?"border-b-2 border-[#FFD700]":"text-white/50"}`}>Wallet</button>
        </div>
      </div>

      <div className="flex justify-between items-center px-4 py-2 bg-[#150826] text-xs">
        <span className="font-black">@{nickname} <span className="text-[#FFD700] text-[10px]">• LIVE</span></span>
        <div className="flex gap-2">
          <button onClick={()=>setShowFloaters(v=>!v)} className={`px-2 py-1 rounded-full text-[10px] font-bold ${showFloaters?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>{showFloaters?"💬 Fly: ON":"💬 Fly: OFF"}</button>
          <button onClick={handleLogout} className="bg-[#241040] border border-[#3A1B63] px-3 py-1 rounded-full text-white/70">Logout</button>
        </div>
      </div>

      {vipActive && (<div className="bg-[#FFD700] text-black px-3 py-2 flex justify-between items-center text-xs font-black z-30"><span>👑 PRIVATE with @{vipWith} • {fmtTime(vipSeconds)}</span><button onClick={endVip} className="bg-black text-white px-3 py-1 rounded-full text-[11px]">End Private</button></div>)}
      {vipStatus && <div className="bg-[#241040] border-b border-[#3A1B63] px-3 py-1.5 text-[11px] text-[#FFD700] text-center">{vipStatus}</div>}
      {camError && <div className="bg-red-600 px-3 py-2 text-[11px] text-center font-bold">{camError} • <button onClick={()=>{ setCamError(""); goLive(); }} className="underline">Tap to Retry</button></div>}

      <div className={`relative bg-[#1E0B36] w-full overflow-hidden ${tab==="live" ? "flex-1 flex flex-col pb-[70px]" : "hidden"}`}>
        <div className="relative flex-1 aspect-[9/14] overflow-hidden bg-black">
          <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${isLive ? "block" : "hidden"}`} style={{ transform: "scaleX(-1)" }} />
          <video ref={remoteRef} autoPlay playsInline className={`w-full h-full object-cover bg-black ${watching ? "block" : "hidden"}`} />
          {showFloaters && (isLive || watching) && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-[15]">
              {floaters.map(f=>(<div key={f.id} className="absolute whitespace-nowrap animate-flyComment" style={{ top: `${f.top}%`, animationDuration: `${f.duration}s`, color: f.color }}><span className="bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-[12px] font-bold shadow-lg">@{f.user}: <span className="text-white">{f.msg}</span></span></div>))}
            </div>
          )}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">{gifts.map(g=>(<div key={g.id} className="absolute bottom-20 text-3xl animate-heart" style={{ left: `${g.x}%` }}>{g.emoji}</div>))}</div>
          {(isLive || watching) && (
            <>
              <div className="absolute top-2 left-2 right-2 flex justify-between z-20">
                <div className="bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-xs flex items-center gap-1">🔴 @{watching||nickname} ❤️ {chat.length}</div>
                <div className="flex gap-1"><div className="bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-xs">{liveHosts.length+1} viewers</div><button onClick={()=> isLive ? stopLive() : stopWatching()} className="bg-black/60 w-6 h-6 rounded-full flex items-center justify-center">✕</button></div>
              </div>
              <div className="absolute top-10 left-2 bg-black/60 px-2.5 py-1 rounded-full text-[10px] z-20">Daily Ranking</div>
              <div className="absolute top-10 right-2 bg-[#FFD700] text-black px-2.5 py-1 rounded-full text-[10px] font-black z-20">{vipActive ? `👑 PRIVATE ${fmtTime(vipSeconds)}` : "Gallery 3/10"}</div>
              {watching && (<button onClick={()=>toggleFollow(watching)} className={`absolute top-16 left-2 z-20 px-3 py-1.5 rounded-full text-[11px] font-black ${following.includes(watching)?"bg-black/60 text-white":"bg-[#FFD700] text-black"}`}>{following.includes(watching)?"Following ✓":"➕ Follow @"+watching}</button>)}
              {watching && !vipActive && (<button onClick={()=>setShowVipModal(true)} className="absolute bottom-3 right-2 z-20 bg-[#FFD700] text-black px-3 py-2 rounded-full text-[11px] font-black shadow-lg">👑 Request Private</button>)}
            </>
          )}
          {!isLive && !watching && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1E0B36] to-black z-10">
              <p className="text-[11px] tracking-[0.25em] text-[#FFD700] font-black mb-2">LOOMI-LIVE</p>
              <button onClick={goLive} className="bg-[#FFD700] text-black px-10 py-4 rounded-full font-black text-lg shadow-[0_0_30px_rgba(255,215,0,0.4)]">🔴 GO LIVE</button>
              <p className="mt-3 text-white/50 text-xs">{liveHosts.length} live now</p>
              {camError && <p className="mt-2 text-red-400 text-[11px] px-6 text-center">{camError}</p>}
            </div>
          )}
        </div>
        {chatError && <div className="bg-red-600/90 px-3 py-1.5 text-[11px] text-center">{chatError}</div>}
        <div className="bg-[#150826] p-2 h-[20vh] overflow-y-auto space-y-1">
          {chat.length===0 && <p className="text-white/30 text-xs text-center pt-2">No comments yet - be first! 💬</p>}
          {chat.filter(c=>!blockedUsers.includes(c.user)).map((c,i)=><p key={c.id || i} className="text-[13px] cursor-pointer" onClick={()=>{ if(c.user!==nickname) setShowSafety(c.user); }}><span className="text-[#FFD700] font-bold">@{c.user}:</span> <span className="text-white/90">{c.msg}</span> {c.user!==nickname && <span className="text-white/30 text-[10px]"> • tap to report</span>}</p>)}
          <div ref={chatEndRef} />
        </div>
        <div className="bg-[#241040] border-t border-[#3A1B63] p-2 flex gap-2 overflow-x-auto relative z-30">
          <button onClick={()=>sendGift(0,"❤️")} className="min-w-[64px] bg-[#150826] border border-[#3A1B63] rounded-xl py-2 text-xs font-bold">❤️<br/><span className="text-white/60">FREE</span></button>
          <button onClick={()=>sendGift(1,"🌹")} className="min-w-[64px] bg-[#150826] border border-[#3A1B63] rounded-xl py-2 text-xs font-bold">🌹<br/>1 🪙</button>
          <button onClick={()=>sendGift(5,"🚀")} className="min-w-[64px] bg-[#150826] border border-[#3A1B63] rounded-xl py-2 text-xs font-bold">🚀<br/>5 🪙</button>
          <button onClick={()=>sendGift(10,"👑")} className="min-w-[64px] bg-[#150826] border border-[#3A1B63] rounded-xl py-2 text-xs font-bold">👑<br/>10</button>
          <button onClick={()=>sendGift(50,"💎")} className="min-w-[64px] bg-[#FFD700] text-black rounded-xl py-2 text-xs font-black">💎<br/>50</button>
          <button onClick={()=>sendGift(100,"🔥")} className="min-w-[64px] bg-orange-600 rounded-xl py-2 text-xs font-bold">🔥<br/>100</button>
        </div>
        <div className="p-2 flex gap-2 bg-[#150826] border-t border-[#3A1B63] relative z-30">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendChat()} className="flex-1 bg-[#241040] border border-[#3A1B63] rounded-full px-4 py-2.5 text-sm outline-none placeholder:text-white/40" placeholder={currentRoom ? `Chat in @${currentRoom}` : "Go live first"} />
          <button onClick={sendChat} className="bg-[#FFD700] text-black px-5 rounded-full text-sm font-black">Send</button>
        </div>
      </div>

      {/* ===== FEED - HOT ASF - FIRST TAB ===== */}
      {tab==="feed" && (
        <div className="flex-1 bg-[#150826] overflow-y-auto pb-[80px]">
          {/* Create post bar like Facebook */}
          <div className="p-3">
            <div onClick={()=>setShowCreatePost(true)} className="bg-[#241040] border border-[#3A1B63] rounded-2xl p-3 flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-[#FFD700] text-black flex items-center justify-center font-black">{nickname[0]?.toUpperCase()||"?"}</div>
              <p className="text-sm text-white/50 flex-1">What's on your mind, @{nickname}? 🤔</p>
              <span className="text-[#FFD700] text-xs font-black">+ Post</span>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={()=>{ setPostType("video"); setShowCreatePost(true); }} className="flex-1 bg-[#241040] border border-[#3A1B63] rounded-full py-2 text-xs font-bold">📹 Video</button>
              <button onClick={()=>{ setPostType("post"); setShowCreatePost(true); }} className="flex-1 bg-[#241040] border border-[#3A1B63] rounded-full py-2 text-xs font-bold">🖼️ Photo</button>
              <button onClick={()=>{ setPostType("meme"); setShowCreatePost(true); }} className="flex-1 bg-[#241040] border border-[#3A1B63] rounded-full py-2 text-xs font-bold">😂 Meme</button>
              <button onClick={()=>{ setPostLocked(true); setShowCreatePost(true); }} className="flex-1 bg-[#FFD700] text-black rounded-full py-2 text-xs font-black">🔒 Paid</button>
            </div>
          </div>

          {/* Trending hashtags */}
          {trendingTags.length>0 && (
            <div className="px-3 pb-2">
              <p className="text-xs font-black text-[#FFD700] mb-2">🔥 TRENDING NOW</p>
              <div className="flex gap-2 overflow-x-auto">
                {trendingTags.map(t=>(
                  <button key={t.tag} onClick={()=>setSearchQuery(t.tag)} className="whitespace-nowrap bg-[#241040] border border-[#FFD700]/40 rounded-full px-3 py-1.5 text-xs">{t.tag} <span className="text-[#FFD700] font-black">{t.count}</span></button>
                ))}
              </div>
            </div>
          )}

          {/* Feed Filters - For You / Following / Trending / Saved */}
          <div className="flex gap-2 px-3 pb-3 overflow-x-auto">
            <button onClick={()=>setFeedFilter("foryou")} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold ${feedFilter==="foryou"?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>✨ For You</button>
            <button onClick={()=>setFeedFilter("following")} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold ${feedFilter==="following"?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>👥 Following</button>
            <button onClick={()=>setFeedFilter("trending")} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold ${feedFilter==="trending"?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>🔥 Trending</button>
            <button onClick={()=>setFeedFilter("saved")} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold ${feedFilter==="saved"?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>🔖 Saved ({savedPosts.length})</button>
          </div>

          {searchQuery && <p className="px-3 pb-2 text-xs text-[#FFD700]">Showing {filteredPosts.length} posts for "{searchQuery}" • <button onClick={()=>setSearchQuery("")} className="underline">Clear</button></p>}
          {filteredPosts.length===0 && (
            <div className="text-center px-6 mt-8">
              <p className="text-4xl">📸</p>
              <p className="font-black mt-2">No posts yet in {feedFilter}</p>
              <p className="text-white/40 text-xs mt-1">Be first to post a video, pic or meme!</p>
              <button onClick={()=>setShowCreatePost(true)} className="mt-3 bg-[#FFD700] text-black px-6 py-2.5 rounded-full text-xs font-black">Create First Post 🚀</button>
            </div>
          )}
          <div className="space-y-3 px-3">
            {filteredPosts.map(p=>{
              const isUnlocked = !p.isLocked || p.unlockedBy?.includes(nickname) || p.creator===nickname;
              const isLiked = p.likedBy?.includes(nickname);
              const isSaved = savedPosts.includes(p.id);
              const comments = postComments[p.id] || [];
              const isVideo = p.mediaType==="video" || isVideoUrl(p.mediaUrl||"");
              return (
                <div key={p.id} className="bg-[#241040] border border-[#3A1B63] rounded-2xl overflow-hidden">
                  {/* Header - Facebook style */}
                  <div className="p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-orange-500 text-black flex items-center justify-center font-black">{p.creator[0]?.toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-black leading-none">@{p.creator} {p.creator===nickname && <span className="text-[10px] bg-[#FFD700] text-black px-1.5 py-0.5 rounded-full">YOU</span>}</p>
                        <p className="text-[11px] text-white/40 mt-0.5">{p.postType==="meme" ? "😂 Meme • " : p.postType==="video" || isVideo ? "📹 Video • " : "📝 Post • "} Just now • 🌍</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {p.creator!==nickname && <button onClick={()=>toggleFollow(p.creator)} className={`px-3 py-1.5 rounded-full text-[11px] font-black ${following.includes(p.creator)?"bg-[#150826] border border-[#3A1B63] text-white/60":"bg-[#FFD700] text-black"}`}>{following.includes(p.creator)?"Following ✓":"Follow"}</button>}
                      <button onClick={()=>toggleSavePost(p.id)} className="text-lg">{isSaved?"🔖":"📑"}</button>
                    </div>
                  </div>
                  <div className="px-3 pb-2 text-sm text-white/90 leading-relaxed">{renderHashtags(p.caption)}</div>
                  {p.mediaUrl ? (
                    <div className="relative" onDoubleClick={()=>likePost(p)}>
                      {isUnlocked ? (
                        isVideo ? <video src={p.mediaUrl} controls playsInline className="w-full max-h-[420px] object-cover bg-black" /> : <img src={p.mediaUrl} alt="" className="w-full max-h-[420px] object-cover" />
                      ) : (
                        <div className="relative"><img src={p.mediaUrl} alt="" className="w-full max-h-[320px] object-cover blur-xl opacity-40" /><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl">🔒</span><p className="text-xs text-white/70 mt-1">Exclusive content from @{p.creator}</p><button onClick={()=>unlockPost(p)} className="mt-2 bg-[#FFD700] text-black px-5 py-2 rounded-full text-xs font-black">Unlock for {p.price} 🪙</button></div></div>
                      )}
                      {p.isLocked && <span className="absolute top-2 right-2 bg-[#FFD700] text-black text-[10px] px-2 py-1 rounded-full font-black">🔒 {p.price} 🪙</span>}
                      {isVideo && isUnlocked && <span className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded-full text-[10px]">▶️ Tap to play • Double-tap to ❤️</span>}
                    </div>
                  ) : !isUnlocked ? (
                    <div className="p-4 text-center bg-black/20"><p className="text-white/60 text-xs">🔒 Locked post - unlock to view</p><button onClick={()=>unlockPost(p)} className="mt-2 bg-[#FFD700] text-black px-5 py-2 rounded-full text-xs font-black">Unlock for {p.price} 🪙</button></div>
                  ) : null}
                  {/* Actions - Facebook / TikTok style */}
                  <div className="px-3 pt-2 flex justify-between text-xs text-white/60"><span>❤️ {p.likes||0} likes • 💬 {comments.length} comments</span><span>{p.isLocked ? `🔒 Earned ${p.price} 🪙 per unlock` : ""}</span></div>
                  <div className="p-2 flex gap-1 border-t border-[#3A1B63]/50 mt-2">
                    <button onClick={()=>likePost(p)} className={`flex-1 py-2.5 rounded-full text-xs font-bold ${isLiked?"bg-[#FFD700] text-black":"bg-[#150826] border border-[#3A1B63]"}`}>{isLiked?"❤️ Liked":"🤍 Like"}</button>
                    <button onClick={()=>setOpenComments(openComments===p.id?null:p.id)} className="flex-1 bg-[#150826] border border-[#3A1B63] py-2.5 rounded-full text-xs font-bold">💬 Comment</button>
                    <button onClick={()=>sharePost(p)} className="flex-1 bg-[#150826] border border-[#3A1B63] py-2.5 rounded-full text-xs font-bold">↗ Share</button>
                    <button onClick={()=>tipPost(p)} className="flex-1 bg-[#150826] border border-[#3A1B63] py-2.5 rounded-full text-xs font-bold">💎 Tip 5</button>
                    {p.isLocked && !isUnlocked && <button onClick={()=>unlockPost(p)} className="flex-1 bg-[#FFD700] text-black py-2.5 rounded-full text-xs font-black">Unlock</button>}
                  </div>
                  {/* Comments */}
                  {openComments===p.id && (
                    <div className="px-3 pb-3 border-t border-[#3A1B63]/50">
                      <div className="max-h-[180px] overflow-y-auto mt-2 space-y-2">
                        {comments.length===0 && <p className="text-white/40 text-xs text-center py-2">No comments yet - be first! 💬</p>}
                        {comments.map((c:any)=>(<p key={c.id} className="text-[13px]"><span className="text-[#FFD700] font-bold">@{c.user}:</span> <span className="text-white/90">{c.msg}</span></p>))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <input value={commentInput} onChange={e=>setCommentInput(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendPostComment(p.id)} placeholder="Write a comment..." className="flex-1 bg-[#150826] border border-[#3A1B63] rounded-full px-3 py-2 text-xs outline-none placeholder:text-white/40" />
                        <button onClick={()=>sendPostComment(p.id)} className="bg-[#FFD700] text-black px-4 rounded-full text-xs font-black">Send</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="discover" && (
        <div className="flex-1 bg-[#150826] overflow-y-auto pb-[70px]">
          <div className="p-3 space-y-3">
            <div className="flex gap-2">
              <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="🔍 Search @username..." className="flex-1 bg-[#241040] border border-[#3A1B63] rounded-full px-4 py-2.5 text-sm outline-none placeholder:text-white/40" />
              {searchQuery && <button onClick={()=>setSearchQuery("")} className="bg-[#241040] border border-[#3A1B63] px-3 rounded-full text-xs">✕</button>}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(c=>(<button key={c} onClick={()=>setSelectedCategory(c)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold ${selectedCategory===c?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>{c}</button>))}
            </div>
            <p className="text-xs font-bold text-[#FFD700]">{filteredHosts.length} live in {selectedCategory} {searchQuery && `for "${searchQuery}"`}</p>
            <div className="flex gap-3 overflow-x-auto">
              <div className="text-center min-w-[56px]"><div onClick={goLive} className="w-14 h-14 rounded-full bg-[#FFD700] text-black flex items-center justify-center font-black cursor-pointer">+</div><p className="text-[11px] mt-1">Go LIVE</p></div>
              {filteredHosts.map((h:any)=>(
                <div key={h.nickname} className="text-center min-w-[72px]">
                  <div onClick={()=>watchHost(h.nickname)} className="w-14 h-14 mx-auto rounded-full bg-red-600 border-2 border-[#FFD700] flex items-center justify-center animate-pulse cursor-pointer">🔴</div>
                  <p className="text-[11px] mt-1 truncate w-14 mx-auto">@{h.nickname}</p>
                  <p className="text-[9px] text-white/40">{h.category || getCategoryFor(h.nickname)}</p>
                  <button onClick={()=>toggleFollow(h.nickname)} className={`mt-1 px-3 py-1 rounded-full text-[10px] font-black ${following.includes(h.nickname)?"bg-[#241040] border border-[#3A1B63] text-white/60":"bg-[#FFD700] text-black"}`}>{following.includes(h.nickname)?"Following ✓":"Follow"}</button>
                </div>
              ))}
            </div>
            {filteredHosts.length===0 && <p className="text-center text-white/40 text-xs mt-2">No live in {selectedCategory} - try All</p>}
            <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl p-3">
              <p className="text-xs font-black">Your Category - how others find you</p>
              <div className="flex gap-2 overflow-x-auto mt-2">
                {categories.filter(c=>c!=="All").map(c=>(<button key={c} onClick={()=>{ setUserCategory(c); localStorage.setItem("loomi_category", c); if(authUser) updateDoc(doc(db, "loomi_users", authUser.uid), { category: c }).catch(()=>{}); }} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold ${userCategory===c?"bg-[#FFD700] text-black":"bg-[#150826] border border-[#3A1B63]"}`}>{c}</button>))}
              </div>
              <p className="text-[11px] text-white/50 mt-2">You are listed as: <b className="text-[#FFD700]">{userCategory}</b></p>
            </div>
          </div>
          <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl mx-3 h-64 flex items-center justify-center text-white/40 text-sm">LIVE Preview Area</div>
          {following.length>0 && <div className="mx-3 mt-3 bg-[#241040] border border-[#3A1B63] rounded-2xl p-3"><p className="text-xs font-black">Following ({following.length})</p>{following.map(u=><div key={u} className="flex justify-between py-2 text-sm"><span>@{u}</span><button onClick={()=>toggleFollow(u)} className="text-red-400 text-xs">Unfollow</button></div>)}</div>}
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
                rankings.map(r=>(<div key={r.user} className="flex items-center gap-3 py-2 border-b border-[#3A1B63]"><span className="w-6 font-black text-[#FFD700]">{r.rank}</span><div className="w-10 h-10 rounded-full bg-[#241040] border border-[#3A1B63]"></div><div className="flex-1"><p className="text-sm font-bold">@{r.user}</p></div><span className="text-sm font-bold text-[#FFD700]">{r.pts} pts</span></div>))
              }
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center"><div className="text-7xl">🦌</div><h2 className="font-black text-xl mt-3">Guardian</h2><p className="text-xs text-white/50 mt-2">The #1 sender becomes Guardian</p><button onClick={()=>sendGift(100,"🛡️")} className="mt-4 bg-[#FFD700] text-black px-6 py-3 rounded-full text-xs font-black">Send Guardian Pledge (100)</button></div>
          )}
        </div>
      )}

      {tab==="balance" && (
        <div className="flex-1 bg-[#150826] text-white p-3 space-y-3 overflow-y-auto pb-[80px]">
          <div className="bg-gradient-to-r from-[#FFD700] to-orange-500 text-black rounded-2xl p-4 flex justify-between items-center">
            <div><p className="text-lg font-black">@{nickname}</p><p className="text-[11px] font-bold opacity-70">{userCategory} Creator • {authUser?.email}</p></div>
            <button onClick={shareApp} className="bg-black text-white px-3 py-2 rounded-full text-xs font-black">↗ Share</button>
          </div>
          <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl text-center py-6">
            <p className="text-xs text-white/60">Coins Balance</p>
            <p className="text-4xl font-black text-[#FFD700]">{keys} 🪙</p>
            <p className="text-xs text-white/50">@{nickname} • 1 coin = R 0.27</p>
            <div className="flex gap-2 justify-center mt-3">
              <button onClick={()=>setShowRecharge(true)} className="bg-[#FFD700] text-black px-4 py-2 rounded-full text-xs font-black">Get Coins</button>
              <button onClick={()=>setShowCashout(true)} className="bg-white text-black px-4 py-2 rounded-full text-xs font-black">Cash Out 💸</button>
            </div>
          </div>
          {!dailyClaimed && <button onClick={claimDaily} className="w-full bg-[#FFD700] text-black py-3 rounded-2xl font-black text-sm animate-pulse">🎁 Claim Daily Bonus +10 🪙</button>}
          {dailyClaimed && <p className="text-center text-xs text-white/50">✅ Daily bonus claimed - come back tomorrow for +10 🪙</p>}
          <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl p-4">
            <p className="text-sm font-black">Earnings Breakdown</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span>⭐ Live Gifts</span><span className="text-[#FFD700] font-bold">+ {giftEarnings} 🪙</span></div>
              <div className="flex justify-between"><span>🔒 Video Unlocks</span><span className="text-[#FFD700] font-bold">+ {unlockEarnings} 🪙</span></div>
              <div className="flex justify-between"><span>💎 Tips</span><span className="text-[#FFD700] font-bold">+ {tipEarnings} 🪙</span></div>
              <div className="flex justify-between"><span>👑 VIP Private</span><span className="text-[#FFD700] font-bold">+ {vipEarnings} 🪙</span></div>
              <div className="flex justify-between border-t border-[#3A1B63] pt-2 font-black"><span>Total Earned</span><span className="text-[#FFD700]">{totalEarnings} 🪙</span></div>
            </div>
          </div>
          <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl p-4">
            <p className="text-sm font-black">Cashout History</p>
            {cashouts.length===0 ? <p className="text-xs text-white/50 mt-1">No cashouts yet.</p> : cashouts.map(c=>(<div key={c.id} className="flex justify-between py-2 border-b border-[#3A1B63] text-sm"><span>{c.amount} 🪙 • {c.bankName}</span><span className={`text-xs font-bold ${c.status==="pending"?"text-yellow-400":"text-green-400"}`}>{c.status}</span></div>))}
          </div>
          {blockedUsers.length>0 && <div className="bg-[#241040] border border-[#3A1B63] rounded-2xl p-4"><p className="text-sm font-black">🛡️ Blocked Users</p>{blockedUsers.map(u=><div key={u} className="flex justify-between py-2 text-sm"><span>@{u}</span><button onClick={()=>unblockUser(u)} className="text-[#FFD700] text-xs underline">Unblock</button></div>)}</div>}
        </div>
      )}

      {showVipModal && (<div className="absolute inset-0 z-[90] flex flex-col justify-end"><div className="flex-1 bg-black/70" onClick={()=>setShowVipModal(false)}></div><div className="bg-[#1E0B36] border-t border-[#FFD700] rounded-t-[24px] p-4 space-y-3"><h2 className="font-black text-center">👑 Request Private with @{watching}</h2><p className="text-xs text-white/60 text-center">5 minutes private 1-to-1. Coins deducted now.</p><div className="flex gap-2">{[50,100,200].map(v=><button key={v} onClick={()=>setVipPrice(v)} className={`flex-1 py-3 rounded-xl text-xs font-black ${vipPrice===v?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>{v} 🪙</button>)}</div><button onClick={requestPrivate} className="w-full bg-[#FFD700] text-black py-3 rounded-full font-black">Send Request - {vipPrice} 🪙</button><button onClick={()=>setShowVipModal(false)} className="w-full text-white/60 text-xs">Cancel</button></div></div>)}
      {vipIncoming && (<div className="absolute inset-0 z-[95] flex items-center justify-center p-6"><div className="bg-[#1E0B36] border border-[#FFD700] rounded-2xl p-5 w-full text-center"><h2 className="font-black">👑 Private Request</h2><p className="text-sm mt-2">@{vipIncoming.viewer} wants Private for <b className="text-[#FFD700]">{vipIncoming.price} 🪙</b></p><p className="text-xs text-white/60">5 mins 1-to-1</p><div className="flex gap-2 mt-4"><button onClick={declineVip} className="flex-1 bg-[#241040] border border-[#3A1B63] py-3 rounded-full font-black text-xs">Decline</button><button onClick={acceptVip} className="flex-1 bg-[#FFD700] text-black py-3 rounded-full font-black text-xs">Accept</button></div></div></div>)}

      {/* CREATE POST - HOT */}
      {showCreatePost && (
        <div className="absolute inset-0 z-[90] flex flex-col justify-end"><div className="flex-1 bg-black/70" onClick={()=>setShowCreatePost(false)}></div><div className="bg-[#1E0B36] border-t border-[#3A1B63] rounded-t-[24px] p-4 space-y-3 max-h-[85vh] overflow-y-auto">
          <h2 className="font-black text-center">Create Post - Loomi-Live 🔥</h2>
          <div className="flex gap-2">
            <button onClick={()=>setPostType("post")} className={`flex-1 py-2.5 rounded-xl text-xs font-black ${postType==="post"?"bg-white text-black":"bg-[#241040] border border-[#3A1B63]"}`}>📝 Post</button>
            <button onClick={()=>setPostType("video")} className={`flex-1 py-2.5 rounded-xl text-xs font-black ${postType==="video"?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>📹 Video</button>
            <button onClick={()=>setPostType("meme")} className={`flex-1 py-2.5 rounded-xl text-xs font-black ${postType==="meme"?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>😂 Meme</button>
          </div>
          <textarea value={postCaption} onChange={e=>setPostCaption(e.target.value)} placeholder={postType==="meme" ? "Meme caption... 😂 e.g. When NSFAS drops #funny #meme" : postType==="video" ? "Video caption... 📹 Add #hashtags to go viral #fyp" : "What's on your mind? Add #hashtags..."} className="w-full bg-[#241040] border border-[#3A1B63] rounded-xl p-3 text-sm outline-none placeholder:text-white/40" rows={3} />
          <div className="flex gap-2 flex-wrap">
            {["#fyp","#funny","#meme","#viral","#southafrica","#amapiano"].map(t=>(
              <button key={t} onClick={()=>setPostCaption(prev=> prev.includes(t) ? prev : (prev+" "+t).trim())} className="bg-[#241040] border border-[#FFD700]/40 rounded-full px-3 py-1 text-[11px]">{t} +</button>
            ))}
          </div>
          <input value={postMedia} onChange={e=>setPostMedia(e.target.value)} placeholder={postType==="video" ? "Video URL - .mp4 link" : "Image URL - paste pic / meme link"} className="w-full bg-[#241040] border border-[#3A1B63] rounded-xl p-3 text-sm outline-none placeholder:text-white/40" />
          <p className="text-[11px] text-white/40">Tip: Upload pic/video to imgur / catbox.moe / Google Drive (Anyone with link) then paste link here.</p>
          <div className="flex gap-2">
            <button onClick={()=>setPostLocked(false)} className={`flex-1 py-3 rounded-xl text-xs font-black ${!postLocked?"bg-white text-black":"bg-[#241040] border border-[#3A1B63]"}`}>FREE - Everyone sees</button>
            <button onClick={()=>setPostLocked(true)} className={`flex-1 py-3 rounded-xl text-xs font-black ${postLocked?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>🔒 LOCKED - Earn 🪙</button>
          </div>
          {postLocked && <div className="flex items-center gap-2"><span className="text-xs">Price:</span><input type="number" value={postPrice} onChange={e=>setPostPrice(parseInt(e.target.value)||0)} className="flex-1 bg-[#241040] border border-[#3A1B63] rounded-xl p-3 text-sm" /><span className="text-xs">🪙</span></div>}
          <button onClick={createPost} className="w-full bg-[#FFD700] text-black py-3 rounded-full font-black">Post 🔥</button>
          <button onClick={()=>setShowCreatePost(false)} className="w-full text-white/60 text-xs">Cancel</button>
        </div></div>
      )}
      {showCashout && (<div className="absolute inset-0 z-[90] flex flex-col justify-end"><div className="flex-1 bg-black/70" onClick={()=>setShowCashout(false)}></div><div className="bg-[#1E0B36] border-t border-[#FFD700] rounded-t-[24px] p-4 space-y-3"><h2 className="font-black text-center">💸 Cash Out - Loomi-Live</h2><p className="text-xs text-white/60 text-center">Balance: {keys} 🪙 • Min 50 • Paid weekly</p><div className="flex gap-2">{[50,100,200,500].map(v=><button key={v} onClick={()=>setCashoutAmount(v)} className={`flex-1 py-2.5 rounded-xl text-xs font-black ${cashoutAmount===v?"bg-[#FFD700] text-black":"bg-[#241040] border border-[#3A1B63]"}`}>{v} 🪙</button>)}</div><input value={bankName} onChange={e=>setBankName(e.target.value)} placeholder="Bank - Capitec / FNB / Standard" className="w-full bg-[#241040] border border-[#3A1B63] rounded-xl p-3 text-sm outline-none" /><input value={accountNum} onChange={e=>setAccountNum(e.target.value)} placeholder="Account Number" className="w-full bg-[#241040] border border-[#3A1B63] rounded-xl p-3 text-sm outline-none" /><input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Account Name" className="w-full bg-[#241040] border border-[#3A1B63] rounded-xl p-3 text-sm outline-none" /><button onClick={requestCashout} className="w-full bg-[#FFD700] text-black py-3 rounded-full font-black">Request {cashoutAmount} 🪙 Cashout</button><button onClick={()=>setShowCashout(false)} className="w-full text-white/60 text-xs">Cancel</button></div></div>)}
      {showRecharge && (<div className="absolute inset-0 z-50 flex flex-col justify-end"><div className="flex-1 bg-black/60" onClick={()=>setShowRecharge(false)}></div><div className="bg-white text-black rounded-t-[24px] p-4"><h2 className="text-center font-black">Recharge - Loomi-Live</h2><div className="grid grid-cols-3 gap-2 mt-4">{[{c:5,r:"R 1,35"},{c:30,r:"R 8,09"},{c:40,r:"R 10,79"},{c:50,r:"R 13,45"},{c:70,r:"R 18,85"},{c:139,r:"R 37,39"}].map(p=><div key={p.c} onClick={()=>{ setKeys(k=>k+p.c); localStorage.setItem("loomi_keys",(keys+p.c).toString()); }} className="border rounded-xl p-3 text-center cursor-pointer"><p className="font-black">🪙 {p.c}</p><p className="text-xs">{p.r}</p></div>)}</div><button onClick={()=>setShowRecharge(false)} className="w-full mt-4 bg-black text-white py-3 rounded-full font-black">Close</button></div></div>)}
      {showDashboard && (
        <div className="absolute inset-0 z-[100] flex">
          <div className="flex-1 bg-black/60" onClick={()=>setShowDashboard(false)}></div>
          <div className="w-[78%] max-w-[320px] bg-[#150826] border-l border-[#3A1B63] h-full overflow-y-auto p-3 space-y-3">
            <div className="flex justify-between items-center p-1"><p className="font-black text-white">@{nickname}</p><button onClick={()=>setShowDashboard(false)} className="text-white text-xl">✕</button></div>
            <p className="text-[11px] text-white/50 px-1">{authUser?.email}</p>
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
            <button onClick={handleLogout} className="w-full bg-red-600 py-3 rounded-2xl font-black text-sm">Logout</button>
          </div>
        </div>
      )}
      {showSafety && (<div className="absolute inset-0 z-[95] flex items-center justify-center p-6"><div className="bg-[#1E0B36] border border-red-500 rounded-2xl p-5 w-full"><h2 className="font-black text-center">🛡️ Safety - @{showSafety}</h2><p className="text-xs text-white/60 text-center mt-1">What happened?</p><div className="flex flex-col gap-2 mt-3">{["Rude / Harassment","Sexual / Nude","Spam / Scam","Hate Speech"].map(r=>(<button key={r} onClick={()=>setReportReason(r)} className={`py-2.5 rounded-xl text-xs font-bold ${reportReason===r?"bg-red-600 text-white":"bg-[#241040] border border-[#3A1B63]"}`}>{r}</button>))}</div><div className="flex gap-2 mt-4"><button onClick={()=>blockUser(showSafety)} className="flex-1 bg-[#241040] border border-[#3A1B63] py-3 rounded-full font-black text-xs">🚫 Block</button><button onClick={()=>reportUser(showSafety)} className="flex-1 bg-red-600 py-3 rounded-full font-black text-xs">🚨 Report</button></div><button onClick={()=>setShowSafety(null)} className="w-full text-white/60 text-xs mt-3">Cancel</button></div></div>)}
      {showNotifs && (<div className="absolute inset-0 z-[96] flex flex-col justify-end"><div className="flex-1 bg-black/70" onClick={()=>setShowNotifs(false)}></div><div className="bg-[#1E0B36] border-t border-[#FFD700] rounded-t-[24px] p-4 max-h-[60vh] overflow-y-auto"><div className="flex justify-between items-center"><h2 className="font-black">🔔 Notifications</h2><button onClick={()=>{ setNotifications([]); setShowNotifs(false); }} className="text-xs text-[#FFD700] underline">Clear all</button></div>{notifications.length===0 ? <p className="text-white/50 text-xs mt-4 text-center">No notifications yet.</p> : notifications.map(n=>(<div key={n.id} onClick={()=>{ setShowNotifs(false); if(n.user && liveHosts.some((h:any)=>h.nickname===n.user)) watchHost(n.user); }} className="bg-[#241040] border border-[#3A1B63] rounded-xl p-3 mt-2 flex justify-between items-center cursor-pointer"><p className="text-sm">{n.text}</p><span className="text-[#FFD700] text-xs font-black">Watch ›</span></div>))}<button onClick={()=>setShowNotifs(false)} className="w-full mt-4 text-white/60 text-xs">Close</button></div></div>)}
      {showWelcome && (<div className="absolute inset-0 z-[110] flex items-center justify-center p-6 bg-black/80"><div className="bg-[#1E0B36] border border-[#FFD700] rounded-3xl p-6 w-full text-center"><p className="text-[11px] tracking-[0.3em] text-[#FFD700] font-black">WELCOME TO</p><h2 className="text-2xl font-black mt-1">LOOMI-LIVE ✨</h2><p className="text-sm text-white/70 mt-2">Go LIVE, get gifts, unlock FEED, earn real money.</p><div className="text-left text-xs space-y-2 mt-4 bg-[#241040] border border-[#3A1B63] rounded-xl p-3"><p>🔴 <b>Go LIVE</b> - show yourself</p><p>🎁 <b>Send Gifts</b> - support hosts</p><p>👑 <b>VIP Private</b> - 1-to-1 for coins</p><p>🔒 <b>FEED Unlocks</b> - earn from posts</p><p>💸 <b>Cash Out</b> - Capitec / FNB</p></div><button onClick={()=>{ localStorage.setItem("loomi_seen_welcome","1"); setShowWelcome(false); }} className="w-full mt-4 bg-[#FFD700] text-black py-3 rounded-full font-black">Start Exploring 🚀</button></div></div>)}
      {!dailyClaimed && !showWelcome && nickname && (<button onClick={claimDaily} className="absolute top-[118px] left-1/2 -translate-x-1/2 z-[80] bg-[#FFD700] text-black px-4 py-2 rounded-full text-xs font-black shadow-lg animate-bounce whitespace-nowrap">🎁 Claim Daily +10 🪙</button>)}
      {/* BOTTOM NAV - FEED FIRST */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-[#150826] border-t border-[#3A1B63] flex justify-around items-center py-2.5 z-[60]">
        <button onClick={()=>setTab("feed")} className={`flex flex-col items-center ${tab==="feed"?"text-[#FFD700]":"text-white/50"}`}><span className="text-[20px]">✨</span><span className="text-[9px]">FEED</span></button>
        <button onClick={()=>setTab("live")} className={`flex flex-col items-center ${tab==="live"?"text-[#FFD700]":"text-white/50"}`}><span className="text-[20px]">🏠</span><span className="text-[9px]">LIVE</span></button>
        <button onClick={goLive} className="bg-[#FFD700] text-black w-12 h-8 rounded-lg flex items-center justify-center font-black text-xl">+</button>
        <button onClick={()=>setTab("ranking")} className={`flex flex-col items-center ${tab==="ranking"?"text-[#FFD700]":"text-white/50"}`}><span className="text-[20px]">🏆</span><span className="text-[9px]">Rankings</span></button>
        <button onClick={()=>setTab("balance")} className={`flex flex-col items-center ${tab==="balance"?"text-[#FFD700]":"text-white/50"}`}><span className="text-[20px]">👤</span><span className="text-[9px]">Wallet</span></button>
      </div>
      <style>{`
        @keyframes heartFloat{0%{transform:translateY(0) scale(0.3);opacity:0}15%{opacity:1}100%{transform:translateY(-80vh);opacity:0}}
        .animate-heart{animation:heartFloat 3s ease-out forwards}
        @keyframes flyComment{0%{transform:translateX(100vw);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(-100%);opacity:0}}
        .animate-flyComment{animation:flyComment linear forwards}
      `}</style>
    </div>
  );
}
