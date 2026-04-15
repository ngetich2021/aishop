import Image    from "next/image";
import Link      from "next/link";
import { Clock } from "lucide-react";

export default function PendingScreen() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-full max-w-md">

        {/* Top banner */}
        <div className="pt-10 pb-8 px-8 bg-gradient-to-b from-blue-600 to-blue-700 flex flex-col items-center gap-4">
          <div className="relative w-24 h-24 rounded-full ring-8 ring-white/20 shadow-2xl overflow-hidden">
            <Image src="/branton_logo.png" alt="Logo" fill className="object-cover" priority />
          </div>
          <div className="flex items-center gap-2 bg-amber-400/20 border border-amber-300/40 rounded-full px-4 py-1.5">
            <Clock size={14} className="text-amber-200" />
            <span className="text-amber-100 text-xs font-bold uppercase tracking-wide">Account Pending</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-8 text-center space-y-4">
          <h1 className="text-xl font-extrabold text-gray-900">Registration Incomplete</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            Your account has been created but has <strong>not yet been registered as staff</strong> by
            an admin. You cannot access the system until an admin assigns you to a shop and sets your
            role.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left text-xs text-amber-800 space-y-1">
            <p className="font-bold">What to do next:</p>
            <ol className="list-decimal list-inside space-y-0.5 font-medium">
              <li>Contact your shop owner or system admin.</li>
              <li>Ask them to register you as staff under the correct shop.</li>
              <li>Sign in again once your account has been approved.</li>
            </ol>
          </div>

          <Link
            href="/"
            className="mt-2 inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl py-3 transition"
          >
            Back to Sign In
          </Link>

          <p className="text-[0.65rem] text-gray-400 pt-2">
            Need help?{" "}
            <a href="tel:+254704876954" className="text-blue-500 hover:underline font-semibold">
              +254 704 876 954
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
