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
        'black-3f': '#3F3F3F',
        'gray-64': "#646464",
        'gray-d6': "#D6D7FF",
        'gray-e5': "#E5E5E5",
        'gray-e6': "#E6E8EC",
        'gray-77': "#777E90",
        'gray-8C': "#8C8C8C",
        'gray-f0': "#F0F0F0",
        'green-bb': "#BBFBDC",
        'yellow-ff': "#FFF1A8",
        'red-ef': "#EF4870",
        'purple-a4': '#A4A8FF',
        'purple-c9': '#C9A8FF'
      },
      backgroundImage: theme => ({
        'gradient-primary': 'linear-gradient(90deg, #F98282 11.46%, #A65BFA 98.96%)',
        'img-home': 'url("@/assets/images/main-bg.svg")',
        'img-common': 'url("@/assets/images/main-bg1.svg")'
      }),
      boxShadow: theme => ({
        'tag-logo': '0px 3px 10px 0px #FFFFFF7D inset',
        'popper-tip': '0px 0px 12px rgba(0,0,0,0.12)'
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

