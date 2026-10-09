import Link from "next/link";
import { ButtonLink, Callout, DataTable } from "@/components/ui";
import type { AuditEntry, AuditPage } from "@/server/audit/queries";

/**
 * The restaurant's change log (brief §7.2 step 8, §14.3): who changed what, when and why, newest
 * first, 50 to a page. Edits go live as soon as they are saved, so this is the record of changes.
 */
export function ChangeLog({ restaurantId, audit }: { restaurantId: string; audit: AuditPage }) {
  if (!audit.ok) {
    return (
      <Callout tone="warning" title="The change log couldn’t be loaded">
        <p>Reload the page to try again. Saving and publishing still work.</p>
      </Callout>
    );
  }

  const { entries, page, pageCount, total } = audit;
  const pageHref = (n: number) =>
    `/admin/restaurants/${encodeURIComponent(restaurantId)}/publish${n > 1 ? `?page=${n}` : ""}#change-log`;

  if (entries.length === 0 && page > 1) {
    return (
      <Callout tone="info" title={`There is no page ${page}`}>
        <p>
          The change log has {pageCount} {pageCount === 1 ? "page" : "pages"}.{" "}
          <Link href={pageHref(1)}>Go to the latest changes</Link>.
        </p>
      </Callout>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <DataTable<AuditEntry>
        caption={<span className="sr-only">Changes to this restaurant, newest first</span>}
        rowHeaders
        empty="No changes recorded yet."
        columns={[
          {
            key: "when",
            label: "When",
            render: (e) => (
              <time dateTime={e.occurredAt} className="font-sans whitespace-nowrap tabular-nums">
                {e.when}
              </time>
            ),
          },
          {
            key: "who",
            label: "Who",
            render: (e) => (
              <span className="flex min-w-32 flex-col">
                <span className="break-words">{e.actor.name}</span>
                {e.actor.detail ? (
                  <span className="font-sans text-small text-ink-muted">{e.actor.detail}</span>
                ) : null}
              </span>
            ),
          },
          {
            key: "summary",
            label: "What",
            render: (e) => <span className="block min-w-48 break-words">{e.summary}</span>,
          },
          {
            key: "reason",
            label: "Reason",
            render: (e) =>
              e.reason ? (
                <span className="block min-w-32 break-words">{e.reason}</span>
              ) : (
                <>
                  <span aria-hidden="true" className="text-ink-muted">
                    —
                  </span>
                  <span className="sr-only">None given</span>
                </>
              ),
          },
        ]}
        rows={entries}
      />

      {pageCount > 1 ? (
        <nav
          aria-label="Change log pages"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="m-0 font-sans text-small text-ink-muted">
            Page <span className="tabular-nums">{page}</span> of{" "}
            <span className="tabular-nums">{pageCount}</span> ·{" "}
            <span className="tabular-nums">{total}</span> changes
          </p>
          <div className="flex flex-wrap gap-2">
            {page > 1 ? (
              <ButtonLink variant="secondary" href={pageHref(page - 1)}>
                Newer changes
              </ButtonLink>
            ) : null}
            {page < pageCount ? (
              <ButtonLink variant="secondary" href={pageHref(page + 1)}>
                Older changes
              </ButtonLink>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
