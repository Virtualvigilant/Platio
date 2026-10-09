/**
 * What the publish step offers for a restaurant's lifecycle (brief §4.3 step 8, §7.2, §7.4): the
 * moves allowed from its status, which of them the viewer's platform role permits, what each one
 * does, and which need a reason or an explicit confirmation. Plain TypeScript so it can be tested
 * and shared by the page and its Server Action; the database checks every move again.
 */
import { z } from "zod";
import { platformCan, type PlatformRole } from "@/domain/access";
import {
  PUBLICLY_VISIBLE_STATUSES,
  RESTAURANT_STATUS_LABELS,
  RESTAURANT_TRANSITIONS,
  type RestaurantStatus,
  type RestaurantTransition,
} from "@/domain/restaurants/lifecycle";

export const MAX_REASON = 500;

export interface MoveContext {
  status: RestaurantStatus;
  platformRole: PlatformRole | null;
  /** Every readiness check passes. */
  ready: boolean;
  /** Number of readiness checks that fail. */
  unfinished: number;
  /** The restaurant has been published before (its web address is locked). */
  everPublished: boolean;
  /** The restaurant's own "Pause new orders" switch is off. */
  acceptingOrders: boolean;
}

export interface LifecycleMove {
  to: RestaurantStatus;
  /** Button label, e.g. "Publish". */
  action: string;
  /** The viewer's platform role may make this move. */
  allowed: boolean;
  /** "Only super-admins can publish." when not allowed. */
  deniedNote: string | null;
  /** Why the move can't be made yet even though the role allows it (publishing before ready). */
  blockedNote: string | null;
  /** What happens, in one or two sentences. */
  consequence: string;
  requiresReason: boolean;
  /** The checkbox label a destructive move must be confirmed with, or null. */
  confirm: string | null;
  variant: "primary" | "secondary" | "danger";
}

const HIDDEN_FROM_CUSTOMERS =
  "Customers can no longer see or order from this restaurant. Existing orders, refunds and records stay.";

/** Moves that take a restaurant away from customers or set it aside need a confirmation. */
export function isDestructiveMove(from: RestaurantStatus, to: RestaurantStatus): boolean {
  if (to === "suspended" || to === "archived") return true;
  return to === "draft" && PUBLICLY_VISIBLE_STATUSES.includes(from);
}

const VARIANT_ORDER = { primary: 0, secondary: 1, danger: 2 } as const;

/** Every move out of the current status: the main move first, destructive ones last. */
export function lifecycleMoves(ctx: MoveContext): LifecycleMove[] {
  return RESTAURANT_TRANSITIONS[ctx.status]
    .map((t) => describeMove(ctx, t))
    .sort((a, b) => VARIANT_ORDER[a.variant] - VARIANT_ORDER[b.variant]);
}

/** Where the restaurant stands now, for the status section. */
export function statusNote(status: RestaurantStatus, acceptingOrders: boolean): string {
  switch (status) {
    case "draft":
      return "Still being set up. Customers can’t see it. Everything saved in the steps is kept until you publish.";
    case "ready_for_review":
      return "Setup is finished and waiting for a super-admin to publish it. Customers can’t see it yet.";
    case "published":
      return acceptingOrders
        ? "Customers can see the restaurant and order from it. Changes saved in any step go live straight away."
        : "Customers can see the restaurant, but it has paused new orders itself. Changes saved in any step go live straight away.";
    case "paused":
      return "Paused by the platform. Customers can see the restaurant but can’t place new orders.";
    case "suspended":
      return "Suspended. Customers can’t see the restaurant or order from it, and the restaurant team can’t lift the suspension.";
    case "archived":
      return "Archived. Customers can’t see it; its records are kept.";
  }
}

function describeMove(ctx: MoveContext, t: RestaurantTransition): LifecycleMove {
  const allowed = !!ctx.platformRole && platformCan(ctx.platformRole, t.permission);
  const destructive = isDestructiveMove(ctx.status, t.to);
  const blockedNote =
    allowed && t.to === "published" && !ctx.ready
      ? `Finish the ${ctx.unfinished === 1 ? "item" : `${ctx.unfinished} items`} on the checklist first. The checklist is checked again when you ${lowerFirst(t.action)}.`
      : null;
  return {
    to: t.to,
    action: t.action,
    allowed,
    deniedNote: allowed ? null : `Only super-admins can ${lowerFirst(t.action)}.`,
    blockedNote,
    consequence: consequence(ctx, t.to),
    requiresReason: t.requiresReason,
    confirm: destructive ? confirmation(ctx.status, t.to) : null,
    variant: destructive ? "danger" : t.to === "published" ? "primary" : "secondary",
  };
}

function consequence(ctx: MoveContext, to: RestaurantStatus): string {
  const isPublic = PUBLICLY_VISIBLE_STATUSES.includes(ctx.status);
  switch (to) {
    case "ready_for_review":
      return "Tells the platform team that setup is finished and a super-admin can publish it. Customers still can’t see it.";
    case "published":
      if (!ctx.everPublished) {
        return "Customers can see the restaurant and order from it straight away. Its web address can’t change after this.";
      }
      if (ctx.status === "paused") {
        return ctx.acceptingOrders
          ? "Customers can place new orders again."
          : "The platform pause ends, but new orders stay paused until the restaurant resumes them itself.";
      }
      return ctx.acceptingOrders
        ? "Customers can see the restaurant and order from it again."
        : "Customers can see the restaurant again. New orders stay paused until the restaurant resumes them itself.";
    case "paused":
      return "Customers can still see the restaurant but can’t place new orders. Orders already placed carry on as normal.";
    case "suspended":
      return `${isPublic ? "Customers can no longer see or order from this restaurant." : "The restaurant stays hidden from customers."} Existing orders, refunds and records stay. Only a super-admin can restore it; the restaurant team can’t.`;
    case "draft":
      if (isPublic) {
        return `${HIDDEN_FROM_CUSTOMERS} It goes back to setup, and publishing again needs every checklist item.`;
      }
      if (ctx.status === "archived") {
        return "Brings the restaurant back to setup. Customers can’t see it until it is published again.";
      }
      return "Moves it back to setup. Customers still can’t see it.";
    case "archived":
      return `${isPublic ? "Customers can no longer see or order from this restaurant." : "The restaurant stays hidden from customers."} Nobody can be invited to it. Existing orders, refunds and records stay, and a super-admin can reactivate it as a draft later.`;
  }
}

function confirmation(from: RestaurantStatus, to: RestaurantStatus): string {
  const isPublic = PUBLICLY_VISIBLE_STATUSES.includes(from);
  if (isPublic) return HIDDEN_FROM_CUSTOMERS;
  if (to === "archived") {
    return "This restaurant will be archived. Its records stay, and nobody can be invited to it until it is reactivated.";
  }
  return `This restaurant will be ${RESTAURANT_STATUS_LABELS[to].toLowerCase()}. Existing orders, refunds and records stay.`;
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** The form fields a move needs, checked on the server before the database is asked. */
export function moveInputSchema(move: { requiresReason: boolean; destructive: boolean }) {
  return z.object({
    reason: z
      .string()
      .trim()
      .max(MAX_REASON, { error: `Keep the reason under ${MAX_REASON} characters.` })
      .refine((v) => !move.requiresReason || v.length > 0, {
        error: "Give a reason. It’s kept in the change log for platform staff.",
      })
      .transform((v) => (v === "" ? null : v)),
    confirm: z.boolean().refine((v) => !move.destructive || v, {
      error: "Tick the box to confirm you understand what happens, then try again.",
    }),
  });
}
