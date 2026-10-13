import type { CapacitorConfig } from '@capacitor/cli';

// Set by `npm run ios:live` only: makes the native app load the Vite dev server instead
// of the bundled web build, for live reload. Never set for a build you intend to ship.
const devServerUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.ncali1.fittrack',
  appName: 'FitTrack',
  webDir: 'dist',
  ...(devServerUrl ? { server: { url: devServerUrl, cleartext: true } } : {}),
};

export default config;
