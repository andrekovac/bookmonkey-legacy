-- language of the web app and (later) of the mails. de | en
ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'de';
