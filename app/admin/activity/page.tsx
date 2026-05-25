import { getAdminActivity } from "@/app/admin/_lib/cache";
import ActivityView          from "./_components/ActivityView";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const data = await getAdminActivity();
  return (
    <ActivityView
      loginLogs={data.loginLogs}
      activityLogs={data.activityLogs}
    />
  );
}
