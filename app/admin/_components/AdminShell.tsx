"use client";

import { useState, useEffect, useCallback } from "react";
import Link                                  from "next/link";
import { usePathname }                       from "next/navigation";
import { signOut }                           from "next-auth/react";
import {
  LayoutDashboard, Users, Store, CreditCard, Wallet,
  Activity, Menu, X, LogOut, Shield, ChevronRight,
} from "lucide-react";

interface Props {
  children:  React.ReactNode;
  adminName: string;
}

const NAV = [
  { label: "Overview",  href: "/admin",          icon: LayoutDashboard },
  { label: "Users",     href: "/admin/users",     icon: Users           },
  { label: "Shops",     href: "/admin/shops",     icon: Store           },
  { label: "Billing",   href: "/admin/billing",   icon: CreditCard      },
  { label: "Payments",  href: "/admin/payments",  icon: Wallet          },
  { label: "Activity",  href: "/admin/activity",  icon: Activity        },
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "A";
}

export default function AdminShell({ children, adminName }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isActive = useCallback(
    (href: string) => href === "/admin" ? pathname === "/admin" : pathname.startsWith(href),
    [pathname]
  );

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/60">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <Shield size={16} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Kwenik Admin</p>
          <p className="text-slate-400 text-[0.65rem]">System Console</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900/40"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
              ].join(" ")}
            >
              <Icon size={17} className="shrink-0" />
              {label}
              {active && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Admin info + sign-out */}
      <div className="border-t border-slate-700/60 px-3 py-4 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/60">
          <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials(adminName)}
          </div>
          <div className="min-w-0">
            <p className="text-slate-200 text-xs font-semibold truncate">{adminName}</p>
            <p className="text-slate-500 text-[0.65rem]">System Admin</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-all duration-150"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 bg-slate-900 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-60 bg-slate-900 flex flex-col h-full shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              type="button"
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition"
              onClick={() => setMobileOpen(p => !p)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
                <Shield size={13} className="text-white" />
              </div>
              <span className="font-bold text-gray-900 text-sm">Kwenik Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100">
              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[0.6rem] font-bold text-white">
                {initials(adminName)}
              </div>
              <span className="text-indigo-700 text-xs font-semibold">{adminName}</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition border border-red-100"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
