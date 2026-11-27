import { NextResponse } from "next/server";
import crypto from "crypto";
import admin from "firebase-admin";

function getAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
    if (!raw) {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
    }
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.firestore();
}

export async function POST(req: Request) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: "Paystack not configured" }, { status: 500 });
    }

    const raw = await req.text();

    // 1. Verify signature - Paystack proves it's really them
    const signature = req.headers.get("x-paystack-signature");
    const hash = crypto.createHmac("sha512", secret).update(raw).digest("hex");
    if (hash !== signature) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }

    const event = JSON.parse(raw);

    // Only care about successful payments
    if (event.event !== "charge.success") {
      return NextResponse.json({ ok: true });
    }

    const { reference, metadata } = event.data;
    const { uid, coins } = metadata || {};

    if (!uid || !coins) {
      return NextResponse.json({ error: "No metadata" }, { status: 400 });
    }

    // 2. Verify with Paystack - never trust webhook alone
    const verify = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
      }
    );
    const v = await verify.json();
    if (!v.data || v.data.status !== "success") {
      return NextResponse.json({ error: "Not verified" }, { status: 400 });
    }

    // 3. Credit coins - Admin only starts HERE, so build won't crash
    const db = getAdmin();

    const topupRef = db.collection("loomi_topups").doc(reference);
    const already = await topupRef.get();
    if (already.exists) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    await db.collection("loomi_users").doc(uid).update({
      keys: admin.firestore.FieldValue.increment(Number(coins)),
    });

    await topupRef.set({
      uid,
      coins: Number(coins),
      amount: v.data.amount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, credited: Number(coins) });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: err.message || "Webhook failed" }, { status: 500 });
  }
}