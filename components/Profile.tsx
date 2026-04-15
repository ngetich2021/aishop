"use client";

import { useSession } from "next-auth/react";
import Image from "next/image";
import { SignOutButton } from "./Sign-Out";



export default function Profile() {
  const { data: session } = useSession();

  return (
    <div className="fixed  w-fit bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
      <div className="flex items-center gap-3">
        {session?.user?.image ? (
          <Image
            src={session.user.image}
            alt="Avatar"
            width={40}
            height={40}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-lg font-medium text-gray-600">
            {session?.user?.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {session?.user?.name || "User"}
          </p>
          <p className="text-xs text-gray-600 truncate">{session?.user?.email}</p>
        </div>
      </div>

      <div className="mt-2 text-center">
        <SignOutButton />
      </div>
    </div>
  );
}