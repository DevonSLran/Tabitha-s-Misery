/** Tabitha's Misery — Tailwind v3 config.
 * Colours point at the CSS variables in tokens.css, so `bg-surface` is automatically correct
 * in light and dark. Do not use Tailwind's default palette (no bg-gray-*, text-red-*).
 * Opacity modifiers (bg-surface/50) won't work on var() colours; use the -soft tokens instead.
 *
 * If you use the Play CDN build that's bundled in the APK, assign this object to
 * `tailwind.config` in a <script> after loading it, in ONE shared file (not per page).
 */
module.exports = {
  content: ['./*.html', './js/**/*.js'],
  // Built from a status key at runtime (TM.budgetStatus().key), so the scanner can't see them.
  safelist: ['pill--ok', 'pill--near', 'pill--over', 'bar-fill--ok', 'bar-fill--near', 'bar-fill--over'],
  darkMode: ['class', '[data-theme="dark"]'], // rarely needed: tokens already switch
  theme: {
    screens: { sm: '375px', md: '768px', lg: '1024px', xl: '1280px' },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: 'var(--bg)',
      surface: 'var(--surface)',
      sunken: 'var(--sunken)',
      line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
      text: { DEFAULT: 'var(--text)', 2: 'var(--text-2)' },
      muted: 'var(--muted)',
      faint: 'var(--faint)',
      ink: 'var(--text)',          // fills: primary button, active nav, toast
      'on-ink': 'var(--surface)',  // text/icons on ink
      accent: { DEFAULT: 'var(--accent)', soft: 'var(--accent-soft)', text: 'var(--accent-text)', 'on-ink': 'var(--on-ink-accent)' },
      positive: { DEFAULT: 'var(--positive)', soft: 'var(--positive-soft)', text: 'var(--positive-text)' },
      warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)', text: 'var(--warning-text)' },
      negative: { DEFAULT: 'var(--negative)', soft: 'var(--negative-soft)', text: 'var(--negative-text)' },
      cat: {
        food: 'var(--cat-food)', transport: 'var(--cat-transport)', health: 'var(--cat-health)',
        utilities: 'var(--cat-utilities)', entertainment: 'var(--cat-entertainment)',
        shopping: 'var(--cat-shopping)', bills: 'var(--cat-bills)',
      },
    },
    fontFamily: {
      serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      sans: ['"IBM Plex Sans"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
    },
    fontSize: {
      // name: [size, lineHeight]
      caption: ['12px', '16px'],
      label: ['13px', '16px'],
      'body-s': ['14px', '20px'],
      // Phone sizes are deliberately compact; md: overrides restore the larger desktop scale.
      body: ['15px', '22px'],
      title: ['15px', '20px'],     // + font-semibold: row titles
      'title-l': ['20px', '26px'], // + font-semibold
      'page': ['28px', '32px'],    // serif page title on phone
      display: ['30px', '34px'],
      'money-xs': ['28px', '32px'],
      'money-s': ['36px', '40px'],
      'money': ['44px', '48px'],
      'money-xl': ['72px', '72px'], // desktop hero
    },
    borderRadius: {
      none: '0', xs: '6px', s: '10px', tile: '12px', m: '16px', card: '20px', l: '24px', full: '999px',
    },
    boxShadow: {
      none: 'none', e1: 'var(--shadow-e1)', fab: 'var(--shadow-fab)', e2: 'var(--shadow-e2)', e3: 'var(--shadow-e3)',
      focus: 'var(--focus-ring)',
    },
    extend: {
      spacing: {
        gutter: 'var(--gutter)', nav: 'var(--nav-h)',
        'safe-t': 'var(--safe-top)', 'safe-b': 'var(--safe-bottom)',
        11: '44px', 13: '52px', 14: '56px',
      },
      minHeight: { tap: '44px', row: '58px' },
      maxWidth: { content: '1040px' },
    },
  },
  plugins: [], // NOTE: do not add @tailwindcss/forms. Its reset is what turned inputs white.
};
