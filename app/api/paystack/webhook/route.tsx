import { NextResponse } from "next/server";
import crypto from "crypto";
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}"
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY!;
  const raw = await req.text();

  const signature = req.headers.get("x-paystack-signature");
  const hash = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  if (hash !== signature) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const event = JSON.parse(raw);
  if (event.event !== "charge.success") return NextResponse.json({ ok: true });

  const { reference, metadata } = event.data;
  const { uid, coins } = metadata || {};
  if (!uid || !coins) return NextResponse.json({ error: "No metadata" }, { status: 400 });

  const verify = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const v = await verify.json();
  if (!v.data || v.data.status !== "success") {
    return NextResponse.json({ error: "Not verified" }, { status: 400 });
  }

  const topupRef = db.collection("loomi_topups").doc(reference);
  const already = await topupRef.get();
  if (already.exists) return NextResponse.json({ ok: true, duplicate: true });

  await db.collection("loomi_users").doc(uid).update({
    keys: admin.firestore.FieldValue.increment(Number(coins)),
  });
  await topupRef.set({
    uid, coins: Number(coins), amount: v.data.amount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, credited: Number(coins) });
}
