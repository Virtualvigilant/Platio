import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformStaff } from "@/server/guards";
import { NewRestaurantForm } from "./new-restaurant-form";

export const metadata: Metadata = { title: "Add a restaurant" };

/** Admin › Restaurants › Add restaurant (brief §4.3 steps 1–2). */
export default async function NewRestaurantPage() {
  await requirePlatformStaff("/admin/restaurants/new", "restaurants.onboard");

  return (
    <main className="mx-auto flex max-w-content flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <nav aria-label="Breadcrumb">
          <p className="m-0 font-serif text-eyebrow text-brand-strong uppercase">
            DineFlow / <Link href="/admin/restaurants">Restaurants</Link>
          </p>
        </nav>
        <h1 className="m-0 font-sans text-title text-ink">Add a restaurant</h1>
        <p className="m-0 font-serif text-body text-ink-muted">
          Start with the name and web address. You’ll add the rest in the setup steps. Customers
          can’t see the restaurant until it’s published.
        </p>
      </div>
      <NewRestaurantForm />
    </main>
  );
}
