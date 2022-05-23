import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pathRouter from 'vite-plugin-react-path-router';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), pathRouter()],
});
