/**
 * Root Layout for Mobile App
 * Similar to web app layout with navigation and indicators
 */

import { Link, Outlet, useNavigate } from "react-router-dom";
import { GPUIndicator } from "./indicators/GPUIndicator";
import { ElectricIndicator } from "./indicators/ElectricIndicator";
import { PostgresIndicator } from "./indicators/PostgresIndicator";
import { TelemetryLogViewerButton } from "@deeprecall/ui";
import { UserMenu } from "./UserMenu";

export function Layout() {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
      {/* Navigation Bar */}
      <nav className="shrink-0 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-4">
          <Link to="/" className="font-bold text-lg flex items-center gap-2">
            <img src="/favicon.ico" alt="" className="w-6 h-6" />
            DeepRecall
          </Link>
          <div className="flex gap-3 text-xs">
            <Link
              to="/library"
              className="text-gray-400 hover:text-gray-100 transition-colors"
            >
              Library
            </Link>
            <Link
              to="/board"
              className="text-gray-400 hover:text-gray-100 transition-colors"
            >
              Board
            </Link>
            <Link
              to="/reader"
              className="text-gray-400 hover:text-gray-100 transition-colors"
            >
              Reader
            </Link>
            <Link
              to="/study"
              className="text-gray-400 hover:text-gray-100 transition-colors"
            >
              Study
            </Link>
            <Link
              to="/admin/cas"
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              CAS
            </Link>
            <Link
              to="/admin/dexie"
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              Dexie
            </Link>
            <Link
              to="/admin/electric"
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              Electric
            </Link>
            <Link
              to="/admin/postgres"
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              Postgres
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <UserMenu />
            <TelemetryLogViewerButton
              onNavigate={() => navigate("/admin/logs")}
            />
            <GPUIndicator />
            <ElectricIndicator />
            <PostgresIndicator />
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
