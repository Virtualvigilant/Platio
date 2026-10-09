import "server-only";
import type { OrderStatus } from "@/domain/orders/state-machine";
import type { PaymentStatus } from "@/domain/payments/state-machine";
import type { ServerClient } from "@/lib/supabase/server";

export interface QueueOrder {
  id: string;
  number: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  mode: "pickup" | "dine_in";
  note: string | null;
  createdAt: Date;
  /** Whole minutes since the order was placed, at query time. */
  ageMinutes: number;
  etaAt: Date | null;
  version: number;
  items: { qty: number; name: string; options?: string }[];
}

const ACTIVE: OrderStatus[] = [
  "awaiting_restaurant",
  "accepted",
  "preparing",
  "ready_for_collection",
];

/** The live queue for one restaurant. RLS already limits rows to restaurants the viewer works at. */
export async function listQueue(
  supabase: ServerClient,
  restaurantId: string,
): Promise<QueueOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, public_order_number, order_status, payment_status, order_mode, customer_note, created_at, eta_at, status_version,
       order_items (quantity, item_name_snapshot, modifiers_snapshot)`,
    )
    .eq("restaurant_id", restaurantId)
    .in("order_status", ACTIVE)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Could not load orders: ${error.message}`);

  type Row = {
    id: string;
    public_order_number: number;
    order_status: OrderStatus;
    payment_status: PaymentStatus;
    order_mode: "pickup" | "dine_in";
    customer_note: string | null;
    created_at: string;
    eta_at: string | null;
    status_version: number;
    order_items: {
      quantity: number;
      item_name_snapshot: string;
      modifiers_snapshot: { name?: string }[];
    }[];
  };
  const now = Date.now();
  return ((data ?? []) as unknown as Row[]).map((o) => ({
    id: o.id,
    number: o.public_order_number,
    status: o.order_status,
    paymentStatus: o.payment_status,
    mode: o.order_mode,
    note: o.customer_note,
    createdAt: new Date(o.created_at),
    ageMinutes: Math.max(0, Math.floor((now - new Date(o.created_at).getTime()) / 60_000)),
    etaAt: o.eta_at ? new Date(o.eta_at) : null,
    version: o.status_version,
    items: o.order_items.map((i) => ({
      qty: i.quantity,
      name: i.item_name_snapshot,
      options:
        Array.isArray(i.modifiers_snapshot) && i.modifiers_snapshot.length
          ? i.modifiers_snapshot
              .map((m) => m.name)
              .filter(Boolean)
              .join(" · ")
          : undefined,
    })),
  }));
}
