-- Slippers chatbot — data-driven rules schema
-- Compatible with MariaDB 10.2+ / 11.x (uses native JSON columns)

CREATE TABLE IF NOT EXISTS topics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,      -- e.g. WEATHER, BALLET, SPORTS
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requires_topic_id INT NULL,            -- rule only matches while this topic is active
  sets_topic_id INT NULL,                -- matching this rule activates this topic
  clears_topic BOOLEAN NOT NULL DEFAULT 0,
  patterns JSON NOT NULL,                -- e.g. ["HELLO","HI","HEY"]  ("*" = wildcard word-group)
  replies JSON NOT NULL,                 -- e.g. ["Hi there!","Hey, good to see you!"]
  replies_alt JSON NULL,                 -- only used by special_key='RECALL_NAME' (the "name not known yet" branch)
  sort_order INT NOT NULL DEFAULT 0,     -- lower = matched first (more specific rules go first)
  enabled BOOLEAN NOT NULL DEFAULT 1,
  notes VARCHAR(255) NULL,               -- admin-facing label, e.g. "greeting"
  special_key VARCHAR(50) NULL,          -- NULL = plain rule. Otherwise ties this rule's match
                                          -- to a fixed piece of code (see server/specialRules.js)
                                          -- for behaviour a template can't express: remembering a
                                          -- name, adjusting mood, pronoun reflection, forgetting memory.
                                          -- Patterns/replies/wording stay fully editable; the
                                          -- mechanic itself doesn't.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (requires_topic_id) REFERENCES topics(id) ON DELETE SET NULL,
  FOREIGN KEY (sets_topic_id) REFERENCES topics(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_rules_sort ON rules (sort_order);

-- ================= accounts =================

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  age_confirmed BOOLEAN NOT NULL DEFAULT 0,
  age_confirmed_at TIMESTAMP NULL,
  last_active_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-account chatbot memory (replaces the old localStorage-based memory).
CREATE TABLE IF NOT EXISTS user_memory (
  user_id INT PRIMARY KEY,
  display_name VARCHAR(100) NULL,   -- the name the user told Slippers, not their login username
  mood INT NOT NULL DEFAULT 0,
  topic_id INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Session store table, used by express-mysql-session (it will also create
-- this automatically if missing, but it's included here for completeness).
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
