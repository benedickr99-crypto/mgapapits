import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        primary: {
          DEFAULT: "#166534", // deep green
          foreground: "#ffffff",
        },

        accent: {
          DEFAULT: "#f59e0b", // gold
          foreground: "#ffffff",
        },

        muted: {
          DEFAULT: "#f3f4f6",
          foreground: "#6b7280",
        },
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },

      boxShadow: {
        glass: "0 10px 30px rgba(0,0,0,0.15)",
        card: "0 4px 20px rgba(0,0,0,0.08)",
      },

      backdropBlur: {
        xs: "2px",
      },

      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },

      animation: {
        fadeUp: "fadeUp 0.6s ease forwards",
        fadeIn: "fadeIn 0.5s ease-in-out",
        scaleIn: "scaleIn 0.3s ease-out",
      },
    },
  },

  plugins: [animate],
} satisfies Config;