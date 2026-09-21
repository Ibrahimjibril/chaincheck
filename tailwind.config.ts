import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#07090b",
        panel: "#0d1117",
        border: "#1e2530",
        accent: "#3ee8b5",
        accent2: "#38bdf8",
        danger: "#f87171",
        warn: "#fbbf24",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(62,232,181,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(62,232,181,0.05) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
export default config;
