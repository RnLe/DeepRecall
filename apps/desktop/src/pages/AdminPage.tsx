import { useState } from "react";
import CASPage from "./admin/CASPage";
import DexiePage from "./admin/DexiePage";
import ElectricPage from "./admin/ElectricPage";
import PostgresPage from "./admin/PostgresPage";

type AdminView = "cas" | "dexie" | "electric" | "postgres";

export default function AdminPage() {
  const [activeView, setActiveView] = useState<AdminView>("cas");

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Navigation */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-900/50">
        <div className="flex gap-1 px-6 py-3">
          <button
            onClick={() => setActiveView("cas")}
            className={`px-4 py-2 rounded transition-colors font-medium ${
              activeView === "cas"
                ? "bg-blue-600 text-white"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            CAS (Blobs)
          </button>
          <button
            onClick={() => setActiveView("dexie")}
            className={`px-4 py-2 rounded transition-colors font-medium ${
              activeView === "dexie"
                ? "bg-blue-600 text-white"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            Dexie (IndexedDB)
          </button>
          <button
            onClick={() => setActiveView("electric")}
            className={`px-4 py-2 rounded transition-colors font-medium ${
              activeView === "electric"
                ? "bg-blue-600 text-white"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            Electric (Sync)
          </button>
          <button
            onClick={() => setActiveView("postgres")}
            className={`px-4 py-2 rounded transition-colors font-medium ${
              activeView === "postgres"
                ? "bg-blue-600 text-white"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            Postgres (DB)
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === "cas" && <CASPage />}
        {activeView === "dexie" && <DexiePage />}
        {activeView === "electric" && <ElectricPage />}
        {activeView === "postgres" && <PostgresPage />}
      </div>
    </div>
  );
}
