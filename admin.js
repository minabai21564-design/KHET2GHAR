const firebaseConfig = {
  apiKey: "AIzaSyDltn7KuX2BuY1QsYaLfUmJCuvqDdYEYpE",
  authDomain: "khet2ghar-e62f3.firebaseapp.com",
  projectId: "khet2ghar-e62f3",
  storageBucket: "khet2ghar-e62f3.firebasestorage.app",
  messagingSenderId: "689040100670",
  appId: "1:689040100670:web:9007604a3c83270c4cb06f"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const ADMIN_UID = "Unn4SIxZlvagRVw8X3gZhDm30Rf1";

const $ = (selector) => document.querySelector(selector);

const money = (value) =>
  "₹" + Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });

const safe = (value) =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

let dashboardData = {
  Farmers: [],
  Buyers: [],
  Crops: [],
  Orders: []
};

$("#adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("#adminUsername").value.trim();
  const password = $("#adminPassword").value;
  const error = $("#loginError");

  error.hidden = true;

  try {
    const result = await auth.signInWithEmailAndPassword(email, password);

    if (result.user.uid !== ADMIN_UID) {
      await auth.signOut();
      error.textContent = "This account is not authorized as admin.";
      error.hidden = false;
      return;
    }

    $("#loginPanel").hidden = true;
    $("#dashboardPanel").hidden = false;
    await renderDashboard();

  } catch (err) {
    console.error(err);
    error.textContent = "Login failed. Check your email, password, and Firebase setup.";
    error.hidden = false;
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  await auth.signOut();
  $("#dashboardPanel").hidden = true;
  $("#loginPanel").hidden = false;
  $("#adminPassword").value = "";
});

$("#refreshBtn").addEventListener("click", renderDashboard);
$("#searchOrders").addEventListener("input", renderOrders);
$("#statusFilter").addEventListener("change", renderOrders);
$("#exportBtn").addEventListener("click", exportOrders);

async function renderDashboard() {
  $("#dataNotice").textContent = "Loading marketplace records…";

  try {
    const [usersSnap, cropsSnap, ordersSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("crops").get(),
      db.collection("orders").get()
    ]);

    const users = usersSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    dashboardData = {
      Farmers: users.filter(u => u.role === "farmer"),
      Buyers: users.filter(u => u.role === "buyer"),
      Crops: cropsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),
      Orders: ordersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    };

    $("#farmersCount").textContent = dashboardData.Farmers.length;
    $("#buyersCount").textContent = dashboardData.Buyers.length;
    $("#productsCount").textContent = dashboardData.Crops.length;
    $("#ordersCount").textContent = dashboardData.Orders.length;

    const sales = dashboardData.Orders.reduce(
      (sum, order) => sum + Number(order.total ?? order["Total (Rs)"] ?? 0),
      0
    );

    $("#salesCount").textContent = money(sales);
    $("#dataNotice").textContent =
      "Showing records from Firestore. Only collections permitted by your security rules can be displayed.";

    renderOrders();

  } catch (err) {
    console.error(err);
    $("#dataNotice").textContent =
      "Could not load records. Check Firestore Security Rules and collection permissions.";
    $("#farmersCount").textContent = "—";
    $("#buyersCount").textContent = "—";
    $("#productsCount").textContent = "—";
    $("#ordersCount").textContent = "—";
    $("#salesCount").textContent = "—";
    $("#ordersBody").innerHTML =
      '<tr><td colspan="8" class="empty">Could not load orders. Check permissions.</td></tr>';
    $("#resultCount").textContent = "Data unavailable";
  }
}

function renderOrders() {
  const allOrders = dashboardData.Orders;
  const query = $("#searchOrders").value.trim().toLowerCase();
  const status = $("#statusFilter").value.toLowerCase();

  const orders = allOrders.filter(order => {
    const text = [
      order.id, order.ID,
      order.buyerName, order["Buyer Name"],
      order.crop, order.Crop,
      order.payment, order.Payment,
      order.orderedAt, order["Ordered On"],
      order.status, order.Status
    ].join(" ").toLowerCase();

    const orderStatus = String(order.status ?? order.Status ?? "Confirmed").toLowerCase();

    return (!query || text.includes(query)) &&
      (!status || orderStatus === status);
  });

  if (!orders.length) {
    $("#ordersBody").innerHTML =
      '<tr><td colspan="8" class="empty">No matching orders found.</td></tr>';
  } else {
    $("#ordersBody").innerHTML = orders.map(order => {
      const statusText = String(order.status ?? order.Status ?? "Confirmed");
      const statusClass = statusText.toLowerCase().replace(/[^a-z]/g, "");

      const orderDate = order.orderedAt?.toDate
        ? order.orderedAt.toDate().toLocaleDateString("en-IN")
        : order.orderedAt ?? order["Ordered On"] ?? "—";

      return `<tr>
        <td>${safe(order.id ?? order.ID ?? "—")}</td>
        <td>${safe(order.buyerName ?? order["Buyer Name"] ?? "—")}</td>
        <td>${safe(order.crop ?? order.Crop ?? "—")}</td>
        <td>${safe(order.quantityKg ?? order["Quantity (kg)"] ?? "—")}</td>
        <td>${money(order.total ?? order["Total (Rs)"] ?? 0)}</td>
        <td>${safe(order.payment ?? order.Payment ?? "—")}</td>
        <td>${safe(orderDate)}</td>
        <td><span class="status ${safe(statusClass)}">${safe(statusText)}</span></td>
      </tr>`;
    }).join("");
  }

  $("#resultCount").textContent = `${orders.length} of ${allOrders.length} orders`;
}

function exportOrders() {
  const query = $("#searchOrders").value.trim().toLowerCase();
  const status = $("#statusFilter").value.toLowerCase();

  const orders = dashboardData.Orders.filter(order => {
    const text = [
      order.id, order.ID,
      order.buyerName, order["Buyer Name"],
      order.crop, order.Crop,
      order.payment, order.Payment,
      order.status, order.Status
    ].join(" ").toLowerCase();

    const orderStatus = String(order.status ?? order.Status ?? "Confirmed").toLowerCase();

    return (!query || text.includes(query)) &&
      (!status || orderStatus === status);
  });

  const columns = [
    ["Order ID", o => o.id ?? o.ID],
    ["Customer", o => o.buyerName ?? o["Buyer Name"]],
    ["Product", o => o.crop ?? o.Crop],
    ["Quantity (kg)", o => o.quantityKg ?? o["Quantity (kg)"]],
    ["Total (Rs)", o => o.total ?? o["Total (Rs)"]],
    ["Payment", o => o.payment ?? o.Payment],
    ["Status", o => o.status ?? o.Status]
  ];

  const cell = value => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  const csv = [
    columns.map(c => cell(c[0])).join(","),
    ...orders.map(o => columns.map(c => cell(c[1](o))).join(","))
  ].join("\r\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "khet2ghar-orders.csv";
  a.click();
  URL.revokeObjectURL(url);
}

auth.onAuthStateChanged(async user => {
  if (!user || user.uid !== ADMIN_UID) {
    $("#dashboardPanel").hidden = true;
    $("#loginPanel").hidden = false;
    return;
  }

  $("#loginPanel").hidden = true;
  $("#dashboardPanel").hidden = false;
  await renderDashboard();
});
  
