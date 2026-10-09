import type { BusinessState } from "@/domain/restaurants/business-status";
import type { StorefrontLayout } from "@/domain/restaurants/config";
import type { HoursLine } from "@/domain/restaurants/hours-display";

/**
 * Everything a storefront shows, already checked and formatted by the server. The Storefront
 * component renders only this object, so the public page and the admin preview cannot differ.
 * Only published, public fields belong here (brief §7.3).
 */
export interface StorefrontData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cuisine: string[];
  logoUrl: string | null;
  coverUrl: string | null;
  layout: StorefrontLayout;
  /** The checked brand colour and its text colour; both null means DineFlow teal. */
  brandColor: string | null;
  brandOnColor: string | null;
  state: BusinessState;
  orderModes: { pickup: boolean; dineIn: boolean };
  pickupInstructions: string | null;
  address: string | null;
  serviceArea: string | null;
  directions: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  publicPhone: string | null;
  /** Grouped weekly hours, Monday first; empty when none are set. */
  hours: HoursLine[];
  /** Upcoming temporary closures in local time, e.g. "Mon 12 Oct, 08:00–14:00". */
  closures: string[];
  /** Active categories with at least one active item, in menu order. */
  categories: StorefrontCategory[];
}

export interface StorefrontCategory {
  id: string;
  name: string;
  description: string | null;
  items: StorefrontMenuItem[];
}

export interface StorefrontMenuItem {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  prepMinutes: number | null;
  tags: string[];
  imageUrl: string | null;
  available: boolean;
}
