# AGENTS.md

## Layout

- The repo root is **not** the app. The real project is
  `SISTEMA_DE_VENTAS_PARA_DISTINTAS_EMPRESAS/` — run every npm/git/deploy command from there.
- `_MEMORIA_PROYECTO.md` (repo root) is a long session log. It is useful for business rules
  and stock-model history, but most of it documents the **old Firebase** implementation.
  Paths like `src/firebase/*`, `firestore`, `onSnapshot` no longer exist; the app is Supabase now.
- Single Vite SPA (not a monorepo). `src/main.tsx` -> `src/App.tsx` -> `src/pages/Index.tsx`.
  `Index.tsx` is a ~12.6k-line monolith with almost all UI and business logic. Prefer editing it
  in place over inventing new architecture.
- Data access lives in `src/supabase/*Service.ts`. Each service maps snake_case DB rows to the
  camelCase app types in `src/supabase/types.ts` (deliberately mirrored by interfaces in `Index.tsx`).
- Firebase is **hosting only** (`.firebaserc` project `sistema-de-ventas-supa`, `firebase.json`
  serves `dist/`). Auth, data, storage and realtime are Supabase. `VITE_FIREBASE_*` in `.env` are
  legacy/unused; do not add Firebase data code.
- `src/config/empresa.ts` is only a fallback for fiscal data (its `ruc` is empty). The real,
  editable config is the single-row `emisor` table loaded via `emisorService.ts`. Until it is
  filled, boletas print "RUC PENDIENTE".
- SUNAT/OSE is **disabled** (`OSE_CONFIG.activo = false` in `sunatService.ts`); comprobantes are
  emitted locally with the DB-assigned correlativo.

## Commands

```powershell
cd SISTEMA_DE_VENTAS_PARA_DISTINTAS_EMPRESAS
npm install                 # package-lock.json is the maintained lockfile (bun.lockb also exists)
npm run dev                 # Vite on 0.0.0.0:8080
npx tsc -p tsconfig.app.json --noEmit    # the real typecheck
npx eslint src/pages/Index.tsx           # scope lint to changed files
npm run build               # vite build ONLY: does not typecheck
firebase deploy --only hosting           # after build; needs Firebase CLI + login
```

- Root `tsconfig.json` is solution-style (`"files": []`), so plain `npx tsc --noEmit` checks
  nothing. Always use `-p tsconfig.app.json`.
- Baseline typecheck already has **4 pre-existing errors** at `Index.tsx:1121` and `:12437`:
  lucide's `Image` icon shadows the DOM `Image`, so `new Image()` resolves to the icon component.
  Don't attribute them to your change.
- `npm run lint` fails on a clean tree (~81 errors, mostly `any` and empty `catch`). It is not a
  merge gate; scope ESLint to files you touched.
- No CI, no test framework, no formatter config. Verification is `tsc` + `npm run build` + manual
  UI flow (login, sell, close cash, print).

## Environment / setup

- `.env` is gitignored and required at dev/build time:
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. `src/supabase/client.ts` throws at import
  if either is missing or still contains `PENDIENTE`.
- Current Supabase project: ref `yeptjlamcfyjeoqwaxib`, region `ca-central-1`
  (`supabase/config.toml`, seed scripts).
- Auth redirect URLs are whitelisted in `supabase/config.toml [auth]` for
  `localhost:8080/8081` and the Firebase Hosting domain. Changing the dev port can break
  password-recovery links.
- Email signup is disabled server-side; only an admin can create accounts (Edge Function below).
  The first admin must be created with `scripts/db-crear-admin.mjs` or the Supabase dashboard.

## Data rules that are easy to break

- **Supabase is the source of truth.** localStorage `pos-*` keys are only a pending/offline buffer
  used by the subscription merges; do not reintroduce Firebase-style local-first writes.
- All writes go through the service layer. Sensitive operations are atomic Postgres RPCs:
  `registrar_venta` (header + items + stock in one transaction), `eliminar_venta` (restores stock,
  refuses if a comprobante exists), `siguiente_correlativo` (never repeats numbers).
  Do not replace them with multi-step client writes.
- **RLS is the authorization boundary** (admin-only deletes, stock history, cash closes;
  active employees can sell). `src/lib/permisos.ts` only gives friendly messages — never enforce
  security in the browser.
- Postgres `numeric` columns arrive as strings. Convert with `num()` / `aNumero()` /
  `aNumeroEstricto()` from `src/supabase/ids.ts`. The app uses string IDs; the DB uses serial ints.
- Stock model switch is the **existence of a level named "Unidad"**:
  - Model A (has "Unidad"): `productos.stock` is shared, in base units; other levels are pricing
    references only.
  - Model B (mayorista without "Unidad"): each level has its own stock.
  - `peso` stock is in grams; `metro` stock is in centimeters while prices are per meter.
  Do not "simplify" this logic.
- Day grouping uses `ventas.fecha_local` (America/Lima), not UTC `fecha`.
- Realtime services (`subscribe*`) use `postgres_changes`; their tables must stay in the
  `supabase_realtime` publication (migration `20260928000600_realtime.sql`).

## Database migrations and scripts

- Schema source of truth: `supabase/migrations/*.sql`. Apply with:
  ```powershell
  $env:SB_REF='yeptjlamcfyjeoqwaxib'; $env:SB_REGION='ca-central-1'; $env:SB_DB_PASSWORD='...'
  node scripts/db-apply.mjs
  ```
  or via Management API: `$env:SB_ACCESS_TOKEN='sbp_...'; node scripts/db-apply-token.mjs`.
  Scripts read **process env**, not `.env` (only the e2e script parses `.env` for URL/key).
- Version tracking uses the filename prefix before the first `_` (`supabase_migrations.schema_migrations`).
  **There is already a duplicate prefix**: `20260929000100_emisor_comprobantes_emitir.sql` and
  `20260929000100_empresa_nueva_fix.sql` — `db-apply` skips the second. Give new migrations a
  unique timestamp prefix.
- `scripts/db-apply-token.mjs` still defaults to the old ref `ulhrsfwvjmvlagtqglcx`; always set
  `SB_PROJECT_REF=yeptjlamcfyjeoqwaxib` when using it.
- `db-check.mjs`, `db-verificar.mjs`, `db-validate.mjs` are read-only. `db-prueba-negocio.mjs` and
  `db-prueba-e2e.mjs` create and delete throwaway rows against the **real** DB (e2e needs
  `SB_DB_PASSWORD` and a populated `.env`). Never point them at production casually.
- `supabase/VERIFICAR.sql` and `supabase/limpiar_duplicados_ventas.sql` are manual SQL-editor
  recipes, not migrations.

## Edge Functions

- `supabase/functions/crear-usuario` creates accounts (admin-only) and `consultar-ruc` looks up
  RUC data. Both are Deno functions with `verify_jwt = false`; security is enforced inside the
  function. Keep the CORS header list including `x-application-name` or the browser preflight fails.
- Deploy them with the Supabase CLI (`supabase functions deploy crear-usuario`), not Firebase.

## UI / printing gotchas

- All UI text, identifiers and comments are Spanish. Match existing naming.
- Boleta HTML is generated inside `Index.tsx`. Direct printing uses QZ Tray with forced 80mm
  portrait; browser print is the fallback. Preview-mode CSS must stay scoped under
  `.boleta-preview` — unscoped `*`/`body` rules previously leaked into the whole page.
- `dist/`, `backups/`, `*.log`, `.env` and service-role keys are gitignored. Never commit backups
  or secrets.
