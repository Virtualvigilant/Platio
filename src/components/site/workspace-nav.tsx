import Link from "next/link";
import { restaurantCan, type RestaurantRole } from "@/domain/access";
import { cn } from "@/components/ui";

export type WorkspaceSection = "orders" | "menu" | "settings" | "team";

const SECTIONS: {
  key: WorkspaceSection;
  label: string;
  href: string;
  visible: (role: RestaurantRole) => boolean;
}[] = [
  { key: "orders", label: "Orders", href: "/restaurant", visible: () => true },
  {
    key: "menu",
    label: "Menu",
    href: "/restaurant/menu",
    visible: (r) => restaurantCan(r, "menu.availability"),
  },
  {
    key: "settings",
    label: "Settings",
    href: "/restaurant/settings",
    visible: (r) => restaurantCan(r, "settings.hours"),
  },
  {
    key: "team",
    label: "Team",
    href: "/restaurant/team",
    visible: (r) => restaurantCan(r, "team.manage"),
  },
];

/** Section links for the restaurant workspace, filtered by the viewer's role at this restaurant. */
export function WorkspaceNav({
  current,
  role,
  restaurantId,
  restaurantName,
  otherRestaurants = [],
}: {
  current: WorkspaceSection;
  role: RestaurantRole;
  restaurantId: string;
  restaurantName: string;
  otherRestaurants?: { id: string; name: string }[];
}) {
  const q = `?r=${restaurantId}`;
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
        DineFlow / Restaurant workspace
      </p>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="m-0 font-sans text-title">{restaurantName}</p>
        {otherRestaurants.length ? (
          <nav aria-label="Switch restaurant" className="flex flex-wrap gap-3 font-sans text-small">
            {otherRestaurants.map((r) => (
              <Link key={r.id} href={`/restaurant?r=${r.id}`}>
                {r.name}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
      <nav aria-label="Workspace" className="flex flex-wrap gap-1 border-b border-line">
        {SECTIONS.filter((s) => s.visible(role)).map((s) => (
          <Link
            key={s.key}
            href={`${s.href}${q}`}
            aria-current={s.key === current ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-touch-min items-center border-b-2 px-3 font-sans text-label no-underline",
              s.key === current
                ? "border-brand text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
