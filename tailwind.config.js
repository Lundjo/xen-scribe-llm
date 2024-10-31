/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#EDF7FA",
          100: "#DCEEF2",
          200: "#ADD4E0",
          300: "#81B9CC",
          400: "#3C84A6",
          500: "#0a5580",
          600: "#084873",
          700: "#06365E",
          800: "#04284D",
          900: "#021B38",
          950: "#010F24",
        },
      },
    },
  },
  plugins: [],
};
