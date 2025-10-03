import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'; // <-- Обязательно импортируй плагин

export default defineConfig({
  plugins: [
    tailwindcss(), // <-- Обязательно добавь плагин сюда
    sveltekit()
  ]
});
