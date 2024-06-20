/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  theme: {
    extend: {
      colors: {
        'black-21': "#212121",
        'black-23': "#23262F",
        'gray-64': "#646464",
        'gray-d6': "#D6D7FF",
        'gray-e5': "#E5E5E5",
        'gray-e6': "#E6E8EC",
        'gray-77': "#777E90",
        'green-bb': "#BBFBDC",
        'yellow-ff': "#FFF1A8",
        'red-ef': "#EF4870"
      },
      backgroundImage: theme => ({
        'gradient-primary': 'linear-gradient(90deg, #F98282 11.46%, #A65BFA 98.96%)'
      }),
      boxShadow: theme => ({
        'tag-logo': '0px 3px 10px 0px #FFFFFF7D inset'
      })
    },
    fontSize: {
      xs: ['10px', '14px'],
      sm: ['12px', '16px'],
      base: ['14px', '20px'],
      lg: ['16px', '24px'],
      xl: ['20px', '28px'],
      '2xl': ['24px', '32px'],
    }
  },
  plugins: [],
}

