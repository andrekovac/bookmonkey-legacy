# Dependencies

We keep the list short and pin exact versions. `npm update` once a quarter, then
`npm test`, `npm run smoke -w api` and `npm run build -w web`.

| Package | Pinned | Why we stay on this major |
|---|---|---|
| express | 4.22.3 | Express 5 changes path syntax (`*`, optional params) and error handling of async handlers. routes.js would need a full pass. |
| zod | 4.6.7 | only in `api/src/v2` |
| bcryptjs | 3.0.3 | pure JS on purpose, no native build on the office server |
| react, react-dom | 18.3.1 | 13 class components left, nobody had time to test them on 19. Do it together with the router upgrade. |
| react-router-dom | 6.30.6 | 7 is a different package layout (`react-router`), needs a migration of routes.jsx |
| vite | 6.4.5 | plugin-react 5+ needs vite 7+ |
| @vitejs/plugin-react | 4.7.0 | see vite |

## Last check

- 2025-01: `npm update` -> nothing newer inside these majors. `npm audit`: 2 moderate for
  react-router 6 (open redirect in `<Link>` with backslash paths, SSR hydration). We do not use
  SSR and all links are internal. Fix only in 7.x, see above.
