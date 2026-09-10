// Reimplements the get/set surface of Claude's artifact `window.storage` API,
// backed by Firestore, so the rest of the app (App.jsx) needs no changes.
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const COLLECTION = "opsData";

async function get(key) {
  const ref = doc(db, COLLECTION, key);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Key not found: " + key);
  return { key, value: snap.data().value };
}

async function set(key, value) {
  const ref = doc(db, COLLECTION, key);
  await setDoc(ref, { value });
  return { key, value };
}

async function del(key) {
  const ref = doc(db, COLLECTION, key);
  await deleteDoc(ref);
  return { key, deleted: true };
}

async function list(prefix) {
  const snap = await getDocs(collection(db, COLLECTION));
  const keys = snap.docs.map((d) => d.id).filter((k) => !prefix || k.startsWith(prefix));
  return { keys };
}

if (typeof window !== "undefined") {
  window.storage = { get, set, delete: del, list };
}
