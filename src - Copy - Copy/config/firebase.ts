import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "[REDACTED_API_KEY]",
  authDomain: "smart-attend-e1604.firebaseapp.com",
  projectId: "smart-attend-e1604",
  storageBucket: "smart-attend-e1604.firebasestorage.app",
  messagingSenderId: "500263335673",
  appId: "1:500263335673:web:36fc77cbe51b195ffb1428",
  measurementId: "G-5C0LGTJE0J"
};

// Initialize Firebase safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
