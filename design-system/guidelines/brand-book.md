DineFlow is one multi-tenant platform for campus food ordering in Kenya, with three surfaces: the **student marketplace** (discover, order, pay, track, collect), the **restaurant workspace** (live order queue, menu, settings, reports) and the **platform admin console** (onboarding, publishing, payments, audit). This system serves all three. Its colours, faces and square edges come from the DineFlow product brief; its components come from the brief's screens and status model.

The name DineFlow is provisional. Nothing in the components depends on it: the name appears only in the `wordmark` style and in copy.

## Principles

- **Mobile first.** Every customer flow works one-handed on a phone over a slow connection. Use one column up to `content-max` (720px), a `space-4` side gutter and `touch-min` (44px) targets.
- **Status is never colour alone.** Every state is a word plus a glyph plus a form (outline, soft fill or solid fill). See _Order and payment status_.
- **The server decides.** Totals, payment success and order state shown in the UI are what the server confirmed. Pending is shown as pending.
- **Kitchen control.** The system suggests and staff confirm. Kitchen screens use `touch-kitchen` (56px) buttons, large numerals and few taps.
- **Configurable, not hard-coded.** Restaurants change their colour, logo, hours and menu, never the layout. See _Restaurant storefronts_.

## Content fundamentals

Write plainly, in short sentences, as a helpful counter attendant would. Address the customer as _you_; the platform speaks as _we_ ("We've sent your order to Mama Oliech Kitchen."). Use sentence case everywhere, including buttons ("Pause new orders", "View details"). No emoji and no exclamation marks.

- Greet with the brief's copy: **"What are you craving?"** and **"Order ahead, then collect when it's ready."**
- Say **"estimated ready time"**, never "guaranteed". Before the kitchen confirms: "Waiting for restaurant to confirm preparation time."
- Say **"Ready for collection"**, never "Done".
- Keep payment words exact: "Payment pending", "Payment confirmed", "Refund initiated", "Refund completed".
- Errors say what happened and the next action: "This item just became unavailable. Remove it or return to the menu."
- Money is **KES** with a space and thousands commas: "KES 1,250". Store integer cents; format with `formatKES`.
- Times are Africa/Nairobi local clock times ("12:50") with "Updated 12:38" when an estimate changes.

The full notification set is in _Voice and copy_.

## Visual foundations

**Colour.** Teal (`brand`) is DineFlow: primary actions, the wordmark, section headings and in-progress states. Navy (`navy`) is structure: table headers, ticket headers and the workspace bar. Text is `ink` on `surface`, with `ink-muted` for metadata. Tints come straight from the brief's callouts: `brand-soft` for information and `amber-soft` for caution. `danger` is kept for stopped states and destructive actions. The brief's teal on its own tint is 4.29:1 and its amber is 3.94:1, so small text on those tints uses `brand-strong` and `amber-strong`, while `brand` and `amber` keep their exact values for fills, borders and large text. Both themes meet 4.5:1 for every text pair named in the token notes.

**Type.** Two faces from the brief. **Noto Serif** is the brand and reading face: `wordmark`, `display`, `lede`, and `body`, `body-sm`, `callout-title`, `eyebrow` and `caption` for running text. **Carlito** (metric-compatible with Calibri) is the brief's heading face and here carries the interface: `title`, `heading` (in `brand`), `label`, `ui`, `small`, `numeral` and `pickup-code`. Numbers that line up in columns use tabular figures. Set `eyebrow` and `caption` in caps.

**Spacing.** A 4px base: `space-1` to `space-12`. Lay out rows with `gap`. Phone gutter `space-4`, card padding `space-4`, page sections `space-8`.

**Shape.** Square like the brief: tables, callouts and the accent bar use `radius-0`. Controls take `radius-sm`, cards and tickets `radius-md`. Only status pills use `radius-pill`, so a fully rounded shape always means status.

**Borders, not shadows.** Separate objects with a `hairline` border in `line`; control borders use `line-strong`. Only things that float over content (the sticky cart bar, bottom sheets) get `shadow-float`.

**Focus.** Every control shows `focus-ring` on `:focus-visible`: a 2px gap in the page colour, then 2px of solid `focus` teal, 3:1 or better on every surface and tint.

**Motion.** Almost none. Loading spinners stop under `prefers-reduced-motion`. A new order is signalled by the ticket's amber header and an optional sound, not by animation.

**Layout.** Marketplace: one column, with the cart as a sticky bottom bar on phones. Workspace: queue columns of OrderTickets (New, Preparing, Ready) on tablet and desktop, stacked on phones, with ConnectionStatus always visible. Admin: DataTables and forms at desktop width.

## Iconography

The brief has no icon set and no logo. The mark is the word **DINEFLOW** set in `wordmark` in `brand`, optionally above a flat `brand` accent bar with `radius-0` (the brief's cover bar is about 6.5 times wider than it is tall). Don't draw a logo for it.

The components draw eleven small stroke glyphs inline (clock, half-filled progress circle, bell, check, cross, slashed circle, alert triangle, return arrow, pause, dot, ring) at 16px in `currentColor`. They were drawn for this system to support status words and are never used alone. When the product adopts an icon library, replace these glyphs to match it. Don't use emoji as icons.

## Intentional additions

The brief defines colours, faces and requirements but no screens, so these were added and are open to change: the dark theme (built around the brief's navy), `brand-strong` and `amber-strong` for legible small text, the `danger`, `neutral-soft` and `line` tokens, the spacing, radius and size scales, the status glyphs, and all fifteen components, each traced to a requirement in the brief.
