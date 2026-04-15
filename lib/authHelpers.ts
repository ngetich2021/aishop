
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireRole(role: string) {
  const session = await auth();

  if (!session?.user || session.user.role !== role) {
    redirect("/"); // redirect if role doesn't match
  }

  return session;
}
