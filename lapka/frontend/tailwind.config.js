/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx,mdx}',
    './components/**/*.{js,jsx,ts,tsx,mdx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        lapka: {
          50: '#f5f9ff',
          100: '#eaf3ff',
          200: '#cfe1f4',
          300: '#afcae7',
          400: '#7eb0de',
          500: '#4f95d1',
          600: '#3279b4',
          700: '#235c8e',
          800: '#1e4a73',
          900: '#1a3f61'
        },
        mint: {
          50: '#f0fcf8',
          100: '#ddf7ee',
          200: '#bcefdc',
          300: '#8ee2c4',
          400: '#58cfa6',
          500: '#37be93',
          600: '#249873',
          700: '#1e795e',
          800: '#1d604c',
          900: '#194f40'
        },
        peach: {
          50: '#fff7f1',
          100: '#ffeedf',
          200: '#ffd8bc',
          300: '#ffba8b',
          400: '#ff9358',
          500: '#fc7630'
        }
      },
      boxShadow: {
        soft: '0 10px 24px rgba(34, 85, 135, 0.09)',
        card: '0 14px 32px rgba(28, 72, 119, 0.12)',
        float: '0 22px 46px rgba(31, 74, 117, 0.16)'
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.5rem'
      },
      backgroundImage: {
        'lapka-gradient': 'linear-gradient(135deg, #4f95d1 0%, #37be93 100%)',
        'lapka-surface': 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,250,255,0.92))'
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.28s ease-out'
      }
    }
  },
  plugins: []
};
