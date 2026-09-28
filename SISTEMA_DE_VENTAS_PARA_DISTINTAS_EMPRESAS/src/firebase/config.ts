import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDMkUWTsXL2mbonqRi6KeFu1bgKxJmTCJ8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sistema-de-ventas-milam.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sistema-de-ventas-milam",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sistema-de-ventas-milam.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1027074999720",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1027074999720:web:c88adb99736e7a58d8c99d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firebase persistence: múltiples pestañas abiertas, persistencia solo en una.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firebase persistence: navegador no soporta IndexedDB.');
  }
});

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
}

export default app;