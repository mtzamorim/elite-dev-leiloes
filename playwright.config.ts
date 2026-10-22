import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',
  timeout:25000,
  retries:1,
  reporter:[['list']],
  use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure'},
  projects:[{name:'chromium-desktop',use:{...devices['Desktop Chrome']}},{name:'chromium-mobile',use:{...devices['Pixel 7']}}],
  webServer:{command:'npm run dev -w @atelier/web',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:120_000}
});
