/**
 * Sign-In Page
 *
 * OAuth-based authentication with Google and GitHub.
 * No passwords, no local authentication.
 */

import { redirect } from "next/navigation";
import { auth } from "@/src/auth/server";
import { SignInForm } from "./_components/SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  // If already signed in, redirect to library
  const session = await auth();
  if (session?.user) {
    redirect("/library");
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/library";
  const error = params.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              DeepRecall
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Read once. Remember for years.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error === "OAuthAccountNotLinked"
                  ? "This email is already associated with another provider. Please sign in with the original provider."
                  : "An error occurred during sign-in. Please try again."}
              </p>
            </div>
          )}

          {/* Sign-In Form */}
          <SignInForm callbackUrl={callbackUrl} />

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              By signing in, you agree to our Terms of Service and Privacy
              Policy.
            </p>
          </div>
        </div>

        {/* Guest Mode Notice */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Want to try without signing in?{" "}
            <a
              href="/library"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Continue as guest
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
