import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      fallback: 'index.html' // SPA-режим
    }),
    paths: {
      base: process.env.NODE_ENV === 'production' ? '/grokweld' : '',
    }
  }
};