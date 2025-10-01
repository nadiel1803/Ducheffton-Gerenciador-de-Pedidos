// script.js — versão atualizada conforme pedido do usuário
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
  Timestamp,
  updateDoc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ============================
   AQUI: defina o PIN desejado
   ============================
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

const addPedidoBtn = document.getElementById('addPedidoBtn');

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
const pagoEl = document.getElementById('pago');

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
const deleteDayBtn = document.getElementById('deleteDayBtn');

/* --- View modal elements --- */
const viewModal = document.getElementById('viewModal');
const viewBackdrop = viewModal ? viewModal.querySelector('.modal-backdrop') : null;
const viewCloseBtn = document.getElementById('viewCloseBtn');
const viewContent = document.getElementById('viewContent');
const viewEditBtn = document.getElementById('viewEditBtn');
const viewPrintBtn = document.getElementById('viewPrintBtn');
const viewDeleteBtn = document.getElementById('viewDeleteBtn');

/* --- Edit modal elements --- */
const editModal = document.getElementById('editModal');
const editBackdrop = editModal ? editModal.querySelector('.modal-backdrop') : null;
const editCloseBtn = document.getElementById('editCloseBtn');
const editForm = document.getElementById('editForm');
const editIdEl = document.getElementById('editId');
const editNome = document.getElementById('editNome');
const editNumero = document.getElementById('editNumero');
const editTipoEntrega = document.getElementById('editTipoEntrega');
const editEnderecoLabel = document.getElementById('editEnderecoLabel');
const editEndereco = document.getElementById('editEndereco');
const editItens = document.getElementById('editItens');
const editHorario = document.getElementById('editHorario');
const editValor = document.getElementById('editValor');
const editPago = document.getElementById('editPago');
const cancelEditBtn = document.getElementById('cancelEdit');

// --- Variáveis de Estado Global ---
let selectedDateFilter = null; // JS Date (midnight) or null
let orderDirection = 'asc';
let unsubscribe = null; // listener

/* calendar state */
let calendarDate = new Date();
calendarDate.setDate(1);

/* Firestore reference */
const pedidosCol = collection(db, 'pedidos');

/* --- Mobile Navigation behavior --- */
function closeNav() {
  document.body.classList.remove('nav-open');
  formArea.setAttribute('aria-hidden', 'true');
}
function openNav() {
  document.body.classList.add('nav-open');
  formArea.setAttribute('aria-hidden', 'false');
}

/* On mobile the add button opens the drawer; on desktop the form is visible so it just focuses */
addPedidoBtn.addEventListener('click', () => {
  if (window.innerWidth <= 880) {
    openNav();
  } else {
    // scroll / focus on form on desktop
    formArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nomeEl.focus();
  }
});

menuToggleBtn.addEventListener('click', (e) => {
  // kept for backward compat but hidden in CSS for mobile
  e.stopPropagation();
  if (document.body.classList.contains('nav-open')) closeNav(); else openNav();
});
overlay.addEventListener('click', closeNav);
formArea.addEventListener('click', (e) => e.stopPropagation());

/* --- Simple PIN auth --- */
function isLoggedIn() {
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
  const pago = !!pagoEl.checked;

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
      pago,
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
  pagoEl.checked = false;
}

/* --- Realtime listener com filtros/ordenação --- */
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

/* --- Edit modal logic and safety --- */
let editState = {
  open: false,
  originalData: null,
  hasUnsavedChanges: false
};

function openEditModal(item) {
  editIdEl.value = item.id;
  editNome.value = item.nome || '';
  editNumero.value = item.numero || '';
  editTipoEntrega.value = item.tipo || 'entrega';
  if (item.tipo === 'entrega') {
    editEnderecoLabel.style.display = 'block';
    editEndereco.required = true;
    editEndereco.value = item.endereco || '';
  } else {
    editEnderecoLabel.style.display = 'none';
    editEndereco.required = false;
    editEndereco.value = '';
  }
  editItens.value = item.itens || '';
  const horarioDate = item.horario && item.horario.toDate ? item.horario.toDate() : (item.horario instanceof Date ? item.horario : null);
  if (horarioDate) {
    const pad = n => String(n).padStart(2, '0');
    const val = `${horarioDate.getFullYear()}-${pad(horarioDate.getMonth()+1)}-${pad(horarioDate.getDate())}T${pad(horarioDate.getHours())}:${pad(horarioDate.getMinutes())}`;
    editHorario.value = val;
  } else {
    editHorario.value = '';
  }
  editValor.value = (item.valor != null) ? Number(item.valor).toFixed(2) : '';
  editPago.checked = !!item.pago;

  editState.originalData = {
    nome: editNome.value,
    numero: editNumero.value,
    tipo: editTipoEntrega.value,
    endereco: editEndereco.value,
    itens: editItens.value,
    horario: editHorario.value,
    valor: editValor.value,
    pago: editPago.checked
  };
  editState.hasUnsavedChanges = false;
  showEditModal();
}

/* Show / hide edit modal */
function showEditModal() {
  editModal.classList.remove('hidden');
  editModal.setAttribute('aria-hidden', 'false');
  editState.open = true;
  window.addEventListener('beforeunload', handleBeforeUnload);
}
function hideEditModal(force = false) {
  if (!force && editState.hasUnsavedChanges) {
    const ok = confirm('Existem alterações não salvas. Deseja descartar as alterações?');
    if (!ok) return;
  }
  editModal.classList.add('hidden');
  editModal.setAttribute('aria-hidden', 'true');
  editState.open = false;
  editState.originalData = null;
  editState.hasUnsavedChanges = false;
  window.removeEventListener('beforeunload', handleBeforeUnload);
}

/* monitor fields for unsaved changes */
[editNome, editNumero, editTipoEntrega, editEndereco, editItens, editHorario, editValor, editPago].forEach(inp => {
  if (!inp) return;
  inp.addEventListener('input', () => {
    const current = {
      nome: editNome.value,
      numero: editNumero.value,
      tipo: editTipoEntrega.value,
      endereco: editEndereco.value,
      itens: editItens.value,
      horario: editHorario.value,
      valor: editValor.value,
      pago: editPago.checked
    };
    editState.hasUnsavedChanges = JSON.stringify(current) !== JSON.stringify(editState.originalData);
  });
});

if (editTipoEntrega) {
  editTipoEntrega.addEventListener('change', () => {
    if (editTipoEntrega.value === 'entrega') {
      editEnderecoLabel.style.display = 'block';
      editEndereco.required = true;
    } else {
      editEnderecoLabel.style.display = 'none';
      editEndereco.required = false;
      editEndereco.value = '';
    }
  });
}

function handleBeforeUnload(e) {
  if (editState.open && editState.hasUnsavedChanges) {
    const confirmationMessage = 'Existem alterações não salvas no pedido. Tem certeza que deseja sair?';
    e.returnValue = confirmationMessage;
    return confirmationMessage;
  }
}

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = editIdEl.value;
  const nome = editNome.value.trim();
  const numero = editNumero.value.trim();
  const tipo = editTipoEntrega.value;
  const endereco = editEndereco.value.trim();
  const itens = editItens.value.trim();
  const horarioStr = editHorario.value;
  const valor = parseFloat(editValor.value);
  const pago = !!editPago.checked;

  if (!nome || !itens || !horarioStr || isNaN(valor)) {
    alert('Preencha os campos obrigatórios.');
    return;
  }

  const horarioDate = new Date(horarioStr);
  const horarioTS = Timestamp.fromDate(horarioDate);

  try {
    const saveBtn = editForm.querySelector('button[type="submit"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    const docRef = doc(db, 'pedidos', id);
    await updateDoc(docRef, {
      nome,
      numero: numero || null,
      tipo,
      endereco: tipo === 'entrega' ? endereco : null,
      itens,
      horario: horarioTS,
      valor,
      pago
    });

    hideEditModal(true);
  } catch (err) {
    alert('Erro ao atualizar: ' + err.message);
  } finally {
    const saveBtn = editForm.querySelector('button[type="submit"]');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar alterações';
  }
});

/* --- VIEW modal logic --- */
let currentViewedItem = null;
function openViewModal(item) {
  currentViewedItem = item;
  renderViewContent(item);
  viewModal.classList.remove('hidden');
  viewModal.setAttribute('aria-hidden', 'false');
  window.addEventListener('keydown', viewKeyHandler);
}
function closeViewModal() {
  viewModal.classList.add('hidden');
  viewModal.setAttribute('aria-hidden', 'true');
  currentViewedItem = null;
  window.removeEventListener('keydown', viewKeyHandler);
}
viewCloseBtn.addEventListener('click', closeViewModal);
if (viewBackdrop) viewBackdrop.addEventListener('click', (e) => { e.stopPropagation(); });

function viewKeyHandler(e) {
  if (e.key === 'Escape') closeViewModal();
}

viewEditBtn.addEventListener('click', async () => {
  if (!currentViewedItem) return;
  // fetch fresh data then open edit
  try {
    const dref = doc(db, 'pedidos', currentViewedItem.id);
    const snap = await getDoc(dref);
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() };
      openEditModal(data);
      closeViewModal();
    } else {
      alert('Pedido não encontrado.');
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
});

viewPrintBtn.addEventListener('click', () => {
  if (!currentViewedItem) return;
  printTicket(currentViewedItem);
});

viewDeleteBtn.addEventListener('click', async () => {
  if (!currentViewedItem) return;
  if (!confirm('Deletar este pedido?')) return;
  try {
    await deleteDoc(doc(db, 'pedidos', currentViewedItem.id));
    closeViewModal();
  } catch (err) {
    alert('Erro: ' + err.message);
  }
});

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

  const isMobileCompact = window.innerWidth <= 880;

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'pedido-item';

    const main = document.createElement('div');
    main.className = 'pedido-main';
    const h4 = document.createElement('h4');
    h4.textContent = item.nome + (item.numero ? ` • ${item.numero}` : '');
    main.appendChild(h4);

    const horarioDate = item.horario && item.horario.toDate ? item.horario.toDate() : (item.horario instanceof Date ? item.horario : null);
    const horarioStr = horarioDate ? horarioDate.toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) : '-';

    if (isMobileCompact) {
      // compact view: only name + small subline
      const compactSub = document.createElement('div');
      compactSub.className = 'compact-sub';
      compactSub.innerHTML = `${horarioStr} • R$ ${Number(item.valor).toFixed(2)}`;
      main.appendChild(compactSub);

      // clicking the whole item opens the view modal with details + actions
      li.addEventListener('click', async () => {
        // fetch up-to-date doc
        try {
          const dref = doc(db, 'pedidos', item.id);
          const snap = await getDoc(dref);
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() };
            openViewModal(data);
          } else {
            alert('Pedido não encontrado (talvez já tenha sido removido).');
          }
        } catch (err) {
          alert('Erro: ' + err.message);
        }
      });
    } else {
      // desktop: show full meta inline and actions visible
      const meta = document.createElement('div');
      meta.className = 'pedido-meta';
      meta.innerHTML = `<div><strong>Tipo:</strong> ${item.tipo}</div>
                        <div><strong>Horário:</strong> ${horarioStr}</div>
                        <div><strong>Valor:</strong> R$ ${Number(item.valor).toFixed(2)}</div>
                        <div><strong>Itens:</strong> ${escapeHtml(item.itens)}</div>
                        ${item.endereco ? `<div><strong>Endereço:</strong> ${escapeHtml(item.endereco)}</div>` : '' }
                        <div><strong>Pago:</strong> ${item.pago ? 'Sim' : 'Não'}</div>`;
      main.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'pedido-actions';
    const actionsRow = document.createElement('div');
    actionsRow.className = 'actions-row';

    // Edit button
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn ghost';
    btnEdit.textContent = 'Editar';
    btnEdit.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      try {
        const dref = doc(db, 'pedidos', item.id);
        const snap = await getDoc(dref);
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          openEditModal(data);
        } else {
          alert('Pedido não encontrado (pode ter sido removido).');
        }
      } catch (err) {
        alert('Erro ao abrir edição: ' + err.message);
      }
    });

    // Print button
    const btnPrint = document.createElement('button');
    btnPrint.className = 'btn ghost';
    btnPrint.textContent = 'Imprimir';
    btnPrint.addEventListener('click', (ev) => {
      ev.stopPropagation();
      printTicket(item);
    });

    // Delete button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn ghost danger';
    btnDelete.textContent = 'Deletar';
    btnDelete.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (editState.open && editIdEl.value === item.id) {
        const sure = confirm('Você está editando este pedido agora — deletar enquanto edita pode causar perda de dados. Deseja realmente deletar?');
        if (!sure) return;
      } else {
        if (!confirm('Deletar este pedido?')) return;
      }

      try {
        await deleteDoc(doc(db, 'pedidos', item.id));
      } catch (err) { alert('Erro: ' + err.message); }
    });

    actionsRow.appendChild(btnEdit);
    actionsRow.appendChild(btnPrint);
    actionsRow.appendChild(btnDelete);
    actions.appendChild(actionsRow);

    li.appendChild(main);
    if (!isMobileCompact) li.appendChild(actions);
    pedidosList.appendChild(li);
  });
}

/* --- render view content (modal) --- */
function renderViewContent(item) {
  const horarioDate = item.horario && item.horario.toDate ? item.horario.toDate() : null;
  const horarioStr = horarioDate ? horarioDate.toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }) : '-';
  const numero = item.numero ? escapeHtml(item.numero) : '-';
  const endereco = item.endereco ? escapeHtml(item.endereco) : '-';
  const itens = escapeHtml(item.itens).replace(/\n/g,'<br>');
  const valorStr = `R$ ${Number(item.valor || 0).toFixed(2)}`;

  // NOTE: we intentionally show 'Pago' status in the site/modal, but printTicket will NOT include it
  viewContent.innerHTML = `
    <div><strong>Nome:</strong> ${escapeHtml(item.nome)}</div>
    <div class="meta-line"><strong>Cliente:</strong> ${numero}</div>
    <div class="meta-line"><strong>Tipo:</strong> ${escapeHtml(item.tipo || '-')}</div>
    ${item.endereco ? `<div class="meta-line"><strong>Endereço:</strong> ${endereco}</div>` : ''}
    <div class="meta-line"><strong>Horário:</strong> ${escapeHtml(horarioStr)}</div>
    <div style="margin-top:8px;"><strong>Itens:</strong><div style="margin-top:6px;">${itens}</div></div>
    <div class="meta-line" style="margin-top:8px;"><strong>Total:</strong> ${escapeHtml(valorStr)}</div>
    <div class="meta-line"><strong>Pago:</strong> ${item.pago ? 'Sim' : 'Não'}</div>
  `;
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
  closeNav();
});

/* --- Order controls --- */
document.querySelectorAll('input[name="order"]').forEach(r => {
  r.addEventListener('change', (e) => {
    orderDirection = e.target.value;
    if (window.__refreshPedidos) window.__refreshPedidos();
  });
});

/* --- Delete day button: deleta pedidos do dia selecionado (ou do dia atual se não houver seleção) --- */
deleteDayBtn.addEventListener('click', async () => {
  let day = selectedDateFilter ? new Date(selectedDateFilter) : new Date();
  day.setHours(0,0,0,0);
  const end = new Date(day);
  end.setDate(end.getDate()+1);

  if (!confirm(`Deletar TODOS os pedidos do dia ${day.toLocaleDateString('pt-BR')}? Esta ação não pode ser desfeita.`)) return;

  try {
    const startTS = Timestamp.fromDate(day);
    const endTS = Timestamp.fromDate(end);
    const q = query(pedidosCol, where('horario', '>=', startTS), where('horario', '<', endTS));
    const snaps = await getDocs(q);
    const batchPromises = [];
    snaps.forEach(s => {
      batchPromises.push(deleteDoc(doc(db, 'pedidos', s.id)));
    });
    await Promise.all(batchPromises);
    alert('Pedidos do dia removidos.');
  } catch (err) {
    alert('Erro ao deletar pedidos do dia: ' + err.message);
  }
});

/* init calendar on load */
renderCalendar();

console.log('%cR2D2: gerenciador carregado — boa sorte!', 'color: #1e88e5; font-weight:700');

/* ============================
   Print ticket function (NÃO mostra "pago")
   ============================ */

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function printTicket(item) {
  // NOTE: intentionally do not print the 'pago' status
  const horarioDate = item.horario?.toDate ? item.horario.toDate() : null;
  const horarioStr = horarioDate ? horarioDate.toLocaleString('pt-BR') : '-';
  const numero = item.numero ? escapeHtml(item.numero) : '-';
  const endereco = item.endereco ? escapeHtml(item.endereco) : '-';
  const itens = escapeHtml(item.itens).replace(/\n/g, '<br>');
  const valorStr = `R$ ${Number(item.valor || 0).toFixed(2)}`;

  const win = window.open('', '_blank');
  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Pedido</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body {
    margin:0;
    font-family: "Arial", sans-serif;
    font-size: 13px;
    font-weight: bold;
    color:#000;
    background:white;
  }
  .ticket {
    width: 100%;
    max-width: 80mm;
    margin: 0 auto;
    padding: 10px;
    box-sizing: border-box;
  }
  header { text-align:center; margin-bottom:12px; }
  .brand-title { font-size:1.3em; }
  .meta { font-size:1em; margin-bottom:12px; }
  .items { font-size:1.05em; margin-bottom:14px; }
  .items .desc { margin-bottom:4px; word-break:break-word; }
  .total {
    font-size:1.2em;
    border-top:1px dashed #000;
    padding-top:8px;
    margin-top:8px;
    display:flex;
    justify-content:space-between;
  }
  .quote {
    margin-top:16px;
    font-style:italic;
    font-size:0.85em;
    text-align:center;
    font-weight: normal;
  }
</style>
</head>
<body>
  <div class="ticket">
    <header>
      <div class="brand-title">PEDIDO - DuCheffton</div>
    </header>
    <div class="meta">
      <div><strong>Nome:</strong> ${escapeHtml(item.nome)}</div>
      <div><strong>Cliente:</strong> ${numero}</div>
      <div><strong>Tipo:</strong> ${escapeHtml(item.tipo || '-')}</div>
      ${item.endereco ? `<div><strong>Endereço:</strong> ${endereco}</div>` : ''}
      <div><strong>Horário:</strong> ${escapeHtml(horarioStr)}</div>
    </div>
    <div class="items">
      <div><strong>Itens:</strong></div>
      <div class="desc">${itens}</div>
    </div>
    <div class="total">
      <div>Total:</div>
      <div>${escapeHtml(valorStr)}</div>
    </div>
    <div class="quote">"Se Deus é por nós, quem será contra nós?" Rm. 8:31</div>
  </div>
<script>
window.onload = function(){
  setTimeout(function(){ window.print(); }, 300);
};
</script>
</body>
</html>`;
  win.document.write(html);
  win.document.close();
}
