/**
 * Validation for every part of a restaurant's configuration (brief §4.3, §6.3, §6.4, §7.2).
 * Server actions parse form input with these schemas; the database repeats the critical checks
 * as constraints, so invalid data cannot be stored even by a buggy caller.
 *
 * Messages follow the voice guide: say what is wrong and how to fix it.
 */
import { z } from "zod";
import { parseKES } from "../money";
import { checkTenantColor } from "./branding";
import { isValidSlug, slugify } from "./slug";

const trimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} can be at most ${max} characters.` });

/** Empty strings become null so optional text columns stay clean. */
const optionalText = (max: number, label: string) =>
  trimmed(max, label).transform((v) => (v === "" ? null : v));

/** "Kenyan, Fish , rice" → ["Kenyan", "Fish", "Rice"]; de-duplicated, at most 8. */
export function parseTags(input: string, max = 8): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    const label = tag.charAt(0).toUpperCase() + tag.slice(1);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(label);
  }
  return tags.slice(0, max);
}

const tagList = (maxTags: number, maxLength: number, label: string) =>
  z
    .string()
    .transform((v) => parseTags(v, Number.MAX_SAFE_INTEGER))
    .pipe(
      z
        .array(
          z.string().max(maxLength, { error: `Keep each ${label} under ${maxLength} characters.` }),
        )
        .max(maxTags, { error: `Use at most ${maxTags} ${label}s.` }),
    );

const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/;

// ---------------------------------------------------------------------------------------------
// Identity (wizard step 1)
// ---------------------------------------------------------------------------------------------

export const identitySchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { error: "Enter the name customers will see." })
    .max(80, { error: "Keep the name under 80 characters." }),
  slug: z.string().trim().toLowerCase().refine(isValidSlug, {
    error: "Use 3–60 lowercase letters, numbers and single hyphens, like mama-oliech-kitchen.",
  }),
  description: optionalText(500, "The description"),
  cuisineTags: tagList(8, 30, "label"),
  legalName: optionalText(120, "The legal name"),
  publicPhone: optionalText(20, "The phone number").refine((v) => v === null || PHONE.test(v), {
    error: "Enter a phone number like +254 712 345 678.",
  }),
  contactEmail: optionalText(254, "The email address").refine(
    (v) => v === null || z.email().safeParse(v).success,
    { error: "Enter an email address like owner@example.com." },
  ),
  contactPhone: optionalText(20, "The phone number").refine((v) => v === null || PHONE.test(v), {
    error: "Enter a phone number like +254 712 345 678.",
  }),
});
export type IdentityInput = z.input<typeof identitySchema>;
export type Identity = z.output<typeof identitySchema>;

/** Creating a draft needs only a name; the address is suggested from it. */
export const newRestaurantSchema = z
  .object({
    displayName: identitySchema.shape.displayName,
    slug: z.string().trim().toLowerCase().optional(),
  })
  .transform((v, ctx) => {
    const slug = v.slug || slugify(v.displayName);
    if (!isValidSlug(slug)) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message:
          "Use 3–60 lowercase letters, numbers and single hyphens, like mama-oliech-kitchen.",
      });
      return z.NEVER;
    }
    return { displayName: v.displayName, slug };
  });

// ---------------------------------------------------------------------------------------------
// Location (step 3)
// ---------------------------------------------------------------------------------------------

const coordinate = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `Enter a ${label} between ${min} and ${max}.` });
        return z.NEVER;
      }
      return Math.round(n * 1e6) / 1e6;
    });

export const locationSchema = z
  .object({
    address: optionalText(200, "The address"),
    serviceArea: optionalText(80, "The service area"),
    directions: optionalText(500, "The directions"),
    latitude: coordinate(-90, 90, "latitude"),
    longitude: coordinate(-180, 180, "longitude"),
  })
  .superRefine((v, ctx) => {
    if ((v.latitude === null) !== (v.longitude === null)) {
      ctx.addIssue({
        code: "custom",
        path: [v.latitude === null ? "latitude" : "longitude"],
        message: "Enter both latitude and longitude, or leave both empty.",
      });
    }
  });
export type Location = z.output<typeof locationSchema>;

// ---------------------------------------------------------------------------------------------
// Hours and operations (step 4)
// ---------------------------------------------------------------------------------------------

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export const hoursIntervalSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    opensAt: z.string().regex(TIME, { error: "Enter a time like 07:30." }),
    closesAt: z.string().regex(TIME, { error: "Enter a time like 21:00." }),
  })
  .refine((h) => toMinutes(h.closesAt) > toMinutes(h.opensAt), {
    error: "Closing time must be after opening time. Overnight hours aren’t supported yet.",
    path: ["closesAt"],
  });

export const weeklyHoursSchema = z.array(hoursIntervalSchema).superRefine((list, ctx) => {
  for (let day = 0; day <= 6; day++) {
    const intervals = list
      .map((h, index) => ({ ...h, index }))
      .filter((h) => h.weekday === day)
      .sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt));
    if (intervals.length > 3) {
      ctx.addIssue({
        code: "custom",
        path: [intervals[3].index],
        message: "Use at most three opening periods a day.",
      });
    }
    for (let i = 1; i < intervals.length; i++) {
      if (toMinutes(intervals[i].opensAt) < toMinutes(intervals[i - 1].closesAt)) {
        ctx.addIssue({
          code: "custom",
          path: [intervals[i].index, "opensAt"],
          message: "Opening periods on the same day can’t overlap.",
        });
      }
    }
  }
});
export type WeeklyHours = z.output<typeof weeklyHoursSchema>;

export const closureSchema = z
  .object({
    startAt: z.coerce.date({ error: "Enter when the closure starts." }),
    endAt: z.coerce.date({ error: "Enter when the closure ends." }),
    reason: optionalText(200, "The reason"),
  })
  .refine((c) => c.endAt > c.startAt, {
    error: "The closure must end after it starts.",
    path: ["endAt"],
  });

export const operationsSchema = z
  .object({
    pickupEnabled: z.boolean(),
    dineInEnabled: z.boolean(),
    pickupInstructions: optionalText(500, "Pickup instructions"),
    prepPresets: z
      .string()
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map(Number),
      )
      .pipe(
        z
          .array(
            z
              .number()
              .int({ error: "Use whole minutes." })
              .min(1)
              .max(120, { error: "Presets must be 1–120 minutes." }),
          )
          .min(1, { error: "Add at least one preset." })
          .max(6, { error: "Use at most six presets." }),
      )
      .transform((list) => [...new Set(list)].sort((a, b) => a - b)),
    defaultPrepMinutes: z.coerce
      .number({ error: "Enter minutes as a number." })
      .int({ error: "Use whole minutes." })
      .min(1, { error: "Use 1–120 minutes." })
      .max(120, { error: "Use 1–120 minutes." }),
  })
  .refine((v) => v.pickupEnabled || v.dineInEnabled, {
    error: "Turn on pickup, dine-in, or both.",
    path: ["pickupEnabled"],
  });
export type Operations = z.output<typeof operationsSchema>;

// ---------------------------------------------------------------------------------------------
// Branding (step 2)
// ---------------------------------------------------------------------------------------------

export const STOREFRONT_LAYOUTS = ["standard", "cover"] as const;
export type StorefrontLayout = (typeof STOREFRONT_LAYOUTS)[number];

export const brandingSchema = z
  .object({
    brandColor: z.string().trim().toLowerCase(),
    layout: z.enum(STOREFRONT_LAYOUTS),
  })
  .transform((v, ctx) => {
    if (v.brandColor === "") return { brandColor: null, brandOnColor: null, layout: v.layout };
    const check = checkTenantColor(v.brandColor);
    if (!check.ok) {
      ctx.addIssue({ code: "custom", path: ["brandColor"], message: check.reason });
      return z.NEVER;
    }
    return { brandColor: check.color, brandOnColor: check.onColor, layout: v.layout };
  });
export type Branding = z.output<typeof brandingSchema>;

export const IMAGE_KINDS = ["logo", "cover", "item"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// ---------------------------------------------------------------------------------------------
// Payments (step 6). Provider secrets never pass through these forms (§6.4, §7.2).
// ---------------------------------------------------------------------------------------------

export const PAYMENT_ONBOARDING_STATUSES = ["not_started", "in_progress", "ready"] as const;

export const paymentSettingsSchema = z
  .object({
    payAtPickupEnabled: z.boolean(),
    onlineEnabled: z.boolean(),
    provider: optionalText(40, "The provider name"),
    merchantReference: optionalText(60, "The merchant reference"),
    onboardingStatus: z.enum(PAYMENT_ONBOARDING_STATUSES),
  })
  .superRefine((v, ctx) => {
    if (!v.payAtPickupEnabled && !v.onlineEnabled) {
      ctx.addIssue({
        code: "custom",
        path: ["payAtPickupEnabled"],
        message: "Turn on at least one way to pay.",
      });
    }
    if (v.onlineEnabled && v.onboardingStatus !== "ready") {
      ctx.addIssue({
        code: "custom",
        path: ["onlineEnabled"],
        message: "Online payment can be turned on once provider onboarding is ready.",
      });
    }
  });
export type PaymentSettings = z.output<typeof paymentSettingsSchema>;

// ---------------------------------------------------------------------------------------------
// Team (step 7)
// ---------------------------------------------------------------------------------------------

export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter an email address like owner@example.com." })),
  role: z.enum(["owner", "manager", "staff"], { error: "Choose a role." }),
});
export type InvitationInput = z.output<typeof invitationSchema>;

// ---------------------------------------------------------------------------------------------
// Menu (step 5, and the restaurant's own menu page)
// ---------------------------------------------------------------------------------------------

const price = (label: string) =>
  z.string().transform((v, ctx) => {
    const minor = parseKES(v);
    if (minor === null) {
      ctx.addIssue({ code: "custom", message: `Enter ${label} in shillings, like 350 or 350.50.` });
      return z.NEVER;
    }
    return minor;
  });

const optionalMinutes = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 120) {
      ctx.addIssue({
        code: "custom",
        message: "Enter whole minutes from 1 to 120, or leave it empty.",
      });
      return z.NEVER;
    }
    return n;
  });

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Enter a category name, like Main dishes." })
    .max(60, { error: "Keep the name under 60 characters." }),
  description: optionalText(200, "The description"),
});

export const menuItemSchema = z.object({
  categoryId: z.uuid({ error: "Choose a category." }),
  name: z
    .string()
    .trim()
    .min(1, { error: "Enter the dish name." })
    .max(80, { error: "Keep the name under 80 characters." }),
  description: optionalText(300, "The description"),
  price: price("the price"),
  prepMinutes: optionalMinutes,
  tags: tagList(6, 24, "label"),
});
export type MenuItemInput = z.output<typeof menuItemSchema>;

export const modifierGroupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Enter a name, like Size or Add-ons." })
      .max(60, { error: "Keep the name under 60 characters." }),
    required: z.boolean(),
    minSelect: z.coerce.number().int().min(0, { error: "Use 0 or more." }).max(20),
    maxSelect: z.coerce.number().int().min(1, { error: "Allow at least one choice." }).max(20),
  })
  .superRefine((v, ctx) => {
    if (v.minSelect > v.maxSelect) {
      ctx.addIssue({
        code: "custom",
        path: ["minSelect"],
        message: "The minimum can’t be more than the maximum.",
      });
    }
    if (v.required && v.minSelect < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["minSelect"],
        message: "A required choice needs a minimum of at least 1.",
      });
    }
  });

export const modifierOptionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Enter the option, like Large." })
    .max(60, { error: "Keep the name under 60 characters." }),
  priceDelta: price("the extra cost"),
});

/** First error message per field, for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
