import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

// One-time fix endpoint.
// Usage:
//   GET /api/admin/fix-staff-roles               → fix all role="user" with ShopInvite records
//   GET /api/admin/fix-staff-roles?email=x@y.com → force-set a specific user to role="staff"
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (email) {
    const user = await prisma.user.findFirst({
      where:  { email },
      select: { id: true, email: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const before = await prisma.profile.findUnique({
      where:  { userId: user.id },
      select: { role: true, shopId: true },
    });

    await prisma.profile.update({
      where: { userId: user.id },
      data:  { role: "staff" },
    });

    return NextResponse.json({ fixed: 1, email: user.email, before, after: "staff" });
  }

  // Bulk fix: any user whose email appears in ShopInvite and still has role="user"
  const invites = await prisma.shopInvite.findMany({ select: { email: true } });
  const results = [];
  for (const inv of invites) {
    const user = await prisma.user.findFirst({
      where:  { email: inv.email },
      select: { id: true, email: true },
    });
    if (!user) continue;
    const profile = await prisma.profile.findUnique({
      where:  { userId: user.id },
      select: { role: true },
    });
    if (!profile || profile.role !== "user") continue;
    await prisma.profile.update({ where: { userId: user.id }, data: { role: "staff" } });
    results.push({ email: user.email });
  }

  return NextResponse.json({ fixed: results.length, records: results });
}
