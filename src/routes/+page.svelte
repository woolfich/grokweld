<script lang="ts">
  import { writable } from 'svelte/store';
  import { goto, invalidateAll } from '$app/navigation';
  import { db } from '$lib/db';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import ImportModal from '$lib/components/ImportModal.svelte';

  // Хранилище для списка сварщиков (синхронизировано с DB)
  const welders = writable<string[]>([]);

  // Состояние модалки импорта
  let isImportModalOpen = false;

  // Загрузка сварщиков из DB
  async function loadWelders() {
    if (!browser || !db) {
      console.log('loadWelders: Skipping, not in browser or db is null');
      return;
    }
    const welderList = await db!.welders.toArray();
    console.log('Loaded welders from DB:', welderList);
    welders.set(welderList.map(w => w.name));
  }

  onMount(loadWelders);

  // Функция добавления сварщика
  async function addWelder() {
    if (!browser || !db) return;
    if (newWelder.trim()) {
      const existing = await db!.welders.where('name').equals(newWelder.trim()).first();
      if (!existing) {
        await db!.welders.add({
          name: newWelder.trim(),
          createdAt: new Date(),
        });
        await loadWelders();
      }
      newWelder = '';
    }
  }

  // Функция перехода в карточку сварщика
  function goToWelder(welder: string) {
    goto(`/welder/${encodeURIComponent(welder)}`);
  }

  // Функция экспорта
  async function exportData() {
    if (!browser || !db) return;
    const currentMonth = new Date().toISOString().slice(0, 7); // "2025-09"
    const weldersData = await db!.welders.toArray();
    const workEntries = await db!.workEntries.where('month').equals(currentMonth).toArray();

    const data = {
      welders: weldersData,
      workEntries,
    };

    const date = new Date();
    const fileName = `Сварка_${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Обработчик импорта
  async function handleImported() {
    await loadWelders();
    await invalidateAll(); // Принудительно обновляем все данные
  }

  let newWelder = '';
</script>

<div class="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
  <!-- Шапка с кнопками Импорт и Экспорт -->
  <header class="p-4 bg-gray-800 border-b border-gray-700 flex gap-2 justify-start">
    <button
      class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
      on:click={() => (isImportModalOpen = true)}
    >
      Импорт
    </button>
    <button
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      on:click={exportData}
    >
      Экспорт
    </button>
  </header>

  <!-- Поле ввода и кнопка Добавить -->
  <div class="p-4 flex gap-2">
    <input
      type="text"
      bind:value={newWelder}
      placeholder="Введите фамилию сварщика"
      class="flex-1 p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
      on:keydown={(e) => e.key === 'Enter' && addWelder()}
    />
    <button
      on:click={addWelder}
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
    >
      Добавить
    </button>
  </div>

  <!-- Список сварщиков -->
  <main class="flex-1 p-4 overflow-y-auto">
    {#if $welders.length === 0}
      <p class="text-gray-400 text-center">Список сварщиков пуст</p>
    {:else}
      <ul class="space-y-2">
        {#each $welders as welder}
          <button
            type="button"
            class="w-full text-left p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            on:click={() => goToWelder(welder)}
            on:keydown={(e) => e.key === 'Enter' && goToWelder(welder)}
          >
            {welder}
          </button>
        {/each}
      </ul>
    {/if}
  </main>

  <!-- Модалка импорта -->
  <ImportModal
    isOpen={isImportModalOpen}
    on:close={() => (isImportModalOpen = false)}
    on:imported={handleImported}
  />

  <!-- Фиксированные кнопки внизу -->
  <footer class="sticky bottom-0 p-4 bg-gray-800 border-t border-gray-700 flex gap-4 justify-center">
    <button
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      on:click={() => goto('/summary')}
    >
      Сводка
    </button>
    <button
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      on:click={() => goto('/standards')}
    >
      Нормы
    </button>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: Arial, sans-serif;
  }
</style>