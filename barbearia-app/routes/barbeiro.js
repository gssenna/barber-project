const express = require('express');
const router = express.Router();
const db = require('../db/db');
const verificarLogin = require('../middleware/auth');
const { paraMinutos, paraHoraTexto } = require('../utils/grade');

router.use(verificarLogin); // todas as rotas daqui pra baixo exigem login

// ===== Configuração do expediente =====

// GET /api/barbeiro/configuracao
router.get('/configuracao', async (req, res) => {
  try {
    const [[config]] = await db.query('SELECT * FROM configuracoes WHERE barbeiro_id = ?', [req.barbeiroId]);
    res.json(config || null);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar configuração.' });
  }
});

// PUT /api/barbeiro/configuracao
// Body: { dias_semana: [1,2,3,4,5,6], hora_abertura: "09:00", hora_fechamento: "19:00", duracao_minutos: 60 }
router.put('/configuracao', async (req, res) => {
  const { dias_semana, hora_abertura, hora_fechamento, duracao_minutos } = req.body;
  if (!dias_semana || !hora_abertura || !hora_fechamento || !duracao_minutos) {
    return res.status(400).json({ erro: 'Preencha todos os campos do expediente.' });
  }
  try {
    await db.query(
      `INSERT INTO configuracoes (barbeiro_id, dias_semana, hora_abertura, hora_fechamento, duracao_minutos)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE dias_semana=?, hora_abertura=?, hora_fechamento=?, duracao_minutos=?`,
      [req.barbeiroId, dias_semana.join(','), hora_abertura, hora_fechamento, duracao_minutos,
       dias_semana.join(','), hora_abertura, hora_fechamento, duracao_minutos]
    );
    res.json({ mensagem: 'Expediente atualizado.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao salvar configuração.' });
  }
});

// ===== Agendamentos (eventos do calendário) =====

// GET /api/barbeiro/agendamentos?data_inicio=...&data_fim=...
// Devolve só os eventos reais (reservas e bloqueios) — horários livres não têm linha,
// então não precisam ser listados aqui (o calendário já sabe o que é expediente).
router.get('/agendamentos', async (req, res) => {
  const { data_inicio, data_fim } = req.query;
  try {
    const [agendamentos] = await db.query(
      `SELECT * FROM agendamentos WHERE barbeiro_id = ? AND data BETWEEN ? AND ? ORDER BY data, hora_inicio`,
      [req.barbeiroId, data_inicio, data_fim]
    );
    res.json(agendamentos);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar agendamentos.' });
  }
});

// POST /api/barbeiro/agendamentos
// O barbeiro cria um bloqueio OU já cria uma reserva direto (cliente que ligou, por ex.)
// Body: { data, hora_inicio, tipo: "bloqueado"|"reservado", nome_cliente?, telefone_cliente? }
router.post('/agendamentos', async (req, res) => {
  const { data, hora_inicio, tipo, nome_cliente, telefone_cliente } = req.body;

  if (!data || !hora_inicio || !tipo) {
    return res.status(400).json({ erro: 'Informe data, horário e o tipo (bloquear ou reservar).' });
  }
  if (tipo === 'reservado' && (!nome_cliente || !telefone_cliente)) {
    return res.status(400).json({ erro: 'Pra reservar, informe nome e telefone do cliente.' });
  }

  try {
    const [[config]] = await db.query('SELECT * FROM configuracoes WHERE barbeiro_id = ?', [req.barbeiroId]);
    const horaFim = paraHoraTexto(paraMinutos(hora_inicio) + config.duracao_minutos);

    await db.query(
      `INSERT INTO agendamentos (barbeiro_id, data, hora_inicio, hora_fim, tipo, nome_cliente, telefone_cliente)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.barbeiroId, data, hora_inicio, horaFim, tipo, nome_cliente || null, telefone_cliente || null]
    );
    res.status(201).json({ mensagem: 'Horário atualizado no calendário.' });
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Já existe algo marcado nesse horário.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao salvar no calendário.' });
  }
});

// PUT /api/barbeiro/agendamentos/:id
// Usado tanto pra EDITAR dados quanto pra MOVER (arrastar no calendário) um agendamento.
// Body: { data, hora_inicio }
router.put('/agendamentos/:id', async (req, res) => {
  const { id } = req.params;
  const { data, hora_inicio } = req.body;

  if (!data || !hora_inicio) {
    return res.status(400).json({ erro: 'Informe a nova data e horário.' });
  }

  try {
    const [[agendamento]] = await db.query(
      'SELECT * FROM agendamentos WHERE id = ? AND barbeiro_id = ?', [id, req.barbeiroId]
    );
    if (!agendamento) return res.status(404).json({ erro: 'Agendamento não encontrado.' });

    const [[config]] = await db.query('SELECT * FROM configuracoes WHERE barbeiro_id = ?', [req.barbeiroId]);
    const horaFim = paraHoraTexto(paraMinutos(hora_inicio) + config.duracao_minutos);

    await db.query('UPDATE agendamentos SET data = ?, hora_inicio = ?, hora_fim = ? WHERE id = ?', [data, hora_inicio, horaFim, id]);
    res.json({ mensagem: 'Movido com sucesso.' });
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Já existe algo marcado nesse novo horário.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao mover.' });
  }
});

// DELETE /api/barbeiro/agendamentos/:id
// Serve tanto pra CANCELAR uma reserva quanto pra DESBLOQUEAR um horário —
// nos dois casos, o resultado é o mesmo: o horário volta a ficar livre.
router.delete('/agendamentos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [resultado] = await db.query('DELETE FROM agendamentos WHERE id = ? AND barbeiro_id = ?', [id, req.barbeiroId]);
    if (resultado.affectedRows === 0) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    res.json({ mensagem: 'Removido. O horário está livre novamente.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover.' });
  }
});

module.exports = router;
