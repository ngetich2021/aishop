"use client";

import { useState, useCallback, useEffect, useMemo, useRef, type JSX } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";

import { isRouteAllowed }  from "@/lib/permissions";
import { RiDashboard3Line } from "react-icons/ri";
import { FaUserShield, FaShop } from "react-icons/fa6";
import { FaMoneyBillTrendUp } from "react-icons/fa6";
import { MdVideogameAsset } from "react-icons/md";
import { IoIosLogOut } from "react-icons/io";
import { IoChevronDown } from "react-icons/io5";
import { AiFillProduct } from "react-icons/ai";
import { FcSalesPerformance } from "react-icons/fc";
import { FaPersonThroughWindow } from "react-icons/fa6";
import { GiBuyCard } from "react-icons/gi";
import { TbReportAnalytics } from "react-icons/tb";
import { Menu, X, ChevronRight, ArrowLeftRight, HandCoins } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const W_OPEN   = 248 as const;
const W_MINI   = 64  as const;
const H_TOP    = 56  as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubLink { title: string; href: string }
type NavBase = { id: number; title: string; label: string; sectionPrefix: string; icon: JSX.Element };
type SingleNav = NavBase & { href: string; submenu?: never };
type GroupNav  = NavBase & { submenu: SubLink[]; href?: never };
type NavItem   = SingleNav | GroupNav;

// ─── Nav definition ───────────────────────────────────────────────────────────
const NAV: NavItem[] = [
  { id: 1,  title: "dashboard", label: "Dashboard", sectionPrefix: "/dashboard", href: "/dashboard",    icon: <RiDashboard3Line size={18} /> },
  { id: 2,  title: "inventory", label: "Inventory",  sectionPrefix: "/inventory",                       icon: <AiFillProduct    size={18} />, submenu: [{ title: "Products",      href: "/inventory/products" }, { title: "Adjust Stock", href: "/inventory/stock" }] },
  { id: 3,  title: "sales",     label: "Sales",      sectionPrefix: "/sales",                           icon: <FcSalesPerformance size={18} />, submenu: [{ title: "Sold",        href: "/sales/sold" }, { title: "Quote", href: "/sales/quote" }] },
  { id: 4,  title: "finance",   label: "Finance",    sectionPrefix: "/finance",                         icon: <FaMoneyBillTrendUp size={18} />, submenu: [{ title: "Payments",    href: "/finance/payments" }, { title: "Expenses", href: "/finance/expenses" }, { title: "Credit", href: "/finance/credit" }, { title: "Wallet", href: "/finance/wallet" }, { title: "Margins", href: "/finance/margins" }] },
  { id: 5,  title: "suppliers", label: "Suppliers",  sectionPrefix: "/suppliers", href: "/suppliers",   icon: <FaUserShield     size={18} /> },
  { id: 6,  title: "hr",        label: "HR",         sectionPrefix: "/hr",                              icon: <FaPersonThroughWindow size={18} />, submenu: [{ title: "Staff",    href: "/hr/staff" }, { title: "Payroll", href: "/hr/payroll" }, { title: "Advances", href: "/hr/advance" }, { title: "Salary", href: "/hr/salary" }, { title: "Login Logs", href: "/hr/logs" }] },
  { id: 7,  title: "reports",   label: "Reports",    sectionPrefix: "/reports",   href: "/reports",     icon: <TbReportAnalytics size={18} /> },
  { id: 8,  title: "assets",    label: "Assets",     sectionPrefix: "/assets",    href: "/assets",      icon: <MdVideogameAsset  size={18} /> },
  { id: 9,  title: "buy",       label: "Buy",        sectionPrefix: "/buy",       href: "/buy",         icon: <GiBuyCard         size={18} /> },
  { id: 10, title: "shop",      label: "Shop",       sectionPrefix: "/shop",      href: "/shop",        icon: <FaShop            size={18} /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name?: string | null) {
  if (!name) return "U";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function roleBadgeColor(role?: string) {
  switch (role?.toLowerCase()) {
    case "owner":   return "bg-indigo-100 text-indigo-700";
    case "manager": return "bg-blue-100 text-blue-700";
    case "staff":   return "bg-gray-100 text-gray-600";
    default:        return "bg-gray-100 text-gray-500";
  }
}

// ─── Tooltip wrapper for collapsed icons ─────────────────────────────────────
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-9999">
        {label}
        <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
      </div>
    </div>
  );
}

// ─── Profile Dropdown ─────────────────────────────────────────────────────────
function ProfileDropdown({
  name, email, image, role, shopId,
}: { name?: string | null; email?: string | null; image?: string | null; role?: string; shopId?: string }) {
  const isStaff = role === "staff" || role === "manager";

  return (
    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-500">
      {/* User card */}
      <div className="px-4 py-4 bg-linear-to-br from-indigo-50 to-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-indigo-200 shrink-0 bg-indigo-100">
            {image ? (
              <Image src={image} alt="Avatar" fill className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-indigo-700 font-bold text-sm">
                {initials(name)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate leading-tight">{name ?? "User"}</p>
            <p className="text-xs text-gray-500 truncate">{email}</p>
            {role && (
              <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-semibold capitalize ${roleBadgeColor(role)}`}>
                {role}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="py-1.5">
        {isStaff && shopId && (
          <Link
            href={`/${shopId}/hr/advance`}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
          >
            <HandCoins size={17} />
            Request Advance
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
        >
          <IoIosLogOut size={17} />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── NavList ──────────────────────────────────────────────────────────────────
function NavList({
  items, collapsed, inDrawer, openMenus, isActive, toggleMenu, onLinkClick,
}: {
  items: NavItem[];
  collapsed: boolean;
  inDrawer: boolean;
  openMenus: Record<string, boolean>;
  isActive: (href: string) => boolean;
  toggleMenu: (title: string) => void;
  onLinkClick?: () => void;
}) {
  const showLabel = inDrawer || !collapsed;

  return (
    <ul className="flex flex-col gap-0.5 px-2 py-2 flex-1 overflow-y-auto">
      {items.map((item) => {
        const hasSub    = !!item.submenu;
        const subActive = hasSub && item.submenu!.some((s) => isActive(s.href));
        const isOpen    = openMenus[item.title] ?? false;

        if (hasSub) {
          const GroupIcon = (
            <button
              type="button"
              onClick={() => toggleMenu(item.title)}
              className={[
                "w-full flex items-center rounded-xl px-3 py-2.5 transition-all duration-150 select-none",
                subActive
                  ? "text-indigo-700 font-bold bg-indigo-50"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                showLabel ? "gap-3 justify-between" : "justify-center",
              ].join(" ")}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={subActive ? "text-indigo-600" : ""}>{item.icon}</span>
                {showLabel && (
                  <span className="text-[0.8rem] font-semibold truncate">{item.label}</span>
                )}
              </span>
              {showLabel && (
                <IoChevronDown
                  size={13}
                  className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>
          );

          return (
            <li key={item.id}>
              {collapsed && !inDrawer ? <Tip label={item.label}>{GroupIcon}</Tip> : GroupIcon}

              {showLabel && isOpen && (
                <ul className="ml-8 mt-0.5 mb-1 flex flex-col gap-0.5">
                  {item.submenu!.map((sub) => (
                    <li key={sub.href}>
                      <Link
                        href={sub.href}
                        onClick={onLinkClick}
                        className={[
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-[0.75rem] transition-all",
                          isActive(sub.href)
                            ? "bg-indigo-100 text-indigo-700 font-semibold"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                        ].join(" ")}
                      >
                        <ChevronRight size={11} className="shrink-0 opacity-40" />
                        {sub.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        }

        // Single link
        const SingleEl = (
          <Link
            href={item.href!}
            onClick={onLinkClick}
            className={[
              "flex items-center rounded-xl px-3 py-2.5 transition-all duration-150",
              isActive(item.href!)
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 font-bold"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              showLabel ? "gap-3" : "justify-center",
            ].join(" ")}
          >
            <span className="shrink-0">{item.icon}</span>
            {showLabel && <span className="text-[0.8rem] font-semibold">{item.label}</span>}
          </Link>
        );

        return (
          <li key={item.id}>
            {collapsed && !inDrawer ? <Tip label={item.label}>{SingleEl}</Tip> : SingleEl}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Sidebar user card ────────────────────────────────────────────────────────
function SidebarUser({
  collapsed,
  name,
  email,
  image,
  role,
}: { collapsed: boolean; name?: string | null; email?: string | null; image?: string | null; role?: string }) {
  if (collapsed) {
    return (
      <Tip label={name ?? "User"}>
        <div className="flex justify-center py-3">
          <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-indigo-200 bg-indigo-50 shrink-0">
            {image ? (
              <Image src={image} alt="Avatar" fill className="object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-indigo-700 font-bold text-xs">
                {initials(name)}
              </span>
            )}
          </div>
        </div>
      </Tip>
    );
  }

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="bg-indigo-50 rounded-2xl px-3 py-3 flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-200 shrink-0 bg-white">
          {image ? (
            <Image src={image} alt="Avatar" fill className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-indigo-700 font-bold text-sm">
              {initials(name)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[0.8rem] font-bold text-gray-900 truncate leading-tight">{name ?? "User"}</p>
          <p className="text-[0.65rem] text-gray-400 truncate">{email}</p>
          {role && (
            <span className={`mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.6rem] font-semibold capitalize ${roleBadgeColor(role)}`}>
              {role}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Navbar ──────────────────────────────────────────────────────────────
export default function Navbar() {
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [openMenus,   setOpenMenus]   = useState<Record<string, boolean>>({});
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const { data: session, update } = useSession();

  // Refresh role/allowedRoutes from DB every 30 s so permission changes
  // made by an admin propagate without the user needing to sign out.
  useEffect(() => {
    const id = setInterval(() => { update(); }, 30_000);
    return () => clearInterval(id);
  }, [update]);

  const user = session?.user as {
    name?:         string | null;
    email?:        string | null;
    image?:        string | null;
    role?:         string;
    allowedRoutes?: string[];
  } | undefined;

  // Extract shopId from path: /[shopId]/section/...
  const shopId = useMemo(() => pathname.split("/").filter(Boolean)[0] ?? "", [pathname]);

  // Filter nav items by role / allowedRoutes
  const visibleNav = useMemo<NavItem[]>(() => {
    const role   = user?.role ?? "user";
    const routes = user?.allowedRoutes ?? [];
    return NAV.filter(item => isRouteAllowed(item.sectionPrefix, role, routes));
  }, [user?.role, user?.allowedRoutes]);

  // Build nav with shopId prefix
  const items = useMemo<NavItem[]>(() => {
    if (!shopId) return visibleNav;
    return visibleNav.map((item) => {
      if (item.submenu) {
        return { ...item, submenu: item.submenu.map((s) => ({ ...s, href: `/${shopId}${s.href}` })) };
      }
      return { ...item, href: `/${shopId}${item.href}` };
    });
  }, [shopId, visibleNav]);

  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + "/"),
    [pathname]
  );

  // Compute open menus: auto-open parent if a child is active
  const computedMenus = useMemo(() => {
    const m = { ...openMenus };
    items.forEach((item) => {
      if (item.submenu?.some((s) => isActive(s.href))) m[item.title] = true;
    });
    return m;
  }, [openMenus, items, isActive]);

  const toggleMenu = useCallback((title: string) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  // Keep CSS variable in sync with sidebar width
  useEffect(() => {
    const w = collapsed ? W_MINI : W_OPEN;
    document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
  }, [collapsed]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Current section label for topbar breadcrumb
  const currentSection = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const section = parts[1] ?? "";
    const found = NAV.find((n) => n.sectionPrefix === `/${section}`);
    return found?.label ?? "";
  }, [pathname]);

  const shopChip = shopId ? `#${shopId.slice(-5).toUpperCase()}` : null;

  return (
    <>
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm"
        style={{ height: H_TOP }}
      >
        {/* Left */}
        <div className="flex items-center gap-2.5">
          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition"
            onClick={() => setMobileOpen((p) => !p)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Logo */}
          <div className="relative h-8 w-8 shrink-0">
            <Image
              src="/branton_logo.png"
              alt="Kwenik"
              fill
              className="object-cover rounded-full border border-indigo-200"
            />
          </div>

          <span className="text-sm font-extrabold text-indigo-700 tracking-wide hidden sm:block">Kwenik</span>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            className="hidden md:flex p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition ml-1"
            onClick={() => setCollapsed((p) => !p)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={17} />
          </button>

          {/* Section breadcrumb */}
          {currentSection && (
            <div className="hidden sm:flex items-center gap-1.5 text-gray-400 text-xs ml-2">
              <ChevronRight size={13} />
              <span className="font-semibold text-gray-600">{currentSection}</span>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5">
          {/* Shop chip */}
          {shopChip && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[0.7rem] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Shop {shopChip}
            </span>
          )}

          {/* Avatar + profile dropdown */}
          {session && (
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setShowProfile((p) => !p)}
                className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 hover:border-indigo-400 transition-colors shrink-0"
              >
                {user?.image ? (
                  <Image src={user.image} alt="Avatar" fill className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center bg-indigo-100 text-indigo-700 font-bold text-xs">
                    {initials(user?.name)}
                  </span>
                )}
              </button>

              {showProfile && (
                <ProfileDropdown
                  name={user?.name}
                  email={user?.email}
                  image={user?.image}
                  role={user?.role}
                  shopId={shopId}
                />
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── DESKTOP SIDEBAR ──────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col fixed z-40 bg-white border-r border-gray-200 transition-[width] duration-200 overflow-hidden"
        style={{ top: H_TOP, bottom: 0, width: collapsed ? W_MINI : W_OPEN }}
      >
        {/* User card */}
        {session && (
          <>
            <SidebarUser
              collapsed={collapsed}
              name={user?.name}
              email={user?.email}
              image={user?.image}
              role={user?.role}
            />
            <div className="mx-3 border-t border-gray-100" />
          </>
        )}

        {/* Nav links */}
        <NavList
          items={items}
          collapsed={collapsed}
          inDrawer={false}
          openMenus={computedMenus}
          isActive={isActive}
          toggleMenu={toggleMenu}
        />

        {/* Bottom actions */}
        <div className="border-t border-gray-100 px-2 py-2.5 flex flex-col gap-1 mt-auto">
          {/* Switch shops */}
          {collapsed ? (
            <Tip label="Switch Shops">
              <Link
                href="/welcome"
                className="flex justify-center items-center w-full rounded-xl px-3 py-2.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                <ArrowLeftRight size={18} />
              </Link>
            </Tip>
          ) : (
            <Link
              href="/welcome"
              className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              <ArrowLeftRight size={18} />
              <span className="text-[0.8rem] font-semibold">Switch Shops</span>
            </Link>
          )}

          {/* Logout */}
          {collapsed ? (
            <Tip label="Sign out">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex justify-center items-center w-full rounded-xl px-3 py-2.5 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
              >
                <IoIosLogOut size={18} />
              </button>
            </Tip>
          ) : (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <IoIosLogOut size={18} />
              <span className="text-[0.8rem] font-semibold">Sign out</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── MOBILE DRAWER ────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-60 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <div
            className="relative z-10 flex flex-col bg-white shadow-2xl"
            style={{ width: W_OPEN }}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-4 border-b border-gray-100 shrink-0"
              style={{ height: H_TOP }}
            >
              <div className="flex items-center gap-2.5">
                <div className="relative h-8 w-8">
                  <Image src="/branton_logo.png" alt="Logo" fill className="object-cover rounded-full border border-indigo-200" />
                </div>
                <span className="text-sm font-extrabold text-indigo-700">Kwenik</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
                <X size={18} />
              </button>
            </div>

            {/* User card */}
            {session && (
              <div className="px-3 pt-3 pb-2">
                <div className="bg-indigo-50 rounded-2xl px-3 py-3 flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-200 shrink-0 bg-white">
                    {user?.image ? (
                      <Image src={user.image} alt="Avatar" fill className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-indigo-700 font-bold text-sm">
                        {initials(user?.name)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.8rem] font-bold text-gray-900 truncate">{user?.name ?? "User"}</p>
                    <p className="text-[0.65rem] text-gray-400 truncate">{user?.email}</p>
                    {user?.role && (
                      <span className={`mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.6rem] font-semibold capitalize ${roleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 border-t border-gray-100" />
              </div>
            )}

            {/* Links */}
            <div className="flex-1 overflow-y-auto">
              <NavList
                items={items}
                collapsed={false}
                inDrawer={true}
                openMenus={computedMenus}
                isActive={isActive}
                toggleMenu={toggleMenu}
                onLinkClick={() => setMobileOpen(false)}
              />
            </div>

            {/* Drawer bottom */}
            <div className="border-t border-gray-100 px-2 py-2.5 flex flex-col gap-1">
              <Link
                href="/welcome"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                <ArrowLeftRight size={18} />
                <span className="text-[0.8rem] font-semibold">Switch Shops</span>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
              >
                <IoIosLogOut size={18} />
                <span className="text-[0.8rem] font-semibold">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
