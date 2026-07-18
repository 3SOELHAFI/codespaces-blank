export async function clearAppData(db) {
  await db.exec('DELETE FROM invoices');
  await db.exec('DELETE FROM salaries');
}
