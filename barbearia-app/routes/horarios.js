const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { SERVICOS } = require('../utils/servicos');
const { calcularHorariosDisponiveis } = require('../utils/grade');

// GET /api/barbeiros
router.get('/barbeiros', async (req, res) => {
  try {
    const [barbeiros] = await db.query('SELECT id, nome FROM barbeiros');
    res.json(barbeiros);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar barbeiros.' });
  }
});

// GET /api/servicos
router.get('/servicos', (req, res) => {
  res.json(SERVICOS);
});

// GET /api/disponibilidade-dia?barbeiro_id=1&servico_id=cabelo&data=2026-07-27
// Devolve só os horários de início REALMENTE disponíveis pra esse serviço nesse dia
// (já considerando a duração do serviço, o expediente, o que já está ocupado, e
// horários que já passaram, se for hoje).
router.get('/disponibilidade-dia', async (req, res) => {
  const { barbeiro_id, servico_id, data } = req.query;
  if (!barbeiro_id || !servico_id || !data) {
    return res.status(400).json({ erro: 'Informe barbeiro_id, servico_id e data.' });
  }

  const servico = SERVICOS.find(s => s.id === servico_id);
  if (!servico) return res.status(400).json({ erro: 'Serviço inválido.' });

  try {
    const [[config]] = await db.query('SELECT * FROM configuracoes WHERE barbeiro_id = ?', [barbeiro_id]);
    if (!config) return res.status(404).json({ erro: 'Esse barbeiro ainda não configurou o expediente.' });

    const [agendamentosDoDia] = await db.query(
      'SELECT hora_inicio, hora_fim FROM agendamentos WHERE barbeiro_id = ? AND data = ?',
      [barbeiro_id, data]
    );

    // new Date(data + 'T00:00:00') = meia-noite LOCAL do dia pedido — usado só
    // pra descobrir o dia da semana (getDay()), não pra formatar texto de data.
    const diaDaSemana = new Date(data + 'T00:00:00').getDay();

    const horarios = calcularHorariosDisponiveis({
      dataISO: data,
      diaDaSemana,
      config,
      duracaoServico: servico.duracao_minutos,
      agendamentosDoDia,
      agora: new Date(),
    });

    res.json({ horarios, duracao_minutos: servico.duracao_minutos });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao calcular horários disponíveis.' });
  }
});

module.exports = router;
