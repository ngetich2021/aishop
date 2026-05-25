import { getAdminShops } from "@/app/admin/_lib/cache";
import ShopsView          from "./_components/ShopsView";

export const dynamic = "force-dynamic";

export default async function AdminShopsPage() {
  const shops = await getAdminShops();
  return <ShopsView shops={shops} />;
}
