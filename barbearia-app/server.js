const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/horarios'));       // públicas: /api/barbeiros e /api/disponibilidade
app.use('/api/reservas', require('./routes/reservas')); // pública: criar reserva
app.use('/api/barbeiro', require('./routes/barbeiro')); // protegidas: painel do barbeiro

// Serve as páginas do site (frontend)
app.use('/', express.static('public'));       // site do cliente (agendamento)
app.use('/barbeiro', express.static('barbeiro')); // painel do barbeiro

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
  console.log(`Painel do barbeiro em http://localhost:${PORTA}/barbeiro/login.html`);
});
