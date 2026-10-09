import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Callout, DataTable, RestaurantStatusPill } from "@/components/ui";
import { platformCan } from "@/domain/access";
import type { RestaurantStatus } from "@/domain/restaurants/lifecycle";
import { startOfBusinessDay } from "@/domain/time";
import { requirePlatformStaff } from "@/server/guards";

export const metadata: Metadata = { title: "Platform admin" };

interface Row {
  id: string;
  display_name: string;
  slug: string;
  status: RestaurantStatus;
  accepting_orders: boolean;
  created_at: string;
  updated_at: string;
}

interface Progress {
  restaurant_id: string;
  passed: number;
  total: number;
}

const IN_SETUP: readonly RestaurantStatus[] = ["draft", "ready_for_review"];
const UNFINISHED_SHOWN = 5;

/** The platform overview (brief §7.1): totals, quick actions and restaurants still being set up. */
export default async function AdminPage() {
  const { supabase, viewer } = await requirePlatformStaff("/admin");
  const startOfDay = startOfBusinessDay(new Date());
  const canOnboard =
    !!viewer.platformRole && platformCan(viewer.platformRole, "restaurants.onboard");

  const [restaurants, ordersToday, refundsOpen] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, display_name, slug, status, accepting_orders, created_at, updated_at")
      .order("display_name"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString()),
    supabase
      .from("refunds")
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "initiated"]),
  ]);
  const rows = (restaurants.data ?? []) as Row[];
  const countOf = (statuses: readonly RestaurantStatus[]) =>
    rows.filter((r) => statuses.includes(r.status)).length;

  // Restaurants still being set up, most recently worked on first.
  const inSetup = rows
    .filter((r) => IN_SETUP.includes(r.status))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const unfinished = inSetup.slice(0, UNFINISHED_SHOWN);
  const progress = new Map<string, Progress>();
  if (unfinished.length > 0) {
    const { data } = await supabase.rpc("restaurant_readiness_summary", {
      p_ids: unfinished.map((r) => r.id),
    });
    for (const p of (data ?? []) as Progress[]) progress.set(p.restaurant_id, p);
  }

  const stats = [
    { label: "Restaurants", value: rows.length },
    { label: "Published", value: countOf(["published"]) },
    { label: "Paused", value: countOf(["paused"]) },
    { label: "Being set up", value: inSetup.length },
    { label: "Orders today", value: ordersToday.count ?? 0 },
    { label: "Open refunds", value: refundsOpen.count ?? 0 },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-col gap-4">
        <div>
          <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
            DineFlow / Platform admin
          </p>
          <h1 className="mt-1 mb-0 font-sans text-title">Overview</h1>
        </div>
        <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
          {canOnboard ? (
            <ButtonLink href="/admin/restaurants/new">Add restaurant</ButtonLink>
          ) : null}
          <ButtonLink variant="secondary" href="/admin/restaurants">
            View restaurants
          </ButtonLink>
        </nav>
      </div>

      {restaurants.error ? (
        <Callout tone="danger" title="Restaurants couldn’t be loaded">
          <p>The numbers below may be incomplete. Reload the page to try again.</p>
        </Callout>
      ) : null}

      <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="border border-line bg-surface-raised p-4">
            <dt className="font-sans text-small text-ink-muted">{s.label}</dt>
            <dd className="m-0 font-sans text-numeral tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {unfinished.length > 0 ? (
        <Callout
          tone="warning"
          title="Unfinished setup"
          actions={
            <ButtonLink variant="secondary" href="/admin/restaurants?incomplete=1">
              View all<span className="sr-only"> restaurants being set up</span>
            </ButtonLink>
          }
        >
          <p>
            {inSetup.length === 1
              ? "1 restaurant is still being set up."
              : `${inSetup.length} restaurants are still being set up.`}{" "}
            {inSetup.length > UNFINISHED_SHOWN
              ? `The ${UNFINISHED_SHOWN} most recently changed are below.`
              : null}
          </p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {unfinished.map((r) => {
              const p = progress.get(r.id);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link
                    href={`/admin/restaurants/${encodeURIComponent(r.id)}/publish`}
                    className="inline-flex min-h-touch-min min-w-0 items-center font-sans text-label break-words"
                  >
                    {r.display_name}
                  </Link>
                  <RestaurantStatusPill status={r.status} />
                  <span className="font-sans text-small text-ink">
                    {p ? (
                      <>
                        <span className="tabular-nums">
                          {p.passed} of {p.total}
                        </span>{" "}
                        checks done
                      </>
                    ) : (
                      "Checklist not available"
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Callout>
      ) : null}

      <DataTable<Row>
        caption="Restaurants"
        rowHeaders
        empty="No restaurants yet."
        columns={[
          {
            key: "display_name",
            label: "Name",
            render: (r) => (
              <Link href={`/admin/restaurants/${encodeURIComponent(r.id)}`}>{r.display_name}</Link>
            ),
          },
          { key: "slug", label: "Address", render: (r) => <code>/restaurants/{r.slug}</code> },
          {
            key: "status",
            label: "Status",
            render: (r) => <RestaurantStatusPill status={r.status} />,
          },
          {
            key: "accepting_orders",
            label: "Taking orders",
            render: (r) => (r.accepting_orders ? "Yes" : "No"),
          },
        ]}
        rows={rows}
      />
    </main>
  );
}
