import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateUser, calculateInvoiceTotal, calculateProfitSummary, createDiscountRecord, createInvoiceRecord, createSalaryRecord, filterInvoicesByQuery, getCustomerReportGroups, getFilteredReportInvoices, getReportSummaries, updateSalaryRecord } from '../logic.js';

test('calculateInvoiceTotal sums service prices', () => {
  const total = calculateInvoiceTotal([
    { name: 'غسيل داخلي', price: 20 },
    { name: 'غسيل كامل', price: 40 },
  ]);

  assert.equal(total, 60);
});

test('createInvoiceRecord builds invoice with total', () => {
  const invoice = createInvoiceRecord({
    customerName: 'يوسف',
    customerPhone: '123456',
    carType: 'سيدان',
    worker: 'إبراهيم',
    paymentMethod: 'كاش',
    subscription: false,
    services: [{ name: 'غسيل داخلي', price: 20 }],
  });

  assert.equal(invoice.total, 20);
  assert.equal(invoice.customerName, 'يوسف');
});

test('authenticateUser accepts the default admin credentials', () => {
  assert.equal(authenticateUser('admin', '90'), true);
  assert.equal(authenticateUser('admin', '1234'), false);
});

test('getFilteredReportInvoices filters by day, week, month, or customer', () => {
  const invoices = [
    createInvoiceRecord({
      customerName: 'يوسف',
      customerPhone: '111',
      carType: 'سيدان',
      worker: 'إبراهيم',
      paymentMethod: 'كاش',
      subscription: false,
      services: [{ name: 'غسيل داخلي', price: 20 }],
      createdAt: '2026-07-07T08:00:00.000Z',
    }),
    createInvoiceRecord({
      customerName: 'أحمد',
      customerPhone: '222',
      carType: 'SUV',
      worker: 'شعيب',
      paymentMethod: 'تحويل',
      subscription: true,
      services: [{ name: 'غسيل كامل', price: 40 }],
      createdAt: '2026-06-30T09:00:00.000Z',
    }),
  ];

  const daily = getFilteredReportInvoices(invoices, { type: 'daily', date: '2026-07-07' });
  const weekly = getFilteredReportInvoices(invoices, { type: 'weekly', date: '2026-07-07' });
  const monthly = getFilteredReportInvoices(invoices, { type: 'monthly', date: '2026-07' });
  const customer = getFilteredReportInvoices(invoices, { type: 'customer', customerName: 'أحمد' });

  assert.equal(daily.length, 1);
  assert.equal(weekly.length, 1);
  assert.equal(monthly.length, 1);
  assert.equal(customer[0].customerName, 'أحمد');
});

test('getCustomerReportGroups groups invoices by customer with service details', () => {
  const invoices = [
    createInvoiceRecord({
      customerName: 'يوسف',
      customerPhone: '111',
      carType: 'سيدان',
      worker: 'إبراهيم',
      paymentMethod: 'كاش',
      subscription: false,
      services: [{ name: 'غسيل داخلي', price: 20 }],
      createdAt: '2026-07-07T08:00:00.000Z',
    }),
    createInvoiceRecord({
      customerName: 'يوسف',
      customerPhone: '111',
      carType: 'SUV',
      worker: 'شعيب',
      paymentMethod: 'تحويل',
      subscription: true,
      services: [{ name: 'غسيل كامل', price: 40 }],
      createdAt: '2026-07-07T09:00:00.000Z',
    }),
  ];

  const groups = getCustomerReportGroups(invoices);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].customerName, 'يوسف');
  assert.equal(groups[0].invoices.length, 2);
  assert.equal(groups[0].invoices[1].carType, 'SUV');
});

test('filterInvoicesByQuery finds matching customer records', () => {
  const invoices = [
    createInvoiceRecord({
      customerName: 'يوسف',
      customerPhone: '111',
      carType: 'سيدان',
      worker: 'إبراهيم',
      paymentMethod: 'كاش',
      subscription: false,
      services: [{ name: 'غسيل داخلي', price: 20 }],
      createdAt: '2026-07-07T08:00:00.000Z',
    }),
    createInvoiceRecord({
      customerName: 'أحمد',
      customerPhone: '222',
      carType: 'SUV',
      worker: 'شعيب',
      paymentMethod: 'تحويل',
      subscription: true,
      services: [{ name: 'غسيل كامل', price: 40 }],
      createdAt: '2026-07-07T09:00:00.000Z',
    }),
  ];

  const result = filterInvoicesByQuery(invoices, 'يوسف');

  assert.equal(result.length, 1);
  assert.equal(result[0].customerName, 'يوسف');
});

test('createDiscountRecord stores the discount amount, date, person name, type, and note', () => {
  const discount = createDiscountRecord({
    amount: 150,
    date: '2026-07-10',
    personName: '  أحمد  ',
    type: 'salary',
    note: '  خصم من الراتب  ',
  });

  assert.equal(discount.amount, 150);
  assert.equal(discount.date, '2026-07-10');
  assert.equal(discount.personName, 'أحمد');
  assert.equal(discount.type, 'salary');
  assert.equal(discount.note, 'خصم من الراتب');
});

test('createInvoiceRecord marks cash payments as pending and preserves custom invoice date', () => {
  const invoice = createInvoiceRecord({
    customerName: 'سارة',
    customerPhone: '999',
    carType: 'SUV',
    worker: 'إبراهيم',
    paymentMethod: 'كاش',
    subscription: false,
    services: [{ name: 'غسيل كامل', price: 40 }],
    createdAt: '2026-07-12T10:00:00.000Z',
  });

  assert.equal(invoice.paymentStatus, 'معلقة');
  assert.equal(invoice.pendingAmount, 40);
  assert.equal(invoice.createdAt, '2026-07-12T10:00:00.000Z');
});

test('createSalaryRecord and calculateProfitSummary aggregate salary and profit values', () => {
  const salary = createSalaryRecord({
    personName: '  جميل  ',
    amount: 250,
    date: '2026-07-10',
    note: 'عمل نهاري',
    discount: 30,
  });
  const summary = calculateProfitSummary({
    invoices: [
      createInvoiceRecord({
        customerName: 'محمود',
        customerPhone: '1',
        carType: 'سيدان',
        worker: 'إبراهيم',
        paymentMethod: 'كاش',
        subscription: false,
        services: [{ name: 'غسيل داخلي', price: 20 }],
        createdAt: '2026-07-10T08:00:00.000Z',
      }),
    ],
    salaries: [salary],
    discount: 30,
  });

  assert.equal(salary.personName, 'جميل');
  assert.equal(salary.discount, 30);
  assert.equal(summary.totalSales, 20);
  assert.equal(summary.totalSalaries, 250);
  assert.equal(summary.totalDiscounts, 60);
  assert.equal(summary.netProfit, -290);
});

test('updateSalaryRecord updates salary values without losing the discount', () => {
  const salary = createSalaryRecord({
    personName: 'سامي',
    amount: 300,
    date: '2026-07-01',
    note: 'أولي',
    discount: 20,
  });

  const updated = updateSalaryRecord(salary, {
    personName: 'سامي الجديد',
    amount: 350,
    date: '2026-07-02',
    note: 'محدث',
    discount: 25,
  });

  assert.equal(updated.personName, 'سامي الجديد');
  assert.equal(updated.amount, 350);
  assert.equal(updated.date, '2026-07-02');
  assert.equal(updated.note, 'محدث');
  assert.equal(updated.discount, 25);
});

test('getReportSummaries aggregates daily and monthly values', () => {
  const now = new Date('2026-07-07T12:00:00.000Z');
  const invoices = [
    createInvoiceRecord({
      customerName: 'أ',
      customerPhone: '1',
      carType: 'سيدان',
      worker: 'إبراهيم',
      paymentMethod: 'كاش',
      subscription: true,
      services: [{ name: 'غسيل داخلي', price: 20 }],
      createdAt: '2026-07-07T08:00:00.000Z',
    }),
    createInvoiceRecord({
      customerName: 'ب',
      customerPhone: '2',
      carType: 'SUV',
      worker: 'شعيب',
      paymentMethod: 'تحويل',
      subscription: false,
      services: [{ name: 'غسيل كامل', price: 40 }],
      createdAt: '2026-06-29T10:00:00.000Z',
    }),
  ];

  const summary = getReportSummaries(invoices, now, [{ date: '2026-07-07', amount: 10 }], [{ date: '2026-07-07', amount: 50 }]);

  assert.equal(summary.dailyCount, 1);
  assert.equal(summary.dailyTotal, 20);
  assert.equal(summary.dailyDiscountTotal, 60);
  assert.equal(summary.monthlyCount, 1);
  assert.equal(summary.monthlyTotal, 20);
  assert.equal(summary.subscribedCount, 1);
  assert.equal(summary.subscribedTotal, 20);
});
