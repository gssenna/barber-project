const express = require('express');
const router = express.Router();
const db = require('../db/db');
const verificarLogin = require('../middleware/auth');
const { paraMinutos, paraHoraTexto, seSobrepoe } = require('../utils/grade');
const { comTravaDaAgenda } = require('../utils/lock');
const { SERVICOS } = require('../utils/servicos');

router.use(verificarLogin);

// ===== Configuração do expediente =====
router.get('/configuracao', async (req, res) => {
  try {
    const [[config]] = await db.query('SELECT * FROM configuracoes WHERE barbeiro_id = ?', [req.barbeiroId]);
    res.json(config || null);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar configuração.' });
  }
});

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

// ===== Serviços (só leitura — lista fixa, ver utils/servicos.js) =====
router.get('/servicos', (req, res) => res.json(SERVICOS));

// ===== Agendamentos =====
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
// Body: { data, hora_inicio, tipo: "bloqueado"|"reservado", servico_id?, nome_cliente?, telefone_cliente?, email_cliente? }
// - Se "bloqueado": bloqueia um período com a duração padrão do expediente.
// - Se "reservado": o barbeiro está marcando um cliente na mão (ex: por telefone) —
//   nesse caso é preciso escolher o serviço, pra registrar duração e valor certinhos.
router.post('/agendamentos', async (req, res) => {
  const { data, hora_inicio, tipo, servico_id, nome_cliente, telefone_cliente, email_cliente } = req.body;

  if (!data || !hora_inicio || !tipo) {
    return res.status(400).json({ erro: 'Informe data, horário e o tipo (bloquear ou reservar).' });
  }

  let duracaoMinutos, servicoNome = null, servicoPreco = null;

  if (tipo === 'reservado') {
    if (!nome_cliente || !servico_id) {
  return res.status(400).json({ erro: 'Pra reservar, informe o serviço e o nome do cliente.' });
  }
    if (email_cliente && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_cliente)) {
      return res.status(400).json({ erro: 'Email inválido.' });
    }
    const servico = SERVICOS.find(s => s.id === servico_id);
    if (!servico) return res.status(400).json({ erro: 'Serviço inválido.' });
    duracaoMinutos = servico.duracao_minutos;
    servicoNome = servico.nome;
    servicoPreco = servico.preco;
  } else {
    const [[config]] = await db.query('SELECT duracao_minutos FROM configuracoes WHERE barbeiro_id = ?', [req.barbeiroId]);
    duracaoMinutos = config.duracao_minutos; // duração padrão de bloqueio manual, definida no Expediente
  }

  const inicioMin = paraMinutos(hora_inicio);
  const fimMin = inicioMin + duracaoMinutos;
  const horaFim = paraHoraTexto(fimMin);

  try {
    const resultado = await comTravaDaAgenda(req.barbeiroId, data, async (conexao) => {
      const [existentes] = await conexao.query(
        'SELECT hora_inicio, hora_fim FROM agendamentos WHERE barbeiro_id = ? AND data = ?',
        [req.barbeiroId, data]
      );
      const conflita = existentes.some(a => seSobrepoe(inicioMin, fimMin, paraMinutos(a.hora_inicio), paraMinutos(a.hora_fim)));
      if (conflita) return { ok: false };

      await conexao.query(
        `INSERT INTO agendamentos (barbeiro_id, data, hora_inicio, hora_fim, tipo, nome_cliente, telefone_cliente, email_cliente, servico_nome, servico_preco)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.barbeiroId, data, hora_inicio, horaFim, tipo, nome_cliente || null, telefone_cliente || null, email_cliente || null, servicoNome, servicoPreco]
      );
      return { ok: true };
    });

    if (!resultado.ok) return res.status(409).json({ erro: 'Já existe algo marcado nesse horário.' });
    res.status(201).json({ mensagem: 'Horário atualizado no calendário.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao salvar no calendário.' });
  }
});

// POST /api/barbeiro/bloquear-dia
// Body: { data }
// Bloqueia o dia inteiro de uma vez (do horário de abertura ao de fechamento).
router.post('/bloquear-dia', async (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ erro: 'Informe a data.' });

  try {
    const [[config]] = await db.query('SELECT * FROM configuracoes WHERE barbeiro_id = ?', [req.barbeiroId]);
    if (!config) return res.status(404).json({ erro: 'Configure o expediente primeiro.' });

    const resultado = await comTravaDaAgenda(req.barbeiroId, data, async (conexao) => {
      const [existentes] = await conexao.query(
        'SELECT tipo FROM agendamentos WHERE barbeiro_id = ? AND data = ?',
        [req.barbeiroId, data]
      );
      const temReserva = existentes.some(a => a.tipo === 'reservado');
      if (temReserva) return { ok: false, motivo: 'reservas' };

      // Remove bloqueios avulsos que já existiam nesse dia antes de criar o bloqueio do dia inteiro
      await conexao.query('DELETE FROM agendamentos WHERE barbeiro_id = ? AND data = ? AND tipo = "bloqueado"', [req.barbeiroId, data]);
      await conexao.query(
        `INSERT INTO agendamentos (barbeiro_id, data, hora_inicio, hora_fim, tipo)
         VALUES (?, ?, ?, ?, 'bloqueado')`,
        [req.barbeiroId, data, config.hora_abertura, config.hora_fechamento]
      );
      return { ok: true };
    });

    if (!resultado.ok) {
      return res.status(409).json({ erro: 'Esse dia já tem reservas de clientes. Cancele-as antes de bloquear o dia inteiro.' });
    }
    res.status(201).json({ mensagem: 'Dia inteiro bloqueado.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao bloquear o dia.' });
  }
});

// PUT /api/barbeiro/agendamentos/:id — usado pra mover (arrastar) um agendamento
router.put('/agendamentos/:id', async (req, res) => {
  const { id } = req.params;
  const { data, hora_inicio } = req.body;
  if (!data || !hora_inicio) return res.status(400).json({ erro: 'Informe a nova data e horário.' });

  try {
    const [[agendamento]] = await db.query('SELECT * FROM agendamentos WHERE id = ? AND barbeiro_id = ?', [id, req.barbeiroId]);
    if (!agendamento) return res.status(404).json({ erro: 'Agendamento não encontrado.' });

    const duracaoMinutos = paraMinutos(agendamento.hora_fim) - paraMinutos(agendamento.hora_inicio);
    const inicioMin = paraMinutos(hora_inicio);
    const fimMin = inicioMin + duracaoMinutos;
    const horaFim = paraHoraTexto(fimMin);

    const resultado = await comTravaDaAgenda(req.barbeiroId, data, async (conexao) => {
      const [existentes] = await conexao.query(
        'SELECT id, hora_inicio, hora_fim FROM agendamentos WHERE barbeiro_id = ? AND data = ? AND id != ?',
        [req.barbeiroId, data, id]
      );
      const conflita = existentes.some(a => seSobrepoe(inicioMin, fimMin, paraMinutos(a.hora_inicio), paraMinutos(a.hora_fim)));
      if (conflita) return { ok: false };

      await conexao.query('UPDATE agendamentos SET data = ?, hora_inicio = ?, hora_fim = ? WHERE id = ?', [data, hora_inicio, horaFim, id]);
      return { ok: true };
    });

    if (!resultado.ok) return res.status(409).json({ erro: 'Já existe algo marcado nesse novo horário.' });
    res.json({ mensagem: 'Movido com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao mover.' });
  }
});

// DELETE /api/barbeiro/agendamentos/:id
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

// ===== Faturamento da semana =====
// GET /api/barbeiro/resumo-semana
// Sempre calcula a semana (domingo a sábado) que contém a data de hoje.
router.get('/resumo-semana', async (req, res) => {
  try {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);

    const formatar = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dataInicioISO = formatar(inicioSemana);
    const dataFimISO = formatar(fimSemana);

    const [linhas] = await db.query(
      `SELECT servico_nome, servico_preco FROM agendamentos
       WHERE barbeiro_id = ? AND tipo = 'reservado' AND data BETWEEN ? AND ?`,
      [req.barbeiroId, dataInicioISO, dataFimISO]
    );

    const porServico = {};
    let totalGeral = 0;
    linhas.forEach(l => {
      const nome = l.servico_nome || 'Outro';
      const preco = Number(l.servico_preco) || 0;
      if (!porServico[nome]) porServico[nome] = { quantidade: 0, total: 0 };
      porServico[nome].quantidade += 1;
      porServico[nome].total += preco;
      totalGeral += preco;
    });

    res.json({
      data_inicio: dataInicioISO,
      data_fim: dataFimISO,
      por_servico: porServico,
      total_geral: totalGeral,
      total_agendamentos: linhas.length,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao calcular o faturamento.' });
  }
});

module.exports = router;
