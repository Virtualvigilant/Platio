import type { Metadata } from "next";
import { NotOnTeam } from "@/components/site/not-on-team";
import { WorkspaceNav } from "@/components/site/workspace-nav";
import { Callout, OrderTicket } from "@/components/ui";
import { formatClock } from "@/domain/prep-estimate";
import { requireMembership } from "@/server/guards";
import { listQueue, type QueueOrder } from "@/server/queries/orders";

export const metadata: Metadata = { title: "Order queue" };

const GROUPS = [
  { key: "new", title: "New", statuses: ["awaiting_restaurant"] },
  { key: "progress", title: "In progress", statuses: ["accepted", "preparing"] },
  { key: "ready", title: "Ready for collection", statuses: ["ready_for_collection"] },
] as const;

export default async function WorkspacePage(props: PageProps<"/restaurant">) {
  const params = await props.searchParams;
  const requested = typeof params.r === "string" ? params.r : undefined;
  const { supabase, viewer, membership } = await requireMembership("/restaurant", requested);
  if (!membership) return <NotOnTeam email={viewer.email} />;

  const orders = await listQueue(supabase, membership.restaurantId);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <WorkspaceNav
        current="orders"
        role={membership.role}
        restaurantId={membership.restaurantId}
        restaurantName={membership.restaurantName}
        otherRestaurants={viewer.memberships
          .filter((m) => m.restaurantId !== membership.restaurantId)
          .map((m) => ({ id: m.restaurantId, name: m.restaurantName }))}
      />
      <h1 className="sr-only">Order queue</h1>

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
