// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs";

import { handlers } from "@/auth";  // Import from your config file

export const { GET, POST } = handlers;