// Script para criar um barbeiro no banco de dados (com expediente padrão).
// Rodar com: npm run criar-barbeiro
const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../db/db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const perguntar = (texto) => new Promise((resolve) => rl.question(texto, resolve));

async function main() {
  console.log('=== Criar novo barbeiro ===');
  const nome = await perguntar('Nome: ');
  const email = await perguntar('Email: ');
  const senha = await perguntar('Senha: ');
  rl.close();

  const senha_hash = await bcrypt.hash(senha, 10);

  try {
    const [resultado] = await db.query(
      'INSERT INTO barbeiros (nome, email, senha_hash) VALUES (?, ?, ?)',
      [nome, email, senha_hash]
    );

    // Cria um expediente padrão: segunda a sábado, 9h às 19h, sessões de 1h.
    // O barbeiro pode mudar isso depois no painel.
    await db.query(
      `INSERT INTO configuracoes (barbeiro_id, dias_semana, hora_abertura, hora_fechamento, duracao_minutos)
       VALUES (?, '1,2,3,4,5,6', '09:00:00', '19:00:00', 60)`,
      [resultado.insertId]
    );

    console.log(`Barbeiro "${nome}" criado com sucesso! Já pode fazer login no painel.`);
    console.log('Expediente padrão: seg-sáb, 9h-19h, sessões de 1h (pode alterar no painel depois).');
  } catch (erro) {
    console.error('Erro ao criar barbeiro:', erro.message);
  } finally {
    process.exit();
  }
}

main();
