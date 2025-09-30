<script lang="ts">
  import { goto } from '$app/navigation';
  import { db, type WorkEntry } from '$lib/db';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  // Форматирование числа: целое без .00, дробное до 2 знаков
  const formatQuantity = (qty: number) => Number.isInteger(qty) ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, '');

  // Стора для данных сводки
  type SummaryBlock = Array<{ article: string; quantity: number; welders: Array<{ welder: string; quantity: number }> }>;
  const summaryBlocks = writable<Record<string, SummaryBlock>>({});

  // Состояние модалки
  const modal = writable<{
    isOpen: boolean;
    article: string;
    welders: Array<{ welder: string; quantity: number }>;
  }>({
    isOpen: false,
    article: '',
    welders: [],
  });

  // Загрузка данных из DB
  onMount(async () => {
    const entries = await db.workEntries.toArray();
    console.log('Loaded entries:', entries); // Дебаг
    const blocks: Record<string, SummaryBlock> = {};

    entries.forEach(entry => {
      const month = entry.month;
      if (!blocks[month]) blocks[month] = [];

      const existingArticle = blocks[month].find(item => item.article === entry.article);
      if (existingArticle) {
        existingArticle.quantity += entry.quantity;
        existingArticle.welders.push({ welder: entry.welder, quantity: entry.quantity });
      } else {
        blocks[month].unshift({
          article: entry.article,
          quantity: entry.quantity,
          welders: [{ welder: entry.welder, quantity: entry.quantity }],
        });
      }
    });

    console.log('Grouped blocks:', blocks); // Дебаг
    // Сортируем блоки по месяцам (новые сверху)
    const sortedBlocks = Object.fromEntries(
      Object.entries(blocks).sort(([a], [b]) => b.localeCompare(a))
    );
    summaryBlocks.set(sortedBlocks);
  });

  // Открытие модалки
  function openModal(article: string, welders: Array<{ welder: string; quantity: number }>) {
    console.log('Opening modal:', { article, welders }); // Дебаг
    modal.set({ isOpen: true, article, welders });
  }

  // Закрытие модалки
  function closeModal() {
    modal.set({ isOpen: false, article: '', welders: [] });
  }
</script>

<div class="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
  <!-- Заголовок -->
  <header class="p-4 bg-gray-800 border-b border-gray-700 text-center text-xl font-bold">
    Сводка
  </header>

  <!-- Список с месячными блоками -->
  <main class="flex-1 p-4 overflow-y-auto space-y-4">
    {#each Object.entries($summaryBlocks) as [month, articles]}
      <div class="bg-gray-800 rounded-lg p-3">
        <h3 class="text-blue-400 mb-2">{month}</h3>
        <ul class="space-y-2">
          {#each articles as { article, quantity, welders }}
            <button
              type="button"
              class="w-full text-left p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              on:click={() => openModal(article, welders)}
              on:keydown={(e) => e.key === 'Enter' && openModal(article, welders)}
            >
              {article}: {formatQuantity(quantity)} шт
            </button>
          {/each}
        </ul>
      </div>
    {/each}
    {#if Object.keys($summaryBlocks).length === 0}
      <p class="text-gray-400 text-center">Нет данных</p>
    {/if}
  </main>

  <!-- Модальное окно -->
  {#if $modal.isOpen}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-green-400 mb-4">
          Артикул: {$modal.article}
        </h2>
        <div class="max-h-40 overflow-y-auto mb-4">
          {#if $modal.welders.length === 0}
            <p class="text-gray-400">Нет данных</p>
          {:else}
            <ul class="space-y-2">
              {#each $modal.welders as { welder, quantity }}
                <li class="text-gray-200">
                  {welder}: {formatQuantity(quantity)} шт
                </li>
              {/each}
            </ul>
          {/if}
        </div>
        <button
          on:click={closeModal}
          class="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
        >
          Закрыть
        </button>
      </div>
    </div>
  {/if}

  <!-- Кнопка На главную -->
  <footer class="sticky bottom-0 p-4 bg-gray-800 border-t border-gray-700 flex justify-center">
  <button
    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
    on:click={() => goto('/')}
  >
    На главную
  </button>
</footer>
</div>