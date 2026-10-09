import type { Metadata } from "next";
import Link from "next/link";
import { Callout, OrderTicket } from "@/components/ui";
import { formatClock } from "@/domain/prep-estimate";
import { listQueue, type QueueOrder } from "@/server/queries/orders";
import { requireViewer } from "@/server/guards";

export const metadata: Metadata = { title: "Order queue" };

const GROUPS = [
  { key: "new", title: "New", statuses: ["awaiting_restaurant"] },
  { key: "progress", title: "In progress", statuses: ["accepted", "preparing"] },
  { key: "ready", title: "Ready for collection", statuses: ["ready_for_collection"] },
] as const;

export default async function WorkspacePage(props: PageProps<"/restaurant">) {
  const { supabase, viewer } = await requireViewer("/restaurant");
  const params = await props.searchParams;

  if (viewer.memberships.length === 0) {
    return (
      <main className="mx-auto max-w-content px-4 py-12">
        <h1 className="m-0 font-sans text-title">You’re not on a restaurant team</h1>
        <p className="mt-2 font-serif text-body text-ink-muted">
          Ask your restaurant’s owner to invite {viewer.email ?? "this account"}. Invitations are
          sent by email.
        </p>
      </main>
    );
  }

  // Only restaurants the viewer belongs to can be chosen; anything else falls back to the first.
  const requested = typeof params.r === "string" ? params.r : undefined;
  const current =
    viewer.memberships.find((m) => m.restaurantId === requested) ?? viewer.memberships[0];

  const orders = await listQueue(supabase, current.restaurantId);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
          DineFlow / Restaurant workspace
        </p>
        <h1 className="mt-1 mb-0 font-sans text-title">{current.restaurantName}</h1>
        {viewer.memberships.length > 1 ? (
          <nav
            aria-label="Your restaurants"
            className="mt-2 flex flex-wrap gap-3 font-sans text-ui"
          >
            {viewer.memberships.map((m) => (
              <Link
                key={m.restaurantId}
                href={`/restaurant?r=${m.restaurantId}`}
                aria-current={m.restaurantId === current.restaurantId ? "page" : undefined}
              >
                {m.restaurantName}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <Callout tone="info" title="No open orders">
          New orders appear here as soon as they are paid.
        </Callout>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {GROUPS.map((g) => {
          const inGroup = orders.filter((o) =>
            (g.statuses as readonly string[]).includes(o.status),
          );
          return (
            <section
              key={g.key}
              aria-labelledby={`q-${g.key}`}
              className="flex min-w-0 flex-col gap-3 bg-surface-alt p-3"
            >
              <h2 id={`q-${g.key}`} className="m-0 font-sans text-heading text-brand">
                {g.title} <span className="text-ink-muted tabular-nums">({inGroup.length})</span>
              </h2>
              {inGroup.map((o) => (
                <Ticket key={o.id} order={o} />
              ))}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Ticket({ order }: { order: QueueOrder }) {
  return (
    <OrderTicket
      number={order.number}
      status={order.status}
      payment={order.paymentStatus}
      mode={order.mode}
      items={order.items}
      note={order.note}
      receivedAt={formatClock(order.createdAt)}
      ageMinutes={order.ageMinutes}
      eta={order.etaAt ? formatClock(order.etaAt) : null}
      isNew={order.status === "awaiting_restaurant"}
    />
  );
}
