const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { calcularGradeDoDia } = require('../utils/grade');

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

// GET /api/disponibilidade?barbeiro_id=1&data_inicio=2026-07-20&data_fim=2026-07-26
// Calcula, dia a dia, quais horários existem (a partir da configuração de expediente)
// e o status de cada um (disponivel / reservado / bloqueado).
// NÃO devolve nome/telefone do cliente aqui — isso só aparece pro barbeiro logado.
router.get('/disponibilidade', async (req, res) => {
  const { barbeiro_id, data_inicio, data_fim } = req.query;
  if (!barbeiro_id || !data_inicio || !data_fim) {
    return res.status(400).json({ erro: 'Informe barbeiro_id, data_inicio e data_fim.' });
  }

  try {
    const [[config]] = await db.query('SELECT * FROM configuracoes WHERE barbeiro_id = ?', [barbeiro_id]);
    if (!config) {
      return res.status(404).json({ erro: 'Esse barbeiro ainda não configurou o expediente.' });
    }

    const [agendamentos] = await db.query(
      `SELECT id, data, hora_inicio, tipo FROM agendamentos
       WHERE barbeiro_id = ? AND data BETWEEN ? AND ?`,
      [barbeiro_id, data_inicio, data_fim]
    );

    const resultado = [];
    const cursor = new Date(data_inicio + 'T00:00:00');
    const fim = new Date(data_fim + 'T00:00:00');

    while (cursor <= fim) {
      const dataISO = cursor.toISOString().split('T')[0];
      const agendamentosDoDia = agendamentos.filter(a => a.data.toISOString().split('T')[0] === dataISO);
      const grade = calcularGradeDoDia(dataISO, cursor.getDay(), config, agendamentosDoDia);
      resultado.push(...grade.map(({ agendamento_id, ...resto }) => resto)); // esconde o id do agendamento do cliente
      cursor.setDate(cursor.getDate() + 1);
    }

    res.json(resultado);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao calcular horários disponíveis.' });
  }
});

module.exports = router;
