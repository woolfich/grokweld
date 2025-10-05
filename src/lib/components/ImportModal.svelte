<!-- src/lib/components/ImportModal.svelte -->
<script lang="ts">
	import { db, type Welder, type WorkEntry } from '$lib/db';
	import { createEventDispatcher } from 'svelte';

	export let isOpen: boolean;
	const dispatch = createEventDispatcher<{ close: null; imported: null }>();

	let fileInput: HTMLInputElement;
	let errorMessage = '';
	let successMessage = '';

	const normalizeArticle = (art: string) => art.replace(/\s+/g, '').toLowerCase();
	const normalizeWelder = (name: string) => name.trim();

	async function handleFileUpload(event: Event) {
		errorMessage = '';
		successMessage = '';
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) {
			errorMessage = 'Выберите файл';
			return;
		}

		try {
			const data = JSON.parse(await file.text());

			if (!Array.isArray(data.welders) || !Array.isArray(data.workEntries)) {
				throw new Error('Ожидаются массивы welders и workEntries');
			}

			const importedWelders: Welder[] = data.welders.map((w: any) => ({
				// id из файла не используем, пусть Dexie создает свой
				name: normalizeWelder(w.name || ''),
				createdAt: new Date(w.createdAt)
			}));

			const importedWorkEntries: WorkEntry[] = data.workEntries.map((e: any) => ({
				// id из файла не используем
				welder: normalizeWelder(e.welder || ''),
				article: normalizeArticle(e.article || ''),
				quantity: parseFloat(e.quantity),
				month: e.month,
				createdAt: new Date(e.createdAt),
				updatedAt: new Date(e.updatedAt),
				history: (e.history || []).map((h: any) => ({
					date: new Date(h.date),
					from: parseFloat(h.from),
					to: parseFloat(h.to)
				}))
			}));

			// Проверка на целостность данных
			const welderNames = new Set(importedWelders.map((w) => w.name));
			const missing = importedWorkEntries.filter((e) => !welderNames.has(e.welder));
			if (missing.length)
				throw new Error(
					`В workEntries есть отсутствующие сварщики: ${missing.map((e) => `'${e.welder}'`).join(', ')}`
				);

			/* --- НОВАЯ ЛОГИКА: СЛИЯНИЕ ДАННЫХ --- */
			await db.transaction('rw', db.welders, db.workEntries, async () => {
				// --- 1. Добавляем только новых сварщиков ---
				const existingWelders = await db.welders.toArray();
				const existingWelderNames = new Set(existingWelders.map((w) => w.name));
				const newWeldersToAdd = importedWelders.filter((w) => !existingWelderNames.has(w.name));
				if (newWeldersToAdd.length > 0) {
					await db.welders.bulkAdd(newWeldersToAdd);
				}

				// --- 2. Суммируем записи о работе ---
				// Получаем уникальные месяцы из импорта, чтобы не грузить всю базу
				const importedMonths = [...new Set(importedWorkEntries.map((e) => e.month))];
				const existingWorkEntries = await db.workEntries
					.where('month')
					.anyOf(importedMonths)
					.toArray();

				// Создаем карту для быстрого поиска существующих записей
				const existingEntriesMap = new Map<string, WorkEntry>();
				for (const entry of existingWorkEntries) {
					const key = `${entry.welder}-${entry.article}-${entry.month}`;
					existingEntriesMap.set(key, entry);
				}

				const entriesToAdd: WorkEntry[] = [];
				const entriesToUpdate: WorkEntry[] = [];

				for (const importedEntry of importedWorkEntries) {
					const key = `${importedEntry.welder}-${importedEntry.article}-${importedEntry.month}`;
					const existingEntry = existingEntriesMap.get(key);

					if (existingEntry) {
						// Если запись существует - обновляем ее (суммируем количество и историю)
						const updatedEntry: WorkEntry = {
							...existingEntry,
							quantity: existingEntry.quantity + importedEntry.quantity,
							history: [...existingEntry.history, ...importedEntry.history].sort(
								(a, b) => a.date.getTime() - b.date.getTime()
							),
							updatedAt: new Date()
						};
						entriesToUpdate.push(updatedEntry);
					} else {
						// Если записи нет - готовим ее к добавлению
						entriesToAdd.push(importedEntry);
					}
				}

				if (entriesToAdd.length > 0) {
					await db.workEntries.bulkAdd(entriesToAdd);
				}
				if (entriesToUpdate.length > 0) {
					await db.workEntries.bulkPut(entriesToUpdate);
				}
			});

			successMessage = 'Данные успешно импортированы и объединены';
			dispatch('imported');
			setTimeout(() => dispatch('close'), 1500);
		} catch (e: any) {
			errorMessage = `Ошибка импорта: ${e.message}`;
			console.error(e);
		}
	}

	function closeModal() {
		errorMessage = successMessage = '';
		dispatch('close');
	}
</script>

<!-- Остальная часть файла (HTML) остается без изменений -->
{#if isOpen}
	<section
		class="bg-opacity-50 fixed inset-0 flex items-center justify-center bg-black p-4"
		role="dialog"
		aria-labelledby="import-modal-title"
		on:click={closeModal}
		on:keydown={(e) => e.key === 'Escape' && closeModal()}
	>
		<div class="w-full max-w-md rounded-lg bg-gray-800 p-6" on:click|stopPropagation>
			<h2 id="import-modal-title" class="mb-4 text-lg font-bold text-green-400">Импорт данных</h2>

			<input
				type="file"
				accept=".json"
				bind:this={fileInput}
				on:change={handleFileUpload}
				class="mb-4 w-full rounded-lg border border-gray-600 bg-gray-700 p-2"
			/>

			{#if errorMessage}
				<p class="mb-4 text-red-400">{errorMessage}</p>
			{/if}
			{#if successMessage}<p class="mb-4 text-green-400">{successMessage}</p>{/if}

			<button
				on:click={closeModal}
				class="w-full rounded-lg bg-gray-600 px-4 py-2 transition-colors hover:bg-gray-500"
			>
				Закрыть
			</button>
		</div>
	</section>
{/if}
