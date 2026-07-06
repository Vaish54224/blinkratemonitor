/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: '#0a0c10',
        lens: '#12151c',
        'lens-raised': '#181c25',
        'tear-film': '#4fd8c4',
        'iris-amber': '#e8a33d',
        'alert-coral': '#ff6b5e',
        'insight-violet': '#8b7cf6',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
