"use client";

import { Providers } from "./providers";
import Link from "next/link";
import { GPUIndicator } from "./components/GPUIndicator";
import { ElectricIndicator } from "./components/ElectricIndicator";
import { PostgresIndicator } from "./components/PostgresIndicator";
import { LogViewerButton } from "@deeprecall/ui";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="h-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
        <nav className="shrink-0 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
            <Link
              href="/"
              className="font-bold text-xl flex items-center gap-2"
            >
              <img src="/favicon.ico" alt="" className="w-8 h-8" />
              DeepRecall
            </Link>
            <div className="flex gap-4 text-sm">
              <Link
                href="/library"
                className="text-gray-400 hover:text-gray-100 transition-colors"
              >
                Library
              </Link>
              <Link
                href="/reader"
                className="text-gray-400 hover:text-gray-100 transition-colors"
              >
                Reader
              </Link>
              <Link
                href="/study"
                className="text-gray-400 hover:text-gray-100 transition-colors"
              >
                Study
              </Link>
              <Link
                href="/admin/cas"
                className="text-gray-600 hover:text-gray-400 transition-colors"
              >
                CAS
              </Link>
              <Link
                href="/admin/dexie"
                className="text-gray-600 hover:text-gray-400 transition-colors"
              >
                Dexie
              </Link>
              <Link
                href="/admin/electric"
                className="text-gray-600 hover:text-gray-400 transition-colors"
              >
                Electric
              </Link>
              <Link
                href="/admin/postgres"
                className="text-gray-600 hover:text-gray-400 transition-colors"
              >
                Postgres
              </Link>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <LogViewerButton />
              <ElectricIndicator />
              <PostgresIndicator />
              <GPUIndicator />
            </div>
          </div>
        </nav>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </Providers>
  );
}
