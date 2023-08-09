-- where a reservation came from: web (detail page), mail (link in a mail), admin
ALTER TABLE reservations ADD COLUMN source TEXT NOT NULL DEFAULT 'web';
