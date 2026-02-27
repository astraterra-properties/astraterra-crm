/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#131B2B',
        'primary-dark': '#0d1420',
        secondary: '#C9A96E',
        'secondary-dark': '#8A6F2F',
        accent: '#C9A96E',
        sidebar: '#131B2B',
        'sidebar-hover': '#1e2a3d',
        'sidebar-active': '#C9A96E',
        gold: '#C9A96E',
        'gold-dark': '#8A6F2F',
        navy: '#131B2B',
        'navy-light': '#1e2a3d',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #C9A96E, #8A6F2F)',
        'navy-gradient': 'linear-gradient(135deg, #131B2B, #1e2a3d)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
