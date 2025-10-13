// script.js — versão com sidebar de filtros para desktop
import { db } from './firebase.js';
import {
  collection, addDoc, onSnapshot, query, orderBy, where, doc, deleteDoc, Timestamp, updateDoc, getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const APP_PIN = '1803';

// --- Elementos ---
const loginScreen = document.getElementById('loginScreen');
const appEl = document.getElementById('app');
const listPage = document.getElementById('listPage');
const detailsPage = document.getElementById('detailsPage');
const detailsTitle = document.getElementById('detailsTitle');
const addPedidoBtn = document.getElementById('addPedidoBtn');
const pedidosList = document.getElementById('pedidosList');
const emptyMsg = document.getElementById('emptyMsg');
const countInfo = document.getElementById('countInfo');
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
const saveBtn = document.getElementById('saveBtn');
const printBtn = document.getElementById('printBtn');
const deleteBtn = document.getElementById('deleteBtn');

// --- Elementos de Filtro ---
const filterBtn = document.getElementById('filterBtn');
const filterModal = document.getElementById('filterModal');
const filterCloseBtn = document.getElementById('filterCloseBtn');
const sidebar = document.getElementById('sidebar');
const filterControls = document.getElementById('filterControls');
const filterModalBody = filterModal.querySelector('.modal-body');

// --- Variáveis de Estado ---
let selectedDateFilter = null;
let orderDirection = 'asc';
let unsubscribe = null;
let calendarDate = new Date();
calendarDate.setDate(1);
let currentPedido = null;

const pedidosCol = collection(db, 'pedidos');

/* --- Lógica de Navegação de Página --- */
function showListPage() { document.body.classList.remove('details-view'); }
function showDetailsPage(pedido = null) {
  currentPedido = pedido;
  if (pedido) {
    detailsTitle.textContent = 'Editar Pedido';
    pedidoIdEl.value = pedido.id;
    nomeEl.value = pedido.nome || '';
    numeroEl.value = pedido.numero || '';
    tipoEntregaEl.value = pedido.tipo || 'entrega';
    enderecoEl.value = pedido.endereco || '';
    itensEl.value = pedido.itens || '';
    const horarioDate = pedido.horario?.toDate();
    if (horarioDate) {
      const pad = n => String(n).padStart(2, '0');
      horarioEl.value = `${horarioDate.getFullYear()}-${pad(horarioDate.getMonth()+1)}-${pad(horarioDate.getDate())}T${pad(horarioDate.getHours())}:${pad(horarioDate.getMinutes())}`;
    } else {
      horarioEl.value = '';
    }
    valorEl.value = (pedido.valor != null) ? Number(pedido.valor).toFixed(2) : '';
    pagoEl.checked = !!pedido.pago;
    deleteBtn.classList.remove('hidden');
    printBtn.classList.remove('hidden');
  } else {
    detailsTitle.textContent = 'Novo Pedido';
    pedidoForm.reset();
    deleteBtn.classList.add('hidden');
    printBtn.classList.add('hidden');
  }
  tipoEntregaEl.dispatchEvent(new Event('change'));
  document.body.classList.add('details-view');
}
addPedidoBtn.addEventListener('click', () => showDetailsPage(null));
backBtn.addEventListener('click', showListPage);
pedidosList.addEventListener('click', (e) => {
  const li = e.target.closest('.pedido-item');
  if (li && li.dataset.id) {
    const pedido = window.pedidosData.find(p => p.id === li.dataset.id);
    if (pedido) showDetailsPage(pedido);
  }
});

/* --- Lógica de UI Responsiva para Filtros --- */
function setupFilterUI() {
  const isDesktop = window.matchMedia('(min-width: 992px)').matches;
  if (isDesktop) {
    // No desktop, move os controles para a sidebar e garante que estejam visíveis
    sidebar.appendChild(filterControls);
    filterControls.classList.remove('hidden');
    filterModal.classList.add('hidden'); // Garante que modal esteja fechado
  } else {
    // No mobile, move os controles para fora do DOM visível, prontos para o modal
    document.body.appendChild(filterControls);
    filterControls.classList.add('hidden');
  }
}
window.addEventListener('resize', setupFilterUI);
window.addEventListener('DOMContentLoaded', setupFilterUI);

/* --- Lógica do Modal de Filtro (Mobile) --- */
function openFilterModal() {
  filterModalBody.appendChild(filterControls);
  filterControls.classList.remove('hidden');
  filterModal.classList.remove('hidden');
}
function closeFilterModal() {
  document.body.appendChild(filterControls);
  filterControls.classList.add('hidden');
  filterModal.classList.add('hidden');
}
filterBtn.addEventListener('click', openFilterModal);
filterCloseBtn.addEventListener('click', closeFilterModal);
filterModal.querySelector('.modal-backdrop').addEventListener('click', closeFilterModal);

/* --- Autenticação --- */
const pinInput = document.getElementById('pinInput');
if (!sessionStorage.getItem('loggedIn') && !localStorage.getItem('loggedIn')) {
  showLogin();
} else {
  showApp();
}
document.getElementById('pinSubmit').addEventListener('click', () => {
  if (pinInput.value.trim() === APP_PIN) {
    const remember = document.getElementById('rememberCheck').checked;
    (remember ? localStorage : sessionStorage).setItem('loggedIn', '1');
    showApp();
  } else {
    document.getElementById('loginMsg').textContent = 'PIN incorreto.';
  }
});
function showLogin() { loginScreen.classList.remove('hidden'); appEl.classList.add('hidden'); }
function showApp() { loginScreen.classList.add('hidden'); appEl.classList.remove('hidden'); initRealtimeListener(); }

/* --- Lógica do Formulário --- */
tipoEntregaEl.addEventListener('change', () => {
  const isEntrega = tipoEntregaEl.value === 'entrega';
  enderecoLabel.style.display = isEntrega ? 'block' : 'none';
  enderecoEl.required = isEntrega;
});
pedidoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = pedidoIdEl.value;
  const data = {
    nome: nomeEl.value.trim(), numero: numeroEl.value.trim() || null, tipo: tipoEntregaEl.value,
    endereco: tipoEntregaEl.value === 'entrega' ? enderecoEl.value.trim() : null,
    itens: itensEl.value.trim(), horario: Timestamp.fromDate(new Date(horarioEl.value)),
    valor: parseFloat(valorEl.value), pago: !!pagoEl.checked,
  };
  if (!data.nome || !data.itens || !horarioEl.value || isNaN(data.valor)) return alert('Preencha os campos obrigatórios.');

  saveBtn.disabled = true; saveBtn.textContent = 'Salvando...';
  try {
    if (id) await updateDoc(doc(db, 'pedidos', id), data);
    else { data.criadoEm = Timestamp.now(); await addDoc(pedidosCol, data); }
    showListPage();
  } catch (err) { alert('Erro: ' + err.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; }
});

/* --- Ações (Imprimir, Deletar) --- */
printBtn.addEventListener('click', () => currentPedido && printTicket(currentPedido));
deleteBtn.addEventListener('click', async () => {
  if (!currentPedido || !confirm('Deletar este pedido?')) return;
  try { await deleteDoc(doc(db, 'pedidos', currentPedido.id)); showListPage(); }
  catch (err) { alert('Erro ao deletar: ' + err.message); }
});

/* --- Listener do Firebase e Renderização --- */
function initRealtimeListener() {
  if (unsubscribe) unsubscribe();
  let q = query(pedidosCol, orderBy('horario', orderDirection));
  if (selectedDateFilter) {
    const start = new Date(selectedDateFilter); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    q = query(pedidosCol, where('horario', '>=', Timestamp.fromDate(start)), where('horario', '<', Timestamp.fromDate(end)), orderBy('horario', orderDirection));
  }
  unsubscribe = onSnapshot(q, snapshot => {
    window.pedidosData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPedidos(window.pedidosData);
  });
}

function renderPedidos(items) {
  pedidosList.innerHTML = '';
  emptyMsg.style.display = items.length ? 'none' : 'block';
  countInfo.textContent = `${items.length} pedido(s)`;
  items.forEach(item => {
    const horarioStr = item.horario?.toDate().toLocaleString('pt-BR', { timeStyle: 'short' }) || '-';
    pedidosList.insertAdjacentHTML('beforeend', `
      <li class="pedido-item" data-id="${item.id}">
        <div class="pedido-main">
          <h4>${escapeHtml(item.nome)}</h4>
          <div class="compact-sub">${horarioStr} • R$ ${Number(item.valor || 0).toFixed(2)}</div>
        </div>
      </li>`);
  });
}

/* --- Calendário e Filtros --- */
function renderCalendar() {
  const calendarEl = document.getElementById('calendar');
  calendarEl.innerHTML = '';
  const year = calendarDate.getFullYear(); const month = calendarDate.getMonth();
  document.getElementById('monthYear').textContent = calendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < startWeekday; i++) calendarEl.insertAdjacentHTML('beforeend', '<div class="day"></div>');
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    const thisDate = new Date(year, month, d);
    cell.className = 'day'; cell.textContent = d;
    if (thisDate.toDateString() === new Date().toDateString()) cell.classList.add('today');
    if (selectedDateFilter && thisDate.toDateString() === selectedDateFilter.toDateString()) cell.classList.add('selected');
    cell.addEventListener('click', () => {
      selectedDateFilter = thisDate; initRealtimeListener(); renderCalendar();
      if (!window.matchMedia('(min-width: 992px)').matches) {
          closeFilterModal();
      }
    });
    calendarEl.appendChild(cell);
  }
}
document.getElementById('prevMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
document.getElementById('clearFilter').addEventListener('click', () => {
    selectedDateFilter = null; initRealtimeListener(); renderCalendar();
    if (!window.matchMedia('(min-width: 992px)').matches) {
        closeFilterModal();
    }
});
document.querySelectorAll('input[name="order"]').forEach(r => r.addEventListener('change', (e) => { orderDirection = e.target.value; initRealtimeListener(); }));
document.getElementById('deleteDayBtn').addEventListener('click', async () => {
  const day = selectedDateFilter || new Date();
  if (!confirm(`Deletar TODOS os pedidos do dia ${day.toLocaleDateString('pt-BR')}?`)) return;
  const start = new Date(day); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate()+1);
  const q = query(pedidosCol, where('horario', '>=', Timestamp.fromDate(start)), where('horario', '<', Timestamp.fromDate(end)));
  const snaps = await getDocs(q);
  await Promise.all(snaps.docs.map(s => deleteDoc(s.ref)));
  alert('Pedidos do dia removidos.');
});

/* --- Utilitários --- */
function escapeHtml(text) { return String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
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


// Inicialização
renderCalendar();
console.log('%cGerenciador de Pedidos: Carregado com sucesso!', 'color: #1e88e5; font-weight:700');