import "./globals.css";
import type { Metadata } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import Nav from "../components/Nav";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CivicStat — Neutraal Transparantie-Platform",
  description:
    "Parlementaire data, neutraal ontsloten. Moties, stemgedrag en verkiezingsprogramma's — traceerbaar, zonder politieke duiding.",
};

// Script to set dark class before first paint (prevents flash)
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased font-sans">
        <Nav />
        <div className="min-h-[calc(100vh-56px)]">
          {children}
        </div>
        <footer className="border-t border-border px-5 py-6 mt-12">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-text-tertiary">
              CivicStat — Democratie, controleerbaar gemaakt.
            </span>
            <div className="flex gap-4 text-xs text-text-tertiary">
              {["Over", "Methodologie", "Open API", "Governance"].map((l) => (
                <span key={l} className="cursor-pointer hover:text-text-secondary transition-colors">
                  {l}
                </span>
              ))}
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
