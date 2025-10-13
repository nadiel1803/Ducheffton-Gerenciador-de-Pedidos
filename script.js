// Referências
const openFilterModal = document.getElementById("openFilterModal");
const filterModal = document.getElementById("filterModal");
const closeModal = document.getElementById("closeModal");
const applyFilterBtn = document.getElementById("applyFilter");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const pedidosList = document.getElementById("pedidosList");

const nomeCliente = document.getElementById("nomeCliente");
const produto = document.getElementById("produto");
const valor = document.getElementById("valor");
const status = document.getElementById("status");
const adicionarPedido = document.getElementById("adicionarPedido");

let pedidos = [];

// Modal abrir e fechar (só desktop)
if (openFilterModal) {
  openFilterModal.addEventListener("click", () => {
    filterModal.style.display = "flex";
  });
}

if (closeModal) {
  closeModal.addEventListener("click", () => {
    filterModal.style.display = "none";
  });
}

window.addEventListener("click", (e) => {
  if (e.target === filterModal) {
    filterModal.style.display = "none";
  }
});

// Adicionar pedido
adicionarPedido.addEventListener("click", () => {
  if (!nomeCliente.value || !produto.value || !valor.value) {
    alert("Preencha todos os campos!");
    return;
  }

  const novoPedido = {
    cliente: nomeCliente.value,
    produto: produto.value,
    valor: parseFloat(valor.value),
    status: status.value
  };

  pedidos.push(novoPedido);
  atualizarLista();

  nomeCliente.value = "";
  produto.value = "";
  valor.value = "";
});

// Atualiza a lista
function atualizarLista(lista = pedidos) {
  pedidosList.innerHTML = "";

  lista.forEach((p, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${p.cliente}</strong> — ${p.produto} — R$ ${p.valor.toFixed(2)} 
      <span style="color:${p.status === 'pago' ? '#28a745' : '#ffc107'}">(${p.status})</span>
    `;
    pedidosList.appendChild(li);
  });
}

// Aplica filtro (desktop)
applyFilterBtn.addEventListener("click", () => {
  const termo = searchInput.value.toLowerCase();
  const statusSelecionado = statusFilter.value;

  const filtrados = pedidos.filter(p =>
    (p.cliente.toLowerCase().includes(termo) || p.produto.toLowerCase().includes(termo)) &&
    (statusSelecionado === "" || p.status === statusSelecionado)
  );

  atualizarLista(filtrados);
  filterModal.style.display = "none";
});
