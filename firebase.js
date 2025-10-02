// firebase.js — inicializa Firebase e exporta apenas o Firestore (db)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* Sua configuração — mantenha os valores que você já tinha */
const firebaseConfig = {
  apiKey: "AIzaSyChkboBPp21hQ_tRFQrV2Hi3iBF-WHxWSE",
  authDomain: "gerenciador-de-pedidos-4ac32.firebaseapp.com",
  projectId: "gerenciador-de-pedidos-4ac32",
  storageBucket: "gerenciador-de-pedidos-4ac32.firebasestorage.app",
  messagingSenderId: "674975621927",
  appId: "1:674975621927:web:a09ad1f5c57c2dcb00ff02",
  measurementId: "G-FWSS1YTR2J"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
