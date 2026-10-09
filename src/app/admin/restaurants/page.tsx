import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import {
  ButtonLink,
  Callout,
  DataTable,
  RestaurantStatusPill,
  buttonClasses,
} from "@/components/ui";
import { platformCan } from "@/domain/access";
import {
  RESTAURANT_STATUSES,
  RESTAURANT_STATUS_LABELS,
  isRestaurantStatus,
  type RestaurantStatus,
} from "@/domain/restaurants/lifecycle";
import { slugify } from "@/domain/restaurants/slug";
import { requirePlatformStaff } from "@/server/guards";
import { cleanSearch } from "@/server/queries/restaurants";

export const metadata: Metadata = { title: "Restaurants" };

const PAGE_SIZE = 25;

interface Row {
  id: string;
  display_name: string;
  slug: string;
  status: RestaurantStatus;
  accepting_orders: boolean;
  service_area: string | null;
  created_at: string;
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Admin › Restaurants (brief §7.4, Appendix A): search, filter and open any restaurant. */
export default async function RestaurantsPage(props: PageProps<"/admin/restaurants">) {
  const { supabase, viewer } = await requirePlatformStaff("/admin/restaurants", "restaurants.read");
  const params = await props.searchParams;

  const q = cleanSearch(one(params.q));
  const statusParam = one(params.status);
  const status = isRestaurantStatus(statusParam) ? statusParam : null;
  const incomplete = one(params.incomplete) === "1";
  const sort = one(params.sort) === "name" ? "name" : "newest";
  const requestedPage = Math.max(1, Math.floor(Number(one(params.page)) || 1));
  const filtered = Boolean(q || status || incomplete);

  let query = supabase
    .from("restaurants")
    .select("id, display_name, slug, status, accepting_orders, service_area, created_at", {
      count: "exact",
    });
  if (q) {
    // cleanSearch keeps letters, digits and spaces, and slugify keeps [a-z0-9-], so both are safe
    // inside the filter expression.
    const term = slugify(q);
    query = query.or(
      [
        `display_name.ilike.%${q}%`,
        `service_area.ilike.%${q}%`,
        ...(term ? [`slug.ilike.%${term}%`] : []),
      ].join(","),
    );
  }
  if (status) query = query.eq("status", status);
  if (incomplete) query = query.in("status", ["draft", "ready_for_review"]);
  query =
    sort === "name"
      ? query.order("display_name").order("id")
      : query.order("created_at", { ascending: false }).order("id");

  const from = (requestedPage - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  // A page past the end (an old link, say) is an error in PostgREST, without a count.
  const pastEnd = error?.code === "PGRST103";
  if (error && !pastEnd) throw new Error(`Could not load restaurants: ${error.message}`);
  const rows = (pastEnd ? [] : (data ?? [])) as Row[];
  const total = count ?? rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = requestedPage;

  const progress = new Map<string, { passed: number; total: number }>();
  if (rows.length > 0) {
    const { data: summary } = await supabase.rpc("restaurant_readiness_summary", {
      p_ids: rows.map((r) => r.id),
    });
    for (const s of (summary ?? []) as { restaurant_id: string; passed: number; total: number }[]) {
      progress.set(s.restaurant_id, { passed: s.passed, total: s.total });
    }
  }

  const canAdd = !!viewer.platformRole && platformCan(viewer.platformRole, "restaurants.onboard");
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (incomplete) sp.set("incomplete", "1");
    if (sort === "name") sp.set("sort", "name");
    if (n > 1) sp.set("page", String(n));
    const s = sp.toString();
    return s ? `/admin/restaurants?${s}` : "/admin/restaurants";
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <nav aria-label="Breadcrumb">
            <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
              <Link href="/admin">DineFlow</Link> / Restaurants
            </p>
          </nav>
          <h1 className="m-0 font-sans text-title text-ink">Restaurants</h1>
        </div>
        {canAdd ? <ButtonLink href="/admin/restaurants/new">Add restaurant</ButtonLink> : null}
      </div>

      <Form
        // Remount when the filters change so the fields show them (e.g. after "Clear filters").
        key={pageHref(1)}
        action="/admin/restaurants"
        className="flex flex-col gap-4 border border-line bg-surface-alt p-4 lg:flex-row lg:flex-wrap lg:items-end"
        role="search"
        aria-label="Find restaurants"
      >
        <div className="flex min-w-0 flex-col gap-1.5 lg:flex-1">
          <label htmlFor="q" className="font-sans text-label text-ink">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, web address or area"
            className="min-h-touch-min w-full rounded-sm border border-line-strong bg-surface-raised px-3 font-sans text-ui text-ink placeholder:text-ink-muted"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="status" className="font-sans text-label text-ink">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="min-h-touch-min w-full rounded-sm border border-line-strong bg-surface-raised px-3 font-sans text-ui text-ink"
          >
            <option value="">Any status</option>
            {RESTAURANT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RESTAURANT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="sort" className="font-sans text-label text-ink">
            Order
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="min-h-touch-min w-full rounded-sm border border-line-strong bg-surface-raised px-3 font-sans text-ui text-ink"
          >
            <option value="newest">Newest first</option>
            <option value="name">By name</option>
          </select>
        </div>
        <label className="flex min-h-touch-min cursor-pointer items-center gap-3 font-sans text-ui text-ink">
          <input
            type="checkbox"
            name="incomplete"
            value="1"
            defaultChecked={incomplete}
            className="size-5 flex-none accent-brand"
          />
          Setup incomplete
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonClasses({ variant: "secondary" })}>
            Show restaurants
          </button>
          {filtered || sort === "name" ? (
            <Link href="/admin/restaurants" className="font-sans text-label">
              Clear filters
            </Link>
          ) : null}
        </div>
      </Form>

      {pastEnd ? (
        <p className="m-0 font-sans text-ui text-ink" role="status">
          There’s nothing on page {page}. <Link href={pageHref(1)}>Go to the first page</Link>
        </p>
      ) : total === 0 && !filtered ? (
        <Callout
          title="No restaurants yet"
          actions={
            canAdd ? (
              <ButtonLink href="/admin/restaurants/new">Add the first restaurant</ButtonLink>
            ) : null
          }
        >
          <p>Each restaurant starts as a draft. Customers see it only once it’s published.</p>
        </Callout>
      ) : (
        <>
          <p className="m-0 font-sans text-small text-ink-muted" role="status">
            {total === 0 ? (
              "No restaurants match these filters."
            ) : rows.length === 0 ? (
              <>
                There’s nothing on this page.{" "}
                <Link href={pageHref(pages)}>Go to the last page</Link>
              </>
            ) : (
              <span className="tabular-nums">
                Showing {from + 1}–{from + rows.length} of {total}
              </span>
            )}
          </p>
          <DataTable<Row>
            caption={<span className="sr-only">Restaurants</span>}
            rowHeaders
            empty={
              <>
                No restaurants match these filters.{" "}
                <Link href="/admin/restaurants">Clear filters</Link>
              </>
            }
            columns={[
              {
                key: "display_name",
                label: "Name",
                render: (r) => (
                  <Link href={`/admin/restaurants/${r.id}`} className="font-bold">
                    {r.display_name}
                  </Link>
                ),
              },
              {
                key: "slug",
                label: "Web address",
                render: (r) => <code className="break-all">/restaurants/{r.slug}</code>,
              },
              {
                key: "status",
                label: "Status",
                render: (r) => <RestaurantStatusPill status={r.status} />,
              },
              {
                key: "accepting_orders",
                label: "Taking orders",
                render: (r) =>
                  r.status !== "published"
                    ? "No"
                    : r.accepting_orders
                      ? "Yes"
                      : "No, paused by the restaurant",
              },
              {
                key: "progress",
                label: "Setup",
                render: (r) => {
                  const p = progress.get(r.id);
                  return p ? (
                    <span className="font-sans tabular-nums whitespace-nowrap">
                      {p.passed} of {p.total} checks
                    </span>
                  ) : (
                    <span className="text-ink-muted">Not available</span>
                  );
                },
              },
            ]}
            rows={rows}
          />
          {pages > 1 && rows.length > 0 ? (
            <nav aria-label="Pages" className="flex flex-wrap items-center gap-3">
              {page > 1 ? (
                <ButtonLink href={pageHref(page - 1)} variant="secondary">
                  Previous<span className="sr-only"> page</span>
                </ButtonLink>
              ) : null}
              <p className="m-0 font-sans text-small text-ink-muted tabular-nums">
                Page {page} of {pages}
              </p>
              {page < pages ? (
                <ButtonLink href={pageHref(page + 1)} variant="secondary">
                  Next<span className="sr-only"> page</span>
                </ButtonLink>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}
