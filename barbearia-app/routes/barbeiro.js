const express = require('express');
const router = express.Router();
const db = require('../db/db');
const verificarLogin = require('../middleware/auth');

// Todas as rotas abaixo exigem login (o middleware roda antes de cada uma)
router.use(verificarLogin);

// GET /api/barbeiro/horarios?data_inicio=...&data_fim=...
// Igual à rota pública, mas já filtra pelo barbeiro logado e traz dados da reserva (nome/telefone)
router.get('/horarios', async (req, res) => {
  const { data_inicio, data_fim } = req.query;
  try {
    const [horarios] = await db.query(
      `SELECT h.id, h.data, h.hora_inicio, h.hora_fim, h.status,
              r.id AS reserva_id, r.nome_cliente, r.telefone_cliente
       FROM horarios h
       LEFT JOIN reservas r ON r.horario_id = h.id
       WHERE h.barbeiro_id = ? AND h.data BETWEEN ? AND ?
       ORDER BY h.data, h.hora_inicio`,
      [req.barbeiroId, data_inicio, data_fim]
    );
    res.json(horarios);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar horários.' });
  }
});

// POST /api/barbeiro/horarios/gerar
// Cria os horários da semana de uma vez, com base numa "grade" simples.
// Body: { data_inicio, dias: [0,1,2,3,4,5] (0=domingo...6=sábado), hora_inicio: "09:00", hora_fim: "19:00", duracao_minutos: 30 }
router.post('/horarios/gerar', async (req, res) => {
  const { data_inicio, dias, hora_inicio, hora_fim, duracao_minutos } = req.body;

  if (!data_inicio || !dias || !hora_inicio || !hora_fim || !duracao_minutos) {
    return res.status(400).json({ erro: 'Preencha todos os campos da grade de horários.' });
  }

  try {
    const inicioSemana = new Date(data_inicio + 'T00:00:00');
    const linhasParaInserir = [];

    // Percorre 7 dias a partir da data_inicio, e só gera horário nos dias marcados
    for (let i = 0; i < 7; i++) {
      const dia = new Date(inicioSemana);
      dia.setDate(dia.getDate() + i);
      const diaDaSemana = dia.getDay(); // 0-6

      if (!dias.includes(diaDaSemana)) continue;

      const dataFormatada = dia.toISOString().split('T')[0];

      // Gera os blocos de horário dentro do intervalo (ex: 09:00, 09:30, 10:00...)
      let [h, m] = hora_inicio.split(':').map(Number);
      const [hFim, mFim] = hora_fim.split(':').map(Number);

      while (h < hFim || (h === hFim && m < mFim)) {
        const horaInicioBloco = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        m += duracao_minutos;
        while (m >= 60) { m -= 60; h += 1; }
        const horaFimBloco = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

        linhasParaInserir.push([req.barbeiroId, dataFormatada, horaInicioBloco, horaFimBloco]);
      }
    }

    if (linhasParaInserir.length === 0) {
      return res.status(400).json({ erro: 'Nenhum horário foi gerado. Confira os dias e horários.' });
    }

    // INSERT IGNORE evita erro se um horário já existir (por causa do UNIQUE KEY no schema)
    await db.query(
      'INSERT IGNORE INTO horarios (barbeiro_id, data, hora_inicio, hora_fim) VALUES ?',
      [linhasParaInserir]
    );

    res.status(201).json({ mensagem: `${linhasParaInserir.length} horários gerados com sucesso.` });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao gerar horários.' });
  }
});

// PUT /api/barbeiro/horarios/:id/bloquear
router.put('/horarios/:id/bloquear', async (req, res) => {
  await mudarStatus(req, res, 'bloqueado', ['disponivel']);
});

// PUT /api/barbeiro/horarios/:id/desbloquear
router.put('/horarios/:id/desbloquear', async (req, res) => {
  await mudarStatus(req, res, 'disponivel', ['bloqueado']);
});

// Função auxiliar: só troca o status se o horário for do barbeiro logado
// e estiver num dos status permitidos (evita, por ex, bloquear um horário já reservado sem cancelar antes)
async function mudarStatus(req, res, novoStatus, statusPermitidos) {
  const { id } = req.params;
  try {
    const [linhas] = await db.query(
      'SELECT status FROM horarios WHERE id = ? AND barbeiro_id = ?',
      [id, req.barbeiroId]
    );
    if (linhas.length === 0) {
      return res.status(404).json({ erro: 'Horário não encontrado.' });
    }
    if (!statusPermitidos.includes(linhas[0].status)) {
      return res.status(409).json({ erro: `Não é possível fazer essa ação com o horário no status "${linhas[0].status}".` });
    }
    await db.query('UPDATE horarios SET status = ? WHERE id = ?', [novoStatus, id]);
    res.json({ mensagem: 'Horário atualizado.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar horário.' });
  }
}

// DELETE /api/barbeiro/reservas/:id
// Cancela a reserva e devolve o horário pra "disponivel"
router.delete('/reservas/:id', async (req, res) => {
  const { id } = req.params;
  const conexao = await db.getConnection();
  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.query(
      `SELECT r.id, h.id AS horario_id FROM reservas r
       JOIN horarios h ON h.id = r.horario_id
       WHERE r.id = ? AND h.barbeiro_id = ?`,
      [id, req.barbeiroId]
    );

    if (linhas.length === 0) {
      await conexao.rollback();
      return res.status(404).json({ erro: 'Reserva não encontrada.' });
    }

    await conexao.query('DELETE FROM reservas WHERE id = ?', [id]);
    await conexao.query('UPDATE horarios SET status = "disponivel" WHERE id = ?', [linhas[0].horario_id]);

    await conexao.commit();
    res.json({ mensagem: 'Reserva cancelada.' });
  } catch (erro) {
    await conexao.rollback();
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cancelar reserva.' });
  } finally {
    conexao.release();
  }
});

// PUT /api/barbeiro/reservas/:id/mover
// Move uma reserva existente para outro horário (que precisa estar livre)
// Body: { novo_horario_id }
router.put('/reservas/:id/mover', async (req, res) => {
  const { id } = req.params;
  const { novo_horario_id } = req.body;

  if (!novo_horario_id) {
    return res.status(400).json({ erro: 'Informe o novo horário.' });
  }

  const conexao = await db.getConnection();
  try {
    await conexao.beginTransaction();

    const [reservaAtual] = await conexao.query(
      `SELECT r.id, h.id AS horario_antigo_id FROM reservas r
       JOIN horarios h ON h.id = r.horario_id
       WHERE r.id = ? AND h.barbeiro_id = ?`,
      [id, req.barbeiroId]
    );
    if (reservaAtual.length === 0) {
      await conexao.rollback();
      return res.status(404).json({ erro: 'Reserva não encontrada.' });
    }

    const [novoHorario] = await conexao.query(
      'SELECT status FROM horarios WHERE id = ? AND barbeiro_id = ? FOR UPDATE',
      [novo_horario_id, req.barbeiroId]
    );
    if (novoHorario.length === 0) {
      await conexao.rollback();
      return res.status(404).json({ erro: 'Novo horário não encontrado.' });
    }
    if (novoHorario[0].status !== 'disponivel') {
      await conexao.rollback();
      return res.status(409).json({ erro: 'O novo horário não está disponível.' });
    }

    // Libera o horário antigo, ocupa o novo, e atualiza a reserva
    await conexao.query('UPDATE horarios SET status = "disponivel" WHERE id = ?', [reservaAtual[0].horario_antigo_id]);
    await conexao.query('UPDATE horarios SET status = "reservado" WHERE id = ?', [novo_horario_id]);
    await conexao.query('UPDATE reservas SET horario_id = ? WHERE id = ?', [novo_horario_id, id]);

    await conexao.commit();
    res.json({ mensagem: 'Reserva movida com sucesso.' });
  } catch (erro) {
    await conexao.rollback();
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao mover reserva.' });
  } finally {
    conexao.release();
  }
});

module.exports = router;
