import NextAuth from "next-auth";
import Google   from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id:            string;
      name?:         string | null;
      email?:        string | null;
      image?:        string | null;
      role:          string;
      allowedRoutes: string[];
    };
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  // Redirect ALL auth errors (InvalidCheck, Configuration, etc.) to the login page.
  // The login page reads ?error= and shows a friendly retry banner.
  pages: {
    signIn: "/",
    error:  "/",
  },

  // JWT sessions: reads are in-memory token decodes — zero DB calls.
  // DB is only queried on sign-in and on explicit session.update() calls.
  session: { strategy: "jwt" },

  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await prisma.profile.upsert({
        where:  { userId: user.id },
        update: { email: user.email ?? null },
        create: { userId: user.id, role: "owner", email: user.email ?? null },
      });
    },

    async signIn({ user }) {
      if (!user?.id) return;
      try {
        await prisma.loginLog.create({
          data: {
            userId:    user.id,
            loginTime: new Date(),
            lastSeen:  new Date(),
            duration:  0,
          },
        });
      } catch { /* non-critical — never block sign-in */ }
    },

    async signOut(message) {
      // Resolve userId from session or token
      const userId =
        ("token" in message && message.token?.sub as string | undefined) ??
        ("session" in message && (message.session as { userId?: string })?.userId);
      if (!userId) return;
      try {
        const log = await prisma.loginLog.findFirst({
          where:   { userId },
          orderBy: { loginTime: "desc" },
        });
        if (!log) return;
        const now      = new Date();
        const duration = Math.round((now.getTime() - log.loginTime.getTime()) / 1000);
        await prisma.loginLog.update({
          where: { id: log.id },
          data:  { logoutTime: now, lastSeen: now, duration },
        });
      } catch { /* non-critical */ }
    },
  },

  callbacks: {
    // ── Guard: only block accounts with no email (invalid OAuth response) ───
    // Role-based access is enforced in welcome/page.tsx and [id]/layout.tsx.
    // Returning false here sends users to /?error=AccessDenied (red banner),
    // NOT the friendly pending screen — so we only block truly invalid accounts.
    async signIn({ user }) {
      if (!user?.email) return false;
      return true;
    },

    async jwt({ token, user, trigger }) {
      // ── First sign-in: embed profile data into the token once ─────────────
      if (user?.id) {
        token["uid"] = user.id;
        const profile = await prisma.profile.findUnique({
          where:  { userId: user.id },
          select: { role: true, allowedRoutes: true },
        });
        token["role"]          = (profile?.role ?? "user").toLowerCase().trim();
        token["allowedRoutes"] = (profile?.allowedRoutes ?? []) as string[];
      }

      // ── Explicit refresh from session.update() — re-read DB ───────────────
      if (trigger === "update") {
        const uid = (token["uid"] ?? token.sub) as string | undefined;
        if (uid) {
          const profile = await prisma.profile.findUnique({
            where:  { userId: uid },
            select: { role: true, allowedRoutes: true },
          });
          if (profile) {
            token["role"]          = profile.role.toLowerCase().trim();
            token["allowedRoutes"] = (profile.allowedRoutes ?? []) as string[];
          }
        }
      }

      return token;
    },

    // Zero DB calls — read directly from the already-decoded token.
    async session({ session, token }) {
      session.user.id            = ((token["uid"] ?? token.sub) as string | undefined) ?? "";
      session.user.role          = (token["role"]          as string   | undefined) ?? "user";
      session.user.allowedRoutes = (token["allowedRoutes"] as string[] | undefined) ?? [];
      session.user.email         = (token.email   as string | undefined) ?? session.user.email;
      session.user.name          = (token.name    as string | undefined) ?? session.user.name;
      session.user.image         = (token.picture as string | undefined) ?? session.user.image;
      return session;
    },
  },
});
