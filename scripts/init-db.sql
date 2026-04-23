-- ======================================================
-- KruKasyno – Database Initialisation
-- Runs on MySQL startup via docker-entrypoint-initdb.d
-- ======================================================

-- ---- Player Database ----
CREATE DATABASE IF NOT EXISTS player_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- ---- Wallet Database ----
CREATE DATABASE IF NOT EXISTS wallet_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- ---- Player Schema ----
USE player_db;

CREATE TABLE IF NOT EXISTS users (
  id           VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  email        VARCHAR(255) NOT NULL,
  username     VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255),
  google_id    VARCHAR(255),
  role         ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
  is_banned    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email    (email),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_google   (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- Wallet Schema ----
USE wallet_db;

CREATE TABLE IF NOT EXISTS wallets (
  id         VARCHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id    VARCHAR(36)    NOT NULL,
  balance    DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
  created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallets_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id              VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  wallet_id       VARCHAR(36)   NOT NULL,
  user_id         VARCHAR(36)   NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,
  type            ENUM('deposit','withdrawal','bet','win','refund') NOT NULL,
  description     VARCHAR(500),
  game_session_id VARCHAR(36),
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transactions_user    (user_id),
  KEY idx_transactions_wallet  (wallet_id),
  KEY idx_transactions_created (created_at),
  CONSTRAINT fk_transactions_wallet FOREIGN KEY (wallet_id)
    REFERENCES wallets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
