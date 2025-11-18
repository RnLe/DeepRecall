"use client";

/**
 * Web Platform User Menu Wrapper
 *
 * Thin wrapper around platform-agnostic UserMenu component.
 * Connects NextAuth session to the shared UI component.
 * Handles offline detection for sign-in navigation.
 */

import { useSession, signOut } from "@/src/auth/client";
import { useRouter } from "next/navigation";
import { UserMenu as SharedUserMenu } from "@deeprecall/ui";
import { useSystemStore } from "@deeprecall/data/stores";
import { useState } from "react";
import { WifiOff, X } from "lucide-react";

export function UserMenu() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isOnline = useSystemStore((state) => state.isOnline);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  const handleSignIn = () => {
    if (!isOnline) {
      setShowOfflineModal(true);
      return;
    }
    router.push("/auth/signin");
  };

  return (
    <>
      <SharedUserMenu
        session={session}
        status={status}
        onSignIn={handleSignIn}
        onSignOut={() => signOut({ callbackUrl: "/" })}
        onNavigateProfile={() => router.push("/profile")}
      />

      {/* Offline Modal */}
      {showOfflineModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowOfflineModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <WifiOff className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No Internet Connection
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sign in requires an internet connection. Please check your
                  network and try again.
                </p>
              </div>

              <button
                onClick={() => setShowOfflineModal(false)}
                className="w-full px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
