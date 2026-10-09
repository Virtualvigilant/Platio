import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ButtonLink, Callout, Glyph, Pill, RestaurantStatusPill } from "@/components/ui";
import { PUBLICLY_VISIBLE_STATUSES } from "@/domain/restaurants/lifecycle";
import { WIZARD_STEPS, isReadyToPublish } from "@/domain/restaurants/wizard";
import { getAdminRestaurant, getReadiness } from "@/server/admin/restaurants";
import { listRestaurantAudit } from "@/server/audit/queries";
import { requirePlatformStaff } from "@/server/guards";
import { ChangeLog } from "./change-log";
import { checklistRows, checklistSummary } from "./checklist";
import { LifecycleForms } from "./lifecycle-form";
import { lifecycleMoves, statusNote } from "./moves";

export const metadata: Metadata = { title: "Preview and publish" };

/**
 * Wizard step 8 (brief §4.3 steps 7–8, §7.2): the readiness checklist, storefront previews, the
 * lifecycle controls and the change log. Platform staff only; support staff see the moves only
 * super-admins can make as notes, and the database enforces the same rules.
 */
export default async function PublishStepPage(props: PageProps<"/admin/restaurants/[id]/publish">) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const { supabase, viewer } = await requirePlatformStaff(
    `/admin/restaurants/${id}/publish`,
    "restaurants.read",
  );
  const restaurant = await getAdminRestaurant(supabase, id);
  if (!restaurant) notFound();

  const page = pageNumber(search.page);
  const [checks, audit] = await Promise.all([
    getReadiness(supabase, restaurant.id).catch(() => null),
    listRestaurantAudit(supabase, restaurant.id, page),
  ]);

  const ready = checks ? isReadyToPublish(checks) : false;
  const rows = checks ? checklistRows(restaurant.id, checks) : [];
  const unfinished = rows.filter((r) => !r.ok).length;
  const isPublic = PUBLICLY_VISIBLE_STATUSES.includes(restaurant.status);
  const moves = lifecycleMoves({
    status: restaurant.status,
    platformRole: viewer.platformRole,
    ready,
    unfinished,
    everPublished: restaurant.firstPublishedAt !== null,
    acceptingOrders: restaurant.acceptingOrders,
  });
  const base = `/admin/restaurants/${encodeURIComponent(restaurant.id)}`;
  const stepNumber = WIZARD_STEPS.findIndex((s) => s.slug === "publish") + 1;

  return (
    <main className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-sans text-small text-ink-muted">
          Step {stepNumber} of {WIZARD_STEPS.length}
        </p>
        <h1 className="m-0 font-sans text-title text-ink">Preview and publish</h1>
        <p className="m-0 max-w-content font-serif text-body text-ink-muted">
          Check what’s left to do, see the storefront as customers will, then publish{" "}
          <span className="break-words">{restaurant.displayName}</span>. Every change is recorded in
          the change log.
        </p>
      </div>

      <Section id="checklist" title="Checklist">
        {checks ? (
          <>
            <p className="m-0 flex items-center gap-2 font-sans text-label text-ink">
              {ready ? (
                <Pill tone="brand" form="soft" glyph="check">
                  {checklistSummary(checks, restaurant.status)}
                </Pill>
              ) : (
                <Pill tone="amber" form="outline" glyph="alert">
                  {checklistSummary(checks, restaurant.status)}
                </Pill>
              )}
            </p>
            <ul className="m-0 flex list-none flex-col p-0">
              {rows.map((row) => (
                <li
                  key={row.key}
                  className="flex flex-col gap-2 border-b border-line py-3 first:border-t sm:flex-row sm:items-start sm:gap-4"
                >
                  <span className="sm:w-24 sm:flex-none">
                    {row.ok ? (
                      <Pill tone="brand" form="soft" glyph="check">
                        Done
                      </Pill>
                    ) : (
                      <Pill tone="neutral" form="outline" glyph="ring">
                        To do
                      </Pill>
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-sans text-label text-ink">{row.label}</span>
                    {row.message ? (
                      <span className="font-serif text-body-sm text-ink-muted">{row.message}</span>
                    ) : null}
                  </div>
                  {row.ok ? null : (
                    <Link
                      href={row.href}
                      className="inline-flex min-h-touch-min items-center font-sans text-label sm:flex-none"
                    >
                      Go to {row.stepLabel}
                      <span className="sr-only"> to fix: {row.label}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Callout tone="warning" title="The checklist couldn’t be loaded">
            <p>Reload the page to try again. Publishing checks the list again either way.</p>
          </Callout>
        )}
      </Section>

      <Section
        id="preview"
        title="Preview"
        description="See the storefront at phone and desktop sizes, as customers will. Only platform staff can open the preview."
      >
        <div className="flex flex-wrap gap-2">
          <ButtonLink variant="secondary" href={`${base}/preview?view=phone`}>
            Preview on a phone
          </ButtonLink>
          <ButtonLink variant="secondary" href={`${base}/preview?view=desktop`}>
            Preview on a desktop
          </ButtonLink>
        </div>
        {isPublic ? (
          <p className="m-0 font-sans text-ui text-ink">
            Customers see it at{" "}
            <Link
              href={`/restaurants/${encodeURIComponent(restaurant.slug)}`}
              className="break-all"
            >
              /restaurants/{restaurant.slug}
            </Link>
            .
          </p>
        ) : (
          <p className="m-0 flex items-start gap-2 font-sans text-ui text-ink-muted">
            <span className="mt-1">
              <Glyph name="slash" size={14} />
            </span>
            <span>
              Not visible to customers.{" "}
              {restaurant.firstPublishedAt ? "When it is published again" : "Once published"}, it
              will be at <code className="break-all">/restaurants/{restaurant.slug}</code>.
            </span>
          </p>
        )}
      </Section>

      <Section id="status" title="Status">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <RestaurantStatusPill status={restaurant.status} size="lg" />
          </div>
          <p className="m-0 max-w-content font-serif text-body-sm text-ink">
            {statusNote(restaurant.status, restaurant.acceptingOrders)}
          </p>
          {restaurant.status === "published" &&
          !restaurant.acceptingOrders &&
          restaurant.pauseReason ? (
            <p className="m-0 max-w-content font-serif text-body-sm text-ink-muted">
              The restaurant’s reason: <span className="break-words">{restaurant.pauseReason}</span>
            </p>
          ) : null}
        </div>
        <LifecycleForms restaurantId={restaurant.id} status={restaurant.status} moves={moves} />
      </Section>

      <Section
        id="change-log"
        title="Change log"
        description="Every change to this restaurant, newest first: who made it, when, and why."
      >
        <ChangeLog restaurantId={restaurant.id} audit={audit} />
      </Section>
    </main>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex min-w-0 scroll-mt-4 flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="m-0 font-sans text-heading text-brand">
          {title}
        </h2>
        {description ? (
          <p className="m-0 max-w-content font-serif text-body-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** ?page=3 → 3; anything else → 1. */
function pageNumber(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,6}$/.test(raw)) return 1;
  const n = Number(raw);
  return n >= 1 ? n : 1;
}
