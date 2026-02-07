"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { href: "/" as const, label: "Home" },
  { href: "/moties" as const, label: "Moties" },
  { href: "/kamerleden" as const, label: "Kamerleden" },
  { href: "/partijen" as const, label: "Partijen" },
];

function ShieldIcon() {
  return (
    <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const mobileIcons: Record<string, (props: { active: boolean }) => JSX.Element> = {
  "/": ({ active }) => (
    <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  "/moties": ({ active }) => (
    <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  "/kamerleden": ({ active }) => (
    <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  "/partijen": ({ active }) => (
    <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" />
    </svg>
  ),
};

export default function Nav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Desktop top nav */}
      <header className="sticky top-0 z-50 h-14 border-b border-border" style={{ background: "var(--nav-bg)", backdropFilter: "blur(18px) saturate(180%)", WebkitBackdropFilter: "blur(18px) saturate(180%)" }}>
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-moss">
              <span className="text-white dark:text-[#0E1623]"><ShieldIcon /></span>
            </div>
            <span className="text-[17px] font-serif text-ink tracking-tight">CivicStat</span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-[7px] px-3.5 py-1.5 text-[13.5px] transition-colors ${
                  isActive(item.href)
                    ? "bg-surface-sub font-semibold text-ink"
                    : "text-text-secondary hover:bg-surface-sub/60"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* placeholder for theme toggle / search */}
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = mobileIcons[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                active ? "text-moss" : "text-text-tertiary"
              }`}
            >
              {Icon && <Icon active={active} />}
              <span className={`text-[10.5px] ${active ? "font-semibold" : ""}`}>
                {item.label === "Kamerleden" ? "Leden" : item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
