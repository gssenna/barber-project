const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db/db');
require('dotenv').config();

// POST /api/auth/login
// Recebe email + senha, devolve um token se estiver correto
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe email e senha.' });
  }

  try {
    const [linhas] = await db.query('SELECT * FROM barbeiros WHERE email = ?', [email]);
    const barbeiro = linhas[0];

    if (!barbeiro) {
      return res.status(401).json({ erro: 'Email ou senha incorretos.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, barbeiro.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Email ou senha incorretos.' });
    }

    const token = jwt.sign(
      { id: barbeiro.id, nome: barbeiro.nome },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, nome: barbeiro.nome, id: barbeiro.id });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro no servidor ao tentar logar.' });
  }
});

module.exports = router;
