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
  apiKey: "AIzaSyB2pPpPVRmcKC8D4clCL73PSyuwVUN8wpY",
  authDomain: "ducheffton-pedidos.firebaseapp.com",
  projectId: "ducheffton-pedidos",
  storageBucket: "ducheffton-pedidos.firebasestorage.app",
  messagingSenderId: "2379935099",
  appId: "1:2379935099:web:e5131fb3c7beeb9d59a1de"
};

const app = initializeApp(firebaseConfig);
// analytics pode falhar se não estiver habilitado, por isso try/catch é seguro
try { getAnalytics(app); } catch(e){ /* ignora */ }

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);