const API = '/api';
const DIAS_SEMANA_ABREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MESES_ABREV = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Países mais comuns pros clientes da Ironblade (Irlanda em primeiro, por padrão).
// maxDigitos = quantidade máxima de dígitos do número LOCAL (sem o código do país
// e sem o "0" inicial que alguns países usam só no formato doméstico).
const PAISES = [
  { dial: '+353', bandeira: '🇮🇪', nome: 'Ireland', maxDigitos: 9 },
  { dial: '+44',  bandeira: '🇬🇧', nome: 'United Kingdom', maxDigitos: 10 },
  { dial: '+1',   bandeira: '🇺🇸', nome: 'United States', maxDigitos: 10 },
  { dial: '+1',   bandeira: '🇨🇦', nome: 'Canada', maxDigitos: 10 },
  { dial: '+55',  bandeira: '🇧🇷', nome: 'Brazil', maxDigitos: 11 },
  { dial: '+351', bandeira: '🇵🇹', nome: 'Portugal', maxDigitos: 9 },
  { dial: '+34',  bandeira: '🇪🇸', nome: 'Spain', maxDigitos: 9 },
  { dial: '+33',  bandeira: '🇫🇷', nome: 'France', maxDigitos: 9 },
  { dial: '+49',  bandeira: '🇩🇪', nome: 'Germany', maxDigitos: 11 },
  { dial: '+39',  bandeira: '🇮🇹', nome: 'Italy', maxDigitos: 10 },
  { dial: '+31',  bandeira: '🇳🇱', nome: 'Netherlands', maxDigitos: 9 },
  { dial: '+48',  bandeira: '🇵🇱', nome: 'Poland', maxDigitos: 9 },
  { dial: '+52',  bandeira: '🇲🇽', nome: 'Mexico', maxDigitos: 10 },
  { dial: '+54',  bandeira: '🇦🇷', nome: 'Argentina', maxDigitos: 10 },
];

let barbeiroSelecionado = null;
let servicoSelecionado = null;
let dataSelecionada = obterHojeLocal();
let inicioSemanaExibida = obterSegundaFeira(dataSelecionada);
let horarioEscolhido = null; // string "HH:MM:SS"

function obterHojeLocal() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}
function obterSegundaFeira(data) {
  const d = new Date(data);
  const diferenca = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diferenca);
  return d;
}
function formatarDataISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}
function formatarHora(horaCompleta) { return horaCompleta.slice(0, 5); }
function mostrar(el) { el.classList.remove('escondido'); }
function esconder(el) { el.classList.add('escondido'); }

// ===== Navegação entre passos =====
function irPara(idEtapa, numeroPasso) {
  document.querySelectorAll('.etapa').forEach(e => e.classList.add('etapa-escondida'));
  document.getElementById(idEtapa).classList.remove('etapa-escondida');

  document.querySelectorAll('.passo').forEach(p => {
    const n = Number(p.dataset.passo);
    p.classList.toggle('ativo', n === numeroPasso);
    p.classList.toggle('concluido', n < numeroPasso);
  });
}

document.querySelectorAll('[data-voltar]').forEach(botao => {
  botao.addEventListener('click', () => {
    const alvo = botao.dataset.voltar;
    const numero = alvo === 'etapa-barbeiro' ? 1 : 2;
    irPara(alvo, numero);
  });
});

// ===== Passo 1: barbeiros =====
async function carregarBarbeiros() {
  const resposta = await fetch(`${API}/barbeiros`);
  const barbeiros = await resposta.json();
  const lista = document.getElementById('lista-barbeiros');

  if (barbeiros.length === 0) {
    lista.innerHTML = '<p class="sem-horarios-dia">No barbers registered yet.</p>';
    return;
  }

  lista.innerHTML = barbeiros.map(b => `
    <button class="cartao-barbeiro" data-id="${b.id}">
      <div class="cartao-barbeiro-avatar">${b.nome.charAt(0).toUpperCase()}</div>
      <div class="cartao-barbeiro-nome">${b.nome}</div>
    </button>
  `).join('');

  lista.querySelectorAll('.cartao-barbeiro').forEach(cartao => {
    cartao.addEventListener('click', () => {
      barbeiroSelecionado = cartao.dataset.id;
      carregarServicos();
      irPara('etapa-servico', 2);
    });
  });
}

// ===== Passo 2: serviços =====
async function carregarServicos() {
  const resposta = await fetch(`${API}/servicos`);
  const servicos = await resposta.json();
  const lista = document.getElementById('lista-servicos');

  lista.innerHTML = servicos.map(s => `
    <button class="cartao-servico" data-id="${s.id}">
      <div>
        <div class="cartao-servico-nome">${s.nome}</div>
        <div class="cartao-servico-duracao">${s.duracao_minutos} minutes</div>
      </div>
      <div class="cartao-servico-preco">€${s.preco}</div>
    </button>
  `).join('');

  lista.querySelectorAll('.cartao-servico').forEach(cartao => {
    cartao.addEventListener('click', () => {
      servicoSelecionado = cartao.dataset.id;
      irPara('etapa-horario', 3);
      montarScrollerDias();
      carregarHorariosDoDia();
    });
  });
}

// ===== Passo 3: data e horário =====
function montarScrollerDias() {
  const scroller = document.getElementById('scroller-dias');
  scroller.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const dia = new Date(inicioSemanaExibida);
    dia.setDate(dia.getDate() + i);

    const chip = document.createElement('button');
    chip.className = 'chip-dia' + (formatarDataISO(dia) === formatarDataISO(dataSelecionada) ? ' selecionado' : '');
    chip.innerHTML = `
      <span class="chip-dia-semana">${DIAS_SEMANA_ABREV[dia.getDay()]}</span>
      <span class="chip-dia-numero">${dia.getDate()}</span>
      <span class="chip-dia-mes">${MESES_ABREV[dia.getMonth()]}</span>
    `;
    chip.addEventListener('click', () => {
      dataSelecionada = dia;
      montarScrollerDias();
      carregarHorariosDoDia();
    });
    scroller.appendChild(chip);
  }
}

function navegarSemana(direcao) {
  const diferencaDias = Math.round((dataSelecionada - inicioSemanaExibida) / 86400000);
  inicioSemanaExibida.setDate(inicioSemanaExibida.getDate() + direcao * 7);
  dataSelecionada = new Date(inicioSemanaExibida);
  dataSelecionada.setDate(inicioSemanaExibida.getDate() + diferencaDias);
  montarScrollerDias();
  carregarHorariosDoDia();
}
document.getElementById('semana-anterior').addEventListener('click', () => navegarSemana(-1));
document.getElementById('semana-proxima').addEventListener('click', () => navegarSemana(1));

document.getElementById('botao-calendario').addEventListener('click', () => {
  const input = document.getElementById('input-data-oculto');
  input.value = formatarDataISO(dataSelecionada);
  if (input.showPicker) input.showPicker();
  else input.click();
});

document.getElementById('input-data-oculto').addEventListener('change', (evento) => {
  const [ano, mes, dia] = evento.target.value.split('-').map(Number);
  dataSelecionada = new Date(ano, mes - 1, dia);
  inicioSemanaExibida = obterSegundaFeira(dataSelecionada);
  montarScrollerDias();
  carregarHorariosDoDia();
});

async function carregarHorariosDoDia() {
  const lista = document.getElementById('lista-horarios');
  lista.innerHTML = '<p class="sem-horarios-dia">Loading...</p>';

  const params = new URLSearchParams({
    barbeiro_id: barbeiroSelecionado,
    servico_id: servicoSelecionado,
    data: formatarDataISO(dataSelecionada),
  });

  const resposta = await fetch(`${API}/disponibilidade-dia?${params}`);
  const dados = await resposta.json();

  if (!dados.horarios || dados.horarios.length === 0) {
    lista.innerHTML = '<p class="sem-horarios-dia">No times available this day. Try another date.</p>';
    return;
  }

  lista.innerHTML = dados.horarios.map(h => `<button class="pilula-horario" data-hora="${h}">${formatarHora(h)}</button>`).join('');
  lista.querySelectorAll('.pilula-horario').forEach(botao => {
    botao.addEventListener('click', () => abrirModalReserva(botao.dataset.hora));
  });
}

// ===== Seletor de país do telefone =====
function montarSelectPais() {
  const select = document.getElementById('select-pais');
  select.innerHTML = PAISES.map((p, i) =>
    `<option value="${i}">${p.bandeira} ${p.dial}</option>`
  ).join('');
  atualizarLimiteTelefone();
}
document.getElementById('select-pais').addEventListener('change', atualizarLimiteTelefone);

function atualizarLimiteTelefone() {
  const pais = PAISES[document.getElementById('select-pais').value];
  document.getElementById('telefone').maxLength = pais.maxDigitos;
}

// Só deixa dígitos serem digitados no campo de telefone
document.getElementById('telefone').addEventListener('input', (evento) => {
  evento.target.value = evento.target.value.replace(/\D/g, '');
});

// ===== Modal de confirmação =====
function abrirModalReserva(horaInicio) {
  horarioEscolhido = horaInicio;
  document.getElementById('modal-horario-info').textContent =
    `${DIAS_SEMANA_ABREV[dataSelecionada.getDay()]}, ${dataSelecionada.getDate()}/${String(dataSelecionada.getMonth() + 1).padStart(2, '0')} at ${formatarHora(horaInicio)}`;
  document.getElementById('form-reserva').reset();
  document.getElementById('select-pais').value = 0; // volta pra Irlanda por padrão
  atualizarLimiteTelefone();
  esconder(document.getElementById('mensagem-erro'));
  mostrar(document.getElementById('modal'));
}

document.getElementById('fechar-modal').addEventListener('click', () => esconder(document.getElementById('modal')));
document.getElementById('fechar-sucesso').addEventListener('click', () => {
  esconder(document.getElementById('modal-sucesso'));
  carregarHorariosDoDia();
});

document.getElementById('form-reserva').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('email').value.trim();
  const numeroLocal = document.getElementById('telefone').value.trim();
  const pais = PAISES[document.getElementById('select-pais').value];
  const caixaErro = document.getElementById('mensagem-erro');

  if (numeroLocal.length < 6) {
    caixaErro.textContent = 'Please enter a valid phone number.';
    mostrar(caixaErro);
    return;
  }

  const telefoneCompleto = pais.dial + numeroLocal;

  try {
    const resposta = await fetch(`${API}/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barbeiro_id: barbeiroSelecionado,
        servico_id: servicoSelecionado,
        data: formatarDataISO(dataSelecionada),
        hora_inicio: horarioEscolhido,
        nome,
        email,
        telefone: telefoneCompleto,
      }),
    });
    const dados = await resposta.json();

    if (!resposta.ok) {
      caixaErro.textContent = dados.erro || 'Could not confirm the booking.';
      mostrar(caixaErro);
      return;
    }

    esconder(document.getElementById('modal'));
    document.getElementById('sucesso-info').textContent =
      `A confirmation has been sent to ${email}. See you soon, ${nome}!`;
    mostrar(document.getElementById('modal-sucesso'));
  } catch (erro) {
    caixaErro.textContent = 'Connection error. Please try again.';
    mostrar(caixaErro);
  }
});

montarSelectPais();
carregarBarbeiros();
