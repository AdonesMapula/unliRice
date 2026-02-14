// src/firebase/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDSOkMwIxvUnezN58cCL0nZUTyd9JYISas",
  authDomain: "ltms-scanner.firebaseapp.com",
  databaseURL: "https://ltms-scanner-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ltms-scanner",
  storageBucket: "ltms-scanner.firebasestorage.app",
  messagingSenderId: "549613150350",
  appId: "1:549613150350:web:efc876a1200cdf3e5069df",
  measurementId: "G-G96LVNPQY9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);