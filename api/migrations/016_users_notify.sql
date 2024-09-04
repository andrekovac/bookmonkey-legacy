-- Benachrichtigungen: mail = all mails, none = only the ones we have to send
-- (reminders for overdue books). Skipped mails stay in the outbox with status 'skipped'.
ALTER TABLE users ADD COLUMN notify TEXT NOT NULL DEFAULT 'mail';
