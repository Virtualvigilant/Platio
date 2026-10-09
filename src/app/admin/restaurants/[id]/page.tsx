import { redirect } from "next/navigation";
import { requirePlatformStaff } from "@/server/guards";

/** A restaurant's admin page opens on the first setup step. */
export default async function RestaurantAdminPage(props: PageProps<"/admin/restaurants/[id]">) {
  const { id } = await props.params;
  await requirePlatformStaff(`/admin/restaurants/${id}`, "restaurants.read");
  redirect(`/admin/restaurants/${encodeURIComponent(id)}/details`);
}
