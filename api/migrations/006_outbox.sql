-- Mails are not sent by the API. We write them into the outbox, the mail relay of the IT
-- picks up the pending rows every few minutes and sets sent_at.
CREATE TABLE outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users (id),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT,
  ref_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX idx_outbox_status ON outbox (status);
CREATE INDEX idx_outbox_ref ON outbox (kind, ref_id);

-- Mahnungen
ALTER TABLE loans ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loans ADD COLUMN last_reminder_at TEXT;
