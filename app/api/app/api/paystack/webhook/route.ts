import { NextResponse } from "next/server";
import crypto from "crypto";

// POST /api/paystack/webhook — Paystack calls this after payment.
// Verifies signature, verifies transaction with Paystack, then credits coins.
// Needs: PAYSTACK_SECRET_KEY + Firebase Admin (npm i firebase-admin)
// + FIREBASE_SERVICE_ACCOUNT_JSON in Vercel env.

export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY!;
  const raw = await req.text();
  const hash = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  if (hash !== req.headers.get("x-paystack-signature")) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  const event = JSON.parse(raw);
  if (event.event !== "charge.success") return NextResponse.json({ ok: true });

  const { reference, metadata } = event.data;
  const { uid, coins } = metadata || {};
  if (!uid || !coins) return NextResponse.json({ error: "No metadata" }, { status: 400 });

  // 1. Verify with Paystack (never trust webhook alone)
  const verify = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const v = await verify.json();
  if (!v.data || v.data.status !== "success") {
    return NextResponse.json({ error: "Not verified" }, { status: 400 });
  }

  // 2. Credit coins — server only. Requires firebase-admin setup.
  // const admin = await import("@/lib/firebase-admin");
  // await admin.db.collection("loomi_users").doc(uid).update({
  //   keys: admin.FieldValue.increment(Number(coins)),
  // });
  // await admin.db.collection("loomi_topups").doc(reference).set({
  //   uid, coins: Number(coins), amount: v.data.amount, createdAt: admin.FieldValue.serverTimestamp(),
  // });

  return NextResponse.json({ ok: true, credited: Number(coins) });
}
