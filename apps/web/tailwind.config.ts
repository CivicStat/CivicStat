import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0E1116",
        mist: "#F4F5F7",
        moss: "#0F5B4D",
        clay: "#C9B59E",
        slate: "#4B5D67"
      }
    }
  },
  plugins: []
};

export default config;
