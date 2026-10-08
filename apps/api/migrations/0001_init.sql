-- Schéma initial d'AxoMaster. Dates en ISO 8601 (TEXT).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'player')),
  -- NULL pour un compte qui ne se connecte que par SSO.
  password_hash TEXT,
  -- Identifiant externe (OID Microsoft Entra ID) pour le futur SSO.
  external_id TEXT UNIQUE,
  bonus_boosters INTEGER NOT NULL DEFAULT 0 CHECK (bonus_boosters >= 0),
  booster_anchor TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE login_attempts (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  failures INTEGER NOT NULL,
  window_start TEXT NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  -- Carte complète, validée par `cardSchema` (@axomaster/card-model).
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  category_id TEXT,
  rarity TEXT NOT NULL,
  number INTEGER,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX cards_status ON cards (status);

-- Inventaire. La contrainte CHECK fait échouer (et annuler) tout batch qui retirerait une
-- carte qu'un joueur n'a plus : c'est elle qui garantit l'atomicité des échanges.
CREATE TABLE user_cards (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  first_obtained_at TEXT NOT NULL,
  PRIMARY KEY (user_id, card_id)
);
CREATE INDEX user_cards_card ON user_cards (card_id);

CREATE TABLE booster_openings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  pool TEXT NOT NULL,
  card_ids TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('periodic', 'bonus')),
  opened_at TEXT NOT NULL
);
CREATE INDEX booster_openings_user ON booster_openings (user_id, opened_at);

CREATE TABLE trades (
  id TEXT PRIMARY KEY,
  from_user TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  to_user TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'failed')),
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX trades_from ON trades (from_user, status);
CREATE INDEX trades_to ON trades (to_user, status);

CREATE TABLE trade_items (
  trade_id TEXT NOT NULL REFERENCES trades (id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('offer', 'request')),
  card_id TEXT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (trade_id, side, card_id)
);

-- Images quand le bucket R2 n'est pas configuré.
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('booster_interval_seconds', '86400'),
  ('booster_max_stock', '3'),
  ('booster_size', '5');

INSERT INTO categories (id, name, color, position) VALUES
  ('collaborateurs', 'Collaborateurs', '#3f5d8c', 0),
  ('evenements', 'Événements', '#a8832f', 1),
  ('projets', 'Projets & clients', '#5d7d68', 2);
