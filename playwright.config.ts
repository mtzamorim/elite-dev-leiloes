import { defineConfig,devices } from '@playwright/test';

const real=process.env.E2E_REAL==='true';
const reuseExistingServer=!process.env.CI;
export default defineConfig({
  testDir:'./e2e',
  timeout:45_000,
  retries:1,
  workers:real?1:undefined,
  reporter:[['list']],
  use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure'},
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome']}},
    {name:'chromium-mobile',use:{...devices['Pixel 7']}}
  ],
  webServer:real?[
    {command:'npm run dev -w @atelier/api',url:'http://127.0.0.1:3001/api/health',reuseExistingServer,timeout:120_000},
    {command:'npm run dev -w @atelier/web',url:'http://127.0.0.1:5173',reuseExistingServer,timeout:120_000}
  ]:{command:'npm run dev -w @atelier/web',url:'http://127.0.0.1:5173',reuseExistingServer,timeout:120_000}
});
