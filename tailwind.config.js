/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  theme: {
    extend: {
      colors: {
        'grey-light': "#ebebeb",
        'grey-light-hover': "#e2e2e2",
        'grey-light-active': "#c2c2c2",
        'grey-normal': "#3b3b3b",
        'grey-normal-hover': "#353535",
        'grey-normal-active': "#2f2f2f",
        'orange-light': "#fff4ec",
        'orange-light-hover': "#ffefe2",
        'orange-light-active': "#ffddc3",
        'orange-normal': "#fe913f",
        'orange-normal-hover': "#e58339",
        'orange-normal-active': "#cb7432",
        'green-hover': '#6D8C7F',
        'green-b6': "#b6ead3",
        'yellow-fa': "#faedaa",
        'red-ff': "#ff3d55",
        'purple-c1': "#c1c3ff",
        'grey-fa': "#FAFAFA",
        'grey-64': "#646464",
        'grey-e6': "#E6E8EC",
        'grey-3f': "#3F3F3F",
        'grey-bd': "#BDBDBD",
        'grey-6f': "#6F6F6F",
        'grey-e7': "#E7E7E7",
        'grey-93': "#9395A4",
        'grey-c9': "#C9C9C9",
        'grey-f0': "#F0F0F0",
        'grey-8d': "#8D8D8D",
        'grey-8e': "#8E8E93",
        'black-19': "#191C32",
        'blue-active': "#575873"
      },
      backgroundImage: theme => ({
        'gradient-primary': 'linear-gradient(213.44deg, #FEB14C -14.77%, #FE2C1A 116.22%);',
        'img-home': 'url("@/assets/images/main-bg.svg")',
        'img-common': 'url("@/assets/images/main-bg1.svg")'
      }),
      boxShadow: theme => ({
        'tag-logo': '0px 3px 10px 0px #FFFFFF7D inset',
        'popper-tip': '0px 0px 12px rgba(0,0,0,0.12)',
        'tab': '0px 20px 40px 0px #373E7D1A',
        'insert-white': '1px 1000px 2px #ffffff inset;'
      })
    },
    fontSize: {
      'xs': ['10px', '14px'],
      'sm': ['12px', '16px'],
      'base': ['14px', '20px'],
      'lg': ['16px', '24px'],
      'xl': ['20px', '28px'],
      '2xl': ['24px', '32px'],
      '3xl': ['28px', '36px'],
      '4xl': ['32px', '40px'],
      'h1': ['32px', {lineHeight: '36px', fontWeight: '800',}],
      'h2': ['22px', {lineHeight: '26px', fontWeight: '700', letterSpacing: '-0.05em'}],
      'h3': ['16px', {lineHeight: '20px', fontWeight: '700', letterSpacing: '-0.02em'}],
      'h4': ['14px', {lineHeight: '16px', fontWeight: '400', letterSpacing: '-0.02em'}],
      'h5': ['14px', {lineHeight: '16px', fontWeight: '700', letterSpacing: '-0.02em'}],
    }
  },
  plugins: [],
}

