import prisma from "@/lib/prisma";

/**
 * Fire-and-forget activity log. Swallows errors so it never breaks a page render.
 */
export async function logActivity(
  userId: string,
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  action?: string,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action: action ?? `Visited ${path}`,
        path,
        method,
      },
    });
  } catch {
    // Non-critical — never let logging crash the app
  }
}
