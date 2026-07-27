// Funções utilitárias de data/hora + cálculo de horários disponíveis.

function paraMinutos(horaTexto) {
  const [h, m] = horaTexto.split(':').map(Number);
  return h * 60 + m;
}

function paraHoraTexto(minutosTotais) {
  const h = Math.floor(minutosTotais / 60);
  const m = minutosTotais % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

// A cada quantos minutos um novo horário "pode começar". Repare que isso é
// diferente da duração do serviço — por exemplo, com passo de 15min, um corte
// de 45min pode começar às 9:00, 9:15, 9:30... (não só de hora em hora).
const PASSO_MINUTOS = 15;

// Verifica se dois intervalos de tempo (em minutos) se sobrepõem
function seSobrepoe(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && fimA > inicioB;
}

// Calcula os horários de início disponíveis num dia, pra um serviço de uma
// certa duração, considerando o expediente e os agendamentos já existentes.
// Retorna uma lista de strings tipo "09:00:00".
function calcularHorariosDisponiveis({ dataISO, diaDaSemana, config, duracaoServico, agendamentosDoDia, agora }) {
  const diasPermitidos = config.dias_semana.split(',').map(Number);
  if (!diasPermitidos.includes(diaDaSemana)) return [];

  const aberturaMin = paraMinutos(config.hora_abertura);
  const fechamentoMin = paraMinutos(config.hora_fechamento);

  const ocupados = agendamentosDoDia.map(a => ({
    inicio: paraMinutos(a.hora_inicio),
    fim: paraMinutos(a.hora_fim),
  }));

  const agoraDataISO = agora ? `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}` : null;
  const agoraMinutos = agora ? agora.getHours() * 60 + agora.getMinutes() : null;
  const ehHoje = agoraDataISO === dataISO;

  const disponiveis = [];
  for (let inicio = aberturaMin; inicio + duracaoServico <= fechamentoMin; inicio += PASSO_MINUTOS) {
    if (ehHoje && inicio <= agoraMinutos) continue; // já passou

    const fim = inicio + duracaoServico;
    const conflita = ocupados.some(o => seSobrepoe(inicio, fim, o.inicio, o.fim));
    if (!conflita) disponiveis.push(paraHoraTexto(inicio));
  }
  return disponiveis;
}

module.exports = { paraMinutos, paraHoraTexto, seSobrepoe, calcularHorariosDisponiveis, PASSO_MINUTOS };
