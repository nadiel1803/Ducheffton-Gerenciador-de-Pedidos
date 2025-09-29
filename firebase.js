// firebase.js (module) - inicializa Firebase e exporta auth e db
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/*
  Sua configuração — usei exatamente o que você enviou.
  Se precisar trocar algo, altere aqui.
*/
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
// analytics pode falhar se não estiver habilitado, por isso try/catch é seguro
try { getAnalytics(app); } catch(e){ /* ignora */ }

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
