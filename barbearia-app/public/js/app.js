// URL base da API. Como o front e o back rodam juntos (mesmo servidor Express),
// pode usar caminho relativo.
const API = '/api';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

let barbeiroSelecionado = null;
let inicioSemana = obterInicioDaSemana(new Date());
let horarioEscolhidoId = null;

// ===== Funções de data =====
function obterInicioDaSemana(data) {
  const d = new Date(data);
  d.setDate(d.getDate() - d.getDay()); // volta até domingo
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatarDataISO(data) {
  return data.toISOString().split('T')[0];
}

function formatarDataBonita(data) {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function ehHoje(data) {
  const hoje = new Date();
  return data.toDateString() === hoje.toDateString();
}

function formatarHora(horaCompleta) {
  return horaCompleta.slice(0, 5); // "14:30:00" -> "14:30"
}

// ===== Carregar barbeiros =====
async function carregarBarbeiros() {
  const resposta = await fetch(`${API}/barbeiros`);
  const barbeiros = await resposta.json();

  const select = document.getElementById('barbeiro');
  select.innerHTML = barbeiros.map(b => `<option value="${b.id}">${b.nome}</option>`).join('');

  if (barbeiros.length > 0) {
    barbeiroSelecionado = barbeiros[0].id;
    carregarSemana();
  } else {
    document.getElementById('grade-semana').innerHTML =
      '<p class="sem-horarios">Nenhum barbeiro cadastrado ainda.</p>';
  }
}

// ===== Carregar e desenhar a semana =====
async function carregarSemana() {
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(fimSemana.getDate() + 6);

  document.getElementById('rotulo-semana').textContent =
    `${formatarDataBonita(inicioSemana)} – ${formatarDataBonita(fimSemana)}`;

  const params = new URLSearchParams({
    barbeiro_id: barbeiroSelecionado,
    data_inicio: formatarDataISO(inicioSemana),
    data_fim: formatarDataISO(fimSemana),
  });

  const resposta = await fetch(`${API}/horarios?${params}`);
  const horarios = await resposta.json();

  desenharGrade(horarios);
}

function desenharGrade(horarios) {
  const grade = document.getElementById('grade-semana');
  grade.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const dia = new Date(inicioSemana);
    dia.setDate(dia.getDate() + i);
    const dataISO = formatarDataISO(dia);

    const horariosDoDia = horarios.filter(h => h.data.startsWith(dataISO));

    const coluna = document.createElement('div');
    coluna.className = 'coluna-dia' + (ehHoje(dia) ? ' hoje' : '');

    const titulo = document.createElement('h3');
    titulo.textContent = `${DIAS_SEMANA[dia.getDay()]} ${formatarDataBonita(dia)}`;
    coluna.appendChild(titulo);

    if (horariosDoDia.length === 0) {
      const vazio = document.createElement('p');
      vazio.className = 'sem-horarios';
      vazio.textContent = '—';
      coluna.appendChild(vazio);
    }

    horariosDoDia.forEach(h => {
      const botao = document.createElement('button');
      botao.className = 'slot' + (h.status !== 'disponivel' ? ' indisponivel' : '');
      botao.textContent = formatarHora(h.hora_inicio);
      botao.disabled = h.status !== 'disponivel';
      botao.addEventListener('click', () => abrirModalReserva(h, dia));
      coluna.appendChild(botao);
    });

    grade.appendChild(coluna);
  }
}

// ===== Modal de reserva =====
function abrirModalReserva(horario, dia) {
  horarioEscolhidoId = horario.id;
  document.getElementById('modal-horario-info').textContent =
    `${DIAS_SEMANA[dia.getDay()]}, ${formatarDataBonita(dia)} às ${formatarHora(horario.hora_inicio)}`;
  document.getElementById('form-reserva').reset();
  esconder(document.getElementById('mensagem-erro'));
  mostrar(document.getElementById('modal'));
}

function mostrar(el) { el.classList.remove('escondido'); }
function esconder(el) { el.classList.add('escondido'); }

document.getElementById('fechar-modal').addEventListener('click', () => esconder(document.getElementById('modal')));
document.getElementById('fechar-sucesso').addEventListener('click', () => {
  esconder(document.getElementById('modal-sucesso'));
  carregarSemana(); // recarrega pra já sumir o horário que acabou de ser reservado
});

document.getElementById('form-reserva').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const nome = document.getElementById('nome').value.trim();
  const telefone = document.getElementById('telefone').value.trim();
  const caixaErro = document.getElementById('mensagem-erro');

  try {
    const resposta = await fetch(`${API}/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horario_id: horarioEscolhidoId, nome, telefone }),
    });
    const dados = await resposta.json();

    if (!resposta.ok) {
      caixaErro.textContent = dados.erro || 'Não foi possível confirmar a reserva.';
      mostrar(caixaErro);
      return;
    }

    esconder(document.getElementById('modal'));
    document.getElementById('sucesso-info').textContent =
      `Você receberá a confirmação pelo telefone informado. Até breve, ${nome}!`;
    mostrar(document.getElementById('modal-sucesso'));
  } catch (erro) {
    caixaErro.textContent = 'Erro de conexão. Tente novamente.';
    mostrar(caixaErro);
  }
});

// ===== Navegação de semana =====
document.getElementById('semana-anterior').addEventListener('click', () => {
  inicioSemana.setDate(inicioSemana.getDate() - 7);
  carregarSemana();
});
document.getElementById('semana-proxima').addEventListener('click', () => {
  inicioSemana.setDate(inicioSemana.getDate() + 7);
  carregarSemana();
});
document.getElementById('barbeiro').addEventListener('change', (e) => {
  barbeiroSelecionado = e.target.value;
  carregarSemana();
});

carregarBarbeiros();
