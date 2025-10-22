import type { Metadata } from "next";
import { Providers } from "./providers";
import Link from "next/link";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "DeepRecall",
  description: "Read once. Remember for years.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased overflow-hidden h-screen">
        <Providers>
          <div className="h-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
            <nav className="flex-shrink-0 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
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
                    href="/admin"
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Admin
                  </Link>
                  <Link
                    href="/admin/graph"
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Graph
                  </Link>
                </div>
              </div>
            </nav>
            <div className="flex-1 overflow-hidden">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
