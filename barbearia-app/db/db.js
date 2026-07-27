// Cria UM pool de conexões com o MySQL, reaproveitado em todo o projeto.
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'barbearia',
  waitForConnections: true,
  connectionLimit: 10,
  // Importante: sem isso, o driver converte colunas DATE/DATETIME em objetos Date
  // do JavaScript, que aplicam fuso horário e podem "voltar" um dia dependendo de
  // onde o servidor está rodando. Com dateStrings, vem sempre como texto puro
  // ("2026-07-25"), sem conversão nenhuma — sem essa fonte de bug.
  dateStrings: true,
});

module.exports = pool;
