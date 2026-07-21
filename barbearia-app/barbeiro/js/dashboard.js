const API = '/api';
const token = localStorage.getItem('token');

if (!token && window.location.pathname.includes('dashboard')) {
  window.location.href = 'login.html';
}

let config = null;       // configuração de expediente do barbeiro
let calendario = null;   // instância do FullCalendar
let dataClicada = null;  // guarda a data/hora clicada nos modais
let tipoSelecionado = 'bloqueado';
let eventoSelecionadoId = null;

function cabecalhosAuth() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function chamarApiProtegida(url, opcoes = {}) {
  const resposta = await fetch(url, { ...opcoes, headers: cabecalhosAuth() });
  if (resposta.status === 401) {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
    throw new Error('Sessão expirada');
  }
  return resposta;
}

function mostrar(el) { el.classList.remove('escondido'); }
function esconder(el) { el.classList.add('escondido'); }

document.addEventListener('DOMContentLoaded', async () => {
  if (!token) return;

  document.getElementById('nome-barbeiro-topo').textContent = localStorage.getItem('nomeBarbeiro') || '';
  configurarBotaoSair();
  configurarFechamentoModais();
  configurarModalNovo();
  configurarModalEvento();
  configurarModalConfig();

  await carregarConfiguracao();
  iniciarCalendario();
});

function configurarBotaoSair() {
  document.getElementById('botao-sair').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nomeBarbeiro');
    window.location.href = 'login.html';
  });
}

function configurarFechamentoModais() {
  document.querySelectorAll('[data-fechar]').forEach(botao => {
    botao.addEventListener('click', () => esconder(document.getElementById(botao.dataset.fechar)));
  });
}

// ===== Configuração de expediente =====
async function carregarConfiguracao() {
  const resposta = await chamarApiProtegida(`${API}/barbeiro/configuracao`);
  config = await resposta.json();
}

function configurarModalConfig() {
  document.getElementById('botao-config').addEventListener('click', () => {
    document.getElementById('config-hora-abertura').value = config.hora_abertura.slice(0, 5);
    document.getElementById('config-hora-fechamento').value = config.hora_fechamento.slice(0, 5);
    document.getElementById('config-duracao').value = config.duracao_minutos;
    const diasAtivos = config.dias_semana.split(',');
    document.querySelectorAll('#config-dias input').forEach(cb => {
      cb.checked = diasAtivos.includes(cb.value);
    });
    esconder(document.getElementById('config-mensagem'));
    mostrar(document.getElementById('modal-config'));
  });

  document.getElementById('form-config').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const mensagem = document.getElementById('config-mensagem');
    const dias = Array.from(document.querySelectorAll('#config-dias input:checked')).map(c => Number(c.value));

    if (dias.length === 0) {
      mensagem.className = 'mensagem-erro';
      mensagem.textContent = 'Selecione ao menos um dia de atendimento.';
      mostrar(mensagem);
      return;
    }

    try {
      const resposta = await chamarApiProtegida(`${API}/barbeiro/configuracao`, {
        method: 'PUT',
        body: JSON.stringify({
          dias_semana: dias,
          hora_abertura: document.getElementById('config-hora-abertura').value,
          hora_fechamento: document.getElementById('config-hora-fechamento').value,
          duracao_minutos: Number(document.getElementById('config-duracao').value),
        }),
      });
      const dados = await resposta.json();
      mensagem.className = resposta.ok ? 'mensagem-ok' : 'mensagem-erro';
      mensagem.textContent = dados.mensagem || dados.erro;
      mostrar(mensagem);

      if (resposta.ok) {
        await carregarConfiguracao();
        aplicarExpedienteNoCalendario();
        calendario.refetchEvents();
        setTimeout(() => esconder(document.getElementById('modal-config')), 800);
      }
    } catch (erro) {
      mensagem.className = 'mensagem-erro';
      mensagem.textContent = 'Erro de conexão.';
      mostrar(mensagem);
    }
  });
}

function aplicarExpedienteNoCalendario() {
  calendario.setOption('businessHours', {
    daysOfWeek: config.dias_semana.split(',').map(Number),
    startTime: config.hora_abertura.slice(0, 5),
    endTime: config.hora_fechamento.slice(0, 5),
  });
  calendario.setOption('slotDuration', `00:${String(config.duracao_minutos).padStart(2, '0')}:00`);
}

// ===== Calendário =====
function iniciarCalendario() {
  const elemento = document.getElementById('calendario');

  calendario = new FullCalendar.Calendar(elemento, {
    locale: 'pt-br',
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay',
    },
    buttonText: { multiMonthYear: 'Ano', dayGridMonth: 'Mês', timeGridWeek: 'Semana', timeGridDay: 'Dia', today: 'Hoje' },
    initialView: 'timeGridWeek',
    slotMinTime: '07:00:00',
    slotMaxTime: '22:00:00',
    allDaySlot: false,
    nowIndicator: true,
    selectable: true,
    selectMirror: true,
    selectOverlap: false,
    editable: true,        // permite arrastar eventos pra mover
    eventDurationEditable: false, // não deixa esticar/encolher (duração é fixa)
    eventStartEditable: true,

    // Clique num dia inteiro (visão de mês/ano) -> abre a visão do dia
    dateClick(info) {
      if (info.view.type === 'dayGridMonth' || info.view.type === 'multiMonthYear') {
        calendario.changeView('timeGridDay', info.date);
      }
    },

    // Selecionou um intervalo de horário livre (visão semana/dia) -> abrir modal de criação
    select(info) {
      if (info.view.type !== 'timeGridWeek' && info.view.type !== 'timeGridDay') {
        calendario.unselect();
        return;
      }
      abrirModalNovo(info.start);
      calendario.unselect();
    },

    // Busca os eventos (reservas e bloqueios) do período visível
    events(info, sucesso, falha) {
      const dataInicio = info.startStr.split('T')[0];
      const dataFim = info.endStr.split('T')[0];
      chamarApiProtegida(`${API}/barbeiro/agendamentos?data_inicio=${dataInicio}&data_fim=${dataFim}`)
        .then(r => r.json())
        .then(agendamentos => {
          sucesso(agendamentos.map(a => ({
            id: String(a.id),
            title: a.tipo === 'reservado' ? a.nome_cliente : 'Bloqueado',
            start: `${a.data.split('T')[0]}T${a.hora_inicio}`,
            end: `${a.data.split('T')[0]}T${a.hora_fim}`,
            classNames: [a.tipo === 'reservado' ? 'evento-reservado' : 'evento-bloqueado'],
            extendedProps: { tipo: a.tipo, nome_cliente: a.nome_cliente, telefone_cliente: a.telefone_cliente },
          })));
        })
        .catch(falha);
    },

    eventClick(info) {
      abrirModalEvento(info.event);
    },

    // Arrastou um evento pra outro horário
    async eventDrop(info) {
      const ok = await moverEvento(info.event.id, info.event.start);
      if (!ok) info.revert();
    },
  });

  aplicarExpedienteNoCalendario();
  calendario.render();
}

// ===== Modal: criar bloqueio ou reserva manual =====
function configurarModalNovo() {
  document.querySelectorAll('.aba-tipo').forEach(botao => {
    botao.addEventListener('click', () => {
      document.querySelectorAll('.aba-tipo').forEach(b => b.classList.remove('ativa'));
      botao.classList.add('ativa');
      tipoSelecionado = botao.dataset.tipo;
      const campos = document.getElementById('campos-cliente');
      tipoSelecionado === 'reservado' ? mostrar(campos) : esconder(campos);
    });
  });

  document.getElementById('form-novo').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const erro = document.getElementById('novo-erro');
    const nome = document.getElementById('novo-nome').value.trim();
    const telefone = document.getElementById('novo-telefone').value.trim();

    if (tipoSelecionado === 'reservado' && (!nome || !telefone)) {
      erro.textContent = 'Preencha nome e telefone do cliente.';
      mostrar(erro);
      return;
    }

    const corpo = {
      data: formatarDataISO(dataClicada),
      hora_inicio: formatarHoraISO(dataClicada),
      tipo: tipoSelecionado,
      nome_cliente: tipoSelecionado === 'reservado' ? nome : undefined,
      telefone_cliente: tipoSelecionado === 'reservado' ? telefone : undefined,
    };

    try {
      const resposta = await chamarApiProtegida(`${API}/barbeiro/agendamentos`, { method: 'POST', body: JSON.stringify(corpo) });
      const dados = await resposta.json();
      if (!resposta.ok) { erro.textContent = dados.erro; mostrar(erro); return; }
      esconder(document.getElementById('modal-novo'));
      calendario.refetchEvents();
    } catch (e) {
      erro.textContent = 'Erro de conexão.';
      mostrar(erro);
    }
  });
}

function abrirModalNovo(data) {
  dataClicada = data;
  document.getElementById('novo-info').textContent = formatarDataHoraBonita(data);
  document.getElementById('form-novo').reset();
  esconder(document.getElementById('novo-erro'));
  esconder(document.getElementById('campos-cliente'));
  tipoSelecionado = 'bloqueado';
  document.querySelectorAll('.aba-tipo').forEach(b => b.classList.remove('ativa'));
  document.querySelector('.aba-tipo[data-tipo="bloqueado"]').classList.add('ativa');
  mostrar(document.getElementById('modal-novo'));
}

// ===== Modal: ver/remover evento existente =====
function configurarModalEvento() {
  document.getElementById('btn-remover-evento').addEventListener('click', async () => {
    if (!confirm('Tem certeza que quer remover isso?')) return;
    const erro = document.getElementById('evento-erro');
    try {
      const resposta = await chamarApiProtegida(`${API}/barbeiro/agendamentos/${eventoSelecionadoId}`, { method: 'DELETE' });
      const dados = await resposta.json();
      if (!resposta.ok) { erro.textContent = dados.erro; mostrar(erro); return; }
      esconder(document.getElementById('modal-evento'));
      calendario.refetchEvents();
    } catch (e) {
      erro.textContent = 'Erro de conexão.';
      mostrar(erro);
    }
  });
}

function abrirModalEvento(evento) {
  eventoSelecionadoId = evento.id;
  const props = evento.extendedProps;

  document.getElementById('evento-titulo').textContent = props.tipo === 'reservado' ? 'Reserva' : 'Bloqueado';
  document.getElementById('evento-info').textContent = formatarDataHoraBonita(evento.start);

  const clienteInfo = document.getElementById('evento-cliente');
  if (props.tipo === 'reservado') {
    clienteInfo.textContent = `${props.nome_cliente} · ${props.telefone_cliente}`;
    mostrar(clienteInfo);
  } else {
    esconder(clienteInfo);
  }

  esconder(document.getElementById('evento-erro'));
  mostrar(document.getElementById('modal-evento'));
}

async function moverEvento(id, novaData) {
  try {
    const resposta = await chamarApiProtegida(`${API}/barbeiro/agendamentos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ data: formatarDataISO(novaData), hora_inicio: formatarHoraISO(novaData) }),
    });
    const dados = await resposta.json();
    if (!resposta.ok) { alert(dados.erro); return false; }
    return true;
  } catch (e) {
    alert('Erro de conexão ao mover.');
    return false;
  }
}

// ===== Formatação de data/hora =====
function formatarDataISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}
function formatarHoraISO(data) {
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}:00`;
}
function formatarDataHoraBonita(data) {
  return data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) +
    ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
