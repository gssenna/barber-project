const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { paraMinutos, paraHoraTexto } = require('../utils/grade');

// POST /api/reservas
// Body: { barbeiro_id, data, hora_inicio, nome, telefone }
// Não pede login nem cadastro — só esses dados.
router.post('/', async (req, res) => {
  const { barbeiro_id, data, hora_inicio, nome, telefone } = req.body;

  if (!barbeiro_id || !data || !hora_inicio || !nome || !telefone) {
    return res.status(400).json({ erro: 'Preencha nome, telefone e escolha um horário.' });
  }

  try {
    const [[config]] = await db.query('SELECT * FROM configuracoes WHERE barbeiro_id = ?', [barbeiro_id]);
    if (!config) {
      return res.status(404).json({ erro: 'Barbeiro não encontrado.' });
    }

    // Confere se esse horário realmente existe dentro do expediente configurado
    const diaDaSemana = new Date(data + 'T00:00:00').getDay();
    const diasPermitidos = config.dias_semana.split(',').map(Number);
    const minutosInicio = paraMinutos(hora_inicio);
    const dentroExpediente =
      diasPermitidos.includes(diaDaSemana) &&
      minutosInicio >= paraMinutos(config.hora_abertura) &&
      minutosInicio + config.duracao_minutos <= paraMinutos(config.hora_fechamento) &&
      (minutosInicio - paraMinutos(config.hora_abertura)) % config.duracao_minutos === 0;

    if (!dentroExpediente) {
      return res.status(400).json({ erro: 'Esse horário não faz parte do expediente do barbeiro.' });
    }

    const horaFim = paraHoraTexto(minutosInicio + config.duracao_minutos);

    // O UNIQUE KEY (barbeiro_id, data, hora_inicio) no banco garante que, mesmo se
    // dois clientes clicarem ao mesmo tempo, só o primeiro INSERT terá sucesso.
    await db.query(
      `INSERT INTO agendamentos (barbeiro_id, data, hora_inicio, hora_fim, tipo, nome_cliente, telefone_cliente)
       VALUES (?, ?, ?, ?, 'reservado', ?, ?)`,
      [barbeiro_id, data, hora_inicio, horaFim, nome, telefone]
    );

    res.status(201).json({ mensagem: 'Reserva confirmada!' });
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Esse horário acabou de ficar indisponível. Escolha outro.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar a reserva.' });
  }
});

module.exports = router;
