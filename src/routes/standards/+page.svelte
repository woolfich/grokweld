<script lang="ts">
  import { goto } from '$app/navigation';
  import { db, type Standard } from '$lib/db';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  // Форматирование числа: целое без .00, дробное до 2 знаков
  const formatQuantity = (qty: number) => Number.isInteger(qty) ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, '');

  // Нормализация артикула: хт, Хт, хТ, х т → хт
  const normalizeArticle = (art: string) => art.replace(/\s+/g, '').toLowerCase();

  // Временные стора для UI
  let article = '';
  let time = '';
  let standards = writable<Standard[]>([]);

  // Загрузка данных из DB
  onMount(async () => {
    const standardsList = await db.standards.orderBy('article').toArray();
    standards.set(standardsList);
  });

  // Функция добавления стандарта
  async function addStandard() {
    const normalizedArticle = normalizeArticle(article);
    const timeValue = parseFloat(time.replace(',', '.'));
    if (!normalizedArticle || isNaN(timeValue) || timeValue <= 0) {
      alert('Введите корректный артикул (например, хт637) и время (например, 10 или 10,5)');
      return;
    }

    // Проверяем, нет ли уже такого артикула
    const existing = await db.standards.where('article').equals(normalizedArticle).first();
    if (existing) {
      alert('Артикул уже существует');
      return;
    }

    const newStandard = {
      article: normalizedArticle,
      time: timeValue,
      createdAt: new Date(),
    };
    const newId = await db.standards.add(newStandard);
    standards.update(current => [...current, { ...newStandard, id: newId }].sort((a, b) => a.article.localeCompare(b.article)));
    article = '';
    time = '';
  }
</script>

<div class="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
  <!-- Заголовок -->
  <header class="p-4 bg-gray-800 border-b border-gray-700 text-center text-xl font-bold">
    Нормы
  </header>

  <!-- Инпуты для артикула и времени + Добавить -->
  <div class="p-4 flex gap-2">
    <input
      type="text"
      bind:value={article}
      placeholder="Артикул, напр. хт637"
      class="flex-1 p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-600"
    />
    <input
      type="text"
      bind:value={time}
      placeholder="Время, напр. 10"
      class="w-24 p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-600"
      on:keydown={(e) => e.key === 'Enter' && addStandard()}
    />
    <button
      on:click={addStandard}
      class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
    >
      Добавить
    </button>
  </div>

  <!-- Список стандартов -->
  <main class="flex-1 p-4 overflow-y-auto space-y-2">
    {#if $standards.length === 0}
      <p class="text-gray-400 text-center">Нет норм</p>
    {:else}
      <ul class="space-y-2">
        {#each $standards as { article, time }, i}
          <li
            class="p-2 bg-gray-700 rounded-lg transition-transform duration-300 transform hover:scale-[1.02]"
            style="animation: slideIn 0.3s ease-in-out {i * 0.05}s both;"
          >
            {article}: {formatQuantity(time)} ч
          </li>
        {/each}
      </ul>
    {/if}
  </main>

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

<style>
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>