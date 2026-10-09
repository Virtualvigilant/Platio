import type { Metadata } from "next";
import { DataTable, RestaurantStatusPill } from "@/components/ui";
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
}

export default async function AdminPage() {
  const { supabase } = await requirePlatformStaff("/admin");
  const startOfDay = startOfBusinessDay(new Date());

  const [restaurants, ordersToday, refundsOpen] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, display_name, slug, status, accepting_orders, created_at")
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
  const published = rows.filter((r) => r.status === "published").length;

  const stats = [
    { label: "Restaurants", value: rows.length },
    { label: "Published", value: published },
    { label: "Orders today", value: ordersToday.count ?? 0 },
    { label: "Open refunds", value: refundsOpen.count ?? 0 },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <div>
        <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
          DineFlow / Platform admin
        </p>
        <h1 className="mt-1 mb-0 font-sans text-title">Overview</h1>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="border border-line bg-surface-raised p-4">
            <dt className="font-sans text-small text-ink-muted">{s.label}</dt>
            <dd className="m-0 font-sans text-numeral tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <DataTable<Row>
        caption="Restaurants"
        rowHeaders
        empty="No restaurants yet."
        columns={[
          { key: "display_name", label: "Name" },
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
