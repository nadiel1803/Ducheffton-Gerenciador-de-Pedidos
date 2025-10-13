// script.js — versão atualizada com UI mobile aprimorada
import { db } from './firebase.js';
import {
  collection, addDoc, onSnapshot, query, orderBy, where, doc, deleteDoc, Timestamp, updateDoc, getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ============================
   AQUI: defina o PIN desejado
   ============================ */
const APP_PIN = '1803'; // <-- altere aqui

// --- Elementos (Login) ---
const loginScreen = document.getElementById('loginScreen');
const pinInput = document.getElementById('pinInput');
const pinSubmit = document.getElementById('pinSubmit');
const pinHelp = document.getElementById('pinHelp');
const rememberCheck = document.getElementById('rememberCheck');
const loginMsg = document.getElementById('loginMsg');
const signOutBtn = document.getElementById('signOutBtn');

// --- Elementos (App e Páginas) ---
const appEl = document.getElementById('app');
const listPage = document.getElementById('listPage');
const detailsPage = document.getElementById('detailsPage');
const detailsTitle = document.getElementById('detailsTitle');

// --- Elementos (Lista) ---
const addPedidoBtn = document.getElementById('addPedidoBtn');
const pedidosList = document.getElementById('pedidosList');
const emptyMsg = document.getElementById('emptyMsg');
const countInfo = document.getElementById('countInfo');

// --- Elementos (Formulário de Detalhes) ---
const pedidoForm = document.getElementById('pedidoForm');
const pedidoIdEl = document.getElementById('pedidoId');
const nomeEl = document.getElementById('nome');
const numeroEl = document.getElementById('numero');
const tipoEntregaEl = document.getElementById('tipoEntrega');
const enderecoLabel = document.getElementById('enderecoLabel');
const enderecoEl = document.getElementById('endereco');
const itensEl = document.getElementById('itens');
const horarioEl = document.getElementById('horario');
const valorEl = document.getElementById('valor');
const pagoEl = document.getElementById('pago');
const backBtn = document.getElementById('backBtn');
const saveBtn = document.getElementById('saveBtn'); // Já está no form
const printBtn = document.getElementById('printBtn');
const deleteBtn = document.getElementById('deleteBtn');

// --- Elementos (Filtro) ---
const filterBtn = document.getElementById('filterBtn');
const filterModal = document.getElementById('filterModal');
const filterCloseBtn = document.getElementById('filterCloseBtn');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const monthYearEl = document.getElementById('monthYear');
const calendarEl = document.getElementById('calendar');
const clearFilterBtn = document.getElementById('clearFilter');
const deleteDayBtn = document.getElementById('deleteDayBtn');

// --- Variáveis de Estado Global ---
let selectedDateFilter = null;
let orderDirection = 'asc';
let unsubscribe = null;
let calendarDate = new Date();
calendarDate.setDate(1);
let currentPedido = null; // Armazena o pedido sendo visualizado/editado

const pedidosCol = collection(db, 'pedidos');

/* --- Lógica de Navegação --- */
function showListPage() {
  document.body.classList.remove('details-view');
  currentPedido = null;
  pedidoForm.reset();
  tipoEntregaEl.dispatchEvent(new Event('change'));
}

function showDetailsPage(pedido = null) {
  currentPedido = pedido;
  if (pedido) {
    // Modo Edição
    detailsTitle.textContent = 'Editar Pedido';
    pedidoIdEl.value = pedido.id;
    nomeEl.value = pedido.nome || '';
    numeroEl.value = pedido.numero || '';
    tipoEntregaEl.value = pedido.tipo || 'entrega';
    enderecoEl.value = pedido.endereco || '';
    itensEl.value = pedido.itens || '';
    const horarioDate = pedido.horario?.toDate ? pedido.horario.toDate() : null;
    if (horarioDate) {
      const pad = n => String(n).padStart(2, '0');
      editHorario.value = `${horarioDate.getFullYear()}-${pad(horarioDate.getMonth()+1)}-${pad(horarioDate.getDate())}T${pad(horarioDate.getHours())}:${pad(horarioDate.getMinutes())}`;
    } else {
      horarioEl.value = '';
    }
    valorEl.value = (pedido.valor != null) ? Number(pedido.valor).toFixed(2) : '';
    pagoEl.checked = !!pedido.pago;
    deleteBtn.style.display = 'flex';
    printBtn.style.display = 'flex';

  } else {
    // Modo Adição
    detailsTitle.textContent = 'Novo Pedido';
    pedidoForm.reset();
    pedidoIdEl.value = '';
    deleteBtn.style.display = 'none';
    printBtn.style.display = 'none';
  }
  tipoEntregaEl.dispatchEvent(new Event('change'));
  document.body.classList.add('details-view');
}

addPedidoBtn.addEventListener('click', () => showDetailsPage(null));
backBtn.addEventListener('click', showListPage);


/* --- Autenticação Simples por PIN --- */
function isLoggedIn() { return sessionStorage.getItem('loggedIn') === '1' || localStorage.getItem('loggedIn') === '1'; }
function setLoggedIn(remember = false) { (remember ? localStorage : sessionStorage).setItem('loggedIn', '1'); }
function clearLogin() { localStorage.removeItem('loggedIn'); sessionStorage.removeItem('loggedIn'); }

if (isLoggedIn()) { showApp(); } else { showLogin(); }

pinSubmit.addEventListener('click', () => {
  if (pinInput.value.trim() === APP_PIN) {
    setLoggedIn(rememberCheck.checked);
    showApp();
  } else {
    loginMsg.textContent = 'PIN incorreto.';
  }
});
pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') pinSubmit.click(); });
pinHelp.addEventListener('click', () => alert('O PIN está definido no arquivo script.js (constante APP_PIN).'));
signOutBtn.addEventListener('click', () => { clearLogin(); showLogin(); });

function showLogin() { loginScreen.style.display = 'flex'; appEl.classList.add('hidden'); }
function showApp() { loginScreen.style.display = 'none'; appEl.classList.remove('hidden'); initRealtimeListener(); }


/* --- Lógica do Formulário Principal --- */
tipoEntregaEl.addEventListener('change', () => {
  const isEntrega = tipoEntregaEl.value === 'entrega';
  enderecoLabel.style.display = isEntrega ? 'block' : 'none';
  enderecoEl.required = isEntrega;
});

pedidoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = pedidoIdEl.value;
  const data = {
    nome: nomeEl.value.trim(),
    numero: numeroEl.value.trim() || null,
    tipo: tipoEntregaEl.value,
    endereco: tipoEntregaEl.value === 'entrega' ? enderecoEl.value.trim() : null,
    itens: itensEl.value.trim(),
    horario: Timestamp.fromDate(new Date(horarioEl.value)),
    valor: parseFloat(valorEl.value),
    pago: !!pagoEl.checked,
  };

  if (!data.nome || !data.itens || !horarioEl.value || isNaN(data.valor)) {
    return alert('Preencha os campos obrigatórios.');
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';

  try {
    if (id) {
      // Atualizar
      await updateDoc(doc(db, 'pedidos', id), data);
    } else {
      // Adicionar
      data.criadoEm = Timestamp.now();
      await addDoc(pedidosCol, data);
    }
    showListPage();
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar';
  }
});


/* --- Ações da Página de Detalhes (Imprimir, Deletar) --- */
printBtn.addEventListener('click', () => {
  if (currentPedido) printTicket(currentPedido);
});

deleteBtn.addEventListener('click', async () => {
  if (!currentPedido || !confirm('Deletar este pedido permanentemente?')) return;
  try {
    await deleteDoc(doc(db, 'pedidos', currentPedido.id));
    showListPage();
  } catch (err) {
    alert('Erro ao deletar: ' + err.message);
  }
});


/* --- Listener do Firebase e Renderização da Lista --- */
function initRealtimeListener() {
  if (unsubscribe) unsubscribe();

  let q = query(pedidosCol, orderBy('horario', orderDirection));
  if (selectedDateFilter) {
    const start = new Date(selectedDateFilter);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    q = query(pedidosCol, where('horario', '>=', Timestamp.fromDate(start)), where('horario', '<', Timestamp.fromDate(end)), orderBy('horario', orderDirection));
  }

  unsubscribe = onSnapshot(q, snapshot => {
    renderPedidos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => console.error('Listener erro:', err));
}

function renderPedidos(items) {
  pedidosList.innerHTML = '';
  emptyMsg.style.display = items.length ? 'none' : 'block';
  countInfo.textContent = `${items.length} pedido(s)`;

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'pedido-item';
    li.addEventListener('click', () => showDetailsPage(item));

    const horarioDate = item.horario?.toDate();
    const horarioStr = horarioDate ? horarioDate.toLocaleString('pt-BR', { timeStyle: 'short' }) : '-';

    li.innerHTML = `
      <div class="pedido-main">
        <h4>${escapeHtml(item.nome)}</h4>
        <div class="compact-sub">
          ${horarioStr} • R$ ${Number(item.valor || 0).toFixed(2)}
        </div>
      </div>
    `;
    pedidosList.appendChild(li);
  });
}


/* --- Lógica do Modal de Filtro e Calendário --- */
function openFilterModal() { filterModal.classList.remove('hidden'); }
function closeFilterModal() { filterModal.classList.add('hidden'); }
filterBtn.addEventListener('click', openFilterModal);
filterCloseBtn.addEventListener('click', closeFilterModal);
filterModal.querySelector('.modal-backdrop').addEventListener('click', closeFilterModal);

function renderCalendar() {
  calendarEl.innerHTML = '';
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  monthYearEl.textContent = calendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < startWeekday; i++) {
    calendarEl.insertAdjacentHTML('beforeend', '<div class="day muted"></div>');
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    const thisDate = new Date(year, month, d);
    cell.className = 'day';
    cell.textContent = d;
    if (thisDate.toDateString() === new Date().toDateString()) cell.classList.add('today');
    if (selectedDateFilter && thisDate.toDateString() === selectedDateFilter.toDateString()) cell.classList.add('selected');
    
    cell.addEventListener('click', () => {
      selectedDateFilter = thisDate;
      initRealtimeListener();
      renderCalendar();
      closeFilterModal();
    });
    calendarEl.appendChild(cell);
  }
}
prevMonthBtn.addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
nextMonthBtn.addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
clearFilterBtn.addEventListener('click', () => { selectedDateFilter = null; initRealtimeListener(); renderCalendar(); closeFilterModal(); });

document.querySelectorAll('input[name="order"]').forEach(r => {
  r.addEventListener('change', (e) => { orderDirection = e.target.value; initRealtimeListener(); });
});


/* --- Ação de Deletar Pedidos do Dia --- */
deleteDayBtn.addEventListener('click', async () => {
  const day = selectedDateFilter || new Date();
  if (!confirm(`Deletar TODOS os pedidos do dia ${day.toLocaleDateString('pt-BR')}? Ação irreversível.`)) return;

  try {
    const start = new Date(day);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(end.getDate()+1);

    const q = query(pedidosCol, where('horario', '>=', Timestamp.fromDate(start)), where('horario', '<', Timestamp.fromDate(end)));
    const snaps = await getDocs(q);
    const batchPromises = snaps.docs.map(s => deleteDoc(s.ref));
    await Promise.all(batchPromises);
    alert('Pedidos do dia removidos.');
  } catch (err) {
    alert('Erro ao deletar: ' + err.message);
  }
});

/* --- Utilitários e Inicialização --- */
function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function printTicket(item) {
  const horarioDate = item.horario?.toDate();
  const horarioStr = horarioDate ? horarioDate.toLocaleString('pt-BR') : '-';
  const itens = escapeHtml(item.itens).replace(/\n/g, '<br>');
  const valorStr = `R$ ${Number(item.valor || 0).toFixed(2)}`;

  const win = window.open('', '_blank');
  win.document.write(`
  <!doctype html><html><head><meta charset="utf-8"/><title>Pedido</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body { margin:0; font-family: "Arial", sans-serif; font-size: 13px; font-weight: bold; color:#000; background:white; }
    .ticket { width: 100%; max-width: 80mm; margin: 0 auto; padding: 10px; box-sizing: border-box; }
    header { text-align:center; margin-bottom:12px; }
    .brand-title { font-size:1.3em; }
    .meta { font-size:1em; margin-bottom:12px; }
    .items { font-size:1.05em; margin-bottom:14px; }
    .items .desc { margin-bottom:4px; word-break:break-word; }
    .total { font-size:1.2em; border-top:1px dashed #000; padding-top:8px; margin-top:8px; display:flex; justify-content:space-between; }
    .quote { margin-top:16px; font-style:italic; font-size:0.85em; text-align:center; font-weight: normal; }
  </style>
  </head><body>
    <div class="ticket">
      <header><div class="brand-title">PEDIDO - DuCheffton</div></header>
      <div class="meta">
        <div><strong>Nome:</strong> ${escapeHtml(item.nome)}</div>
        <div><strong>Cliente:</strong> ${item.numero ? escapeHtml(item.numero) : '-'}</div>
        <div><strong>Tipo:</strong> ${escapeHtml(item.tipo || '-')}</div>
        ${item.endereco ? `<div><strong>Endereço:</strong> ${escapeHtml(item.endereco)}</div>` : ''}
        <div><strong>Horário:</strong> ${escapeHtml(horarioStr)}</div>
      </div>
      <div class="items">
        <div><strong>Itens:</strong></div>
        <div class="desc">${itens}</div>
      </div>
      <div class="total"><div>Total:</div><div>${escapeHtml(valorStr)}</div></div>
      <div class="quote">"Se Deus é por nós, quem será contra nós?" Rm. 8:31</div>
    </div>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
  </body></html>`);
  win.document.close();
}

// Inicializa o calendário ao carregar a página
renderCalendar();
console.log('%cR2D2: gerenciador carregado — boa sorte!', 'color: #1e88e5; font-weight:700');