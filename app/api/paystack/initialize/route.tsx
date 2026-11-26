import { NextResponse } from "next/server";

// POST /api/paystack/initialize
// Body: { email: string, coins: number, uid: string }
// Returns: { authorization_url }
// Uses PAYSTACK_SECRET_KEY (server-only, no NEXT_PUBLIC_)

const COIN_PACKS: Record<number, number> = {
  5: 135, 30: 809, 40: 1079, 50: 1345, 70: 1885, 139: 3739,
}; // amount in cents (ZAR)

export async function POST(req: Request) {
  const { email, coins, uid } = await req.json();
  if (!email?.includes("@") || !uid || !COIN_PACKS[coins]) {
    return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
  }
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Paystack not configured" }, { status: 500 });

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      amount: COIN_PACKS[coins],
      metadata: { uid, coins, source: "loomi-live" },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/buy-keys?verify=true`,
    }),
  });
  const data = await res.json();
  if (!data.status) return NextResponse.json({ error: data.message || "Paystack failed" }, { status: 400 });
  return NextResponse.json({ authorization_url: data.data.authorization_url, reference: data.data.reference });
}
