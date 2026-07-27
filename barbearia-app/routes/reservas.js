const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { SERVICOS } = require('../utils/servicos');
const { paraMinutos, paraHoraTexto, seSobrepoe } = require('../utils/grade');
const { comTravaDaAgenda } = require('../utils/lock');

// POST /api/reservas
// Body: { barbeiro_id, servico_id, data, hora_inicio, nome, email, telefone }
router.post('/', async (req, res) => {
  const { barbeiro_id, servico_id, data, hora_inicio, nome, email, telefone } = req.body;

  if (!barbeiro_id || !servico_id || !data || !hora_inicio || !nome || !email || !telefone) {
    return res.status(400).json({ erro: 'Preencha nome, email, telefone, serviço e horário.' });
  }

  // Validação simples de email (mesma regra básica usada no navegador: precisa
  // ter algo, depois @, depois algo, depois um ponto e mais algo)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ erro: 'Informe um email válido.' });
  }
  if (!/^\+\d{1,3}\d{4,14}$/.test(telefone)) {
    return res.status(400).json({ erro: 'Informe um telefone válido.' });
  }

  const servico = SERVICOS.find(s => s.id === servico_id);
  if (!servico) return res.status(400).json({ erro: 'Serviço inválido.' });

  try {
    const [[config]] = await db.query('SELECT * FROM configuracoes WHERE barbeiro_id = ?', [barbeiro_id]);
    if (!config) return res.status(404).json({ erro: 'Barbeiro não encontrado.' });

    const diaDaSemana = new Date(data + 'T00:00:00').getDay();
    const diasPermitidos = config.dias_semana.split(',').map(Number);
    const inicioMin = paraMinutos(hora_inicio);
    const fimMin = inicioMin + servico.duracao_minutos;

    const dentroExpediente =
      diasPermitidos.includes(diaDaSemana) &&
      inicioMin >= paraMinutos(config.hora_abertura) &&
      fimMin <= paraMinutos(config.hora_fechamento);

    if (!dentroExpediente) {
      return res.status(400).json({ erro: 'Esse horário não faz parte do expediente do barbeiro.' });
    }

    const agora = new Date();
    const dataDeHojeISO = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
    const horaAgora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`;
    if (data < dataDeHojeISO || (data === dataDeHojeISO && hora_inicio <= horaAgora)) {
      return res.status(400).json({ erro: 'Esse horário já passou. Escolha outro.' });
    }

    const horaFim = paraHoraTexto(fimMin);

    // A trava garante que, mesmo se dois clientes clicarem no mesmo instante,
    // só um consegue de fato reservar — o segundo recebe um erro claro.
    const resultado = await comTravaDaAgenda(barbeiro_id, data, async (conexao) => {
      const [existentes] = await conexao.query(
        'SELECT hora_inicio, hora_fim FROM agendamentos WHERE barbeiro_id = ? AND data = ?',
        [barbeiro_id, data]
      );
      const conflita = existentes.some(a => seSobrepoe(inicioMin, fimMin, paraMinutos(a.hora_inicio), paraMinutos(a.hora_fim)));
      if (conflita) return { ok: false };

      await conexao.query(
        `INSERT INTO agendamentos (barbeiro_id, data, hora_inicio, hora_fim, tipo, nome_cliente, telefone_cliente, email_cliente, servico_nome, servico_preco)
         VALUES (?, ?, ?, ?, 'reservado', ?, ?, ?, ?, ?)`,
        [barbeiro_id, data, hora_inicio, horaFim, nome, telefone, email, servico.nome, servico.preco]
      );
      return { ok: true };
    });

    if (!resultado.ok) {
      return res.status(409).json({ erro: 'Esse horário acabou de ficar indisponível. Escolha outro.' });
    }

    res.status(201).json({ mensagem: 'Reserva confirmada!' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar a reserva.' });
  }
});

module.exports = router;
