# DineFlow

A multi-restaurant ordering and kitchen operations platform for campus communities in Kenya: one
marketplace where students order ahead and collect, one workspace per restaurant for the live
order queue, and one admin console for onboarding restaurants. "DineFlow" is a provisional name.

The product specification is [`DineFlow_Developer_Product_Brief.pdf`](DineFlow_Developer_Product_Brief.pdf).
Section numbers below (§) refer to it.

## Where things stand

This is **Phase 1: Foundation** from the brief's delivery plan (§18).

| Area                     | State                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project setup            | Next.js 16, TypeScript, Tailwind CSS 4, ESLint, Prettier, Vitest, CI                                                                                                      |
| Design system            | Tokens, fonts and 15 components in `src/components/ui`; gallery at `/design`                                                                                              |
| Business rules           | Order and payment state machines, KES money, prep-time suggestion, pickup codes, roles, opening hours, brand-colour contrast (`src/domain`, unit tested)                  |
| Database                 | Full schema from §10 with row-level security on every table, order transitions enforced in Postgres, audit trail (`supabase/migrations`)                                  |
| Tenant isolation         | 40 database tests prove Restaurant A cannot read or change Restaurant B's data, customers see only their own orders, and roles cannot be escalated (§17.1 exit condition) |
| Sign-in                  | Email sign-in links via Supabase Auth; session refresh in `src/proxy.ts`                                                                                                  |
| Pages                    | Marketplace with search, restaurant menu page, restaurant order queue (read-only), admin overview                                                                         |
| Not started (Phases 2–6) | Restaurant setup wizard, cart and checkout, payments, order actions in the workspace, realtime updates, notifications, reports                                            |

## Getting started

You need Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
```

### Supabase

**Locally** (needs Docker), using the Supabase CLI and the settings in `supabase/config.toml`:

```bash
npx supabase start      # prints the API URL and publishable key for .env.local
npx supabase db reset   # applies supabase/migrations and loads demo restaurants from supabase/seed.sql
```

Sign-in emails are caught by the local mail viewer at http://localhost:54324.

**Hosted:** create a project, then `npx supabase link` and `npx supabase db push`. Add
`<your site>/auth/callback` to Authentication → URL Configuration → Redirect URLs.

Put the API URL and publishable (or anon) key in `.env.local`, then:

```bash
npm run dev             # http://localhost:3000
```

### Giving yourself access

Nobody can grant themselves a role from the app. After signing in once, run the SQL at the bottom
of `supabase/seed.sql` (in Supabase Studio or `psql`) to make your account an owner of a demo
restaurant and a platform admin. Then `/restaurant` and `/admin` open for you.

## Scripts

| Command                  | What it does                                                                  |
| ------------------------ | ----------------------------------------------------------------------------- |
| `npm run dev`            | Development server                                                            |
| `npm run build`          | Production build                                                              |
| `npm run lint`           | ESLint                                                                        |
| `npm run typecheck`      | Generates route types, then runs TypeScript                                   |
| `npm test`               | Unit tests for `src/`                                                         |
| `npm run test:db`        | Applies every migration to a fresh database and runs the RLS and order tests  |
| `npm run db:test-server` | Starts a throwaway local Postgres for `test:db` and prints its `DATABASE_URL` |
| `npm run tokens`         | Regenerates `src/styles/tokens.css` from `design-system/tokens.json`          |
| `npm run format`         | Prettier                                                                      |

Database tests need a Postgres 15+ server and nothing else (no Supabase, no Docker):

```bash
npm run db:test-server                     # or use any Postgres you have
DATABASE_URL=postgres://postgres@127.0.0.1:54329/postgres npm run test:db
```

## Layout

```
design-system/          tokens.json (source of truth) and the brand guidelines
supabase/migrations/    schema, row-level security, order and pickup-code functions
supabase/tests/         database tests (tenant isolation, transitions, pickup codes)
supabase/seed.sql       demo restaurants for local development
src/domain/             business rules as plain TypeScript, no framework code
src/components/ui/      the design system's components
src/server/             server-only data access and access checks
src/lib/                env validation, Supabase clients
src/app/                routes
```

## How security works

- **The database is the boundary.** Every table has row-level security, and API roles start with
  no privileges; each table grants exactly what its policies cover. Hiding a button is never the
  control (§3).
- **Orders change only through functions.** `transition_order()` checks who is asking, the allowed
  transition, the expected version (so two tablets can't overwrite each other), and reason/ETA
  rules, then appends to `order_status_events`. The same table lives in
  `src/domain/orders/state-machine.ts`, and a test keeps them identical.
- **Payment status is separate from order status** (§8.1). Only verified provider events will
  confirm a payment. Rejecting a paid order records a refund request; the payment status changes
  only when the provider confirms.
- **Pickup codes** are random, visible only to the customer after acceptance, and checked by staff
  through `verify_pickup_code()`, which locks after five wrong attempts.
- **Restaurant colours** are accepted only when text on them reaches 4.5:1 contrast, and they never
  change status colours.

## Design system

`design-system/tokens.json` holds every colour (light and dark), type style, spacing step and
radius. `npm run tokens` turns it into a Tailwind theme, so classes like `bg-brand`, `text-ink`,
`text-body` and `rounded-md` are the design tokens. The default Tailwind palette is switched off.
Guidelines for status, copy and storefront theming are in `design-system/guidelines/`.

## Decisions still open

The brief lists business decisions to confirm before taking real orders (§19): launch sign-in
method, payment and settlement arrangement, who pays platform fees, tax display, cancellation
policy, order acceptance timeout and notification channels. The code uses the brief's suggested
defaults (email sign-in links, pickup first, customer cancellation only before acceptance) and
keeps these choices in one place each, so they can change without a rewrite.
