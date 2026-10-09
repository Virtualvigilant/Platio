import { Fragment, type ReactNode } from "react";
import { BusinessStatus, Callout, MenuItem, cn } from "@/components/ui";
import { mapHref, orderModesLabel, phoneHref } from "./format";
import { StorefrontHeader } from "./storefront-header";
import type { StorefrontData } from "./types";

/** Categories needed before the menu gets a jump list. */
const JUMP_LIST_MIN = 3;

/**
 * One restaurant's public page, generated from its stored configuration by one tested template
 * (brief §5.2, §7.3). The public route and the admin preview both render this, so what an admin
 * checks is what customers get. Presentational only: no data fetching and no client code.
 *
 * Layout follows the storefront's own width through container queries, not the viewport, so it
 * adapts inside a 390px preview frame: one column on phones, with hours and location beside the
 * menu once there is room.
 */
export function Storefront({
  data,
  headingLevel = 1,
  className,
}: {
  data: StorefrontData;
  /** 2 when the storefront sits under a page heading of its own, as in the admin preview. */
  headingLevel?: 1 | 2;
  className?: string;
}) {
  const Heading = headingLevel === 1 ? "h2" : "h3";
  const base = `storefront-${data.id}`;
  const modes = orderModesLabel(data.orderModes);
  const tel = data.publicPhone ? phoneHref(data.publicPhone) : null;
  const map = data.coordinates ? mapHref(data.coordinates) : null;
  const hasLocation = !!(data.address || data.serviceArea || data.directions || map);

  return (
    <article
      aria-labelledby={`${base}-name`}
      className={cn("@container flex min-w-0 flex-col gap-6", className)}
    >
      <StorefrontHeader
        name={data.name}
        cuisine={data.cuisine}
        logoUrl={data.logoUrl}
        coverUrl={data.coverUrl}
        layout={data.layout}
        brandColor={data.brandColor}
        brandOnColor={data.brandOnColor}
        titleAs={headingLevel === 1 ? "h1" : "h2"}
        titleId={`${base}-name`}
      />

      <div className="grid min-w-0 gap-6 @3xl:grid-cols-[minmax(0,1fr)_17rem] @3xl:grid-rows-[auto_1fr] @3xl:gap-x-8">
        <div className="flex min-w-0 flex-col gap-4 @3xl:col-start-1 @3xl:row-start-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <BusinessStatus status={data.state.status} detail={data.state.detail} size="lg" />
            {modes ? <span className="font-sans text-ui text-ink">{modes}</span> : null}
          </div>
          {data.description ? (
            <p className="m-0 font-serif text-body whitespace-pre-line">{data.description}</p>
          ) : null}
          {data.state.status === "paused" ? (
            <Callout tone="warning" title="Not taking new orders right now">
              You can still browse the menu. Check back soon.
            </Callout>
          ) : null}
          {data.pickupInstructions ? (
            <Callout tone="info" title="Pickup instructions">
              <p className="whitespace-pre-line">{data.pickupInstructions}</p>
            </Callout>
          ) : null}
        </div>

        <aside
          aria-label="Opening hours, location and contact"
          className="grid min-w-0 content-start gap-4 @md:grid-cols-2 @3xl:col-start-2 @3xl:row-span-2 @3xl:row-start-1 @3xl:grid-cols-1"
        >
          <InfoBlock id={`${base}-hours`} title="Opening hours" Heading={Heading}>
            {data.hours.length ? (
              <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-sans text-ui">
                {data.hours.map((line) => (
                  <Fragment key={line.days}>
                    <dt className="font-bold">
                      <span aria-hidden="true">{line.days}</span>
                      <span className="sr-only">{line.daysLong}</span>
                    </dt>
                    <dd className={cn("m-0 tabular-nums", line.closed && "text-ink-muted")}>
                      {line.hours}
                    </dd>
                  </Fragment>
                ))}
              </dl>
            ) : (
              <p className="m-0 font-serif text-body-sm text-ink-muted">
                Opening hours aren’t set yet.
              </p>
            )}
            {data.closures.length ? (
              <div className="flex flex-col gap-1">
                <p className="m-0 font-sans text-label text-ink">Temporary closures</p>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 font-sans text-small text-ink">
                  {data.closures.map((closure, index) => (
                    <li key={`${index}-${closure}`} className="tabular-nums">
                      {closure}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </InfoBlock>

          {hasLocation ? (
            <InfoBlock id={`${base}-location`} title="Location" Heading={Heading}>
              {data.address ? (
                <p className="m-0 font-sans text-ui text-ink">{data.address}</p>
              ) : null}
              {data.serviceArea ? (
                <p className="m-0 font-sans text-small text-ink-muted">{data.serviceArea}</p>
              ) : null}
              {data.directions ? (
                <p className="m-0 font-serif text-body-sm whitespace-pre-line">{data.directions}</p>
              ) : null}
              {map ? (
                <a
                  href={map}
                  className="inline-flex min-h-touch-min items-center self-start font-sans text-label"
                >
                  Open the map
                </a>
              ) : null}
            </InfoBlock>
          ) : null}

          {data.publicPhone ? (
            <InfoBlock id={`${base}-contact`} title="Contact" Heading={Heading}>
              <p className="m-0 font-sans text-ui text-ink">
                <span className="select-all tabular-nums">{data.publicPhone}</span>
              </p>
              {tel ? (
                <a
                  href={tel}
                  className="inline-flex min-h-touch-min items-center self-start font-sans text-label"
                >
                  Call the restaurant
                </a>
              ) : null}
            </InfoBlock>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-col gap-6 @3xl:col-start-1 @3xl:row-start-2">
          {data.categories.length === 0 ? (
            <Callout tone="info" title="The menu isn’t published yet">
              This restaurant hasn’t added dishes. Check back soon.
            </Callout>
          ) : (
            <>
              {data.categories.length >= JUMP_LIST_MIN ? (
                <nav
                  aria-labelledby={`${base}-menu-nav`}
                  className="sticky top-0 z-10 flex min-w-0 items-center gap-3 border-b border-line bg-surface py-2"
                >
                  <p
                    id={`${base}-menu-nav`}
                    className="m-0 flex-none font-sans text-label text-ink"
                  >
                    Menu
                  </p>
                  <ul className="m-0 flex min-w-0 list-none gap-2 overflow-x-auto p-0 pb-1">
                    {data.categories.map((category) => (
                      <li key={category.id} className="flex-none">
                        <a
                          href={`#menu-${category.id}`}
                          className="inline-flex min-h-touch-min items-center rounded-sm border border-line-strong bg-surface-raised px-3 font-sans text-label whitespace-nowrap text-ink no-underline hover:bg-surface-alt"
                        >
                          {category.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}

              {data.categories.map((category) => (
                <section
                  key={category.id}
                  id={`menu-${category.id}`}
                  aria-labelledby={`menu-${category.id}-title`}
                  className="min-w-0 scroll-mt-20"
                >
                  <Heading
                    id={`menu-${category.id}-title`}
                    className="m-0 font-sans text-heading text-brand"
                  >
                    {category.name}
                  </Heading>
                  {category.description ? (
                    <p className="mt-1 mb-0 font-serif text-body-sm text-ink-muted">
                      {category.description}
                    </p>
                  ) : null}
                  {category.items.map((item) => (
                    <MenuItem
                      key={item.id}
                      name={item.name}
                      description={item.description}
                      priceMinor={item.priceMinor}
                      prepMinutes={item.prepMinutes}
                      tags={item.tags}
                      imageUrl={item.imageUrl}
                      available={item.available}
                    />
                  ))}
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function InfoBlock({
  id,
  title,
  Heading,
  children,
}: {
  id: string;
  title: string;
  Heading: "h2" | "h3";
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-2 rounded-md border border-line bg-surface-raised p-4"
    >
      <Heading id={id} className="m-0 font-sans text-heading text-brand">
        {title}
      </Heading>
      {children}
    </section>
  );
}
