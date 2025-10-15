// script.js — versão com correções de bugs
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
const filterControls = document.getElementById('filterControls');
const filterModalBody = filterModal.querySelector('.modal-body');

// --- Elementos de Pedidos Concluídos ---
const completedBtn = document.getElementById('completedBtn');
const completedModal = document.getElementById('completedModal');
const completedCloseBtn = document.getElementById('completedCloseBtn');
const completedList = document.getElementById('completedList');

// --- Elementos do Menu Mobile ---
const hamburgerMenu = document.getElementById('hamburgerMenu');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileAddPedidoBtn = document.getElementById('mobileAddPedidoBtn');
const mobileFilterBtn = document.getElementById('mobileFilterBtn');
const mobileCompletedBtn = document.getElementById('mobileCompletedBtn');

// --- Elementos de Login ---
const pinInput = document.getElementById('pinInput');
const numpad = document.getElementById('numpad');

// --- Variáveis de Estado ---
let selectedDateFilter = null;
let orderDirection = 'asc';
let unsubscribe = null;
let calendarDate = new Date();
calendarDate.setDate(1);
let currentPedido = null;
window.pedidosData = [];

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
    pedidoIdEl.value = '';
    deleteBtn.classList.add('hidden');
    printBtn.classList.add('hidden');
  }
  tipoEntregaEl.dispatchEvent(new Event('change'));
  document.body.classList.add('details-view');
}
addPedidoBtn.addEventListener('click', () => showDetailsPage(null));
backBtn.addEventListener('click', showListPage);

pedidosList.addEventListener('click', (e) => {
  const target = e.target;
  const card = target.closest('.pedido-card');
  if (!card) return;

  const pedidoId = card.dataset.id;
  const pedido = window.pedidosData.find(p => p.id === pedidoId);
  if (!pedido) return;

  if (target.matches('.complete-btn')) {
    if (confirm(`Marcar o pedido de "${pedido.nome}" como concluído?`)) {
      marcarComoConcluido(pedidoId);
    }
  } else if (target.closest('.pedido-card-header, .pedido-card-body')) {
    showDetailsPage(pedido);
  }
});

async function marcarComoConcluido(id) {
    try {
        await updateDoc(doc(db, 'pedidos', id), { status: 'completed' });
    } catch (err) {
        alert('Erro ao concluir pedido: ' + err.message);
    }
}

/* --- Lógica dos Modais (Filtro e Concluídos) --- */
function openModal(modalEl) { modalEl.classList.remove('hidden'); modalEl.setAttribute('aria-hidden', 'false'); }
function closeModal(modalEl) { modalEl.classList.add('hidden'); modalEl.setAttribute('aria-hidden', 'true'); }

// Filtro
filterBtn.addEventListener('click', () => {
  filterModalBody.appendChild(filterControls);
  filterControls.classList.remove('hidden');
  openModal(filterModal);
});
filterCloseBtn.addEventListener('click', () => closeModal(filterModal));
filterModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(filterModal));

// Concluídos
completedBtn.addEventListener('click', () => { renderCompletedPedidos(); openModal(completedModal); });
completedCloseBtn.addEventListener('click', () => closeModal(completedModal));
completedModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(completedModal));

/* --- Lógica do Menu Mobile --- */
hamburgerBtn.addEventListener('click', () => hamburgerMenu.classList.toggle('is-open'));
function closeMobileMenu() { hamburgerMenu.classList.remove('is-open'); }
mobileAddPedidoBtn.addEventListener('click', () => { closeMobileMenu(); showDetailsPage(null); });
mobileFilterBtn.addEventListener('click', () => { closeMobileMenu(); filterBtn.click(); });
mobileCompletedBtn.addEventListener('click', () => { closeMobileMenu(); completedBtn.click(); });

/* --- Autenticação com Teclado Numérico --- */
if (!sessionStorage.getItem('loggedIn') && !localStorage.getItem('loggedIn')) {
  showLogin();
} else {
  showApp();
}

numpad.addEventListener('click', (e) => {
    const key = e.target.closest('.numpad-key');
    if (!key) return;
    const action = key.dataset.action;
    const currentVal = pinInput.value;
    if (action === 'backspace') {
        pinInput.value = currentVal.slice(0, -1);
    } else if (action === 'clear') {
        pinInput.value = '';
    } else if (currentVal.length < pinInput.maxLength) {
        pinInput.value += key.textContent;
    }
});

document.getElementById('pinSubmit').addEventListener('click', () => {
  if (pinInput.value.trim() === APP_PIN) {
    const remember = document.getElementById('rememberCheck').checked;
    (remember ? localStorage : sessionStorage).setItem('loggedIn', '1');
    showApp();
  } else {
    document.getElementById('loginMsg').textContent = 'PIN incorreto.';
    pinInput.value = '';
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
    if (id) {
      await updateDoc(doc(db, 'pedidos', id), data);
    } else {
      data.criadoEm = Timestamp.now();
      data.status = 'active';
      await addDoc(pedidosCol, data);
    }
    showListPage();
  } catch (err) { alert('Erro: ' + err.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; }
});


/* --- Ações (Imprimir, Deletar) --- */
printBtn.addEventListener('click', () => currentPedido && printTicket(currentPedido));
deleteBtn.addEventListener('click', async () => {
  if (!currentPedido || !confirm('Deletar este pedido? A ação não pode ser desfeita.')) return;
  try { await deleteDoc(doc(db, 'pedidos', currentPedido.id)); showListPage(); }
  catch (err) { alert('Erro ao deletar: ' + err.message); }
});

/* --- Listener do Firebase e Renderização --- */
function initRealtimeListener() {
  if (unsubscribe) unsubscribe();
  let constraints = [where('status', '==', 'active'), orderBy('horario', orderDirection)];
  if (selectedDateFilter) {
    const start = new Date(selectedDateFilter); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    constraints = [
      where('status', '==', 'active'),
      where('horario', '>=', Timestamp.fromDate(start)),
      where('horario', '<', Timestamp.fromDate(end)),
      orderBy('horario', orderDirection)
    ];
  }
  const q = query(pedidosCol, ...constraints);
  unsubscribe = onSnapshot(q, snapshot => {
    window.pedidosData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPedidos(window.pedidosData);
  }, (error) => {
      console.error("Erro no listener de pedidos ativos:", error);
      alert("Não foi possível carregar os pedidos ativos. Verifique o console para mais detalhes.");
  });
}


function renderPedidos(items) {
  pedidosList.innerHTML = '';
  emptyMsg.style.display = items.length ? 'none' : 'block';
  countInfo.textContent = `${items.length} pedido(s)`;
  items.forEach(item => {
    const horarioDate = item.horario?.toDate();
    const dataStr = horarioDate?.toLocaleDateString('pt-BR') || '-';
    const horarioStr = horarioDate?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '-';

    pedidosList.insertAdjacentHTML('beforeend', `
      <div class="pedido-card" data-id="${item.id}">
        <div class="pedido-card-header">${escapeHtml(item.nome)}</div>
        <div class="pedido-card-body">
          ${item.numero ? `<div><strong>Nº Cliente:</strong> ${escapeHtml(item.numero)}</div>` : ''}
          <div><strong>Data:</strong> ${dataStr}</div>
          <div><strong>Horário:</strong> ${horarioStr}</div>
          <div><strong>Valor:</strong> R$ ${Number(item.valor || 0).toFixed(2)}</div>
        </div>
        <div class="pedido-card-footer">
            <button class="btn success complete-btn">✔ Concluir Pedido</button>
        </div>
      </div>`);
  });
}

async function renderCompletedPedidos() {
    completedList.innerHTML = '<p>Carregando...</p>';
    try {
        const q = query(pedidosCol, where('status', '==', 'completed'), orderBy('horario', 'desc'));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (items.length === 0) {
            completedList.innerHTML = '<p class="muted" style="text-align:center;">Nenhum pedido concluído encontrado.</p>';
            return;
        }

        const groupedByDate = items.reduce((acc, item) => {
            const dateStr = item.horario.toDate().toLocaleDateString('pt-BR');
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(item);
            return acc;
        }, {});

        for (const date in groupedByDate) {
            groupedByDate[date].sort((a, b) => a.horario.toMillis() - b.horario.toMillis());
        }

        let html = '';
        for (const dateStr of Object.keys(groupedByDate)) {
            html += `<div class="date-group">`;
            html += `<h4 class="date-header">${dateStr}</h4>`;
            groupedByDate[dateStr].forEach(item => {
                const horarioStr = item.horario.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                html += `
                    <div class="completed-item">
                        <span><strong>${horarioStr}</strong> - ${escapeHtml(item.nome)}</span>
                        <span>R$ ${Number(item.valor || 0).toFixed(2)}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
        completedList.innerHTML = html;
    } catch (error) {
        console.error("Erro ao buscar pedidos concluídos:", error);
        completedList.innerHTML = `<p class="muted" style="text-align:center; color: #c82121;"><b>Erro ao carregar pedidos.</b><br>Verifique se o índice do Firestore foi criado corretamente e tente novamente.</p>`;
    }
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
      closeModal(filterModal);
    });
    calendarEl.appendChild(cell);
  }
}
document.getElementById('prevMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
document.getElementById('clearFilter').addEventListener('click', () => {
    selectedDateFilter = null; initRealtimeListener(); renderCalendar();
    closeModal(filterModal);
});
document.querySelectorAll('input[name="order"]').forEach(r => r.addEventListener('change', (e) => { orderDirection = e.target.value; initRealtimeListener(); }));
document.getElementById('deleteDayBtn').addEventListener('click', async () => {
  const day = selectedDateFilter || new Date();
  if (!confirm(`Deletar TODOS os pedidos (ativos e concluídos) do dia ${day.toLocaleDateString('pt-BR')}?`)) return;
  const start = new Date(day); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate()+1);
  const q = query(pedidosCol, where('horario', '>=', Timestamp.fromDate(start)), where('horario', '<', Timestamp.fromDate(end)));
  const snaps = await getDocs(q);
  if (snaps.empty) return alert('Nenhum pedido encontrado para este dia.');
  await Promise.all(snaps.docs.map(s => deleteDoc(s.ref)));
  alert(`${snaps.size} pedido(s) do dia foram removidos.`);
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