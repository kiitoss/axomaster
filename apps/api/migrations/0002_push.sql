-- Notifications push : abonnements Web Push (un par appareil) et suivi des recharges de boosters.

CREATE TABLE push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX push_subscriptions_user ON push_subscriptions (user_id);

-- Prochaine recharge de booster à notifier (NULL : à calculer, ou réserve pleine).
ALTER TABLE users ADD COLUMN booster_notify_at TEXT;
