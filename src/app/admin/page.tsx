import { redirect } from "next/navigation";
import { getSessionFromRequest } from "@/lib/auth";
import { ensureSystemSeeded } from "@/lib/seed-service";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const dynamic = "force-dynamic";

export default async function AdminControlPlanePage() {
  await ensureSystemSeeded();
  const user = await getSessionFromRequest();

  if (!user) {
    redirect("/login");
  }

  return <DashboardShell initialUser={user} />;
}

