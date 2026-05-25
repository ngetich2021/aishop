import { getAdminBilling } from "@/app/admin/_lib/cache";
import BillingView          from "./_components/BillingView";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const data = await getAdminBilling();
  return (
    <BillingView
      subscriptionPayments={data.subscriptionPayments}
      shopBillingLogs={data.shopBillingLogs}
      planDist={data.planDist}
      monthlyRevenue={data.monthlyRevenue}
    />
  );
}
