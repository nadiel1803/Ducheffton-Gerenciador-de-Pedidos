// script.js (module) — versão corrigida e otimizada
import { auth, provider, db } from './firebase.js';
import {
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  doc,
  deleteDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* === CONFIGURÁVEL: lista de e-mails autorizados ===
   Edite esta lista para controlar quem pode logar. */
const ALLOWED_EMAILS = [
  "danialmeida1803@gmail.com", // exemplo
  // "outro@exemplo.com"
];
// cria um set em lowercase pra comparação segura
const ALLOWED_SET = new Set(ALLOWED_EMAILS.map(e => e.toLowerCase()));

/* --- Elements --- */
const loginScreen = document.getElementById('loginScreen');
const googleSignInBtn = document.getElementById('googleSignIn');
const loginMsg = document.getElementById('loginMsg');

const appEl = document.getElementById('app');
const userEmailEl = document.getElementById('userEmail');
const signOutBtn = document.getElementById('signOutBtn');

const pedidoForm = document.getElementById('pedidoForm');
const nomeEl = document.getElementById('nome');
const numeroEl = document.getElementById('numero');
const tipoEntregaEl = document.getElementById('tipoEntrega');
const enderecoLabel = document.getElementById('enderecoLabel');
const enderecoEl = document.getElementById('endereco');
const itensEl = document.getElementById('itens');
const horarioEl = document.getElementById('horario');
const valorEl = document.getElementById('valor');
const clearFormBtn = document.getElementById('clearForm');

const pedidosList = document.getElementById('pedidosList');
const emptyMsg = document.getElementById('emptyMsg');
const countInfo = document.getElementById('countInfo');

const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const monthYearEl = document.getElementById('monthYear');
const calendarEl = document.getElementById('calendar');
const clearFilterBtn = document.getElementById('clearFilter');

// Mobile navigation elements
const menuToggleBtn = document.getElementById('menuToggle');
const overlay = document.getElementById('overlay');
const formArea = document.getElementById('formArea');

let selectedDateFilter = null; // JS Date (midnight) or null
let orderDirection = 'asc';

/* calendar state */
let calendarDate = new Date();
calendarDate.setDate(1);

/* Firestore reference */
const pedidosCol = collection(db, 'pedidos');

/* --- Mobile Navigation --- */
function closeNav() {
  document.body.classList.remove('nav-open');
}

function openNav() {
  document.body.classList.add('nav-open');
}

menuToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (document.body.classList.contains('nav-open')) {
    closeNav();
  } else {
    openNav();
  }
});

overlay.addEventListener('click', closeNav);
formArea.addEventListener('click', (e) => e.stopPropagation()); // Impede que cliques dentro do menu o fechem


/* --- Auth: sign in with popup + fallback to redirect --- */
async function trySignIn() {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.warn('signInWithPopup falhou, tentando signInWithRedirect:', err.message || err);
    try {
      await signInWithRedirect(auth, provider);
    } catch (err2) {
      loginMsg.textContent = 'Erro no login: ' + (err2.message || err2);
    }
  }
}

googleSignInBtn.addEventListener('click', trySignIn);

signOutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, user => {
  if (user) {
    const email = (user.email || '').toLowerCase();
    if (!ALLOWED_SET.has(email)) {
      signOut(auth).then(() => {
        loginMsg.textContent = 'Conta não autorizada. Peça permissão ao administrador.';
        loginScreen.style.display = 'flex';
        appEl.classList.add('hidden');
      });
      return;
    }

    userEmailEl.textContent = user.email || '';
    loginScreen.style.display = 'none';
    appEl.classList.remove('hidden');
    initRealtimeListener();
  } else {
    loginScreen.style.display = 'flex';
    appEl.classList.add('hidden');
  }
});

/* --- Form behaviors --- */
tipoEntregaEl.addEventListener('change', () => {
  if (tipoEntregaEl.value === 'entrega') {
    enderecoLabel.style.display = 'block';
    enderecoEl.required = true;
  } else {
    enderecoEl.required = false;
    enderecoLabel.style.display = 'none';
  }
});
tipoEntregaEl.dispatchEvent(new Event('change'));

clearFormBtn.addEventListener('click', clearForm);

pedidoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = nomeEl.value.trim();
  const numero = numeroEl.value.trim();
  const tipo = tipoEntregaEl.value;
  const endereco = enderecoEl.value.trim();
  const itens = itensEl.value.trim();
  const horarioStr = horarioEl.value;
  const valor = parseFloat(valorEl.value);

  if (!nome || !itens || !horarioStr || isNaN(valor)) {
    alert('Preencha os campos obrigatórios.');
    return;
  }

  const horarioDate = new Date(horarioStr);
  const horarioTS = Timestamp.fromDate(horarioDate);

  try {
    const saveButton = pedidoForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando...';

    await addDoc(pedidosCol, {
      nome,
      numero: numero || null,
      tipo,
      endereco: tipo === 'entrega' ? endereco : null,
      itens,
      horario: horarioTS,
      valor,
      criadoEm: Timestamp.now()
    });
    clearForm();
    closeNav(); // Fecha o menu mobile ao salvar
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  } finally {
    const saveButton = pedidoForm.querySelector('button[type="submit"]');
    saveButton.disabled = false;
    saveButton.textContent = 'Salvar pedido';
  }
});

function clearForm(){
  pedidoForm.reset();
  tipoEntregaEl.dispatchEvent(new Event('change'));
}

/* --- Real-time listener com filtros/ordenação --- */
let unsubscribe = null;

function initRealtimeListener(){
  if (unsubscribe) unsubscribe();

  const buildQuery = () => {
    let q = null;
    if (selectedDateFilter) {
      const start = new Date(selectedDateFilter);
      start.setHours(0,0,0,0);
      const end = new Date(start);
      end.setDate(end.getDate()+1);
      const startTS = Timestamp.fromDate(start);
      const endTS = Timestamp.fromDate(end);
      q = query(pedidosCol, where('horario', '>=', startTS), where('horario', '<', endTS), orderBy('horario', orderDirection));
    } else {
      q = query(pedidosCol, orderBy('horario', orderDirection));
    }
    return q;
  };

  const q = buildQuery();
  unsubscribe = onSnapshot(q, snapshot => {
    renderPedidos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => {
    console.error('Listener erro:', err);
  });

  window.__refreshPedidos = () => {
    if (unsubscribe) unsubscribe();
    const q2 = buildQuery();
    unsubscribe = onSnapshot(q2, snapshot => {
      renderPedidos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => { console.error('Listener erro:', err); });
  };
}

/* --- Render pedidos --- */
function renderPedidos(items){
  pedidosList.innerHTML = '';
  if (!items.length) {
    emptyMsg.style.display = 'block';
    countInfo.textContent = '0 pedidos';
    return;
  }
  emptyMsg.style.display = 'none';
  countInfo.textContent = `${items.length} pedido(s)`;

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'pedido-item';

    const main = document.createElement('div');
    main.className = 'pedido-main';
    const h4 = document.createElement('h4');
    h4.textContent = item.nome + (item.numero ? ` • ${item.numero}` : '');
    main.appendChild(h4);

    const meta = document.createElement('div');
    meta.className = 'pedido-meta';
    const horarioDate = item.horario && item.horario.toDate ? item.horario.toDate() : (item.horario instanceof Date ? item.horario : null);
    const horarioStr = horarioDate ? horarioDate.toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) : '-';
    meta.innerHTML = `<div><strong>Tipo:</strong> ${item.tipo}</div>
                      <div><strong>Horário:</strong> ${horarioStr}</div>
                      <div><strong>Valor:</strong> R$ ${Number(item.valor).toFixed(2)}</div>
                      <div><strong>Itens:</strong> ${item.itens}</div>
                      ${item.endereco ? `<div><strong>Endereço:</strong> ${item.endereco}</div>` : ''}`;
    main.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'pedido-actions';
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn ghost';
    btnDelete.textContent = 'Deletar';
    btnDelete.addEventListener('click', async () => {
      if (confirm('Deletar este pedido?')) {
        try {
          await deleteDoc(doc(db, 'pedidos', item.id));
        } catch (err) { alert('Erro: ' + err.message); }
      }
    });

    actions.appendChild(btnDelete);
    li.appendChild(main);
    li.appendChild(actions);
    pedidosList.appendChild(li);
  });
}

/* --- Calendar render e interação --- */
function renderCalendar(){
  calendarEl.innerHTML = '';
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  monthYearEl.textContent = calendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();

  for (let i=0;i<startWeekday;i++){
    const cell = document.createElement('div');
    cell.className = 'day muted';
    cell.innerHTML = '';
    calendarEl.appendChild(cell);
  }

  for (let d = 1; d <= daysInMonth; d++){
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.textContent = d;
    const thisDate = new Date(year, month, d);
    const today = new Date();
    if (thisDate.toDateString() === today.toDateString()) cell.classList.add('today');

    if (selectedDateFilter) {
      if (selectedDateFilter.toDateString() === thisDate.toDateString()) cell.classList.add('selected');
    }

    cell.addEventListener('click', () => {
      selectedDateFilter = new Date(year, month, d);
      if (window.__refreshPedidos) window.__refreshPedidos();
      renderCalendar();
      closeNav(); // Fecha o menu ao selecionar data
    });

    calendarEl.appendChild(cell);
  }
}

prevMonthBtn.addEventListener('click', () => {
  calendarDate.setMonth(calendarDate.getMonth()-1);
  renderCalendar();
});
nextMonthBtn.addEventListener('click', () => {
  calendarDate.setMonth(calendarDate.getMonth()+1);
  renderCalendar();
});

clearFilterBtn.addEventListener('click', () => {
  selectedDateFilter = null;
  if (window.__refreshPedidos) window.__refreshPedidos();
  renderCalendar();
  closeNav(); // Fecha o menu ao limpar filtro
});

/* --- Order controls --- */
document.querySelectorAll('input[name="order"]').forEach(r => {
  r.addEventListener('change', (e) => {
    orderDirection = e.target.value;
    if (window.__refreshPedidos) window.__refreshPedidos();
  });
});

/* init calendar on load */
renderCalendar();

loginScreen.style.display = 'flex';

console.log('%cR2D2: gerenciador carregado — boa sorte!', 'color: #e53935; font-weight:700');