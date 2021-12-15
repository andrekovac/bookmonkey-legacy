# BookMonkey

Online catalogue and shop for the BookMonkey book stores.

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

- Shop: http://localhost:5180
- API: http://localhost:4780/api/v1/books
- Admin (staff): http://localhost:4780/admin-old/

Test logins (created by `db:reset`):

| E-Mail | Password | Role |
|---|---|---|
| admin@bookmonkey.example | admin2021 | admin |
| mia.schulz@example.com | lesen123 | customer |
| jonas.becker@example.com | jonas2021 | customer |
| lea.hoffmann@example.com | buecher | customer |

Run the tests with `npm test`.

## What is in here

```
api/        express API (port 4780)
  server.js     app setup, static files, error handling
  routes.js     all /api/v1 routes
  db.js         sqlite connection + migrations
  migrations/   *.sql, applied in order on start
  lib/          isbn, pricing, money, auth, session, logger, utils
  seed/         books.json + covers, seed.js (used by db:reset)
  scripts/      reset-db.js, import-legacy-csv.js
  legacy/admin-old/   staff admin page (plain JS)
  test/         node:test tests
web/        shop frontend, React + Vite (port 5180)
  src/pages/    Catalogue, Detail, Login, Register, Cart, Checkout, Account
  src/api/xhr.js   small XHR helper, all API calls go through it
```

The web dev server proxies `/api` and `/covers` to the API, so both must run.

## Data

The database is a single SQLite file at `api/data/bookmonkey.db`. It is not in git.
`npm run db:reset` deletes it, runs all migrations and imports `api/seed/books.json`.

ISBNs are stored and shown with hyphens, like on the book (`978-0-7475-3269-9`).
Use that format in URLs too: `/api/v1/books/978-0-7475-3269-9`.

Prices in the database are **net** prices in EUR. The API adds 7 % VAT
(`priceGross`), see `api/lib/pricing.js`.

Supplier price lists (CSV from the old shop system) can be imported with

```
npm run import:csv -w api -- path/to/list.csv --dry-run
```

The path is relative to `api/`. There is a sample in `api/scripts/samples/`.

## API

```
GET    /api/v1/books                 ?q= &publisher= &sort=title|author|price|published &order=asc|desc &_page= &_limit=
GET    /api/v1/books/:isbn
GET    /api/v1/books/:isbn/series
GET    /api/v1/publishers
POST   /api/v1/auth/login            {email, password}
POST   /api/v1/auth/register         {email, password, name}
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
PUT    /api/v1/auth/me               {name, password, currentPassword}
GET    /api/v1/cart
POST   /api/v1/cart                  {isbn, qty}
PUT    /api/v1/cart/:isbn            {qty}
DELETE /api/v1/cart/:isbn
POST   /api/v1/orders                {name, street, zip, city, payment, note}
GET    /api/v1/orders
GET    /api/v1/orders/:id

admin only:
POST   /api/v1/books
PUT    /api/v1/books/:isbn
DELETE /api/v1/books/:isbn
GET    /api/v1/users
GET    /api/v1/admin/orders          ?status=
PUT    /api/v1/admin/orders/:id      {status}
```

Errors come back as `{ "error": "..." }` with a 4xx/5xx status.

Login sets a signed cookie (`bm_session`). Set `SESSION_SECRET` in production.

## Plans

- PostgreSQL for production (SQLite is fine for development)
- new admin inside the shop app, then remove `admin-old`
- payment provider instead of invoice / prepayment only
- order confirmation e-mails

## License

MIT, see `LICENSE`. Book data and covers: see `NOTICE`.
