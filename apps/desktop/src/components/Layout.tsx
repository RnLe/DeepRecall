import { Link, useLocation } from "react-router-dom";
import { GPUIndicator } from "./indicators/GPUIndicator";
import { PostgresIndicator } from "./indicators/PostgresIndicator";
import { ElectricIndicator } from "./indicators/ElectricIndicator";
import { LogViewerButton, ConnectionStatusIndicator } from "@deeprecall/ui";
import { UserMenu } from "./UserMenu";
import { useConnectionStatus } from "@deeprecall/data/hooks";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const connectionStatus = useConnectionStatus();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-950 text-gray-100 overflow-hidden">
      {/* Desktop-style navigation bar */}
      <nav className="flex items-center bg-linear-to-brom-gray-900 to-gray-950 border-b border-gray-800 h-14 shrink-0 select-none [app-region:drag]">
        <div className="flex items-center gap-2.5 px-5 h-full border-r border-gray-800 [app-region:no-drag]">
          <img src="/favicon.ico" alt="" className="w-7 h-7" />
          <span className="font-semibold text-[15px] text-white tracking-tight">
            DeepRecall
          </span>
        </div>
        <div className="flex h-full flex-1 [app-region:no-drag]">
          <Link
            to="/library"
            className={`flex items-center gap-2 px-6 h-full text-gray-400 no-underline text-sm font-medium border-none border-r border-gray-800 bg-transparent transition-all duration-150 relative hover:bg-gray-900 hover:text-gray-100 ${
              isActive("/library")
                ? "bg-gray-950 text-white border-b-2 border-b-blue-500"
                : ""
            }`}
          >
            <svg
              className="w-[18px] h-[18px] shrink-0"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>Library</span>
          </Link>
          <Link
            to="/reader"
            className={`flex items-center gap-2 px-6 h-full text-gray-400 no-underline text-sm font-medium border-none border-r border-gray-800 bg-transparent transition-all duration-150 relative hover:bg-gray-900 hover:text-gray-100 ${
              isActive("/reader")
                ? "bg-gray-950 text-white border-b-2 border-b-blue-500"
                : ""
            }`}
          >
            <svg
              className="w-[18px] h-[18px] shrink-0"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>Reader</span>
          </Link>
          <Link
            to="/study"
            className={`flex items-center gap-2 px-6 h-full text-gray-400 no-underline text-sm font-medium border-none border-r border-gray-800 bg-transparent transition-all duration-150 relative hover:bg-gray-900 hover:text-gray-100 ${
              isActive("/study")
                ? "bg-gray-950 text-white border-b-2 border-b-blue-500"
                : ""
            }`}
          >
            <svg
              className="w-[18px] h-[18px] shrink-0"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Study</span>
          </Link>
        </div>
        <div className="flex h-full border-l border-gray-800 [app-region:no-drag]">
          <Link
            to="/admin"
            className={`flex items-center gap-2 px-6 h-full text-gray-400 no-underline text-sm font-medium border-none bg-transparent transition-all duration-150 relative hover:bg-gray-900 hover:text-gray-100 ${
              isActive("/admin")
                ? "bg-gray-950 text-white border-b-2 border-b-blue-500"
                : ""
            }`}
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Admin</span>
          </Link>
        </div>
        {/* Status Indicators */}
        <div className="flex items-center gap-2 px-4 border-l border-gray-800 [app-region:no-drag]">
          <LogViewerButton />
          <ConnectionStatusIndicator status={connectionStatus} />
          <ElectricIndicator />
          <PostgresIndicator />
          <GPUIndicator />
          <div className="h-6 w-px bg-gray-700 mx-2"></div>
          <UserMenu />
        </div>
      </nav>
      <main className="flex-1 overflow-hidden bg-gray-950">{children}</main>
    </div>
  );
}
