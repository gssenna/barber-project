-- ============================================
-- Schema do banco de dados - Sistema de Reservas de Barbearia
-- ============================================
-- Como usar: abra o MySQL (Workbench, DBeaver ou terminal) e rode:
--   mysql -u root -p < schema.sql
-- Isso cria o banco "barbearia" e as 3 tabelas necessárias.

CREATE DATABASE IF NOT EXISTS barbearia CHARACTER SET utf8mb4;
USE barbearia;

-- Um barbeiro = uma conta que pode logar no painel
CREATE TABLE barbeiros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cada linha aqui é UM horário possível (ex: terça 14:00-14:30 do barbeiro X)
-- status pode ser: 'disponivel', 'bloqueado' ou 'reservado'
CREATE TABLE horarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barbeiro_id INT NOT NULL,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  status ENUM('disponivel', 'bloqueado', 'reservado') NOT NULL DEFAULT 'disponivel',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barbeiro_id) REFERENCES barbeiros(id) ON DELETE CASCADE,
  UNIQUE KEY horario_unico (barbeiro_id, data, hora_inicio)
);

-- Uma reserva sempre está ligada a UM horário (relação 1 para 1)
-- Não pede cadastro: só nome e telefone
CREATE TABLE reservas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  horario_id INT NOT NULL UNIQUE,
  nome_cliente VARCHAR(100) NOT NULL,
  telefone_cliente VARCHAR(20) NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE CASCADE
);
