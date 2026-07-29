import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        // Single hue — green scale
        green: {
          50: 'var(--green-50)',
          100: 'var(--green-100)',
          200: 'var(--green-200)',
          300: 'var(--green-300)',
          400: 'var(--green-400)',
          500: 'var(--green-500)',
          600: 'var(--green-600)',
          700: 'var(--green-700)',
          800: 'var(--green-800)',
          900: 'var(--green-900)',
        },
        // Text / structure — black scale
        ink: {
          900: 'var(--ink-900)',
          700: 'var(--ink-700)',
          500: 'var(--ink-500)',
        },
        paper: 'var(--paper)',
        white: 'var(--white)',
        line: 'var(--line)',

        // shadcn semantic aliases mapped onto the three-hue system
        border: 'var(--line)',
        input: 'var(--line)',
        ring: 'var(--green-600)',
        background: 'var(--paper)',
        foreground: 'var(--ink-900)',
        primary: {
          DEFAULT: 'var(--green-600)',
          foreground: 'var(--white-fixed)',
        },
        secondary: {
          DEFAULT: 'var(--green-50)',
          foreground: 'var(--green-900)',
        },
        muted: {
          DEFAULT: 'var(--surface-muted)',
          foreground: 'var(--ink-500)',
        },
        accent: {
          DEFAULT: 'var(--green-50)',
          foreground: 'var(--green-900)',
        },
        destructive: {
          DEFAULT: 'var(--green-50)',
          foreground: 'var(--ink-900)',
        },
        popover: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--ink-900)',
        },
        card: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--ink-900)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['1.125rem', { lineHeight: '1.4' }],
        xl: ['1.25rem', { lineHeight: '1.3' }],
        '2xl': ['1.5rem', { lineHeight: '1.2' }],
        '3xl': ['1.875rem', { lineHeight: '1.15' }],
        '4xl': ['2.25rem', { lineHeight: '1.1' }],
        '5xl': ['3rem', { lineHeight: '1.05' }],
      },
      borderRadius: {
        card: '16px',
        control: '10px',
        tile: '12px',
        pill: '999px',
        lg: '16px',
        md: '10px',
        sm: '8px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(20,83,45,.06)',
        md: '0 6px 20px -6px rgba(20,83,45,.12)',
        lg: '0 18px 40px -12px rgba(20,83,45,.18)',
        focus: '0 0 0 2px var(--paper), 0 0 0 4px var(--green-600)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'draw-in': {
          from: { strokeDashoffset: '1000' },
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
