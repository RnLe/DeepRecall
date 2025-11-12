/**
 * GuestBanner - Non-blocking sign-in prompt for guest users
 *
 * Displays a subtle banner encouraging guests to sign in to save their data.
 * Only shown when guest has created local content.
 *
 * Features:
 * - Non-intrusive placement (top banner)
 * - Dismissible (hides until next session)
 * - Shows only when guest has local data
 * - Clear call-to-action for sign-in
 */

import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";

export interface GuestBannerProps {
  /**
   * Whether the user is authenticated
   */
  isAuthenticated: boolean;

  /**
   * Whether the guest has local data
   * If false, banner is not shown
   */
  hasLocalData: boolean;

  /**
   * Callback when user clicks sign-in button
   */
  onSignIn: () => void;

  /**
   * Callback when user dismisses the banner
   * Banner won't show again until next page load
   */
  onDismiss?: () => void;
}

export function GuestBanner({
  isAuthenticated,
  hasLocalData,
  onSignIn,
  onDismiss,
}: GuestBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show banner if:
  // - User is authenticated
  // - Guest has no local data
  // - Banner was dismissed
  if (isAuthenticated || !hasLocalData || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Icon + Message */}
          <div className="flex items-center gap-3 flex-1">
            <Save className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                You're using DeepRecall as a guest
              </p>
              <p className="text-xs text-blue-100 mt-0.5">
                Sign in to save your work across devices and access cloud
                features
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSignIn}
              className="px-4 py-2 bg-white text-blue-600 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
            >
              Sign In
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-blue-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Minimal GuestBanner variant for mobile/compact views
 */
export function GuestBannerCompact({
  isAuthenticated,
  hasLocalData,
  onSignIn,
  onDismiss,
}: GuestBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isAuthenticated || !hasLocalData || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-blue-600 text-white shadow-md">
      <div className="px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Save className="w-4 h-4 shrink-0" />
            <p className="text-xs truncate">Sign in to save your work</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onSignIn}
              className="px-3 py-1 bg-white text-blue-600 rounded text-xs font-medium"
            >
              Sign In
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-blue-700 rounded"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
