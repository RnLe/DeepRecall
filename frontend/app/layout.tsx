import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

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
      <body className="antialiased">
        <Providers>
          <div className="min-h-screen bg-gray-950 text-gray-100">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
