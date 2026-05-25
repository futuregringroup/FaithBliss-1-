/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          pink: "var(--accent-pink)",
          purple: "var(--accent-purple)",
          fuchsia: "var(--accent-fuchsia)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          soft: "var(--brand-soft)",
        },
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        "glow-pink": "0 0 0 3px rgba(236,72,153,0.25), 0 14px 28px rgba(236,72,153,0.18)",
        "glow-purple": "0 0 0 3px rgba(124,58,237,0.2), 0 14px 28px rgba(124,58,237,0.15)",
        "card-light": "0 14px 34px rgba(15,23,42,0.08)",
        "card-dark": "0 20px 65px rgba(3,12,28,0.62)",
        "nav": "0 12px 36px rgba(2,6,23,0.6)",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.34,1.56,0.64,1)",
        "smooth": "cubic-bezier(0.25,0.46,0.45,0.94)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "micro-bounce": {
          "0%, 100%": { transform: "scale(1)" },
          "40%": { transform: "scale(0.92)" },
          "60%": { transform: "scale(1.06)" },
          "80%": { transform: "scale(0.98)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s cubic-bezier(0.25,0.46,0.45,0.94) both",
        "fade-up-slow": "fade-up 0.6s cubic-bezier(0.25,0.46,0.45,0.94) both",
        "fade-in": "fade-in 0.3s ease-out both",
        "shimmer": "shimmer 2.2s linear infinite",
        "float": "float 3.5s ease-in-out infinite",
        "micro-bounce": "micro-bounce 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      },
    },
  },
  plugins: [],
}
