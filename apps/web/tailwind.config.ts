import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      colors: {
        ink: "var(--color-ink)",
        mist: "var(--color-mist)",
        moss: "var(--color-moss)",
        "moss-hover": "var(--color-moss-hover)",
        surface: "var(--color-surface)",
        "surface-sub": "var(--color-surface-sub)",
        "surface-sub2": "var(--color-surface-sub2)",
        border: "var(--color-border)",
        "border-subtle": "var(--color-border-subtle)",
        "text-secondary": "var(--color-text-secondary)",
        "text-tertiary": "var(--color-text-tertiary)",
        "bar-voor": "var(--color-bar-voor)",
        "bar-tegen": "var(--color-bar-tegen)",
        "bar-afwezig": "var(--color-bar-afwezig)",
        "accent-subtle": "var(--color-accent-subtle)",
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-md": "var(--shadow-card-md)",
      },
    },
  },
  plugins: [],
};

export default config;
