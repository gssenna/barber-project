# Sistema de Reservas — Barbearia

Site de agendamento sem cadastro para clientes (com serviços, preços em euro e
duração de cada corte) + painel com calendário completo pro(s) barbeiro(s).

## Como funciona
- **Cliente**: escolhe o barbeiro → escolhe o serviço (com preço e duração) →
  escolhe data e horário (só aparecem horários realmente livres) → confirma com
  nome e telefone. Sem cadastro.
- **Barbeiro**: calendário com visão Ano/Mês/Semana/Dia. Clique num horário livre
  pra bloquear ou marcar um cliente na mão; clique num evento existente pra
  removê-lo; arraste um evento pra outro horário pra movê-lo; clique no ícone 🚫
  no topo de cada coluna (visão semana/dia) pra bloquear o dia inteiro de uma vez.
- **Faturamento**: botão "Faturamento" no painel mostra quantos agendamentos de
  cada serviço a semana atual teve, e o total em euros.

## Serviços (editáveis em `utils/servicos.js`)
| Serviço | Preço | Duração |
|---|---|---|
| Cabelo | €25 | 45 min |
| Barba | €20 | 30 min |
| Cabelo + Barba | €40 | 1h |
| Sobrancelha | €15 | 30 min |

Pra mudar preços/durações, edite o arquivo `utils/servicos.js` e reinicie o servidor.

## 1. Pré-requisitos
- Node.js instalado
- MySQL instalado e rodando

## 2. Banco de dados
```
mysql -u root -p < db/schema.sql
```
⚠️ Se você já tinha uma versão anterior rodando, isso recria as tabelas do zero
(perde reservas de teste antigas).

## 3. Variáveis de ambiente
```
cp .env.example .env
```
Edite com o usuário/senha do seu MySQL e um `JWT_SECRET` qualquer.

## 4. Instalar e rodar
```
npm install
npm start
```

## 5. Criar o barbeiro
```
npm run criar-barbeiro
```

## 6. Acessar
- **Site do cliente:** http://localhost:3000
- **Painel do barbeiro:** http://localhost:3000/barbeiro/login.html

## Estrutura do projeto
```
barbearia-app/
├── db/schema.sql             → estrutura do banco
├── db/db.js                  → conexão com o MySQL
├── utils/servicos.js         → lista de serviços (preço/duração)
├── utils/grade.js            → cálculo de horários disponíveis
├── utils/lock.js             → trava pra evitar reservas conflitantes
├── middleware/auth.js        → protege as rotas do barbeiro
├── routes/auth.js            → login do barbeiro
├── routes/horarios.js        → rotas públicas (barbeiros, serviços, disponibilidade)
├── routes/reservas.js        → rota pública (cliente reservar)
├── routes/barbeiro.js        → rotas protegidas (expediente, calendário, faturamento)
├── scripts/criar-barbeiro.js → cria um barbeiro + expediente padrão
├── server.js                 → arquivo principal
├── public/                   → site do cliente (fluxo em 3 passos)
└── barbeiro/                 → painel do barbeiro (calendário com FullCalendar)
```

O painel usa a biblioteca gratuita **FullCalendar**, carregada via internet —
por isso o computador que abrir o painel precisa estar conectado.

## Colocando no ar (deploy)
Railway ou Render são bons pontos de partida — hospedam Node.js + MySQL juntos e
têm plano gratuito/barato. Me chama quando quiser fazer isso.
