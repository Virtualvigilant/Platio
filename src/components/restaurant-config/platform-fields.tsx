import { tenantStyle } from "@/components/ui";

/**
 * Identity and branding that only DineFlow can change (name, web address, colour, layout), shown
 * read-only on the restaurant's own settings page.
 */
export function PlatformFields({
  displayName,
  slug,
  brandColor,
  brandOnColor,
  layout,
}: {
  displayName: string;
  slug: string;
  brandColor: string | null;
  brandOnColor: string | null;
  layout: "standard" | "cover";
}) {
  const rows = [
    { label: "Name", value: displayName },
    {
      label: "Web address",
      value: <code className="break-all">/restaurants/{slug}</code>,
    },
    {
      label: "Brand colour",
      value: brandColor ? (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-5 flex-none rounded-sm border border-line bg-tenant"
            style={tenantStyle(brandColor, brandOnColor)}
          />
          <span className="font-sans tabular-nums">{brandColor}</span>
        </span>
      ) : (
        "DineFlow teal (default)"
      ),
    },
    {
      label: "Page layout",
      value: layout === "cover" ? "Cover photo above the name" : "Logo and name",
    },
  ];

  return (
    <div className="flex max-w-content flex-col gap-3">
      <dl className="m-0 grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex min-w-0 flex-col gap-1">
            <dt className="font-sans text-label text-ink">{r.label}</dt>
            <dd className="m-0 font-serif text-body text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 font-sans text-small text-ink-muted">
        Ask DineFlow support to change these.
      </p>
    </div>
  );
}
