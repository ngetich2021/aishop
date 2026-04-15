import Image from 'next/image';
import { SignInButton } from './Sign-in';
import PWAInstallBar from './PWAInstallBar';

const ERROR_MESSAGES: Record<string, string> = {
  Configuration:      "Sign-in could not be completed. Please try again.",
  AccessDenied:       "Access denied. Your account is not authorised.",
  Verification:       "The sign-in link has expired. Please request a new one.",
  OAuthSignin:        "Could not start Google sign-in. Please try again.",
  OAuthCallback:      "Something went wrong during sign-in. Please try again.",
  OAuthCreateAccount: "Could not create your account. Please contact support.",
  Default:            "An unexpected error occurred. Please try again.",
};

export default function GoogleSignIn({ authError }: { authError?: string }) {
  const errorMsg = authError
    ? (ERROR_MESSAGES[authError] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
      <div className="max-w-sm w-full space-y-4">
        {errorMsg && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center font-medium">
            ⚠ {errorMsg}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header with Logo */}
          <div className="pt-10 pb-8 px-8 bg-gradient-to-b from-blue-600 to-blue-700 flex flex-col items-center">
            <div className="relative w-24 h-24 rounded-full ring-8 ring-white/20 shadow-2xl overflow-hidden">
              <Image
                src="/branton_logo.png"
                alt="Kwenik Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <h1 className="mt-4 text-white text-xl font-extrabold tracking-tight">Kwenik</h1>
            <p className="text-blue-200 text-xs mt-0.5">Business Management Platform</p>
          </div>

          {/* Main Content */}
          <div className="px-8 py-8 space-y-5">
            <div className="text-center">
              <p className="text-gray-700 font-semibold">Welcome back</p>
              <p className="text-sm text-gray-400 mt-0.5">Sign in to continue to your account</p>
            </div>

            {/* Google Sign-In */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl blur opacity-60 group-hover:opacity-90 transition duration-300" />
              <div className="relative bg-white rounded-xl px-6 py-5 border border-gray-200 hover:border-gray-300 transition-all shadow-sm">
                <SignInButton />
              </div>
            </div>

            {/* Install / Share */}
            <div className="pt-1">
              <p className="text-[0.7rem] text-gray-400 text-center font-medium mb-3 uppercase tracking-widest">Get the App</p>
              <PWAInstallBar />
            </div>

            {/* Footer */}
            <div className="pt-2 space-y-1 text-center border-t border-gray-100">
              <p className="text-[0.7rem] text-gray-400">
                Need help?{' '}
                <a href="tel:+254704876954" className="text-blue-600 hover:text-blue-700 font-bold">
                  +254 704 876 954
                </a>
              </p>
              <p className="text-[0.65rem] text-gray-300">
                Developed by{' '}
                <span className="font-semibold text-blue-500">Kwenik Developers</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
