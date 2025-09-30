import Dexie from 'dexie';

export interface WorkEntry {
  id?: number;
  welder: string; // Фамилия сварщика
  article: string; // Артикул
  quantity: number; // Количество (до 2 знаков после запятой)
  month: string; // Ключ месяца, напр. "2025-09"
  createdAt: Date; // Дата создания
  updatedAt: Date; // Дата последнего изменения
  history: Array<{
    date: Date;
    from: number;
    to: number;
  }>; // История изменений
}

export interface Welder {
  id?: number;
  name: string; // Фамилия сварщика
  createdAt: Date; // Дата добавления
}

export interface Standard {
  id?: number;
  article: string; // Артикул (например, "хт637")
  time: number; // Время в часах
  createdAt: Date; // Дата добавления
}

export class AppDB extends Dexie {
  workEntries: Dexie.Table<WorkEntry, number>;
  welders: Dexie.Table<Welder, number>;
  standards: Dexie.Table<Standard, number>;

  constructor() {
    super('WeldersDB');
    this.version(3).stores({ // Увеличили версию на 3 для новой таблицы
      workEntries: '++id, welder, article, month',
      welders: '++id, name',
      standards: '++id, article',
    });
    this.workEntries = this.table('workEntries');
    this.welders = this.table('welders');
    this.standards = this.table('standards');
  }
}

export const db = new AppDB();