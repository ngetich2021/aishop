import { getAdminPayments } from "@/app/admin/_lib/cache";
import PaymentsView          from "./_components/PaymentsView";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const data = await getAdminPayments();
  return (
    <PaymentsView
      mpesaCallbacks={data.mpesaCallbacks}
      subscriptionPayments={data.subscriptionPayments}
    />
  );
}
