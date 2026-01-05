"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Lock,
  LogOut,
  ChevronRight,
} from "lucide-react";

const ADMIN_PASSWORD = "deeprecall4815";

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  { href: "/admin/dojo", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/dojo/concepts", label: "Concepts", icon: BookOpen },
  { href: "/admin/dojo/exercises", label: "Exercises", icon: FileText },
];

export default function AdminDojoLayout({ children }: AdminLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Check if already authenticated
    const stored = sessionStorage.getItem("dojo-admin-auth");
    if (stored === "true") {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem("dojo-admin-auth", "true");
      setError("");
    } else {
      setError("Invalid password");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("dojo-admin-auth");
    setPassword("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-amber-500" />
              <h1 className="text-lg font-semibold text-gray-100">
                Dojo Admin
              </h1>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-gray-400 mb-1"
                >
                  Admin Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
                  placeholder="Enter password"
                  autoFocus
                />
              </div>
              {error && <div className="text-xs text-red-400">{error}</div>}
              <button
                type="submit"
                className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded transition-colors"
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-48 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-3 border-b border-gray-800">
          <h1 className="text-sm font-semibold text-amber-500">Dojo Admin</h1>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin/dojo" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  isActive
                    ? "bg-gray-800 text-gray-100"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {isActive && (
                  <ChevronRight className="w-3 h-3 ml-auto text-gray-500" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-2 py-1.5 w-full rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
