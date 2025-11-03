/**
 * Platform-Agnostic User Menu Component
 *
 * Displays sign-in button for guests or user avatar/menu for authenticated users.
 * Platform-specific adapters inject navigation and auth functions.
 */

import { useState, useRef, useEffect } from "react";

export interface UserSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    provider?: string;
  };
}

export interface UserMenuProps {
  session: UserSession | null;
  status: "loading" | "authenticated" | "unauthenticated";
  onSignIn: () => void;
  onSignOut: () => void;
  onNavigateProfile?: () => void;
}

export function UserMenu({
  session,
  status,
  onSignIn,
  onSignOut,
  onNavigateProfile,
}: UserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Loading state
  if (status === "loading") {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse"></div>
    );
  }

  // Guest (not signed in)
  if (!session?.user) {
    return (
      <button
        onClick={onSignIn}
        className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      >
        Sign In
      </button>
    );
  }

  // Authenticated user
  const user = session.user;
  const displayName = user.name || user.email?.split("@")[0] || "User";
  const avatarUrl =
    user.image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-8 h-8 rounded-full border-2 border-gray-700"
        />
        <span className="text-sm text-gray-300 hidden sm:block">
          {displayName}
        </span>
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-sm font-medium text-white">{displayName}</p>
            {user.email && (
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            )}
            {user.provider && (
              <p className="text-xs text-gray-500 mt-1">
                via {user.provider === "google" ? "Google" : "GitHub"}
              </p>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {onNavigateProfile && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onNavigateProfile();
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Profile & Settings
              </button>
            )}
            <button
              onClick={() => {
                setMenuOpen(false);
                onSignOut();
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
