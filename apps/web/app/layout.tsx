import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap"
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Neutrale Transparantie-Platform",
  description:
    "Feitelijke, traceerbare ontsluiting van moties, stemgedrag en programmapassages."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" className={`${fraunces.variable} ${plex.variable}`}>
      <body className="min-h-screen bg-mist text-ink antialiased">
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,91,77,0.15),_transparent_65%)]" />
          <div className="pointer-events-none absolute -right-32 top-32 h-80 w-80 rounded-full bg-clay/40 blur-3xl" />
          <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
