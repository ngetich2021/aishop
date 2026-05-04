import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import AcceptSuccess from "./_components/AcceptSuccess";

// eslint-disable-next-line @typescript-eslint/no-explicit-any


interface Props {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitePage({ params }: Props) {
  const { token } = await params;

  // Load invite
  const invite = await prisma.shopInvite.findUnique({
    where:  { token },
    select: {
      id:          true,
      shopId:      true,
      email:       true,
      role:        true,
      fullName:    true,
      baseSalary:  true,
      tel1:        true,
      designation: true,
      expiresAt:   true,
      accepted:    true,
      shop: { select: { name: true } },
    },
  }) as {
    id:          string;
    shopId:      string;
    email:       string;
    role:        string;
    fullName:    string | null;
    baseSalary:  number | null;
    tel1:        string | null;
    designation: string | null;
    expiresAt:   Date;
    accepted:    boolean;
    shop:        { name: string };
  } | null;

  if (!invite) {
    return <InviteStatus type="notfound" />;
  }

  const now = new Date();

  if (invite.accepted) {
    return <InviteStatus type="already_accepted" shopName={invite.shop.name} />;
  }

  if (invite.expiresAt < now) {
    return <InviteStatus type="expired" shopName={invite.shop.name} />;
  }

  // Check if user is logged in
  const session = await auth();

  if (!session?.user?.id) {
    // Redirect to login with callbackUrl
    const callbackUrl = encodeURIComponent(`/invite/${token}`);
    redirect(`/?callbackUrl=${callbackUrl}`);
  }

  const userId = session.user.id;

  // Accept the invite: create Staff record, update Profile, mark invite accepted
  try {
    // Resolve allowedRoutes from the designation if provided
    let allowedRoutes: string[] = [];
    if (invite.designation) {
      const roleRecord = await prisma.role.findUnique({
        where:  { shopId_name: { shopId: invite.shopId, name: invite.designation } },
        select: { allowedRoutes: true },
      }).catch(() => null);
      allowedRoutes = (roleRecord?.allowedRoutes ?? []) as string[];
    }

    await prisma.$transaction(async (tx) => {
      const displayName = invite.fullName
        ?? session.user.name
        ?? invite.email.split("@")[0];

      // Upsert Staff record (in case they're re-invited or already exist)
      const existing = await tx.staff.findUnique({ where: { userId }, select: { id: true } });
      if (existing) {
        await tx.staff.update({
          where: { userId },
          data:  {
            fullName:   displayName,
            shopId:     invite.shopId,
            baseSalary: invite.baseSalary ?? 0,
            tel1:       invite.tel1 ?? null,
          },
        });
      } else {
        await tx.staff.create({
          data: {
            userId,
            fullName:   displayName,
            shopId:     invite.shopId,
            baseSalary: invite.baseSalary ?? 0,
            tel1:       invite.tel1 ?? null,
          },
        });
      }

      await tx.profile.upsert({
        where:  { userId },
        create: {
          userId,
          shopId:        invite.shopId,
          role:          "staff",
          fullName:      displayName,
          email:         invite.email,
          designation:   invite.designation ?? null,
          allowedRoutes,
        },
        update: {
          shopId:        invite.shopId,
          role:          "staff",
          fullName:      displayName,
          designation:   invite.designation ?? null,
          allowedRoutes,
        },
      });

      await tx.shopInvite.update({
        where: { id: invite.id },
        data:  { accepted: true },
      });
    });
  } catch (err) {
    console.error("AcceptInvitePage error:", err);
    return <InviteStatus type="error" shopName={invite.shop.name} />;
  }

  return <AcceptSuccess shopId={invite.shopId} shopName={invite.shop.name} />;
}

// ─── Status display components ────────────────────────────────────────────────

type StatusType = "success" | "notfound" | "expired" | "already_accepted" | "error";

function InviteStatus({
  type,
  shopName,
  role,
  shopId,
}: {
  type:      StatusType;
  shopName?: string;
  role?:     string;
  shopId?:   string;
}) {
  const configs: Record<StatusType, {
    icon:    React.ReactNode;
    title:   string;
    message: string;
    action?: { label: string; href: string };
    color:   string;
    bg:      string;
    border:  string;
  }> = {
    success: {
      icon:    <CheckCircle2 size={40} className="text-emerald-500" />,
      title:   "Welcome aboard!",
      message: `You have joined ${shopName ?? "the shop"} as ${role ?? "staff"}. Head to your dashboard to get started.`,
      action:  { label: "Go to Dashboard", href: shopId ? `/${shopId}/dashboard` : "/" },
      color:   "text-emerald-800",
      bg:      "bg-emerald-50",
      border:  "border-emerald-200",
    },
    notfound: {
      icon:    <AlertTriangle size={40} className="text-red-500" />,
      title:   "Invalid invite link",
      message: "This invite link is invalid or has already been used. Ask your shop owner for a new invite.",
      color:   "text-red-800",
      bg:      "bg-red-50",
      border:  "border-red-200",
    },
    expired: {
      icon:    <Clock size={40} className="text-amber-500" />,
      title:   "Invite expired",
      message: `The invite for ${shopName ?? "this shop"} has expired (invites are valid for 7 days). Ask the shop owner to send a new one.`,
      color:   "text-amber-800",
      bg:      "bg-amber-50",
      border:  "border-amber-200",
    },
    already_accepted: {
      icon:    <CheckCircle2 size={40} className="text-blue-500" />,
      title:   "Already accepted",
      message: `This invite for ${shopName ?? "the shop"} has already been accepted.`,
      color:   "text-blue-800",
      bg:      "bg-blue-50",
      border:  "border-blue-200",
    },
    error: {
      icon:    <AlertTriangle size={40} className="text-red-500" />,
      title:   "Something went wrong",
      message: `We couldn't accept your invite for ${shopName ?? "the shop"}. Please try again or contact support.`,
      color:   "text-red-800",
      bg:      "bg-red-50",
      border:  "border-red-200",
    },
  };

  const cfg = configs[type];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className={`bg-white rounded-2xl shadow-sm border-2 ${cfg.border} max-w-md w-full px-8 py-10 text-center space-y-4`}>
        <div className="flex justify-center">{cfg.icon}</div>
        <h1 className={`text-xl font-black ${cfg.color}`}>{cfg.title}</h1>
        <p className="text-sm text-gray-600">{cfg.message}</p>
        {cfg.action && (
          <a
            href={cfg.action.href}
            className="inline-block mt-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition"
          >
            {cfg.action.label}
          </a>
        )}
      </div>
    </div>
  );
}
