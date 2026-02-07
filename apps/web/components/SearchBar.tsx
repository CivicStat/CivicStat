"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) {
      router.push(`/moties?q=${encodeURIComponent(q.trim())}`);
    } else {
      router.push("/moties");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-[520px]">
      <div className="card flex items-center gap-2 px-3 py-1">
        <svg
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          viewBox="0 0 24 24"
          className="flex-shrink-0 text-text-tertiary"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek moties, Kamerleden of partijen..."
          className="flex-1 border-none outline-none bg-transparent text-sm text-ink py-2.5 placeholder:text-text-tertiary"
        />
        {q.trim() && (
          <button
            type="submit"
            className="rounded-md bg-moss px-3 py-1.5 text-xs font-medium text-white hover:bg-moss-hover transition-colors"
          >
            Zoek
          </button>
        )}
      </div>
    </form>
  );
}
