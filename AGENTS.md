<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DineFlow project rules

The product spec is `DineFlow_Developer_Product_Brief.pdf`; README.md says what is built so far.

- **Business rules live in `src/domain/`** as plain TypeScript with unit tests. Pages and server code call them; they import nothing from Next.js or Supabase.
- **Every database change is a new migration** in `supabase/migrations/`. Each new table needs `enable row level security`, explicit `grant`s (API roles start with none), policies, and a test in `supabase/tests/` showing another tenant cannot read or write it. Run `npm run test:db`.
- **Order and payment state change only through Postgres functions** (`transition_order`, etc.). If you change `ORDER_TRANSITIONS` in `src/domain/orders/state-machine.ts`, change `order_status_transitions` in a migration too; `transitions-match.test.ts` fails otherwise.
- **Money is integer cents** (`price_minor`, `total_minor`) and is formatted with `formatKES`. Never compute a payable total in the browser.
- **Times are stored in UTC** and shown in Africa/Nairobi with `formatClock` / `startOfBusinessDay`.
- **Styling uses the design tokens** via Tailwind classes (`bg-brand`, `text-ink`, `text-body`, `rounded-md`). Edit `design-system/tokens.json`, then `npm run tokens`. The default Tailwind palette is off on purpose. Tailwind orders utilities by CSS property, not class order, so never pass two values for the same property (e.g. `border-transparent` and `border-line-strong`) to one element.
- **Reuse `src/components/ui`** before writing new UI. Status is always word + glyph + form, never colour alone.
- **Copy follows `design-system/guidelines/voice.md`**: "estimated ready time", "Ready for collection" (never "Done"), exact payment wording, errors that say what happened and what to do next.
- **Protected pages call `requireViewer` / `requirePlatformStaff`** from `src/server/guards.ts` in the page itself; layouts render in parallel with pages, so a layout check alone is not enough.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run test:db && npm run build`.
