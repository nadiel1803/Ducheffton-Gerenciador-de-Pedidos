// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// TODO: Adicione a configuração do seu projeto Firebase aqui
const firebaseConfig = {
  apiKey: "AIzaSyChkboBPp21hQ_tRFQrV2Hi3iBF-WHxWSE",
  authDomain: "gerenciador-de-pedidos-4ac32.firebaseapp.com",
  projectId: "gerenciador-de-pedidos-4ac32",
  storageBucket: "gerenciador-de-pedidos-4ac32.firebasestorage.app",
  messagingSenderId: "674975621927",
  appId: "1:674975621927:web:a09ad1f5c57c2dcb00ff02",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);