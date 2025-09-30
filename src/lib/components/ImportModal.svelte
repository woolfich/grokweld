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
  const normalizeWelder   = (name: string) => name.trim();

  async function handleFileUpload(event: Event) {
    errorMessage = '';
    successMessage = '';
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) { errorMessage = 'Выберите файл'; return; }

    try {
      const data = JSON.parse(await file.text());

      if (!Array.isArray(data.welders) || !Array.isArray(data.workEntries)) {
        throw new Error('Ожидаются массивы welders и workEntries');
      }

      const welders: Welder[] = data.welders.map((w: any) => ({
        id: w.id,
        name: normalizeWelder(w.name || ''),
        createdAt: new Date(w.createdAt),
      }));

      const workEntries: WorkEntry[] = data.workEntries.map((e: any) => ({
        id: e.id,
        welder: normalizeWelder(e.welder || ''),
        article: normalizeArticle(e.article || ''),
        quantity: parseFloat(e.quantity),
        month: e.month,
        createdAt: new Date(e.createdAt),
        updatedAt: new Date(e.updatedAt),
        history: (e.history || []).map((h: any) => ({
          date: new Date(h.date),
          from: parseFloat(h.from),
          to: parseFloat(h.to),
        })),
      }));

      const welderNames = new Set(welders.map(w => w.name));
      const missing = workEntries.filter(e => !welderNames.has(e.welder));
      if (missing.length) throw new Error(
        `В workEntries есть отсутствующие сварщики: ${missing.map(e => `'${e.welder}'`).join(', ')}`
      );

      /*  ГЛАВНОЕ ИСПРАВЛЕНИЕ: ждём bulkAdd  */
      await db.transaction('rw', db.welders, db.workEntries, async () => {
        await db.welders.clear();
        await db.workEntries.clear();
        await db.welders.bulkAdd(welders);        // ← await
        await db.workEntries.bulkAdd(workEntries); // ← await
      });

      successMessage = 'Данные успешно импортированы';
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

{#if isOpen}
  <section
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
    role="dialog"
    aria-labelledby="import-modal-title"
    on:click={closeModal}
    on:keydown={(e) => e.key === 'Escape' && closeModal()}
  >
    <div
      class="bg-gray-800 rounded-lg p-6 w-full max-w-md"
      on:click|stopPropagation
    >
      <h2 id="import-modal-title" class="text-lg font-bold text-green-400 mb-4">Импорт данных</h2>

      <input
        type="file"
        accept=".json"
        bind:this={fileInput}
        on:change={handleFileUpload}
        class="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg mb-4"
      />

      {#if errorMessage}  <p class="text-red-400  mb-4">{errorMessage}</p> {/if}
      {#if successMessage}<p class="text-green-400 mb-4">{successMessage}</p>{/if}

      <button
        on:click={closeModal}
        class="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
      >
        Закрыть
      </button>
    </div>
  </section>
{/if}