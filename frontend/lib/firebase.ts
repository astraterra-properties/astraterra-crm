import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB0V7AU4j9Aybwe0jHLr-RJJZhJGfbbtws",
  authDomain: "astra-terra-website.firebaseapp.com",
  projectId: "astra-terra-website",
  storageBucket: "astra-terra-website.firebasestorage.app",
  messagingSenderId: "1080534409740",
  appId: "1:1080534409740:web:cd649051b0ab04aba44429",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
