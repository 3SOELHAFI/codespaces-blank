import test from 'node:test';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { clearAppData } from '../reset-data.js';

test('clearAppData removes invoices and salaries from the database', async () => {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE invoices (
      id TEXT PRIMARY KEY,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      carType TEXT NOT NULL,
      worker TEXT NOT NULL,
      paymentMethod TEXT NOT NULL,
      subscription INTEGER NOT NULL,
      services TEXT NOT NULL,
      total REAL NOT NULL,
      createdAt TEXT NOT NULL,
      paymentStatus TEXT NOT NULL,
      pendingAmount REAL NOT NULL
    );

    CREATE TABLE salaries (
      id TEXT PRIMARY KEY,
      personName TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL,
      discount REAL NOT NULL DEFAULT 0
    );
  `);

  await db.run(
    'INSERT INTO invoices (id, customerName, customerPhone, carType, worker, paymentMethod, subscription, services, total, createdAt, paymentStatus, pendingAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['inv-1', 'عميل', '0500000000', 'سيدان', 'إبراهيم', 'كاش', 0, '[]', 100, '2024-01-01', 'مدفوعة', 0],
  );
  await db.run(
    'INSERT INTO salaries (id, personName, amount, date, note, discount) VALUES (?, ?, ?, ?, ?, ?)',
    ['sal-1', 'أحمد', 2000, '2024-01-01', 'ملاحظة', 0],
  );

  await clearAppData(db);

  const invoices = await db.all('SELECT * FROM invoices');
  const salaries = await db.all('SELECT * FROM salaries');

  assert.equal(invoices.length, 0);
  assert.equal(salaries.length, 0);
});
