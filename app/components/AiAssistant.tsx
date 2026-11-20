"use client";
import { useState } from "react";

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<{me:boolean; text:string}[]>([
    { me: false, text: "Hi! I'm Loomi AI ✨ Ask me how to Go LIVE, earn coins, or cash out." }
  ]);

  function ask() {
    if (!q.trim()) return;
    const question = q.toLowerCase();
    const userMsg = q;
    setQ("");
    let answer = "You can Go LIVE with the red button, get gifts ❤️🌹💎, and cash out from Wallet. What do you want to do?";
    if (question.includes("live")) answer = "Tap + then 🔴 Go LIVE. Viewers will see you in Discover. Turn on Face Blur if you want privacy 😶‍🌫️";
    else if (question.includes("earn") || question.includes("money") || question.includes("coin")) answer = "Earn from LIVE Gifts, FEED Unlocks, Tips, DM (Paid), and VIP Private 50/100/200 🪙. 1 🪙 = R 0.27. Cashout min 50 🪙 in Wallet.";
    else if (question.includes("cash") || question.includes("withdraw") || question.includes("capitec") || question.includes("fnb")) answer = "Go to Wallet → Cash Out 💸. Min 50 🪙. Add Capitec / FNB / Standard, Account Number + Name. Paid weekly.";
    else if (question.includes("dm")) answer = "DM is set by the HOST. They choose Paid / Free / Followers Only / OFF. Check their profile → Message.";
    else if (question.includes("vip") || question.includes("private")) answer = "VIP Private is 1-to-1. Viewer sends Request for 50 / 100 / 200 🪙. Host Accepts, then you go Private 👑";
    else if (question.includes("unlock") || question.includes("locked")) answer = "Locked 🔒 posts cost coins. Tap Unlock, pay the price, and you can view it. Host earns the coins.";
    else if (question.includes("safe") || question.includes("report") || question.includes("block") || question.includes("privacy")) answer = "Tap any comment → Report / Block. Use Privacy for Face Blur, Private Profile, and View-Once. No screenshots on Private content 🛡️";
    setMsgs((m) => [...m, { me: true, text: userMsg }, { me: false, text: answer }]);
  }

  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed bottom-[80px] right-4 z-[120] w-12 h-12 bg-[#FFD700] text-black rounded-full font-black text-xl shadow-lg">
        ✨
      </button>
      {open && (
        <div className="fixed bottom-[140px] right-3 left-3 max-w-[400px] mx-auto z-[120] bg-[#1E0B36] border border-[#FFD700] rounded-3xl p-3 shadow-2xl">
          <div className="flex justify-between items-center">
            <p className="font-black text-sm">✨ Loomi AI Assistant</p>
            <button onClick={() => setOpen(false)} className="text-white/60">✕</button>
          </div>
          <div className="h-[220px] overflow-y-auto space-y-2 mt-2">
            {msgs.map((m, i) => (
              <div key={i} className={`p-2 rounded-xl text-xs ${m.me ? "bg-[#FFD700] text-black ml-8" : "bg-[#241040] border border-[#3A1B63] mr-8"}`}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Ask how to earn, go live..." className="flex-1 bg-[#241040] border border-[#3A1B63] rounded-full px-3 py-2 text-xs outline-none" />
            <button onClick={ask} className="bg-[#FFD700] text-black px-4 rounded-full font-black text-xs">Send</button>
          </div>
        </div>
      )}
    </>
  );
}
