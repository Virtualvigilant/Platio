import { LogoTile, cn, tenantStyle } from "@/components/ui";
import type { StorefrontLayout } from "@/domain/restaurants/config";

/**
 * The restaurant's identity block: an optional cover photo, then a band in the restaurant's
 * checked colour with its logo tile, name and cuisine labels. This is the only place the tenant
 * colour appears (design-system/guidelines/storefronts.md); text never sits on the photo.
 *
 * A container of its own, so it lays out the same in the storefront, the admin preview frame and
 * the branding step's live preview. No client-only code: it renders on the server or the client.
 */
export function StorefrontHeader({
  name,
  cuisine,
  logoUrl,
  coverUrl,
  layout,
  brandColor,
  brandOnColor,
  titleAs: Title = "h1",
  titleId,
  className,
}: {
  name: string;
  cuisine: readonly string[];
  logoUrl?: string | null;
  coverUrl?: string | null;
  layout: StorefrontLayout;
  brandColor?: string | null;
  brandOnColor?: string | null;
  /** The name's element: the page heading on the storefront, plain text in a form preview. */
  titleAs?: "h1" | "h2" | "p";
  titleId?: string;
  className?: string;
}) {
  // The cover layout needs a cover photo; until one exists the standard layout is used.
  const showCover = layout === "cover" && !!coverUrl;
  return (
    <header
      style={tenantStyle(brandColor, brandOnColor)}
      className={cn("@container overflow-hidden rounded-md bg-tenant text-on-tenant", className)}
    >
      {showCover ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage URLs are already sized
        <img
          src={coverUrl}
          alt=""
          className="block aspect-[5/2] w-full bg-surface-alt object-cover @3xl:aspect-[4/1]"
        />
      ) : null}
      <div className="flex items-center gap-4 px-4 py-5 @2xl:px-6 @2xl:py-6">
        <LogoTile name={name} logoUrl={logoUrl} className="border-2 border-on-tenant" />
        <div className="flex min-w-0 flex-col gap-1">
          <Title
            id={titleId}
            className="m-0 font-serif text-title wrap-break-word @md:text-display"
          >
            {name}
          </Title>
          {cuisine.length ? (
            <p className="m-0 font-sans text-small">{cuisine.join(" · ")}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
