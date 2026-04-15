"use client";

import Image from "next/image";
import { login } from "./Logins";
import { MdArrowForwardIos } from "react-icons/md";

export const SignInButton = () => (
  <button
    onClick={() => login()}
    className="flex items-center justify-center gap-4 w-full py-1 text-lg font-medium text-gray-700 hover:text-gray-900 transition-all duration-200 active:scale-95"
    type="button"
  >
    <div className="relative w-9 h-9">
      <Image src="/google1.png" alt="Google" fill className="object-contain" />
    </div>
    <span className="flex gap-2 text-xl font-bold text-blu items-center">LOGIN<MdArrowForwardIos className="text-green-400" /></span>
  </button>
);
