<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { db, type WorkEntry } from '$lib/db';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  // Проверяем welderName, редирект на главную, если undefined
  const welderName = $page.params.name ?? '';
  if (!welderName) {
    goto('/');
  }

  // Форматирование числа: целое без .00, дробное до 2 знаков
  const formatQuantity = (qty: number) => Number.isInteger(qty) ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, '');

  // Форматирование даты для истории: "09.10 10:33"
  const formatDateTime = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Временные стора для UI
  let article = '';
  let quantity = '';
  let monthlyBlocks = writable<Record<string, Array<{ article: string; quantity: number; id: number; history: WorkEntry['history']; updatedAt: Date }>>>({});

  // Состояние модалки
  const modal = writable<{
    isOpen: boolean;
    article: string;
    quantity: number;
    id: number;
    history: WorkEntry['history'];
  }>({
    isOpen: false,
    article: '',
    quantity: 0,
    id: 0,
    history: [],
  });
  let modalQuantity = ''; // Для ввода в модалке

  // Загрузка данных из DB
  onMount(async () => {
    const entries = await db.workEntries.where({ welder: welderName }).toArray();
    console.log('Loaded entries for', welderName, entries); // Дебаг

    const blocks: typeof $monthlyBlocks = {};
    entries.forEach(entry => {
      if (!blocks[entry.month]) blocks[entry.month] = [];
      blocks[entry.month].push({
        article: entry.article,
        quantity: entry.quantity,
        id: entry.id!,
        history: entry.history,
        updatedAt: entry.updatedAt, // Добавляем для сортировки
      });
    });

    // Сортируем внутри каждого месяца по updatedAt (последние изменённые сверху)
    Object.keys(blocks).forEach(month => {
      blocks[month].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    });

    // Сортируем блоки по месяцам (новые сверху)
    const sortedBlocks = Object.fromEntries(
      Object.entries(blocks).sort(([a], [b]) => b.localeCompare(a))
    );
    monthlyBlocks.set(sortedBlocks);
  });

  // Функция добавления/обновления
  async function addOrUpdate() {
    const qty = parseFloat(quantity.replace(',', '.'));
    console.log('Adding/Updating:', { article, quantity: qty, welder: welderName });
    if (!article.trim() || isNaN(qty) || qty <= 0) {
      console.log('Invalid input:', { article, quantity: qty });
      return;
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    // Ищем существующий артикул в текущем месяце
    const existing = await db.workEntries.where({
      welder: welderName,
      article,
      month: currentMonth,
    }).first();
    console.log('Existing entry:', existing);

    const now = new Date();

    if (existing) {
      // Суммируем или обновляем
      const newQty = existing.quantity + qty;
      const historyUpdate = [...existing.history, { date: now, from: existing.quantity, to: newQty }];
      await db.workEntries.update(existing.id!, {
        quantity: newQty,
        updatedAt: now,
        history: historyUpdate,
      });
      console.log('Updated entry:', { id: existing.id, newQty, historyUpdate });
      // Перемещаем в верх списка
      updateStoreAfterChange(currentMonth, article, newQty, existing.id!, historyUpdate);
    } else {
      // Добавляем новый
      const newId = await db.workEntries.add({
        welder: welderName,
        article,
        quantity: qty,
        month: currentMonth,
        createdAt: now,
        updatedAt: now,
        history: [{ date: now, from: 0, to: qty }],
      });
      console.log('Added new entry:', { id: newId, article, quantity: qty });
      // Обновляем store
      monthlyBlocks.update(blocks => {
        if (!blocks[currentMonth]) blocks[currentMonth] = [];
        blocks[currentMonth].unshift({ article, quantity: qty, id: newId, history: [{ date: now, from: 0, to: qty }], updatedAt: now });
        return { ...blocks };
      });
    }

    article = '';
    quantity = '';
  }

  // Функция обновления store после изменения (перемещение вверх)
  function updateStoreAfterChange(month: string, art: string, newQty: number, id: number, history: WorkEntry['history']) {
    monthlyBlocks.update(blocks => {
      const block = blocks[month] || [];
      const index = block.findIndex(item => item.article === art);
      if (index > -1) block.splice(index, 1);
      block.unshift({ article: art, quantity: newQty, id, history, updatedAt: new Date() });
      blocks[month] = block;
      return { ...blocks };
    });
  }

  // Подстановка артикула по клику
  function selectArticle(art: string) {
    article = art;
  }

  // Открытие модалки
  let longPressTimer: NodeJS.Timeout | null = null;
  function startLongPress(art: string, qty: number, id: number, history: WorkEntry['history']) {
    longPressTimer = setTimeout(() => {
      modal.set({ isOpen: true, article: art, quantity: qty, id, history });
      modalQuantity = formatQuantity(qty);
    }, 500);
  }
  function cancelLongPress() {
    if (longPressTimer) clearTimeout(longPressTimer);
  }

  // Закрытие модалки
  function closeModal() {
    modal.set({ isOpen: false, article: '', quantity: 0, id: 0, history: [] });
    modalQuantity = '';
  }

  // Изменение количества через модалку
  async function updateQuantity() {
    const qty = parseFloat(modalQuantity.replace(',', '.'));
    if (isNaN(qty) || qty < 0) return;

    const { id, article: art, quantity: oldQty } = $modal;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const now = new Date();

    await db.workEntries.update(id, {
      quantity: qty,
      updatedAt: now,
      history: [...$modal.history, { date: now, from: oldQty, to: qty }],
    });

    updateStoreAfterChange(currentMonth, art, qty, id, [...$modal.history, { date: now, from: oldQty, to: qty }]);
    closeModal();
  }
</script>

<div class="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
  <!-- Фамилия сверху -->
  <header class="p-4 bg-gray-800 border-b border-gray-700 text-center text-xl font-bold">
    {welderName}
  </header>

  <!-- Инпуты для артикула и количества + Добавить -->
  <div class="p-4 flex gap-2">
    <input
      type="text"
      bind:value={article}
      placeholder="Артикул, напр. хт637"
      class="flex-1 p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
    />
    <input
      type="text"
      bind:value={quantity}
      placeholder="Количество, напр. 1,2"
      class="w-24 p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
      on:keydown={(e) => e.key === 'Enter' && addOrUpdate()}
    />
    <button
      on:click={addOrUpdate}
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
    >
      Добавить
    </button>
  </div>

  <!-- Список с месячными блоками -->
  <main class="flex-1 p-4 overflow-y-auto space-y-4">
    {#each Object.entries($monthlyBlocks) as [month, items]}
      <div class="bg-gray-800 rounded-lg p-3">
        <h3 class="text-blue-400 mb-2">{month}</h3>
        <ul class="space-y-2">
          {#each items as item}
            <button
              type="button"
              class="w-full text-left p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              on:click={() => selectArticle(item.article)}
              on:keydown={(e) => e.key === 'Enter' && selectArticle(item.article)}
              on:mousedown={() => startLongPress(item.article, item.quantity, item.id, item.history)}
              on:mouseup={cancelLongPress}
              on:touchstart={() => startLongPress(item.article, item.quantity, item.id, item.history)}
              on:touchend={cancelLongPress}
            >
              {item.article}: {formatQuantity(item.quantity)} шт
            </button>
          {/each}
        </ul>
      </div>
    {/each}
    {#if Object.keys($monthlyBlocks).length === 0}
      <p class="text-gray-400 text-center">Нет записей</p>
    {/if}
  </main>

  <!-- Модальное окно -->
  {#if $modal.isOpen}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 class="text-lg font-bold text-blue-400 mb-4">
          Редактирование: {$modal.article}
        </h2>
        <div class="flex gap-2 mb-4">
          <input
            type="text"
            bind:value={modalQuantity}
            placeholder="Новое количество, напр. 1,2"
            class="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            on:keydown={(e) => e.key === 'Enter' && updateQuantity()}
          />
          <button
            on:click={updateQuantity}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Изменить
          </button>
        </div>
        <div class="max-h-40 overflow-y-auto mb-4">
          {#if $modal.history.length === 0}
            <p class="text-gray-400">Нет истории изменений</p>
          {:else}
            <ul class="space-y-2">
              {#each $modal.history as change}
                <li class="text-gray-200">
                  {formatDateTime(change.date)}: {formatQuantity(change.from)} → {formatQuantity(change.to)}
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