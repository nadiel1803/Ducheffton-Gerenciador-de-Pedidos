// script.js — versão com PIN simples (substitui Auth)
import { db } from './firebase.js';
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

/* ============================
   AQUI: defina o PIN desejado
   ============================
   Troque '1234' pelo PIN que você quiser.
   OBS: esse PIN fica no código (visível no navegador).
*/
const APP_PIN = '1803'; // <-- altere aqui

/* --- elementos (login) --- */
const loginScreen = document.getElementById('loginScreen');
const pinInput = document.getElementById('pinInput');
const pinSubmit = document.getElementById('pinSubmit');
const pinHelp = document.getElementById('pinHelp');
const rememberCheck = document.getElementById('rememberCheck');
const loginMsg = document.getElementById('loginMsg');

const appEl = document.getElementById('app');
const userLabel = document.getElementById('userLabel');
const signOutBtn = document.getElementById('signOutBtn');

/* --- Elements (form) --- */
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
function closeNav() { document.body.classList.remove('nav-open'); }
function openNav() { document.body.classList.add('nav-open'); }

menuToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (document.body.classList.contains('nav-open')) closeNav(); else openNav();
});
overlay.addEventListener('click', closeNav);
formArea.addEventListener('click', (e) => e.stopPropagation());

/* --- Simple PIN auth --- */
function isLoggedIn() {
  // if remember checked, we store in localStorage; else sessionStorage
  return sessionStorage.getItem('loggedIn') === '1' || localStorage.getItem('loggedIn') === '1';
}

function setLoggedIn(remember = false) {
  if (remember) localStorage.setItem('loggedIn', '1');
  else sessionStorage.setItem('loggedIn', '1');
}

function clearLogin() {
  localStorage.removeItem('loggedIn');
  sessionStorage.removeItem('loggedIn');
}

/* try auto-login on load */
if (isLoggedIn()) {
  showApp();
} else {
  showLogin();
}

pinSubmit.addEventListener('click', () => {
  const pin = (pinInput.value || '').trim();
  if (!pin) {
    loginMsg.textContent = 'Digite o PIN.';
    return;
  }
  if (pin === APP_PIN) {
    setLoggedIn(rememberCheck.checked);
    loginMsg.textContent = '';
    pinInput.value = '';
    showApp();
  } else {
    loginMsg.textContent = 'PIN incorreto.';
  }
});

pinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') pinSubmit.click();
});

pinHelp.addEventListener('click', () => {
  alert('O PIN está definido dentro do arquivo script.js, na constante APP_PIN. Mude lá se quiser.');
});

signOutBtn.addEventListener('click', () => {
  clearLogin();
  showLogin();
});

/* --- UI show/hide --- */
function showLogin() {
  loginScreen.style.display = 'flex';
  appEl.classList.add('hidden');
}

function showApp() {
  loginScreen.style.display = 'none';
  appEl.classList.remove('hidden');
  initRealtimeListener();
}

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

/* --- Realtime listener com filtros/ordenação --- */
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

console.log('%cR2D2: gerenciador carregado — boa sorte!', 'color: #e53935; font-weight:700');
