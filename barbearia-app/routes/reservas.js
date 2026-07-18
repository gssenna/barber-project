const express = require('express');
const router = express.Router();
const db = require('../db/db');

// POST /api/reservas
// Body: { horario_id, nome, telefone }
// Não pede login nem cadastro — só esses 3 dados.
router.post('/', async (req, res) => {
  const { horario_id, nome, telefone } = req.body;

  if (!horario_id || !nome || !telefone) {
    return res.status(400).json({ erro: 'Preencha nome, telefone e escolha um horário.' });
  }

  // Usamos uma transação + "FOR UPDATE" pra evitar que dois clientes
  // reservem o MESMO horário ao mesmo tempo (condição de corrida).
  const conexao = await db.getConnection();
  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.query(
      'SELECT status FROM horarios WHERE id = ? FOR UPDATE',
      [horario_id]
    );

    if (linhas.length === 0) {
      await conexao.rollback();
      return res.status(404).json({ erro: 'Horário não encontrado.' });
    }

    if (linhas[0].status !== 'disponivel') {
      await conexao.rollback();
      return res.status(409).json({ erro: 'Esse horário acabou de ficar indisponível. Escolha outro.' });
    }

    await conexao.query('UPDATE horarios SET status = "reservado" WHERE id = ?', [horario_id]);
    await conexao.query(
      'INSERT INTO reservas (horario_id, nome_cliente, telefone_cliente) VALUES (?, ?, ?)',
      [horario_id, nome, telefone]
    );

    await conexao.commit();
    res.status(201).json({ mensagem: 'Reserva confirmada!' });
  } catch (erro) {
    await conexao.rollback();
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar a reserva.' });
  } finally {
    conexao.release();
  }
});

module.exports = router;
