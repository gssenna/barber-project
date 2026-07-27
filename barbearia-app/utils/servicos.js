// Lista de serviços oferecidos. Por enquanto é fixa (definida aqui no código);
// se no futuro quiser deixar o barbeiro editar preços pelo painel, é só transformar
// isso numa tabela no banco — a estrutura do resto do sistema já foi pensada pra isso.
const SERVICOS = [
  { id: 'cabelo', nome: 'Cabelo', preco: 25, duracao_minutos: 45 },
  { id: 'barba', nome: 'Barba', preco: 20, duracao_minutos: 30 },
  { id: 'cabelo_barba', nome: 'Cabelo + Barba', preco: 40, duracao_minutos: 60 },
  { id: 'sobrancelha', nome: 'Sobrancelha', preco: 15, duracao_minutos: 30 },
];

function buscarServico(id) {
  return SERVICOS.find(s => s.id === id) || null;
}

module.exports = { SERVICOS, buscarServico };
