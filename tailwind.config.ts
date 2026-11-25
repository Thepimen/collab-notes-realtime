import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        codebg: 'var(--bg-code)',
        ink: 'var(--fg-primary)',
        secondary: 'var(--fg-secondary)',
        muted: 'var(--fg-muted)',
        hairline: 'var(--border-subtle)',
        borderstrong: 'var(--border-strong)',
        terracotta: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)'
        },
        sage: {
          DEFAULT: 'var(--sage)',
          soft: 'var(--sage-soft)'
        },
        ochre: {
          DEFAULT: 'var(--ochre)',
          soft: 'var(--ochre-soft)'
        }
      },
      letterSpacing: {
        editorial: '-0.015em'
      }
    }
  },
  plugins: []
};

export default config;
