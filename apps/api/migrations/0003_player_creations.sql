-- Créations de cartes par les joueurs : auteur, refus avec motif et quota anti-flood.

-- Joueur à l'origine de la carte (NULL : carte d'admin ou importée).
ALTER TABLE cards ADD COLUMN created_by TEXT REFERENCES users (id) ON DELETE SET NULL;
-- Refus d'une proposition : la carte reste en brouillon, le motif est montré au joueur.
ALTER TABLE cards ADD COLUMN rejected_at TEXT;
ALTER TABLE cards ADD COLUMN review_note TEXT;

CREATE INDEX cards_created_by ON cards (created_by);

-- Journal des créations : compte le quota, même si la carte a été supprimée depuis.
CREATE TABLE card_creations (
  id         INTEGER PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  card_id    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX card_creations_user ON card_creations (user_id, created_at);

INSERT INTO settings (key, value) VALUES
  ('creation_limit', '3'),
  ('creation_window_seconds', '604800')
ON CONFLICT (key) DO NOTHING;
