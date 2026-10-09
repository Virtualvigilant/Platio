import { RESTAURANT_STATUS_LABELS, type RestaurantStatus } from "@/domain/restaurants/lifecycle";
import type { GlyphName } from "./glyph";
import { Pill, type Form, type Tone } from "./status";

const LOOK: Record<RestaurantStatus, { tone: Tone; form: Form; glyph: GlyphName }> = {
  draft: { tone: "neutral", form: "outline", glyph: "ring" },
  ready_for_review: { tone: "amber", form: "outline", glyph: "clock" },
  published: { tone: "brand", form: "soft", glyph: "check" },
  paused: { tone: "amber", form: "soft", glyph: "pause" },
  suspended: { tone: "danger", form: "soft", glyph: "cross" },
  archived: { tone: "neutral", form: "soft", glyph: "slash" },
};

/** A restaurant's lifecycle status for platform staff (Draft, Published, Suspended…). */
export function RestaurantStatusPill({
  status,
  size,
  className,
}: {
  status: RestaurantStatus;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <Pill {...LOOK[status]} size={size} className={className}>
      {RESTAURANT_STATUS_LABELS[status]}
    </Pill>
  );
}
