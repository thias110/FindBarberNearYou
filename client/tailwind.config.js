/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f8f4",
          100: "#e0ede3",
          500: "#2f6b46",
          700: "#1f4a30",
          900: "#122b1c",
        },
      },
    },
  },
  plugins: [],
};
