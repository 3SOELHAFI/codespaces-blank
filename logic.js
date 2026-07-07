export function calculateInvoiceTotal(services = []) {
  return services.reduce((sum, service) => sum + Number(service.price || 0), 0);
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

export function createInvoiceRecord({
  customerName,
  customerPhone,
  carType,
  worker,
  paymentMethod,
  subscription,
  services,
  createdAt,
}) {
  const total = calculateInvoiceTotal(services);

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
    createdAt: createdAt || new Date().toISOString(),
  };
}

export function updateInvoiceRecord(invoice, updates) {
  const nextServices = updates.services || invoice.services;
  return {
    ...invoice,
    ...updates,
    services: nextServices.map((service) => ({ ...service })),
    total: calculateInvoiceTotal(nextServices),
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

export function getReportSummaries(invoices = [], referenceDate = new Date()) {
  const today = referenceDate.toISOString().slice(0, 10);
  const month = referenceDate.toISOString().slice(0, 7);

  const dailyInvoices = invoices.filter((invoice) => invoice.createdAt.slice(0, 10) === today);
  const monthlyInvoices = invoices.filter((invoice) => invoice.createdAt.slice(0, 7) === month);
  const subscribedInvoices = invoices.filter((invoice) => invoice.subscription);

  return {
    dailyCount: dailyInvoices.length,
    dailyTotal: dailyInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
    monthlyCount: monthlyInvoices.length,
    monthlyTotal: monthlyInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
    subscribedCount: subscribedInvoices.length,
    subscribedTotal: subscribedInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
    recentInvoices: [...invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8),
  };
}
