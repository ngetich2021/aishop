// Route handler — only Route Handlers (and Server Actions) may modify cookies.
// welcome/page.tsx redirects here when role === "user" so next-auth can
// clear the session before sending the user to the pending notice screen.
import { signOut } from "@/auth";

export async function GET() {
  await signOut({ redirectTo: "/?notice=pending" });
}
