import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBvo-F7BGLN59VUnkHmfI9RQKsTnhPIXZE",
  authDomain: "reflectflow-16f92.firebaseapp.com",
  projectId: "reflectflow-16f92",
  storageBucket: "reflectflow-16f92.firebasestorage.app",
  messagingSenderId: "457987340747",
  appId: "1:457987340747:web:091a47e85f620658f4de4e",
  measurementId: "G-J1W6KQ6T09",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;