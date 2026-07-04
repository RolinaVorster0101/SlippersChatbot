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
  sort_order INT NOT NULL DEFAULT 0,     -- lower = matched first (more specific rules go first)
  enabled BOOLEAN NOT NULL DEFAULT 1,
  notes VARCHAR(255) NULL,               -- admin-facing label, e.g. "greeting"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (requires_topic_id) REFERENCES topics(id) ON DELETE SET NULL,
  FOREIGN KEY (sets_topic_id) REFERENCES topics(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_rules_sort ON rules (sort_order);
