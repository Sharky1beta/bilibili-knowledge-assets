import type { Metadata } from "next";
import Link from "next/link";
import { Database, FileText, Layers3 } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowledge Clip Studio",
  description: "Reusable knowledge assets from long Bilibili videos.",
};

const navItems = [
  { href: "/", label: "Assets", icon: Database },
  { href: "/generate", label: "Generate", icon: FileText },
  { href: "/docs", label: "Architecture", icon: Layers3 },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <body className="notranslate">
        <div className="shell-grid">
          <aside className="border-r border-[var(--line)] bg-white px-5 py-6">
            <Link href="/" className="block">
              <div className="text-lg font-semibold tracking-tight">Knowledge Clip</div>
              <div className="mt-1 text-sm text-[var(--muted)]">Reusable video intelligence</div>
            </Link>
            <nav className="mt-8 grid gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
                  >
                    <Icon size={17} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
