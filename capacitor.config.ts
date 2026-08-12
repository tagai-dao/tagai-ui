import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'fun.tagai.app',
  appName: 'TagAI',
  webDir: 'dist',
  server: {
    hostname: 'tagai.fun',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER',
      showSpinner: false,
    },
  },
}

export default config
