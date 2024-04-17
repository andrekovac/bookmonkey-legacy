// routes.js is split up into one file per area, see docs/adr/0001-typescript-migration.md
//
// done:   publishers, outbox, wishlist + flags + reports (new, never were in routes.js)
// next:   books, reviews, auth, cart, orders, loans, reservations, admin/*
//
// routes.js still mounts these, so the order of the middleware (requireAdmin!) stays the
// same. Once everything is moved, server.js mounts this file instead of routes.js.
module.exports = {
  publishers: require('./publishers'),
  outbox: require('./outbox'),
  wishlist: require('./wishlist'),
  flags: require('./flags'),
  reports: require('./reports')
};
