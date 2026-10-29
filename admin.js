// Khet2Ghar Admin frontend demo.
// IMPORTANT: client-side credentials are NOT secure. Replace with server-side authentication before production.
const DEMO_ADMIN_USER = 'admin';
const DEMO_ADMIN_PASSWORD = 'KhetAdmin123!';
const $ = (selector) => document.querySelector(selector);
const money = (value) => '₹' + Number(value || 0).toLocaleString('en-IN', {maximumFractionDigits:2});
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

$('#adminLoginForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const username = $('#adminUsername').value.trim();
  const password = $('#adminPassword').value;
  if (username === DEMO_ADMIN_USER && password === DEMO_ADMIN_PASSWORD) {
    sessionStorage.setItem('k2g_admin_demo_session', '1');
    $('#loginError').hidden = true;
    showDashboard();
  } else {
    $('#loginError').hidden = false;
  }
});
$('#logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('k2g_admin_demo_session');
  $('#dashboardPanel').hidden = true;
  $('#loginPanel').hidden = false;
  $('#adminPassword').value = '';
});
$('#refreshBtn').addEventListener('click', renderDashboard);
$('#searchOrders').addEventListener('input', renderOrders);
$('#statusFilter').addEventListener('change', renderOrders);
$('#exportBtn').addEventListener('click', exportOrders);

function loadDb() {
  try {
    const db = JSON.parse(localStorage.getItem('k2g_db') || '{}');
    return {
      Farmers: Array.isArray(db.Farmers) ? db.Farmers : [],
      Buyers: Array.isArray(db.Buyers) ? db.Buyers : [],
      Crops: Array.isArray(db.Crops) ? db.Crops : [],
      Orders: Array.isArray(db.Orders) ? db.Orders : []
    };
  } catch (_) {
    return {Farmers:[], Buyers:[], Crops:[], Orders:[]};
  }
}
function showDashboard() {
  $('#loginPanel').hidden = true;
  $('#dashboardPanel').hidden = false;
  renderDashboard();
}
function renderDashboard() {
  const db = loadDb();
  $('#farmersCount').textContent = db.Farmers.length;
  $('#buyersCount').textContent = db.Buyers.length;
  $('#productsCount').textContent = db.Crops.length;
  $('#ordersCount').textContent = db.Orders.length;
  const sales = db.Orders.reduce((sum, order) => sum + Number(order['Total (Rs)'] || 0), 0);
  $('#salesCount').textContent = money(sales);
  const notice = $('#dataNotice');
  if (!localStorage.getItem('k2g_db')) {
    notice.textContent = 'No Khet2Ghar records found in this browser yet. Register users and place test orders on the same browser to see demo data.';
  } else {
    notice.textContent = 'Showing records stored in this browser only. Shared records require a connected backend. Do not treat this demo login as secure admin access.';
  }
  renderOrders();
}
function renderOrders() {
  const db = loadDb();
  const query = $('#searchOrders').value.trim().toLowerCase();
  const status = $('#statusFilter').value.toLowerCase();
  const orders = db.Orders.filter(order => {
    const text = [order.ID, order['Buyer Name'], order.Crop, order.Payment, order['Ordered On'], order.Status].join(' ').toLowerCase();
    return (!query || text.includes(query)) && (!status || String(order.Status || '').toLowerCase() === status);
  });
  const body = $('#ordersBody');
  if (!orders.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty">No matching orders found.</td></tr>';
  } else {
    body.innerHTML = orders.map(order => {
      const statusText = String(order.Status || 'Confirmed');
      const statusClass = statusText.toLowerCase().replace(/[^a-z]/g, '');
      return `<tr>
        <td>${safe(order.ID || '—')}</td>
        <td>${safe(order['Buyer Name'] || '—')}</td>
        <td>${safe(order.Crop || '—')}</td>
        <td>${safe(order['Quantity (kg)'] ?? '—')}</td>
        <td>${money(order['Total (Rs)'])}</td>
        <td>${safe(order.Payment || '—')}</td>
        <td>${safe(order['Ordered On'] || '—')}</td>
        <td><span class="status ${safe(statusClass)}">${safe(statusText)}</span></td>
      </tr>`;
    }).join('');
  }
  $('#resultCount').textContent = `${orders.length} of ${db.Orders.length} orders`;
}
function exportOrders() {
  const db = loadDb();
  const query = $('#searchOrders').value.trim().toLowerCase();
  const status = $('#statusFilter').value.toLowerCase();
  const orders = db.Orders.filter(order => {
    const text = [order.ID, order['Buyer Name'], order.Crop, order.Payment, order['Ordered On'], order.Status].join(' ').toLowerCase();
    return (!query || text.includes(query)) && (!status || String(order.Status || '').toLowerCase() === status);
  });
  const columns = [
    ['Order ID','ID'], ['Customer','Buyer Name'], ['Product','Crop'],
    ['Quantity (kg)','Quantity (kg)'], ['Total (Rs)','Total (Rs)'],
    ['Payment','Payment'], ['Order date','Ordered On'], ['Status','Status']
  ];
  const csvCell = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const csv = [columns.map(c => csvCell(c[0])).join(','), ...orders.map(o => columns.map(c => csvCell(o[c[1]])).join(','))].join('\r\n');
  const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'khet2ghar-orders.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
if (sessionStorage.getItem('k2g_admin_demo_session') === '1') showDashboard();
