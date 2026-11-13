import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCZnKHJowjahIoVrf8duZNxA6LzA7vw2-Q",
  authDomain: "loomi-live.firebaseapp.com",
  projectId: "loomi-live",
  storageBucket: "loomi-live.firebasestorage.app",
  messagingSenderId: "922536195604",
  appId: "1:922536195604:web:65d28130faa4e3b10b1901",
  measurementId: "G-YC6DE5DL9Y"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
