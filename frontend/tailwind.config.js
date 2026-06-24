/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Professional Navy CBT color scheme
        cbt: {
          navy: {
            light: '#2a4365',
            DEFAULT: '#1e3a8a',
            dark: '#172554',
          },
          answered: '#16a34a', // Green
          unanswered: '#dc2626', // Red
          review: '#9333ea', // Purple
          unvisited: '#9ca3af', // Gray
          current: '#2563eb', // Light Blue
        }
      }
    },
  },
  plugins: [],
}
