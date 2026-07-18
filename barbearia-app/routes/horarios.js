const express = require('express');
const router = express.Router();
const db = require('../db/db');

// GET /api/barbeiros
// Lista os barbeiros disponíveis (pra escolher, se a barbearia tiver mais de um)
router.get('/barbeiros', async (req, res) => {
  try {
    const [barbeiros] = await db.query('SELECT id, nome FROM barbeiros');
    res.json(barbeiros);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar barbeiros.' });
  }
});

// GET /api/horarios?barbeiro_id=1&data_inicio=2026-07-20&data_fim=2026-07-26
// Devolve os horários de um barbeiro num intervalo de datas (pra montar a grade da semana)
router.get('/horarios', async (req, res) => {
  const { barbeiro_id, data_inicio, data_fim } = req.query;

  if (!barbeiro_id || !data_inicio || !data_fim) {
    return res.status(400).json({ erro: 'Informe barbeiro_id, data_inicio e data_fim.' });
  }

  try {
    const [horarios] = await db.query(
      `SELECT id, data, hora_inicio, hora_fim, status
       FROM horarios
       WHERE barbeiro_id = ? AND data BETWEEN ? AND ?
       ORDER BY data, hora_inicio`,
      [barbeiro_id, data_inicio, data_fim]
    );
    res.json(horarios);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar horários.' });
  }
});

module.exports = router;
