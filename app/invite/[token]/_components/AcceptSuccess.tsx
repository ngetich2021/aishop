"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter }  from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function AcceptSuccess({ shopId, shopName }: { shopId: string; shopName: string }) {
  const { update } = useSession();
  const router     = useRouter();

  useEffect(() => {
    // Refresh the JWT so the new role + shopId are picked up immediately
    update().then(() => router.push(`/${shopId}/dashboard`));
  }, []); // eslint-disable-line

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border-2 border-emerald-200 max-w-md w-full px-8 py-10 text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h1 className="text-xl font-black text-emerald-800">Welcome aboard!</h1>
        <p className="text-sm text-gray-600">
          You have joined <strong>{shopName}</strong>. Taking you to your dashboard…
        </p>
        <div className="flex justify-center pt-2">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
        </div>
      </div>
    </div>
  );
}
