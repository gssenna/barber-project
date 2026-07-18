// Script para criar um barbeiro no banco de dados.
// Rodar com: npm run criar-barbeiro
// Vai perguntar nome, email e senha no terminal.
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
    await db.query(
      'INSERT INTO barbeiros (nome, email, senha_hash) VALUES (?, ?, ?)',
      [nome, email, senha_hash]
    );
    console.log(`Barbeiro "${nome}" criado com sucesso! Já pode fazer login no painel.`);
  } catch (erro) {
    console.error('Erro ao criar barbeiro:', erro.message);
  } finally {
    process.exit();
  }
}

main();
