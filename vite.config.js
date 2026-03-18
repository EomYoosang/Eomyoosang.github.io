import { basename } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repositoryName =
  process.env.GITHUB_REPOSITORY?.split('/')[1] ?? basename(process.cwd());
const base = repositoryName.endsWith('.github.io') ? '/' : `/${repositoryName}/`;

export default defineConfig({
  plugins: [react()],
  base,
});
