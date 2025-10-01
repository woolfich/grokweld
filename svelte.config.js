import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      fallback: '404.html' // ← ВАЖНО: для GitHub Pages
    }),
    paths: {
      base: '/grokweld' // ← всегда указываем имя репо
    }
  }
};