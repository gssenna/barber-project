// Esse middleware roda ANTES das rotas protegidas do barbeiro.
// Ele verifica se veio um token válido no cabeçalho da requisição.
const jwt = require('jsonwebtoken');
require('dotenv').config();

function verificarLogin(req, res, next) {
  const cabecalho = req.headers.authorization; // formato esperado: "Bearer <token>"

  if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Você precisa estar logado.' });
  }

  const token = cabecalho.split(' ')[1];

  try {
    const dados = jwt.verify(token, process.env.JWT_SECRET);
    req.barbeiroId = dados.id; // deixa disponível pras próximas funções da rota
    next();
  } catch (erro) {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}

module.exports = verificarLogin;
