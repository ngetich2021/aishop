/**
 * Permission helpers for route-based access control.
 *
 * Roles with unrestricted access: admin, owner
 * Roles with broad access: manager
 * Roles that need explicit allowedRoutes: staff, user
 *
 * allowedRoutes is stored as a string[] on the Profile model.
 * Each entry is a route prefix like "/sales", "/hr", "/finance".
 */

const ADMIN_ROLES  = new Set(["admin", "owner"]);
const MANAGER_ROLES = new Set(["manager"]);

export interface NavSection {
  key:         string;
  prefix:      string;
  label:       string;
  emoji:       string;
  description: string;
}

export const NAV_SECTIONS: NavSection[] = [
  { key: "dashboard", prefix: "/dashboard", label: "Dashboard",  emoji: "📊", description: "Overview, KPIs and charts" },
  { key: "inventory", prefix: "/inventory", label: "Inventory",  emoji: "📦", description: "Products, stock levels, adjustments" },
  { key: "sales",     prefix: "/sales",     label: "Sales",      emoji: "🛒", description: "Point of sale, quotes, returns" },
  { key: "finance",   prefix: "/finance",   label: "Finance",    emoji: "💰", description: "Expenses, credit, wallet, margins" },
  { key: "suppliers", prefix: "/suppliers", label: "Suppliers",  emoji: "🚚", description: "Supplier contacts and history" },
  { key: "hr",        prefix: "/hr",        label: "HR",         emoji: "👥", description: "Staff, payroll, advances" },
  { key: "reports",   prefix: "/reports",   label: "Reports",    emoji: "📈", description: "Analytics and performance reports" },
  { key: "assets",    prefix: "/assets",    label: "Assets",     emoji: "🏷️", description: "Business assets tracking" },
  { key: "buy",       prefix: "/buy",       label: "Purchases",  emoji: "🛍️", description: "Purchase orders from suppliers" },
  { key: "shop",      prefix: "/shop",      label: "Shop",       emoji: "🏪", description: "Shop settings and configuration" },
];

/** Safely parse the allowedRoutes field (comes from DB as unknown) */
export function parseAllowedRoutes(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((r): r is string => typeof r === "string");
  return [];
}

/**
 * Returns true if the given role is allowed to access the route prefix.
 * - admin/owner: always allowed
 * - manager: always allowed
 * - others: allowed only if prefix is in allowedRoutes (or allowedRoutes is empty → deny)
 */
export function isRouteAllowed(
  prefix:        string,
  role:          string,
  allowedRoutes: string[]
): boolean {
  const r = role.toLowerCase().trim();
  if (ADMIN_ROLES.has(r))   return true;
  if (MANAGER_ROLES.has(r)) return true;
  if (allowedRoutes.length === 0) return false;
  // Dashboard is always reachable if the user has any allowed routes —
  // the page itself filters the widgets to only the sections they can access.
  if (prefix === "/dashboard") return true;
  return allowedRoutes.some(ar => ar === prefix || prefix.startsWith(ar + "/"));
}
