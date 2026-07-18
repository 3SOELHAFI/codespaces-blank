import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { authenticateUser } from './logic.js';
import { clearAppData } from './reset-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(express.static(__dirname));

let db;

async function ensureColumn(tableName, columnName, definition) {
  const columns = await db.all(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'data.sqlite'),
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
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

    CREATE TABLE IF NOT EXISTS salaries (
      id TEXT PRIMARY KEY,
      personName TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL,
      discount REAL NOT NULL DEFAULT 0
    );
  `);

  await ensureColumn('invoices', 'paymentStatus', 'TEXT NOT NULL DEFAULT "مدفوعة"');
  await ensureColumn('invoices', 'pendingAmount', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn('salaries', 'discount', 'REAL NOT NULL DEFAULT 0');

  const existingServices = await db.all('SELECT id FROM services');
  if (!existingServices.length) {
    await db.exec(`
      INSERT INTO services (id, name, price) VALUES
      ('service-1', 'غسيل داخلي', 20),
      ('service-2', 'غسيل خارجي', 20),
      ('service-3', 'غسيل كامل', 40),
      ('service-4', 'غسيل VIP', 90),
      ('service-5', 'غسيل محرك بخار', 90),
      ('service-6', 'غسيل صالون بخار', 350),
      ('service-7', 'غسيل كامل بخار', 470),
      ('service-8', 'غسيل محرك قاز', 30),
      ('service-9', 'غسيل صالة قاز', 30),
      ('service-10', 'تلميع ديكسوات', 50);
    `);
  }
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  res.json({ success: authenticateUser(username, password) });
});

app.get('/api/services', async (_req, res) => {
  const services = await db.all('SELECT * FROM services ORDER BY name');
  res.json(services);
});

app.post('/api/services', async (req, res) => {
  const { id, name, price } = req.body;
  await db.run('INSERT INTO services (id, name, price) VALUES (?, ?, ?)', [id, name, price]);
  res.json({ ok: true });
});

app.put('/api/services/:id', async (req, res) => {
  const { name, price } = req.body;
  await db.run('UPDATE services SET name = ?, price = ? WHERE id = ?', [name, price, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/services/:id', async (req, res) => {
  await db.run('DELETE FROM services WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/invoices', async (_req, res) => {
  const invoices = await db.all('SELECT * FROM invoices ORDER BY createdAt DESC');
  res.json(invoices.map((invoice) => ({ ...invoice, services: JSON.parse(invoice.services) })));
});

app.post('/api/invoices', async (req, res) => {
  const invoice = req.body;
  await db.run(
    'INSERT INTO invoices (id, customerName, customerPhone, carType, worker, paymentMethod, subscription, services, total, createdAt, paymentStatus, pendingAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [invoice.id, invoice.customerName, invoice.customerPhone, invoice.carType, invoice.worker, invoice.paymentMethod, invoice.subscription ? 1 : 0, JSON.stringify(invoice.services), invoice.total, invoice.createdAt, invoice.paymentStatus || 'مدفوعة', invoice.pendingAmount || 0],
  );
  res.json({ ok: true });
});

app.put('/api/invoices/:id', async (req, res) => {
  const invoice = req.body;
  await db.run(
    'UPDATE invoices SET customerName = ?, customerPhone = ?, carType = ?, worker = ?, paymentMethod = ?, subscription = ?, services = ?, total = ?, createdAt = ?, paymentStatus = ?, pendingAmount = ? WHERE id = ?',
    [invoice.customerName, invoice.customerPhone, invoice.carType, invoice.worker, invoice.paymentMethod, invoice.subscription ? 1 : 0, JSON.stringify(invoice.services), invoice.total, invoice.createdAt, invoice.paymentStatus || 'مدفوعة', invoice.pendingAmount || 0, req.params.id],
  );
  res.json({ ok: true });
});

app.delete('/api/invoices/:id', async (req, res) => {
  await db.run('DELETE FROM invoices WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/salaries', async (_req, res) => {
  const salaries = await db.all('SELECT * FROM salaries ORDER BY date DESC, id DESC');
  res.json(salaries);
});

app.post('/api/salaries', async (req, res) => {
  const salary = req.body;
  await db.run(
    'INSERT INTO salaries (id, personName, amount, date, note, discount) VALUES (?, ?, ?, ?, ?, ?)',
    [salary.id, salary.personName, salary.amount, salary.date, salary.note || '', Number(salary.discount || 0)],
  );
  res.json({ ok: true });
});

app.put('/api/salaries/:id', async (req, res) => {
  const salary = req.body;
  await db.run(
    'UPDATE salaries SET personName = ?, amount = ?, date = ?, note = ?, discount = ? WHERE id = ?',
    [salary.personName, salary.amount, salary.date, salary.note || '', Number(salary.discount || 0), req.params.id],
  );
  res.json({ ok: true });
});

app.delete('/api/salaries/:id', async (req, res) => {
  await db.run('DELETE FROM salaries WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/reset-all', async (_req, res) => {
  await clearAppData(db);
  res.json({ ok: true });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDb().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
});
