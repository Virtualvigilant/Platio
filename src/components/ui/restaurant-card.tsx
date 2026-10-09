import Link from "next/link";
import type { CSSProperties } from "react";
import type { BusinessStatus as BusinessStatusValue } from "@/domain/restaurants/business-status";
import { cn } from "./cn";
import { BusinessStatus } from "./status";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/** The restaurant's checked brand colour, applied only to its own identity (logo tile, header). */
export function tenantStyle(
  color?: string | null,
  onColor?: string | null,
): CSSProperties | undefined {
  if (!color || !onColor) return undefined;
  return { "--color-tenant": color, "--color-on-tenant": onColor } as CSSProperties;
}

export function LogoTile({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex size-14 flex-none items-center justify-center overflow-hidden rounded-sm bg-tenant font-serif text-[22px] font-bold text-on-tenant",
        className,
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage URLs are already sized
        <img src={logoUrl} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}

/** One restaurant in the marketplace list. Paused and closed restaurants stay visible with the reason. */
export function RestaurantCard({
  name,
  cuisine = [],
  status,
  statusDetail,
  readyIn,
  priceCue,
  distance,
  logoUrl,
  tenantColor,
  tenantOnColor,
  href,
  className,
}: {
  name: string;
  cuisine?: readonly string[];
  status: BusinessStatusValue;
  statusDetail?: string;
  readyIn?: string;
  priceCue?: string;
  distance?: string;
  logoUrl?: string | null;
  tenantColor?: string | null;
  tenantOnColor?: string | null;
  href?: string;
  className?: string;
}) {
  const note =
    status === "paused"
      ? "Not taking new orders right now. You can still browse the menu."
      : status === "closed"
        ? "Ordering opens when the restaurant opens."
        : null;

  const body = (
    <>
      <LogoTile name={name} logoUrl={logoUrl} />
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="m-0 font-sans text-[18px] leading-[22px] font-bold text-ink">{name}</h3>
        {cuisine.length ? (
          <p className="m-0 font-sans text-small text-ink-muted">{cuisine.join(" · ")}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 font-sans text-small text-ink">
          <BusinessStatus status={status} detail={statusDetail} />
          {status === "open" && readyIn ? (
            <span>
              Ready in <span className="tabular-nums">{readyIn}</span>
            </span>
          ) : null}
          {priceCue ? <span className="tabular-nums">{priceCue}</span> : null}
          {distance ? <span className="tabular-nums">{distance}</span> : null}
        </div>
        {note ? <p className="mt-1 mb-0 font-serif text-body-sm text-ink-muted">{note}</p> : null}
      </div>
    </>
  );

  const classes = cn(
    "grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-md border border-line bg-surface-raised p-4 text-ink no-underline",
    href && "hover:border-line-strong",
    className,
  );
  const style = tenantStyle(tenantColor, tenantOnColor);

  return href ? (
    <Link href={href} className={classes} style={style}>
      {body}
    </Link>
  ) : (
    <article className={classes} style={style}>
      {body}
    </article>
  );
}
