import { authenticateUser, calculateInvoiceTotal, createInvoiceRecord, createServiceRecord, filterInvoicesByQuery, getCustomerReportGroups, getFilteredReportInvoices, getReportSummaries, updateInvoiceRecord } from './logic.js';

const STORAGE_KEY = 'car-wash-pos-store';

const defaultServices = [
  { id: 'service-1', name: 'غسيل داخلي', price: 20 },
  { id: 'service-2', name: 'غسيل خارجي', price: 20 },
  { id: 'service-3', name: 'غسيل كامل', price: 40 },
  { id: 'service-4', name: 'غسيل VIP', price: 90 },
  { id: 'service-5', name: 'غسيل محرك بخار', price: 90 },
  { id: 'service-6', name: 'غسيل صالون بخار', price: 350 },
  { id: 'service-7', name: 'غسيل كامل بخار', price: 470 },
  { id: 'service-8', name: 'غسيل محرك قاز', price: 30 },
  { id: 'service-9', name: 'غسيل صالة قاز', price: 30 },
  { id: 'service-10', name: 'تلميع ديكسوات', price: 50 },
];

const initialState = {
  services: defaultServices,
  invoices: [],
};

let state = loadState();
let selectedServices = [];
let editingInvoiceId = null;
let authenticated = false;

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const invoiceForm = document.getElementById('invoiceForm');
const serviceButtonsEl = document.getElementById('serviceButtons');
const currentItemsEl = document.getElementById('currentItems');
const currentTotalEl = document.getElementById('currentTotal');
const recentInvoicesEl = document.getElementById('recentInvoices');
const reportInvoicesEl = document.getElementById('reportInvoices');
const customerReportListEl = document.getElementById('customerReportList');
const invoiceManagementEl = document.getElementById('invoiceManagement');
const serviceListEl = document.getElementById('serviceList');
const customerNameEl = document.getElementById('customerName');
const customerPhoneEl = document.getElementById('customerPhone');
const carTypeEl = document.getElementById('carType');
const workerEl = document.getElementById('worker');
const paymentMethodEl = document.getElementById('paymentMethod');
const subscriptionEl = document.getElementById('subscription');
const printInvoiceEl = document.getElementById('printInvoice');
const manualStainPriceEl = document.getElementById('manualStainPrice');
const manualStainBtn = document.getElementById('manualStainBtn');
const resetFormBtn = document.getElementById('resetFormBtn');
const printCurrentInvoiceBtn = document.getElementById('printCurrentInvoiceBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const reportSearchEl = document.getElementById('reportSearch');
const reportTypeSelectEl = document.getElementById('reportTypeSelect');
const reportDateInputEl = document.getElementById('reportDateInput');
const reportCustomerInputEl = document.getElementById('reportCustomerInput');
const serviceForm = document.getElementById('serviceForm');
const serviceNameEl = document.getElementById('serviceName');
const servicePriceEl = document.getElementById('servicePrice');
const serviceSubmitBtn = document.getElementById('serviceSubmitBtn');
const cancelServiceEditBtn = document.getElementById('cancelServiceEditBtn');
const loginScreen = document.getElementById('loginScreen');
const appShell = document.getElementById('appShell');
const loginUsernameEl = document.getElementById('loginUsername');
const loginPasswordEl = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');

let editingServiceId = null;

setupTabs();
setupLogin();
registerServiceWorker();
render();

invoiceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveInvoice();
});

manualStainBtn.addEventListener('click', () => {
  const price = Number(manualStainPriceEl.value || 0);
  if (!price) {
    alert('يرجى إدخال سعر إزالة البقع');
    return;
  }

  selectedServices = [...selectedServices, {
    id: `manual-${Date.now()}`,
    name: 'إزالة بقع',
    price,
  }];
  manualStainPriceEl.value = '';
  renderCurrentInvoice();
});

resetFormBtn.addEventListener('click', () => {
  resetForm();
});

printCurrentInvoiceBtn.addEventListener('click', () => {
  const draftInvoice = buildDraftInvoice();
  if (!draftInvoice.services.length) {
    alert('يرجى اختيار خدمة واحدة على الأقل قبل الطباعة');
    return;
  }
  openPrintWindow(buildInvoiceHtml(draftInvoice));
});

reportSearchEl.addEventListener('input', () => {
  renderReports();
});
reportTypeSelectEl.addEventListener('change', () => {
  updateReportInputsVisibility();
  renderReports();
});
reportDateInputEl.addEventListener('input', () => {
  renderReports();
});
reportCustomerInputEl.addEventListener('input', () => {
  renderReports();
});

exportPdfBtn.addEventListener('click', () => {
  const reportType = reportTypeSelectEl.value;
  const reportDate = reportDateInputEl.value.trim();
  const reportCustomer = reportCustomerInputEl.value.trim();

  if (reportType === 'customer' && !reportCustomer) {
    alert('يرجى إدخال اسم العميل لعرض تقرير العميل المحدد.');
    return;
  }

  if (['daily', 'weekly', 'monthly'].includes(reportType) && !reportDate) {
    alert('يرجى اختيار التاريخ للتقرير.');
    reportDateInputEl.focus();
    return;
  }

  const filteredInvoices = getFilteredReportInvoices(
    filterInvoicesByQuery(state.invoices, reportSearchEl.value),
    {
      type: reportType,
      date: reportDate,
      customerName: reportCustomer,
    },
  );

  const summary = getReportSummaries(filteredInvoices);
  const reportLabel = reportType === 'all'
    ? 'تقرير كل الفواتير'
    : reportType === 'daily'
      ? `تقرير يومي: ${reportDate}`
      : reportType === 'weekly'
        ? `تقرير أسبوعي حتى: ${reportDate}`
        : reportType === 'monthly'
          ? `تقرير شهري: ${reportDate}`
          : `تقرير العميل: ${reportCustomer}`;

  const invoiceSections = filteredInvoices
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((invoice) => `<div style="margin-bottom:24px;page-break-inside:avoid;">${buildInvoiceHtml(invoice)}</div>`)
    .join('');

  const html = `
    <div style="font-family:Tahoma;padding:24px;direction:rtl;">
      <h1>مركز 90 لغسيل السيارات</h1>
      <h2 style="margin-top:0;">${reportLabel}</h2>
      <p>عدد الفواتير: <strong>${filteredInvoices.length}</strong></p>
      <p>إجمالي المبيعات اليومية: <strong>${summary.dailyTotal}</strong> دل</p>
      <p>إجمالي المبيعات الشهرية: <strong>${summary.monthlyTotal}</strong> دل</p>
      <p>إجمالي العملاء المشتركين: <strong>${summary.subscribedTotal}</strong> دل</p>
      <hr />
      <div>${invoiceSections || '<p>لا توجد فواتير لعرضها.</p>'}</div>
    </div>
  `;
  openPrintWindow(html);
});

serviceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = serviceNameEl.value.trim();
  const price = Number(servicePriceEl.value);

  if (!name || !price) {
    alert('يرجى إدخال اسم الخدمة وسعرها');
    return;
  }

  if (editingServiceId) {
    const updatedService = { ...state.services.find((service) => service.id === editingServiceId), name, price };
    state.services = state.services.map((service) => (service.id === editingServiceId ? updatedService : service));
    await persistService(updatedService);
  } else {
    const createdService = createServiceRecord({ name, price });
    state.services.push(createdService);
    await persistService(createdService);
  }

  saveState();
  resetServiceForm();
  render();
});

cancelServiceEditBtn.addEventListener('click', resetServiceForm);

function setupLogin() {
  loginBtn.addEventListener('click', async () => {
    const success = authenticateUser(loginUsernameEl.value, loginPasswordEl.value);
    if (!success) {
      alert('بيانات الدخول غير صحيحة');
      return;
    }

    authenticated = true;
    loginScreen.classList.add('hidden');
    appShell.classList.remove('hidden');
    await loadRemoteData();
    render();
  });
}

async function loadRemoteData() {
  try {
    const [servicesResponse, invoicesResponse] = await Promise.all([
      fetch('/api/services'),
      fetch('/api/invoices'),
    ]);

    const services = await servicesResponse.json();
    const invoices = await invoicesResponse.json();
    state = { services, invoices };
    saveState();
  } catch {
    state = loadState();
  }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
    } catch {
      // ignore service worker registration issues
    }
  }
}

function setupTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.remove('active'));
      panels.forEach((panel) => panel.classList.remove('active-panel'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active-panel');
    });
  });
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return initialState;
    }
    const parsed = JSON.parse(stored);
    return {
      services: parsed.services?.length ? parsed.services : initialState.services,
      invoices: parsed.invoices || [],
    };
  } catch {
    return initialState;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function persistInvoice(invoice) {
  try {
    if (editingInvoiceId) {
      await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice),
      });
    } else {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoice),
      });
    }
  } catch {
    // ignore network errors and keep working locally
  }
}

async function persistService(service) {
  try {
    if (editingServiceId) {
      await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(service),
      });
    } else {
      await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(service),
      });
    }
  } catch {
    // ignore network errors and keep working locally
  }
}

function render() {
  renderServiceButtons();
  renderCurrentInvoice();
  renderRecentInvoices();
  renderReports();
  renderServices();
  renderInvoiceManagement();
}

function renderServiceButtons() {
  serviceButtonsEl.innerHTML = '';
  state.services.forEach((service) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${service.name} - ${service.price} دل`;
    button.className = selectedServices.some((item) => item.id === service.id) ? 'active' : '';
    button.addEventListener('click', () => toggleService(service));
    serviceButtonsEl.appendChild(button);
  });
}

function toggleService(service) {
  const exists = selectedServices.findIndex((item) => item.id === service.id);
  if (exists >= 0) {
    selectedServices = selectedServices.filter((item) => item.id !== service.id);
  } else {
    selectedServices = [...selectedServices, { ...service }];
  }
  renderCurrentInvoice();
  renderServiceButtons();
}

function renderCurrentInvoice() {
  currentItemsEl.innerHTML = '';

  if (!selectedServices.length) {
    const empty = document.createElement('li');
    empty.textContent = 'لا توجد خدمات محددة بعد';
    currentItemsEl.appendChild(empty);
  } else {
    selectedServices.forEach((service) => {
      const item = document.createElement('li');
      item.textContent = `${service.name} - ${service.price} دل`;
      currentItemsEl.appendChild(item);
    });
  }

  currentTotalEl.textContent = `${calculateInvoiceTotal(selectedServices)} دل`;
}

function renderRecentInvoices() {
  recentInvoicesEl.innerHTML = '';
  const latest = [...state.invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  if (!latest.length) {
    recentInvoicesEl.innerHTML = '<p class="muted">لا توجد فواتير حتى الآن.</p>';
    return;
  }

  latest.forEach((invoice) => {
    const card = document.createElement('div');
    card.className = 'invoice-item';
    card.innerHTML = `
      <strong>${invoice.customerName}</strong>
      <div>${invoice.carType} · ${invoice.worker}</div>
      <div>${invoice.total} دل · ${invoice.paymentMethod}</div>
      <div>${new Date(invoice.createdAt).toLocaleString('ar-EG')}</div>
      <div class="invoice-actions">
        <button data-action="edit" data-id="${invoice.id}" type="button">تعديل</button>
        <button data-action="delete" data-id="${invoice.id}" type="button">حذف</button>
      </div>
    `;
    recentInvoicesEl.appendChild(card);
  });

  recentInvoicesEl.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => handleInvoiceAction(button.dataset.action, button.dataset.id));
  });
}

function renderReports() {
  updateReportInputsVisibility();
  const reportType = reportTypeSelectEl.value;
  const reportDate = reportDateInputEl.value.trim();
  const reportCustomer = reportCustomerInputEl.value.trim();
  const filteredInvoices = getFilteredReportInvoices(
    filterInvoicesByQuery(state.invoices, reportSearchEl.value),
    {
      type: reportType,
      date: reportDate,
      customerName: reportCustomer,
    },
  );
  const summary = getReportSummaries(filteredInvoices);
  document.getElementById('dailyCount').textContent = `${summary.dailyCount} فاتورة`;
  document.getElementById('dailyTotal').textContent = `${summary.dailyTotal} دل`;
  document.getElementById('monthlyCount').textContent = `${summary.monthlyCount} فاتورة`;
  document.getElementById('monthlyTotal').textContent = `${summary.monthlyTotal} دل`;
  document.getElementById('subscribedCount').textContent = `${summary.subscribedCount} عميل`;
  document.getElementById('subscribedTotal').textContent = `${summary.subscribedTotal} دل`;

  reportInvoicesEl.innerHTML = '';
  if (!filteredInvoices.length) {
    reportInvoicesEl.innerHTML = '<p class="muted">لا توجد نتائج مطابقة للبحث.</p>';
    renderCustomerReportList(filteredInvoices);
    return;
  }

  filteredInvoices
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((invoice) => {
      const item = document.createElement('div');
      item.className = 'invoice-item';
      item.innerHTML = `
        <strong>${invoice.customerName}</strong>
        <div>${invoice.customerPhone} · ${invoice.carType}</div>
        <div>${invoice.services.map((service) => service.name).join('، ')}</div>
        <div>الإجمالي: ${invoice.total} دل · ${invoice.paymentMethod} · ${invoice.subscription ? 'مشترك' : 'غير مشترك'}</div>
      `;
      reportInvoicesEl.appendChild(item);
    });

  renderCustomerReportList(filteredInvoices);
}

function renderCustomerReportList(invoices) {
  customerReportListEl.innerHTML = '';
  const groups = getCustomerReportGroups(invoices);

  if (!groups.length) {
    customerReportListEl.innerHTML = '<p class="muted">لا توجد بيانات كافية لعرض تقرير العملاء.</p>';
    return;
  }

  groups.forEach((group) => {
    const card = document.createElement('div');
    card.className = 'invoice-item customer-report-card';
    card.innerHTML = `
      <strong>${group.customerName}</strong>
      <div>رقم العميل: ${group.customerPhone}</div>
      <div>عدد الزيارات: ${group.invoices.length}</div>
      <div>${group.invoices.map((invoice) => `• ${invoice.carType} - ${invoice.services.map((service) => service.name).join('، ')}`).join('<br>')}</div>
    `;
    customerReportListEl.appendChild(card);
  });
}

function renderServices() {
  serviceListEl.innerHTML = '';
  state.services.forEach((service) => {
    const row = document.createElement('div');
    row.className = 'service-row';
    row.innerHTML = `
      <div><strong>${service.name}</strong><div>${service.price} دل</div></div>
      <div class="invoice-actions">
        <button data-action="edit-service" data-id="${service.id}" type="button">تعديل</button>
        <button data-action="delete-service" data-id="${service.id}" type="button">حذف</button>
      </div>
    `;
    serviceListEl.appendChild(row);
  });

  serviceListEl.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => handleServiceAction(button.dataset.action, button.dataset.id));
  });
}

function renderInvoiceManagement() {
  invoiceManagementEl.innerHTML = '';
  if (!state.invoices.length) {
    invoiceManagementEl.innerHTML = '<p class="muted">لا توجد فواتير لإدارتها.</p>';
    return;
  }

  state.invoices
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((invoice) => {
      const item = document.createElement('div');
      item.className = 'invoice-item';
      item.innerHTML = `
        <strong>${invoice.customerName}</strong>
        <div>${invoice.total} دل · ${invoice.paymentMethod}</div>
        <div class="invoice-actions">
          <button data-action="edit-invoice" data-id="${invoice.id}" type="button">تعديل</button>
          <button data-action="delete-invoice" data-id="${invoice.id}" type="button">حذف</button>
        </div>
      `;
      invoiceManagementEl.appendChild(item);
    });

  invoiceManagementEl.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => handleInvoiceManagementAction(button.dataset.action, button.dataset.id));
  });
}

function handleInvoiceAction(action, id) {
  const invoice = state.invoices.find((item) => item.id === id);
  if (!invoice) return;
  if (action === 'edit') {
    populateInvoiceForm(invoice);
    editingInvoiceId = invoice.id;
    document.querySelector('.tab[data-target="pos"]').click();
  }
  if (action === 'delete') {
    state.invoices = state.invoices.filter((item) => item.id !== id);
    saveState();
    render();
  }
}

function handleInvoiceManagementAction(action, id) {
  if (action === 'delete-invoice') {
    state.invoices = state.invoices.filter((item) => item.id !== id);
    saveState();
    render();
  }
  if (action === 'edit-invoice') {
    const invoice = state.invoices.find((item) => item.id === id);
    if (!invoice) return;
    populateInvoiceForm(invoice);
    editingInvoiceId = invoice.id;
    document.querySelector('.tab[data-target="pos"]').click();
  }
}

function handleServiceAction(action, id) {
  if (action === 'delete-service') {
    state.services = state.services.filter((service) => service.id !== id);
    saveState();
    render();
    return;
  }

  if (action === 'edit-service') {
    const service = state.services.find((item) => item.id === id);
    if (!service) return;
    editingServiceId = service.id;
    serviceNameEl.value = service.name;
    servicePriceEl.value = service.price;
    serviceSubmitBtn.textContent = 'تحديث الخدمة';
  }
}

async function saveInvoice() {
  const payload = {
    customerName: customerNameEl.value,
    customerPhone: customerPhoneEl.value,
    carType: carTypeEl.value,
    worker: workerEl.value,
    paymentMethod: paymentMethodEl.value,
    subscription: subscriptionEl.checked,
    services: selectedServices,
  };

  if (!payload.customerName || !payload.customerPhone || !payload.carType || !selectedServices.length) {
    alert('يرجى تعبئة بيانات العميل واختيار خدمة واحدة على الأقل');
    return;
  }

  const invoice = editingInvoiceId
    ? updateInvoiceRecord(state.invoices.find((item) => item.id === editingInvoiceId), payload)
    : createInvoiceRecord({ ...payload, createdAt: new Date().toISOString() });

  if (editingInvoiceId) {
    state.invoices = state.invoices.map((item) => (item.id === editingInvoiceId ? invoice : item));
  } else {
    state.invoices = [invoice, ...state.invoices];
  }

  await persistInvoice(invoice);
  saveState();
  if (printInvoiceEl.checked) {
    openPrintWindow(buildInvoiceHtml(invoice));
  }
  resetForm();
  render();
}

function populateInvoiceForm(invoice) {
  customerNameEl.value = invoice.customerName;
  customerPhoneEl.value = invoice.customerPhone;
  carTypeEl.value = invoice.carType;
  workerEl.value = invoice.worker;
  paymentMethodEl.value = invoice.paymentMethod;
  subscriptionEl.checked = invoice.subscription;
  selectedServices = invoice.services.map((service) => ({ ...service }));
  renderServiceButtons();
  renderCurrentInvoice();
}

function resetForm() {
  invoiceForm.reset();
  selectedServices = [];
  editingInvoiceId = null;
  renderCurrentInvoice();
  renderServiceButtons();
}

function resetServiceForm() {
  serviceForm.reset();
  editingServiceId = null;
  serviceSubmitBtn.textContent = 'إضافة خدمة';
}

function updateReportInputsVisibility() {
  const reportType = reportTypeSelectEl.value;
  reportDateInputEl.style.display = 'none';
  reportCustomerInputEl.style.display = 'none';
  reportDateInputEl.type = 'text';
  reportDateInputEl.placeholder = 'yyyy-mm-dd أو yyyy-mm';

  if (reportType === 'daily' || reportType === 'weekly') {
    reportDateInputEl.type = 'date';
    reportDateInputEl.placeholder = 'yyyy-mm-dd';
    reportDateInputEl.style.display = 'inline-flex';
  }

  if (reportType === 'monthly') {
    reportDateInputEl.type = 'month';
    reportDateInputEl.placeholder = 'yyyy-mm';
    reportDateInputEl.style.display = 'inline-flex';
  }

  if (reportType === 'customer') {
    reportCustomerInputEl.style.display = 'inline-flex';
  }
}

function buildDraftInvoice() {
  return {
    id: `draft-${Date.now()}`,
    customerName: customerNameEl.value.trim(),
    customerPhone: customerPhoneEl.value.trim(),
    carType: carTypeEl.value.trim(),
    worker: workerEl.value,
    paymentMethod: paymentMethodEl.value,
    subscription: subscriptionEl.checked,
    services: selectedServices,
    total: calculateInvoiceTotal(selectedServices),
    createdAt: new Date().toISOString(),
  };
}

function buildInvoiceHtml(invoice) {
  const servicesMarkup = invoice.services.map((service) => `
    <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px dashed #aaa;">
      <span>${service.name}</span>
      <strong>${service.price} دل</strong>
    </div>
  `).join('');

  return `
    <div style="font-family:Tahoma;padding:24px;direction:rtl;line-height:1.6;max-width:700px;margin:0 auto;border:2px solid #111;border-radius:18px;">
      <div style="text-align:center;border-bottom:2px solid #d40000;padding-bottom:12px;">
        <h2 style="margin:0;color:#d40000;">مركز 90 لغسيل السيارات</h2>
        <p style="margin:4px 0 0;">فاتورة خدمة</p>
      </div>
      <div style="display:grid;gap:6px;margin-top:12px;">
        <p style="margin:0;">العميل: <strong>${invoice.customerName || 'غير محدد'}</strong></p>
        <p style="margin:0;">رقم العميل: <strong>${invoice.customerPhone || 'غير محدد'}</strong></p>
        <p style="margin:0;">نوع السيارة: <strong>${invoice.carType || 'غير محدد'}</strong></p>
        <p style="margin:0;">العامل: <strong>${invoice.worker || 'غير محدد'}</strong></p>
        <p style="margin:0;">الدفع: <strong>${invoice.paymentMethod || 'غير محدد'}</strong></p>
        <p style="margin:0;">العميل مشترك: <strong>${invoice.subscription ? 'نعم' : 'لا'}</strong></p>
      </div>
      <div style="margin-top:12px;">${servicesMarkup}</div>
      <div style="display:flex;justify-content:space-between;padding-top:12px;font-size:1.1rem;font-weight:700;">
        <span>الإجمالي</span>
        <span>${invoice.total || 0} دل</span>
      </div>
      <p style="margin-top:12px;text-align:center;color:#666;">${new Date(invoice.createdAt).toLocaleString('ar-EG')}</p>
      <p style="margin-top:8px;text-align:center;">شكرًا لثقتكم</p>
    </div>
  `;
}

function openPrintWindow(content) {
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    alert('يرجى السماح بفتح نافذة جديدة للطباعة');
    return;
  }

  printWindow.document.write(`<!DOCTYPE html><html><head><title>فاتورة</title><style>body{font-family:Tahoma;padding:24px;direction:rtl;}</style></head><body>${content}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
