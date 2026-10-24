import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLocalNetworkRedirect } from "@/lib/development";
import { getNetworkStatus, getRecords, getToday } from "@/lib/attendance";
import AttendanceDashboard from "@/components/attendance-dashboard";

export default async function AttendancePage() {
  const requestHeaders = await headers();
  const localUrl = getLocalNetworkRedirect(requestHeaders, "/attendance");
  if (localUrl) redirect(localUrl);
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return (
    <AttendanceDashboard
      initial={{
        user,
        today: getToday(),
        records: getRecords(user.id),
        network: getNetworkStatus(requestHeaders),
      }}
    />
  );
}
