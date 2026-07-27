-- ============================================
-- Schema do banco de dados - Sistema de Reservas de Barbearia
-- ============================================
-- Como usar: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS barbearia CHARACTER SET utf8mb4;
USE barbearia;

DROP TABLE IF EXISTS agendamentos;
DROP TABLE IF EXISTS configuracoes;
DROP TABLE IF EXISTS reservas;  -- tabela do modelo antigo (versão anterior do projeto)
DROP TABLE IF EXISTS horarios;  -- tabela do modelo antigo (versão anterior do projeto)
DROP TABLE IF EXISTS barbeiros;

-- Um barbeiro = uma conta que pode logar no painel
CREATE TABLE barbeiros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configuração do expediente de cada barbeiro.
-- É a partir daqui que o sistema CALCULA quais horários existem — não precisa
-- mais "gerar" horário por horário toda semana.
CREATE TABLE configuracoes (
  barbeiro_id INT PRIMARY KEY,
  dias_semana VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5,6', -- 0=domingo ... 6=sábado
  hora_abertura TIME NOT NULL DEFAULT '09:00:00',
  hora_fechamento TIME NOT NULL DEFAULT '19:00:00',
  duracao_minutos INT NOT NULL DEFAULT 60,
  FOREIGN KEY (barbeiro_id) REFERENCES barbeiros(id) ON DELETE CASCADE
);

-- Cada linha aqui é UM evento real no calendário: uma reserva de cliente OU um
-- bloqueio (folga) do barbeiro. Horários "livres" simplesmente não têm linha aqui.
CREATE TABLE agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbeiro_id INT NOT NULL,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  tipo ENUM('reservado', 'bloqueado') NOT NULL,
  nome_cliente VARCHAR(100) NULL,
  telefone_cliente VARCHAR(25) NULL,
  email_cliente VARCHAR(150) NULL,
  servico_nome VARCHAR(60) NULL,   -- ex: "Cabelo + Barba" (preenchido só quando reservado)
  servico_preco DECIMAL(6,2) NULL, -- preço cobrado NESSE agendamento (guardado aqui pra não mudar
                                    -- retroativamente se o preço do serviço for alterado no futuro)
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barbeiro_id) REFERENCES barbeiros(id) ON DELETE CASCADE
);
