# Phase 2 decisions: admin restaurant builder

The brief leaves several Phase 2 questions open. These are the answers the code implements, chosen
from the brief's own defaults where it gives them. Each one is easy to change later and lives in one
place (named in brackets).

## Lifecycle and publishing

- **Statuses:** Draft → Ready for review (optional) → Published → Paused or Suspended → Archived
  (§7.2). Unpublish returns a restaurant to Draft. Archived restaurants can be reactivated as Draft;
  they are never deleted. [`src/domain/restaurants/lifecycle.ts`, `restaurant_status_transitions`]
- **Who can move them:** support staff create and edit restaurants and mark them ready for review.
  Only super-admins publish, pause, suspend, unpublish, restore, archive and reactivate (§19 "admin
  power boundaries"). [`src/domain/access.ts`, `platform_can()`]
- **Reasons:** pausing, suspending, unpublishing, resuming, restoring, archiving and reactivating
  need an audit reason (§4.3 step 8).
- **Publishing needs every readiness check:** a description and cuisine label, an address or service
  area, opening hours, pickup instructions when pickup is on, at least one dish in an active
  category, a payment method, and an owner who has **accepted** their invitation. A pending
  invitation is not enough, so someone can always take orders. [`restaurant_readiness()`]
- **Platform pause vs. the restaurant's own pause:** "Paused" is a platform lifecycle status. A
  restaurant's "Pause new orders" switch is separate (`accepting_orders`). Owners can't lift a
  platform suspension.
- **Visibility:** published and paused restaurants are visible to everyone; paused ones can't take
  orders. Draft, ready-for-review, suspended and archived restaurants are hidden from the public.
  Platform staff preview drafts at `/admin/restaurants/[id]/preview`.
- **Edits go live immediately.** There is no staged copy of a published restaurant; the audit log is
  the change log.

## Identity and branding

- **Web address (slug):** unique, suggested from the name, editable until the first publish, then
  locked to avoid broken links (§7.3 allows either choice).
- **Duplicate names:** a warning lists similar restaurants; creating anyway needs a checkbox.
  Duplicate web addresses are refused.
- **Colour:** one primary colour per restaurant, accepted only when white or ink text reaches 4.5:1.
  It colours the restaurant's own logo tile and header band, never buttons or status. Restaurants
  can't supply CSS or HTML. [`checkTenantColor`]
- **Layouts:** "standard" (logo and name) and "cover" (a wide photo above the name).
- **Images:** PNG, JPEG or WebP up to 2 MB, checked by their first bytes on the server. Each upload
  gets a new path under the restaurant's folder, so images are cached for a year. Derived sizes
  can come later from Supabase image transforms.

## Who edits what

| Field                                                              | Platform staff | Owner              | Manager                 |
| ------------------------------------------------------------------ | -------------- | ------------------ | ----------------------- |
| Name, web address, colour, layout                                  | Yes            | —                  | —                       |
| Description, cuisine labels, public phone, logo, cover, location   | Yes            | Yes                | —                       |
| Pickup/dine-in, pickup instructions, prep presets, hours, closures | Yes            | Yes                | Yes                     |
| Menu                                                               | Yes            | Yes                | Yes                     |
| Item availability                                                  | Yes            | Yes                | Yes (and counter staff) |
| Payment settings                                                   | Yes            | Read only          | —                       |
| Team                                                               | Yes (any role) | Managers and staff | —                       |

The database enforces this table (`guard_restaurant_update`, RLS policies), not only the UI.

## Team and invitations

- Invitations are by email, valid for 7 days, revocable, and replaced by a newer invitation for the
  same person. Only a hash of the token is stored.
- Email delivery arrives with notifications (Phase 5). Until then the admin copies the one-time link
  and sends it. The invitee must sign in with the invited, confirmed email address.
- Owners invite managers and staff. Only platform staff invite owners or transfer ownership. A
  restaurant can have several owners and can't lose its last owner except through platform staff.
- Roles are fixed bundles (owner, manager, staff); there are no per-person permission flags yet.
- Claiming an existing business without an invitation is out of scope.

## Hours, operations and menu

- Up to three opening periods a day; overnight periods aren't supported yet. Temporary closures are
  date-time ranges in Nairobi time.
- Prep-time presets and the default are per restaurant. The workload buffer is a platform default
  (`DEFAULT_PREP_SETTINGS`).
- Dine-in can be switched on, but pickup is the default (§19).
- "Archived" (`active = false`) hides a dish or category but keeps it for history; "Unavailable" is
  sold out for now. Price edits apply to new orders only; past orders keep their snapshots.
- Modifier groups belong to a restaurant and can be attached to several dishes.
- Labels such as "Vegetarian" are free text maintained by the restaurant.

## Payments

- The payments step records methods (pay at pickup, online), the provider name, a public merchant
  reference (till or paybill number) and onboarding status. Online payment can be switched on only
  when onboarding is "ready". Provider keys never pass through forms; they belong in managed
  secrets (Phase 5).

## Deferred

- Minimum lead time, service fees, tax display and cancellation defaults (Phases 3 and 5).
- Order acceptance timeout (pilot decision, §19).
- Re-authentication for sensitive ownership or payment changes (§12 "if appropriate").
- `/admin/users` and `/admin/audit` platform-wide pages.
- A global list of service areas; the service area is free text for now.
