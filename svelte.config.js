import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss({           // ← важно ставить ДО sveltekit
      basePath: './grokweld' // ← тот же путь, что и в svelte.config.js
    }),
    sveltekit()
  ],
  base: './grokweld/'       // ← ещё одно место, куда Vite вставит префикс
});
