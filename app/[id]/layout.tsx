import { auth }           from "@/auth";
import { redirect }       from "next/navigation";
import { headers }        from "next/headers";
import { isRouteAllowed } from "@/lib/permissions";
import Navbar             from "@/components/Navbar";
import IdleTimer          from "@/components/IdleTimer";
import { ReactNode }      from "react";

interface Props {
  children: ReactNode;
  params:   Promise<{ id: string }>;
}

export default async function ShopLayout({ children, params }: Props) {
  const { id: shopId } = await params;

  // ── Session ──────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  // role + allowedRoutes are already embedded in the session by the callback
  const role          = (session.user.role as string) ?? "user";
  const allowedRoutes = (session.user.allowedRoutes as string[]) ?? [];

  // ── Route-access enforcement ─────────────────────────────────────────────
  // middleware.ts stamps x-pathname on every request so we can read it here
  const reqHeaders = await headers();
  const pathname   = reqHeaders.get("x-pathname") ?? "";
  const parts      = pathname.split("/").filter(Boolean); // ["shopId", "section", ...]
  const section    = parts[1] ? `/${parts[1]}` : "/dashboard";

  if (!isRouteAllowed(section, role, allowedRoutes)) {
    // Redirect to the first allowed section, or back to welcome
    const first = allowedRoutes[0];
    redirect(first ? `/${shopId}${first}` : "/welcome");
  }

  // ── Render shell ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <IdleTimer />
      <style>{`
        :root { --sidebar-w: 64px; --topbar-h: 56px; }
        .app-main {
          padding-top: var(--topbar-h);
          padding-left: var(--sidebar-w);
          transition: padding-left 200ms ease-in-out;
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 767px) {
          .app-main { padding-left: 0 !important; }
        }
      `}</style>
      <Navbar />
      <main className="app-main p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
