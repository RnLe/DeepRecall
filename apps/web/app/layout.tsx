import type { Metadata } from "next";
import { ClientLayout } from "./ClientLayout";
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
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
