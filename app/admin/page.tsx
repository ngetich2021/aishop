import { getAdminOverview } from "./_lib/cache";
import AdminOverview        from "./_components/AdminOverview";

export const dynamic = "force-dynamic";   // always fresh via ISR tags

export default async function AdminPage() {
  const data = await getAdminOverview();
  return <AdminOverview {...data} />;
}
