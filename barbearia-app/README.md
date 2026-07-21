# Sistema de Reservas — Barbearia

Site de agendamento sem cadastro para clientes + painel com calendário completo
(Ano/Mês/Semana/Dia) para o(s) barbeiro(s) gerenciar.

## Como funciona agora
- Você define o **expediente** uma vez (dias de atendimento, horário de abertura/fechamento,
  duração de cada corte). Os horários disponíveis são calculados automaticamente — não
  precisa mais "gerar" horário por horário.
- Cada sessão dura o tempo que você configurar (padrão: 1 hora).
- No calendário do painel: clique e arraste num horário livre pra **bloquear** (folga) ou
  **marcar um cliente na mão**; clique num evento existente pra **cancelar/desbloquear**;
  **arraste** um evento pra outro horário pra movê-lo.
- O cliente só vê e escolhe entre os horários que estão realmente livres — o que está
  reservado ou bloqueado simplesmente não aparece como opção pra ele.

## 1. Pré-requisitos
- Node.js instalado
- MySQL instalado e rodando

## 2. Banco de dados
```
mysql -u root -p < db/schema.sql
```
⚠️ Se você já tinha rodado a versão anterior deste projeto, este comando novo
**apaga as tabelas antigas** (`horarios`, `reservas`) e cria o novo modelo
(`agendamentos`, `configuracoes`). Reservas de teste antigas serão perdidas —
tudo bem, pois é a estrutura nova.

## 3. Variáveis de ambiente
```
cp .env.example .env
```
Edite o `.env` com o usuário/senha do seu MySQL e um `JWT_SECRET` qualquer, grande e aleatório.

## 4. Instalar e rodar
```
npm install
npm start
```

## 5. Criar o barbeiro
```
npm run criar-barbeiro
```
Isso já cria um expediente padrão (seg-sáb, 9h-19h, sessões de 1h) — o barbeiro
pode mudar isso a qualquer momento clicando em **"Expediente"** dentro do painel.

## 6. Acessar
- **Site do cliente:** http://localhost:3000
- **Painel do barbeiro:** http://localhost:3000/barbeiro/login.html

## Estrutura do projeto
```
barbearia-app/
├── db/schema.sql             → estrutura do banco (agendamentos, configuracoes, barbeiros)
├── db/db.js                  → conexão com o MySQL
├── utils/grade.js            → calcula os horários do dia a partir do expediente
├── middleware/auth.js        → protege as rotas do barbeiro
├── routes/auth.js            → login do barbeiro
├── routes/horarios.js        → rotas públicas (barbeiros e disponibilidade)
├── routes/reservas.js        → rota pública (cliente reservar)
├── routes/barbeiro.js        → rotas protegidas (expediente + calendário)
├── scripts/criar-barbeiro.js → cria um barbeiro + expediente padrão
├── server.js                 → arquivo principal
├── public/                   → site do cliente
└── barbeiro/                 → painel do barbeiro (calendário com FullCalendar)
```

O painel usa a biblioteca gratuita **FullCalendar** (carregada via internet, direto
no HTML) — por isso o computador que abrir o painel precisa estar conectado à internet.

## Colocando no ar (deploy)
Railway ou Render são bons pontos de partida — hospedam Node.js + MySQL juntos e
têm plano gratuito/barato. Me chama quando quiser fazer isso, te guio passo a passo.
