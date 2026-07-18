# Sistema de Reservas — Barbearia

Site de agendamento sem cadastro para clientes + painel de gestão para o(s) barbeiro(s).

## O que já foi testado e funciona
- Cliente reserva escolhendo apenas nome, telefone e horário (sem login)
- Não deixa dois clientes reservarem o mesmo horário ao mesmo tempo
- Barbeiro faz login e vê a agenda da semana
- Barbeiro gera horários de atendimento em lote (ex: toda seg-sáb, 9h-19h, blocos de 30min)
- Barbeiro bloqueia um horário (folga) e desbloqueia depois
- Barbeiro cancela uma reserva existente
- Barbeiro troca uma reserva de horário

## 1. Pré-requisitos
- Node.js instalado ([nodejs.org](https://nodejs.org))
- MySQL instalado e rodando

## 2. Configurar o banco de dados
Abra um terminal na pasta do projeto e rode:

```bash
mysql -u root -p < db/schema.sql
```

Isso cria o banco `barbearia` com as 3 tabelas (`barbeiros`, `horarios`, `reservas`).

## 3. Configurar as variáveis de ambiente
Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Abra o `.env` e preencha com os dados do SEU MySQL (usuário, senha) e invente um texto
qualquer, grande e aleatório, para `JWT_SECRET`.

## 4. Instalar as dependências e rodar

```bash
npm install
npm start
```

Se aparecer `Servidor rodando em http://localhost:3000`, deu certo.

## 5. Criar o primeiro barbeiro
Em outro terminal (com o servidor rodando ou não, tanto faz):

```bash
npm run criar-barbeiro
```

Vai perguntar nome, email e senha. Esse será o login do barbeiro no painel.
Repita esse comando pra cada barbeiro que a barbearia tiver.

## 6. Acessar
- **Site do cliente (reservas):** http://localhost:3000
- **Painel do barbeiro:** http://localhost:3000/barbeiro/login.html

## Fluxo de uso recomendado
1. Barbeiro cria a conta (`npm run criar-barbeiro`)
2. Barbeiro faz login no painel → aba **"Gerar horários"** → define a grade da semana (dias, horário de início/fim, duração de cada corte) → clica em Gerar
3. Os clientes já conseguem ver e reservar esses horários no site
4. Quando o barbeiro quiser folga, algum imprevisto ou cancelar alguém: aba **"Agenda"** → clica no horário → escolhe a ação

## Estrutura do projeto
```
barbearia-app/
├── db/schema.sql          → estrutura do banco de dados
├── db/db.js                → conexão com o MySQL
├── middleware/auth.js       → protege as rotas do barbeiro (exige login)
├── routes/auth.js           → login do barbeiro
├── routes/horarios.js       → rotas públicas (ver barbeiros e horários)
├── routes/reservas.js       → rota pública (cliente reservar)
├── routes/barbeiro.js       → rotas protegidas (gerar/bloquear/cancelar/mover)
├── scripts/criar-barbeiro.js→ cria um login de barbeiro via terminal
├── server.js                → arquivo principal, junta tudo
├── public/                  → site do cliente (HTML/CSS/JS)
└── barbeiro/                → painel do barbeiro (HTML/CSS/JS)
```

## Colocando no ar (deploy)
Quando quiser publicar de verdade (não só rodar no seu computador), você vai
precisar de um serviço que hospede Node.js + MySQL. Opções simples e com plano
gratuito/barato: Railway, Render ou um VPS como DigitalOcean. Posso te ajudar
com isso quando chegar nessa etapa — é um passo à parte da programação em si.

## Próximos passos possíveis (se quiser evoluir depois)
- Enviar confirmação por WhatsApp/SMS automaticamente
- Mais de um serviço por barbeiro (corte, barba, etc, com durações diferentes)
- Tela de "meus agendamentos" pro cliente ver/cancelar pelo telefone
