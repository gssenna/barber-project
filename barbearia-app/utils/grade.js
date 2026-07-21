// Dado o expediente do barbeiro (configuracoes) e os agendamentos já existentes
// num dia, calcula a "grade" de horários daquele dia — sem precisar ter
// nenhuma linha salva no banco pros horários livres.

function paraMinutos(horaTexto) {
  const [h, m] = horaTexto.split(':').map(Number);
  return h * 60 + m;
}

function paraHoraTexto(minutosTotais) {
  const h = Math.floor(minutosTotais / 60);
  const m = minutosTotais % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

// dataISO: "2026-07-20" | diaDaSemana: 0-6 (0=domingo)
// config: { dias_semana: "1,2,3,4,5,6", hora_abertura, hora_fechamento, duracao_minutos }
// agendamentosDoDia: [{ hora_inicio, tipo, nome_cliente, telefone_cliente, id }]
function calcularGradeDoDia(dataISO, diaDaSemana, config, agendamentosDoDia) {
  const diasPermitidos = config.dias_semana.split(',').map(Number);
  if (!diasPermitidos.includes(diaDaSemana)) return [];

  const inicio = paraMinutos(config.hora_abertura);
  const fim = paraMinutos(config.hora_fechamento);
  const duracao = config.duracao_minutos;

  // Mapa rápido: "09:00:00" -> agendamento
  const porHoraInicio = {};
  agendamentosDoDia.forEach(a => { porHoraInicio[a.hora_inicio] = a; });

  const grade = [];
  for (let m = inicio; m + duracao <= fim; m += duracao) {
    const horaInicio = paraHoraTexto(m);
    const horaFim = paraHoraTexto(m + duracao);
    const agendamento = porHoraInicio[horaInicio];

    grade.push({
      data: dataISO,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      status: agendamento ? agendamento.tipo : 'disponivel',
      agendamento_id: agendamento ? agendamento.id : null,
    });
  }
  return grade;
}

module.exports = { calcularGradeDoDia, paraMinutos, paraHoraTexto };
