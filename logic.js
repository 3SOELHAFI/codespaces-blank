export function calculateInvoiceTotal(services = [], options = {}) {
  const baseTotal = services.reduce((sum, service) => sum + Number(service.price || 0), 0);
  const vipDiscount = Number(options.vipDiscount || 0);
  return Math.max(0, baseTotal - vipDiscount);
}

export function authenticateUser(username = '', password = '') {
  return username.trim().toLowerCase() === 'admin' && password === '90';
}

export function createServiceRecord({ name, price }) {
  return {
    id: `service-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    price: Number(price || 0),
  };
}

export function createDiscountRecord({ amount, date, personName, type = 'general', note = '' }) {
  return {
    id: `discount-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    amount: Number(amount || 0),
    date: date || new Date().toISOString().slice(0, 10),
    personName: personName.trim(),
    type,
    note: note.trim(),
  };
}

export function createSalaryRecord({ personName, amount, date, note, discount = 0 }) {
  return {
    id: `salary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    personName: personName.trim(),
    amount: Number(amount || 0),
    discount: Number(discount || 0),
    date: date || new Date().toISOString().slice(0, 10),
    note: note?.trim() || '',
  };
}

export function calculateProfitSummary({ invoices = [], salaries = [], discounts = [], discount = 0 } = {}) {
  const totalSales = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const totalSalaries = salaries.reduce((sum, salary) => sum + Number(salary.amount || 0), 0);
  const totalSalaryDiscounts = salaries.reduce((sum, salary) => sum + Number(salary.discount || 0), 0);
  const totalManualDiscounts = discounts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalDiscounts = totalSalaryDiscounts + totalManualDiscounts + Number(discount || 0);

  return {
    totalSales,
    totalSalaries,
    totalDiscounts,
    netProfit: totalSales - totalSalaries - totalDiscounts,
  };
}

export function updateSalaryRecord(salary = {}, updates = {}) {
  return {
    ...salary,
    personName: (updates.personName ?? salary.personName ?? '').trim(),
    amount: Number(updates.amount ?? salary.amount ?? 0),
    discount: Number(updates.discount ?? salary.discount ?? 0),
    date: updates.date ?? salary.date ?? new Date().toISOString().slice(0, 10),
    note: (updates.note ?? salary.note ?? '').trim(),
  };
}

export function createInvoiceRecord({
  customerName,
  customerPhone,
  carType,
  worker,
  paymentMethod,
  subscription,
  services,
  createdAt,
  cashOnDelivery = false,
  vipDiscount = 0,
}) {
  const total = calculateInvoiceTotal(services, { vipDiscount });
  const isCash = paymentMethod === 'كاش';

  return {
    id: `invoice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    carType: carType.trim(),
    worker: worker.trim(),
    paymentMethod,
    subscription: Boolean(subscription),
    services: services.map((service) => ({ ...service })),
    total,
    cashOnDelivery: Boolean(cashOnDelivery),
    vipDiscount: Number(vipDiscount || 0),
    createdAt: createdAt || new Date().toISOString(),
    paymentStatus: isCash ? 'معلقة' : 'مدفوعة',
    pendingAmount: isCash ? total : 0,
  };
}

export function updateInvoiceRecord(invoice, updates) {
  const nextServices = updates.services || invoice.services;
  const vipDiscount = updates.vipDiscount ?? invoice.vipDiscount ?? 0;
  const total = calculateInvoiceTotal(nextServices, { vipDiscount });
  const paymentMethod = updates.paymentMethod || invoice.paymentMethod;
  const isCash = paymentMethod === 'كاش';

  return {
    ...invoice,
    ...updates,
    services: nextServices.map((service) => ({ ...service })),
    total,
    cashOnDelivery: Boolean(updates.cashOnDelivery ?? invoice.cashOnDelivery ?? false),
    vipDiscount: Number(vipDiscount || 0),
    paymentStatus: isCash ? 'معلقة' : 'مدفوعة',
    pendingAmount: isCash ? total : 0,
  };
}

export function filterInvoicesByQuery(invoices = [], query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return invoices;
  }

  return invoices.filter((invoice) => {
    const haystack = [
      invoice.customerName,
      invoice.customerPhone,
      invoice.carType,
      invoice.worker,
      invoice.paymentMethod,
      invoice.services.map((service) => service.name).join(' '),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function getFilteredReportInvoices(invoices = [], options = {}) {
  const { type = 'all', date = '', customerName = '' } = options;
  const normalizedName = customerName.trim().toLowerCase();
  let now = new Date();

  if (type === 'customer') {
    if (!normalizedName) {
      return [];
    }
    return invoices.filter((invoice) => invoice.customerName.toLowerCase().includes(normalizedName));
  }

  if (type === 'daily') {
    const targetDate = date || now.toISOString().slice(0, 10);
    return invoices.filter((invoice) => invoice.createdAt.slice(0, 10) === targetDate);
  }

  if (type === 'weekly') {
    const targetDate = date || now.toISOString().slice(0, 10);
    const endDate = new Date(`${targetDate}T23:59:59.999Z`);
    const startDate = new Date(`${targetDate}T00:00:00.000Z`);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    const startKey = startDate.toISOString().slice(0, 10);
    const endKey = endDate.toISOString().slice(0, 10);
    return invoices.filter((invoice) => {
      const invoiceDateKey = invoice.createdAt.slice(0, 10);
      return invoiceDateKey >= startKey && invoiceDateKey <= endKey;
    });
  }

  if (type === 'monthly') {
    const targetMonth = date || now.toISOString().slice(0, 7);
    return invoices.filter((invoice) => invoice.createdAt.slice(0, 7) === targetMonth);
  }

  return invoices;
}

export function getCustomerReportGroups(invoices = []) {
  const grouped = new Map();

  invoices.forEach((invoice) => {
    const key = invoice.customerPhone || invoice.customerName;
    if (!grouped.has(key)) {
      grouped.set(key, {
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        invoices: [],
      });
    }

    grouped.get(key).invoices.push(invoice);
  });

  return Array.from(grouped.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));
}

export function getReportSummaries(invoices = [], referenceDate = new Date(), discounts = [], salaries = []) {
  const today = referenceDate.toISOString().slice(0, 10);
  const month = referenceDate.toISOString().slice(0, 7);

  const dailyInvoices = invoices.filter((invoice) => invoice.createdAt.slice(0, 10) === today);
  const monthlyInvoices = invoices.filter((invoice) => invoice.createdAt.slice(0, 7) === month);
  const subscribedInvoices = invoices.filter((invoice) => invoice.subscription);
  const dailyDiscounts = (discounts || []).filter((discount) => discount.date === today);
  const dailySalaries = (salaries || []).filter((salary) => salary.date === today);
  const dailyDiscountTotal = dailyDiscounts.reduce((sum, discount) => sum + Number(discount.amount || 0), 0)
    + dailySalaries.reduce((sum, salary) => sum + Number(salary.amount || 0), 0);

  return {
    dailyCount: dailyInvoices.length,
    dailyTotal: dailyInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
    dailyDiscountTotal,
    monthlyCount: monthlyInvoices.length,
    monthlyTotal: monthlyInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
    subscribedCount: subscribedInvoices.length,
    subscribedTotal: subscribedInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
    recentInvoices: [...invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8),
  };
}
