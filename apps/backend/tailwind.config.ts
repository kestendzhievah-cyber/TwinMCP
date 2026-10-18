import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Design system: a letterpress business card (see docs/DESIGN.md).
// Global overrides below deliberately re-map Tailwind's defaults so the whole
// app inherits the card's voice without per-file churn:
// - every radius is 0 (card stock has square corners; `rounded-full` stays
//   round for dots and avatars),
// - weights are lightened (Garamond's bold is too heavy for letterpress),
// - tracking-tight becomes neutral (negative tracking is a grotesque habit),
// - the type scale is ~6% larger (Garamond's x-height is small),
// - shadows become hairline/stacked-card effects instead of soft blurs.
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    fontFamily: {
      sans: ["var(--font-serif)", "Garamond", "Georgia", "serif"],
      serif: ["var(--font-serif)", "Garamond", "Georgia", "serif"],
      mono: ["var(--font-mono)", "Courier New", "Courier", "monospace"],
    },
    fontSize: {
      xs: ["0.8125rem", { lineHeight: "1.25rem" }],
      sm: ["0.9375rem", { lineHeight: "1.4rem" }],
      base: ["1.0625rem", { lineHeight: "1.65rem" }],
      lg: ["1.1875rem", { lineHeight: "1.75rem" }],
      xl: ["1.375rem", { lineHeight: "1.85rem" }],
      "2xl": ["1.625rem", { lineHeight: "2.1rem" }],
      "3xl": ["2rem", { lineHeight: "2.4rem" }],
      "4xl": ["2.5rem", { lineHeight: "2.85rem" }],
      "5xl": ["3.25rem", { lineHeight: "1.08" }],
      "6xl": ["4rem", { lineHeight: "1.05" }],
      "7xl": ["5rem", { lineHeight: "1" }],
      "8xl": ["6rem", { lineHeight: "1" }],
      "9xl": ["8rem", { lineHeight: "1" }],
    },
    fontWeight: {
      thin: "300",
      extralight: "300",
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "500",
      bold: "600",
      extrabold: "700",
      black: "700",
    },
    letterSpacing: {
      tighter: "-0.01em",
      tight: "0",
      normal: "0",
      wide: "0.05em",
      wider: "0.1em",
      widest: "0.2em",
      sc: "0.12em",
      eyebrow: "0.28em",
    },
    borderRadius: {
      none: "0",
      sm: "0",
      DEFAULT: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      sm: "0 1px 0 0 hsl(var(--foreground) / 0.06)",
      DEFAULT: "0 1px 0 0 hsl(var(--foreground) / 0.06)",
      md: "0 1px 2px 0 hsl(var(--foreground) / 0.08)",
      lg: "3px 3px 0 0 hsl(var(--card)), 3px 3px 0 1px hsl(var(--border))",
      xl: "4px 4px 0 0 hsl(var(--card)), 4px 4px 0 1px hsl(var(--border)), 8px 8px 0 0 hsl(var(--card)), 8px 8px 0 1px hsl(var(--border))",
      "2xl":
        "4px 4px 0 0 hsl(var(--card)), 4px 4px 0 1px hsl(var(--border)), 8px 8px 0 0 hsl(var(--card)), 8px 8px 0 1px hsl(var(--border))",
      // A stack of cards — the photo's signature. Use on hero mockups, dialogs,
      // the highlighted pricing tier.
      stack:
        "4px 4px 0 0 hsl(var(--card)), 4px 4px 0 1px hsl(var(--border)), 8px 8px 0 0 hsl(var(--card)), 8px 8px 0 1px hsl(var(--border))",
      // Ink pressed into stock — for inputs and pressed states.
      press: "inset 0 1px 2px 0 hsl(var(--foreground) / 0.12)",
      inner: "inset 0 1px 2px 0 hsl(var(--foreground) / 0.08)",
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Semantic accents (see globals.css). Use as text/border + a /10 tint,
        // e.g. `border-success/40 bg-success/10 text-success`.
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
        },
        gilt: {
          DEFAULT: "hsl(var(--gilt))",
          foreground: "hsl(var(--gilt-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
