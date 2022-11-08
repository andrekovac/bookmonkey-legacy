-- employees: home library (for the borrow button) and department (for the reports later)
ALTER TABLE users ADD COLUMN location TEXT;
ALTER TABLE users ADD COLUMN department TEXT;
