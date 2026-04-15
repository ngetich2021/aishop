// types/next-auth.d.ts
import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    role?:          string;
    allowedRoutes?: string[];
  }

  interface Session {
    user: {
      id:            string;
      role:          string;
      allowedRoutes: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?:          string;
    allowedRoutes?: string[];
  }
}
