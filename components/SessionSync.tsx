"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

/**
 * Silently refreshes the JWT whenever the server-read DB role or allowedRoutes
 * differ from what is currently in the client JWT. Placed in [id]/layout so the
 * Navbar (which reads from useSession) always reflects the latest DB state.
 */
export default function SessionSync({
  dbRole,
  dbAllowedRoutes,
}: {
  dbRole:          string;
  dbAllowedRoutes: string[];
}) {
  const { data: session, update } = useSession();
  const updatedRef = useRef(false);

  useEffect(() => {
    if (updatedRef.current) return;
    const jwtRole   = session?.user?.role ?? "";
    const jwtRoutes = (session?.user?.allowedRoutes ?? []).join(",");
    const dbRoutes  = dbAllowedRoutes.join(",");

    if (jwtRole !== dbRole || jwtRoutes !== dbRoutes) {
      updatedRef.current = true;
      update();
    }
  }, [session?.user?.role, session?.user?.allowedRoutes, dbRole, dbAllowedRoutes, update]);

  return null;
}
