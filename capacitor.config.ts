import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cmc.social',
  appName: 'CMC Social',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#2D3339",
      showSpinner: true,
      spinnerColor: "#FFFFFF"
    }
  }
};

export default config;