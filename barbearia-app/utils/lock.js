// Trava nomeada do MySQL: garante que só uma requisição por vez mexe na agenda
// de um barbeiro num dia específico, evitando que dois clientes cliquem ao
// mesmo tempo e os dois consigam reservar horários que se sobrepõem.
const db = require('../db/db');

async function comTravaDaAgenda(barbeiroId, dataISO, funcao) {
  const chave = `agenda_${barbeiroId}_${dataISO}`;
  const conexao = await db.getConnection();
  try {
    await conexao.query('SELECT GET_LOCK(?, 10)', [chave]);
    return await funcao(conexao);
  } finally {
    await conexao.query('SELECT RELEASE_LOCK(?)', [chave]);
    conexao.release();
  }
}

module.exports = { comTravaDaAgenda };
