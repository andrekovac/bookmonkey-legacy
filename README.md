# BookMonkey

Company libraries for our customers' offices (Hamburg, Berlin, München) plus the old
BookMonkey book shop. Employees borrow books, reserve books that are out, write reviews,
and can still buy a book in the shop ("kaufen statt leihen").

## Quickstart

You need Node.js 24 or newer (the API uses the built-in `node:sqlite`). Nothing else.

```
npm install
npm run db:reset
npm run dev:api
```

and in a second terminal:

```
npm run dev:web
```

- Web app (catalogue, library, shop): http://localhost:5180
- Library admin: http://localhost:5180/admin/loans (log in as admin)
- API: http://localhost:4780/api/v1/books
- Old admin (books, orders): http://localhost:4780/admin-old/

Test logins (created by `db:reset`):

| E-Mail | Password | Role |
|---|---|---|
| admin@bookmonkey.example | admin2021 | admin |
| bibliothek@bookmonkey.example | regal2022 | admin (library team) |
| mia.schulz@example.com | lesen123 | employee |
| jonas.becker@example.com | jonas2021 | employee |
| lea.hoffmann@example.com | buecher | employee |
| tobias.wagner@example.com | tobias2022 | employee |
| sarah.klein@example.com | klein2022 | employee |
| murat.yilmaz@example.com | murat2022 | employee |
| anja.richter@example.com | anja2022 | employee |

Run the tests with `npm test`.

## How the library works

- Every book in the catalogue can have **copies** (Exemplare) in one of the three
  locations. Each copy has a barcode label `BM-00042`.
- **Borrow**: 4 weeks. **Renew**: 2 times, 2 weeks each, not when somebody is waiting.
  At most 5 books at the same time.
- **Return**: drop box (the library team scans it in the admin) or self service on the
  "Meine Ausleihen" page.
- **Reservation** (Vormerkung): only when all copies are out. First come, first served.
  When a copy comes back, the first person on the waitlist gets it on the hold shelf and
  has **48 hours** to pick it up, after that it goes to the next person.
- **Reminders**: 2 days before the due date, then 1, 7 and 14 days after it. After the
  third reminder the admins get a mail.
- **Inventory** (Inventur, December): scan all barcodes of one location in the admin,
  missing copies are marked as lost.

### Mails

The API does not send mails itself. Everything goes into the `outbox` table
(`api/lib/mailer.js`), the IT mail relay picks up the `pending` rows every few minutes.
In development you can read them in the admin under "Mails".

The reminder job (`api/jobs/overdue.js`) runs inside the API process, every 60 minutes
and once 5 seconds after start. `OVERDUE_INTERVAL_MIN=5` to run it more often,
`JOBS=off` to switch it off. In the admin there is a button "Mahnlauf jetzt".

## What is in here

```
api/        express API (port 4780)
  server.js     app setup, static files, error handling, starts the reminder job
  routes.js     all /api/v1 routes (sections listed at the top of the file)
  db.js         sqlite connection + migrations
  migrations/   *.sql, applied in order on start
  lib/          isbn, pricing (vat + discount rules), money, auth, session, mailer,
                validate, ics, logger, utils
  services/     loans, reservations, waitlist, notifications (mail texts), inventory
  jobs/         overdue.js (reminders, expired holds)
  seed/         books.json + covers, seed.js (used by db:reset)
  scripts/      reset-db.js, import-legacy-csv.js, import-copies-csv.js
  legacy/admin-old/   old staff admin page (plain JS)
  test/         node:test tests
web/        frontend, React + Vite (port 5180)
  src/pages/    Catalogue, Detail, Login, Register, Cart, Checkout, Account,
                Loans, LoanDetail, Reservations, Admin* (library admin)
  src/components/   Header, BookCard, Availability, Reviews, Price, ...
  src/store/    session + cart stores
  src/api/xhr.js   small XHR helper (older pages), new pages use fetch directly
```

The web dev server proxies `/api` and `/covers` to the API, so both must run.

## Data

The database is a single SQLite file at `api/data/bookmonkey.db`. It is not in git.
`npm run db:reset` deletes it, runs all migrations and imports `api/seed/books.json`,
copies, a few loans, a waitlist, reviews and discount rules.

ISBNs are stored and shown with hyphens, like on the book (`978-0-7475-3269-9`).
Use that format in URLs too: `/api/v1/books/978-0-7475-3269-9`.

Prices in the database are **net** prices in EUR. The API applies the best matching
discount rule (rounded to cents) and adds 7 % VAT (`priceGross`), see `api/lib/pricing.js`.
Discount rules are only for the shop, borrowing is free.

All timestamps are local server time, `YYYY-MM-DD HH:MM:SS` (`utils.now()`), due dates
are `YYYY-MM-DD`.

Imports (paths are relative to `api/`, samples in `api/scripts/samples/`):

```
npm run import:csv -w api -- path/to/supplier-list.csv --dry-run
npm run import:copies -w api -- path/to/inventory.csv --dry-run
```

## API

```
GET    /api/v1/books                 ?q= &publisher= &available=1 &sort=title|author|price|published &order=asc|desc &_page= &_limit=
GET    /api/v1/books/:isbn
GET    /api/v1/books/:isbn/series
GET    /api/v1/books/:isbn/availability
GET    /api/v1/books/:isbn/reviews
POST   /api/v1/books/:isbn/reviews   {rating, text}
DELETE /api/v1/reviews/:id
GET    /api/v1/publishers
POST   /api/v1/auth/login            {email, password}
POST   /api/v1/auth/register         {email, password, name}
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
PUT    /api/v1/auth/me               {name, location, department, password, currentPassword}
GET    /api/v1/cart
POST   /api/v1/cart                  {isbn, qty}
PUT    /api/v1/cart/:isbn            {qty}
DELETE /api/v1/cart/:isbn
POST   /api/v1/orders                {name, street, zip, city, payment, note}
GET    /api/v1/orders
GET    /api/v1/orders/:id
GET    /api/v1/loans                 ?history=1
GET    /api/v1/loans.ics
POST   /api/v1/loans                 {isbn, location}
GET    /api/v1/loans/:id
POST   /api/v1/loans/:id/renew
POST   /api/v1/loans/:id/return
GET    /api/v1/reservations          ?all=1
POST   /api/v1/reservations          {isbn}
DELETE /api/v1/reservations/:id

admin only:
POST   /api/v1/books
PUT    /api/v1/books/:isbn
DELETE /api/v1/books/:isbn
GET    /api/v1/users
GET    /api/v1/admin/users
PUT    /api/v1/admin/users/:id       {role, location, department}
GET    /api/v1/admin/orders          ?status=
PUT    /api/v1/admin/orders/:id      {status}
GET    /api/v1/admin/copies          ?isbn= &status= &location= &q=
POST   /api/v1/admin/books/:isbn/copies   {location, shelf, count}
PUT    /api/v1/admin/copies/:id      {status, location, shelf, note}
DELETE /api/v1/admin/copies/:id
POST   /api/v1/admin/acquisitions    {isbn, title, ..., copies, location}
POST   /api/v1/admin/inventory/check|apply   {location, barcodes}
GET    /api/v1/admin/discounts
POST   /api/v1/admin/discounts       {name, scope, value, percent, valid_from, valid_until}
PUT    /api/v1/admin/discounts/:id
DELETE /api/v1/admin/discounts/:id
GET    /api/v1/admin/loans           ?status=open|overdue|returned &q=
POST   /api/v1/admin/loans           {email, barcode}
POST   /api/v1/admin/loans/checkin   {barcode}
GET    /api/v1/admin/reservations    ?status= &isbn=
GET    /api/v1/admin/outbox          ?status=
POST   /api/v1/admin/outbox/:id/sent
POST   /api/v1/admin/jobs/overdue
```

Errors come back as `{ "error": "..." }` (shop routes) or `{ "message": "..." }`
(library routes) with a 4xx/5xx status. The web app understands both.

Login sets a signed cookie (`bm_session`). Set `SESSION_SECRET` in production.

## Deployment

The API runs on the office server behind nginx:

```
PORT=3000 SESSION_SECRET=... BASE_URL=https://bibliothek.bookmonkey.example npm start
```

The web app is built with `npm run build -w web` and served by nginx from `web/dist`.

## Plans

- PostgreSQL for production (SQLite is fine for now, one office server)
- move the rest of the old admin (books, orders) into the web app, then remove `admin-old`
- statistics for the library team (loans per month, top books)
- English version of the web app
- payment provider instead of invoice / prepayment only

## License

MIT, see `LICENSE`. Book data and covers: see `NOTICE`.
