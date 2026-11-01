import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Design system: "Clear sky" (see docs/DESIGN.md).
// - Tailwind's default type scale, weights and tracking are back (Inter does
//   not need the letterpress overrides).
// - Radii are soft (buttons 10px, cards 16px), shadows are navy-tinted blurs
//   driven by --shadow-color so they adapt to dark mode.
const SANS = ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"];
const shadow = (alpha: number) => `hsl(var(--shadow-color) / ${alpha})`;

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1400px" },
    },
    fontFamily: {
      sans: SANS,
      display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
    },
    borderRadius: {
      none: "0",
      sm: "6px",
      DEFAULT: "8px",
      md: "8px",
      lg: "10px",
      xl: "12px",
      "2xl": "16px",
      "3xl": "24px",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      sm: `0 1px 2px 0 ${shadow(0.06)}`,
      DEFAULT: `0 1px 3px 0 ${shadow(0.08)}, 0 1px 2px -1px ${shadow(0.06)}`,
      md: `0 4px 12px -2px ${shadow(0.08)}, 0 2px 4px -2px ${shadow(0.05)}`,
      lg: `0 12px 24px -6px ${shadow(0.1)}, 0 4px 8px -4px ${shadow(0.06)}`,
      xl: `0 24px 48px -12px ${shadow(0.16)}`,
      "2xl": `0 24px 48px -12px ${shadow(0.16)}`,
      inner: `inset 0 1px 2px 0 ${shadow(0.06)}`,
      // Soft rose glow under the primary button.
      cta: "0 6px 16px -4px hsl(var(--primary) / 0.35)",
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          alt: "hsl(var(--surface-alt))",
          band: "hsl(var(--surface-band))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          active: "hsl(var(--primary-active))",
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
        // The €10 offer: soft pink surface, dark rose text, pink hairline.
        offer: {
          DEFAULT: "hsl(var(--offer))",
          foreground: "hsl(var(--offer-foreground))",
          border: "hsl(var(--offer-border))",
        },
        // Semantic accents. Use as text/border + a /10 tint,
        // e.g. `border-success/30 bg-success/10 text-success`.
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
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
