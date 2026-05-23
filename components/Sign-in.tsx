"use client";

import Image from "next/image";
import { login } from "./Logins";
import { Loader2 } from "lucide-react";
import { MdArrowForwardIos } from "react-icons/md";

interface Props {
  loading: boolean;
  onLoading: (v: boolean) => void;
}

export const SignInButton = ({ loading, onLoading }: Props) => {
  const handleClick = async () => {
    if (loading) return;
    onLoading(true);
    try {
      await login();
    } catch {
      onLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      className="flex items-center justify-center gap-4 w-full py-1 text-lg font-medium text-gray-700 hover:text-gray-900 transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
    >
      {loading ? (
        <>
          <Loader2 size={24} className="animate-spin text-blue-600 shrink-0" />
          <span className="text-xl font-bold text-gray-500">Signing in…</span>
        </>
      ) : (
        <>
          <div className="relative w-9 h-9 shrink-0">
            <Image src="/google1.png" alt="Google" fill sizes="36px" className="object-contain" />
          </div>
          <span className="flex gap-2 text-xl font-bold text-blu items-center">
            LOGIN <MdArrowForwardIos className="text-green-400" />
          </span>
        </>
      )}
    </button>
  );
};
