import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa'; // <--- ИМПОРТ ИЗ ДРУГОГО ПАКЕТА
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		// ... остальной код vite.config.ts
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'robots.txt'],
			manifest: {
				name: 'GrokWeld PWA',
				short_name: 'GrokWeld',
				description: 'Учет сварочных работ для бригадиров',
				start_url: '/grokweld',
				scope: '/grokweld',
				display: 'standalone',
				background_color: '#111827',
				theme_color: '#2563eb',
				icons: [
					{
						src: 'icons/pwa-192x192.png', // <--- ИЗМЕНИЛ ПУТЬ
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'icons/pwa-512x512.png', // <--- ИЗМЕНИЛ ПУТЬ
						sizes: '512x512',
						type: 'image/png'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg}']
			}
		})
		// ... остальной код
	]
});
