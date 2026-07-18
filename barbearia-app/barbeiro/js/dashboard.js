const API = '/api';
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const token = localStorage.getItem('token');

// Se não tiver token e estiver no dashboard, manda pro login
if (!token && window.location.pathname.includes('dashboard')) {
  window.location.href = 'login.html';
}

let inicioSemana = obterInicioDaSemana(new Date());
let horarioSelecionado = null; // guarda o horário clicado no modal de ação
let cacheHorariosSemana = []; // guarda os horários já buscados, pra usar na troca de reserva

// ===== Cabeçalho de autenticação usado em toda chamada protegida =====
function cabecalhosAuth() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// Se a API responder 401 (sessão expirada/inválida), manda de volta pro login
async function chamarApiProtegida(url, opcoes = {}) {
  const resposta = await fetch(url, { ...opcoes, headers: cabecalhosAuth() });
  if (resposta.status === 401) {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
    throw new Error('Sessão expirada');
  }
  return resposta;
}

// ===== Funções de data (iguais às do site do cliente) =====
function obterInicioDaSemana(data) {
  const d = new Date(data);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatarDataISO(data) { return data.toISOString().split('T')[0]; }
function formatarDataBonita(data) { return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
function ehHoje(data) { return data.toDateString() === new Date().toDateString(); }
function formatarHora(horaCompleta) { return horaCompleta.slice(0, 5); }
function mostrar(el) { el.classList.remove('escondido'); }
function esconder(el) { el.classList.add('escondido'); }

// ===== Inicialização =====
document.addEventListener('DOMContentLoaded', () => {
  if (!token) return; // estamos na tela de login, não faz nada daqui

  document.getElementById('nome-barbeiro-topo').textContent = localStorage.getItem('nomeBarbeiro') || '';
  document.getElementById('data-inicio-gerar').value = formatarDataISO(new Date());

  configurarAbas();
  configurarNavegacaoSemana();
  configurarModalAcao();
  configurarFormularioGerar();
  configurarBotaoSair();

  carregarSemana();
});

// ===== Abas =====
function configurarAbas() {
  document.querySelectorAll('.aba-botao').forEach(botao => {
    botao.addEventListener('click', () => {
      document.querySelectorAll('.aba-botao').forEach(b => b.classList.remove('ativa'));
      document.querySelectorAll('.painel-secao').forEach(s => s.classList.remove('ativa'));
      botao.classList.add('ativa');
      document.getElementById(`secao-${botao.dataset.aba}`).classList.add('ativa');
    });
  });
}

function configurarBotaoSair() {
  document.getElementById('botao-sair').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nomeBarbeiro');
    window.location.href = 'login.html';
  });
}

// ===== Navegação de semana =====
function configurarNavegacaoSemana() {
  document.getElementById('semana-anterior').addEventListener('click', () => {
    inicioSemana.setDate(inicioSemana.getDate() - 7);
    carregarSemana();
  });
  document.getElementById('semana-proxima').addEventListener('click', () => {
    inicioSemana.setDate(inicioSemana.getDate() + 7);
    carregarSemana();
  });
}

// ===== Carregar e desenhar a agenda da semana =====
async function carregarSemana() {
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(fimSemana.getDate() + 6);

  document.getElementById('rotulo-semana').textContent =
    `${formatarDataBonita(inicioSemana)} – ${formatarDataBonita(fimSemana)}`;

  const params = new URLSearchParams({
    data_inicio: formatarDataISO(inicioSemana),
    data_fim: formatarDataISO(fimSemana),
  });

  const resposta = await chamarApiProtegida(`${API}/barbeiro/horarios?${params}`);
  const horarios = await resposta.json();
  cacheHorariosSemana = horarios;

  desenharGrade(horarios);
}

function desenharGrade(horarios) {
  const grade = document.getElementById('grade-agenda');
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
      vazio.textContent = 'Sem horários';
      coluna.appendChild(vazio);
    }

    horariosDoDia.forEach(h => {
      const botao = document.createElement('button');
      botao.className = `slot-dash ${h.status}`;
      if (h.status === 'reservado') {
        botao.innerHTML = `${formatarHora(h.hora_inicio)}
          <span class="cliente-nome">${h.nome_cliente}</span>
          <span class="cliente-tel">${h.telefone_cliente}</span>`;
      } else {
        botao.textContent = `${formatarHora(h.hora_inicio)} · ${h.status === 'disponivel' ? 'Livre' : 'Bloqueado'}`;
      }
      botao.addEventListener('click', () => abrirModalAcao(h, dia));
      coluna.appendChild(botao);
    });

    grade.appendChild(coluna);
  }
}

// ===== Modal de ação (bloquear / desbloquear / cancelar / mover) =====
function configurarModalAcao() {
  document.getElementById('fechar-modal-acao').addEventListener('click', () => esconder(document.getElementById('modal-acao')));

  document.getElementById('btn-bloquear').addEventListener('click', () => executarAcao(
    () => chamarApiProtegida(`${API}/barbeiro/horarios/${horarioSelecionado.id}/bloquear`, { method: 'PUT' })
  ));

  document.getElementById('btn-desbloquear').addEventListener('click', () => executarAcao(
    () => chamarApiProtegida(`${API}/barbeiro/horarios/${horarioSelecionado.id}/desbloquear`, { method: 'PUT' })
  ));

  document.getElementById('btn-cancelar').addEventListener('click', () => {
    if (!confirm('Tem certeza que quer cancelar essa reserva?')) return;
    executarAcao(() => chamarApiProtegida(`${API}/barbeiro/reservas/${horarioSelecionado.reserva_id}`, { method: 'DELETE' }));
  });

  document.getElementById('btn-mover').addEventListener('click', () => {
    const select = document.getElementById('select-novo-horario');
    const disponiveis = cacheHorariosSemana.filter(h => h.status === 'disponivel');

    if (disponiveis.length === 0) {
      select.innerHTML = '<option>Nenhum horário livre nesta semana</option>';
    } else {
      select.innerHTML = disponiveis.map(h =>
        `<option value="${h.id}">${h.data.split('T')[0].split('-').reverse().join('/')} às ${formatarHora(h.hora_inicio)}</option>`
      ).join('');
    }
    mostrar(document.getElementById('area-mover'));
  });

  document.getElementById('btn-confirmar-mover').addEventListener('click', () => {
    const novoHorarioId = document.getElementById('select-novo-horario').value;
    executarAcao(() => chamarApiProtegida(`${API}/barbeiro/reservas/${horarioSelecionado.reserva_id}/mover`, {
      method: 'PUT',
      body: JSON.stringify({ novo_horario_id: novoHorarioId }),
    }));
  });
}

function abrirModalAcao(horario, dia) {
  horarioSelecionado = horario;
  const infoData = `${DIAS_SEMANA[dia.getDay()]}, ${formatarDataBonita(dia)} às ${formatarHora(horario.hora_inicio)}`;

  document.getElementById('acao-titulo').textContent =
    horario.status === 'disponivel' ? 'Horário livre' : horario.status === 'bloqueado' ? 'Horário bloqueado' : 'Horário reservado';
  document.getElementById('acao-info').textContent = infoData;

  [ 'acao-disponivel', 'acao-bloqueado', 'acao-reservado' ].forEach(id => esconder(document.getElementById(id)));
  esconder(document.getElementById('area-mover'));
  esconder(document.getElementById('mensagem-acao'));

  if (horario.status === 'disponivel') mostrar(document.getElementById('acao-disponivel'));
  if (horario.status === 'bloqueado') mostrar(document.getElementById('acao-bloqueado'));
  if (horario.status === 'reservado') {
    mostrar(document.getElementById('acao-reservado'));
    document.getElementById('reservado-nome').textContent = horario.nome_cliente;
    document.getElementById('reservado-tel').textContent = horario.telefone_cliente;
  }

  mostrar(document.getElementById('modal-acao'));
}

async function executarAcao(chamada) {
  const mensagem = document.getElementById('mensagem-acao');
  try {
    const resposta = await chamada();
    const dados = await resposta.json();
    if (!resposta.ok) {
      mensagem.textContent = dados.erro || 'Não foi possível concluir a ação.';
      mostrar(mensagem);
      return;
    }
    esconder(document.getElementById('modal-acao'));
    carregarSemana();
  } catch (erro) {
    mensagem.textContent = 'Erro de conexão. Tente novamente.';
    mostrar(mensagem);
  }
}

// ===== Formulário: gerar horários da semana =====
function configurarFormularioGerar() {
  document.getElementById('form-gerar').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const mensagem = document.getElementById('mensagem-gerar');

    const dias = Array.from(document.querySelectorAll('.checkboxes-dias input:checked')).map(c => Number(c.value));

    const corpo = {
      data_inicio: document.getElementById('data-inicio-gerar').value,
      hora_inicio: document.getElementById('hora-inicio-gerar').value,
      hora_fim: document.getElementById('hora-fim-gerar').value,
      duracao_minutos: Number(document.getElementById('duracao-gerar').value),
      dias,
    };

    try {
      const resposta = await chamarApiProtegida(`${API}/barbeiro/horarios/gerar`, {
        method: 'POST',
        body: JSON.stringify(corpo),
      });
      const dados = await resposta.json();

      mensagem.className = resposta.ok ? 'mensagem-ok' : 'mensagem-erro';
      mensagem.textContent = dados.mensagem || dados.erro;
      mostrar(mensagem);

      if (resposta.ok) carregarSemana();
    } catch (erro) {
      mensagem.className = 'mensagem-erro';
      mensagem.textContent = 'Erro de conexão. Tente novamente.';
      mostrar(mensagem);
    }
  });
}
