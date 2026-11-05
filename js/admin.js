// HALAMAN ADMIN //

function setupAdmin() {
  if (localStorage.getItem(STORAGE.adminLogin) === "true") {
    showAdmin();
  }

  $("loginForm")?.addEventListener("submit", handleAdminLogin);
  $("logoutBtn")?.addEventListener("click", logoutAdmin);
}

function handleAdminLogin(event) {
  event.preventDefault();

  const username = $("adminUser").value.trim();
  const password = $("adminPass").value;

  if (username === ADMIN.username && password === ADMIN.password) {
    localStorage.setItem(STORAGE.adminLogin, "true");
    $("loginError").textContent = "";
    showAdmin();
    return;
  }

  $("loginError").textContent = "Username atau password salah.";
}

function logoutAdmin() {
  localStorage.removeItem(STORAGE.adminLogin);
  location.reload();
}

async function showAdmin() {
    $("loginPage")?.classList.add("hidden");
    $("adminApp")?.classList.remove("hidden");

    setupAdminNavigation();

    // Muat data terbaru dari database
    await loadProductsFromDatabase();
    await loadOrdersFromDatabase();

    // Tampilkan data terbaru
    renderDashboard();
    renderOrders();
    renderProducts();
    renderReports();

    updateNotificationUI();
    requestNotificationPermission();
    startAdminAutoRefresh();
}




// NAVIGASI ADMIN 

function setupAdminNavigation() {
  document.querySelectorAll(".side-link").forEach((link) => {
    link.addEventListener("click", () => openAdminSection(link.dataset.section));
  });

  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => openAdminSection(button.dataset.go));
  });

  $("bellBtn")?.addEventListener("click", () => openAdminSection("notifications"));
  $("browserNotifBtn")?.addEventListener("click", requestNotificationPermission);
  $("exportBtn")?.addEventListener("click", exportExcel);
  $("addProductBtn")?.addEventListener("click", () => openModal("productModal"));
  $("readAllBtn")?.addEventListener("click", markNotificationsRead);
  $("applyReportBtn")?.addEventListener("click", renderReports);
  $("resetReportBtn")?.addEventListener("click", resetReportFilter);
  $("productForm")?.addEventListener("submit", saveProduct);
  $("editOrderForm")?.addEventListener("submit", saveOrderEdit);
  $("editProductForm")?.addEventListener("submit",saveEditProduct);

  document.addEventListener("click", handleAdminActionClick);
}

function openAdminSection(section) {
  const titles = {
    dashboard: "Dashboard",
    orders: "Data Pesanan",
    products: "Data Produk",
    reports: "Laporan",
    notifications: "Notifikasi"
  };

  document.querySelectorAll(".admin-section").forEach((element) => {
    element.classList.add("hidden");
  });

  $(`${section}Section`)?.classList.remove("hidden");

  document.querySelectorAll(".side-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.section === section);
  });

  if ($("pageTitle")) {
    $("pageTitle").textContent = titles[section] || "Dashboard";
  }
}

// DASHBOARD 

function renderDashboard() {
  $("statOrders").textContent = orders.length;
  $("statProcess").textContent = orders.filter((order) => order.status === "Diproses").length;
  $("statShipping").textContent = orders.filter((order) => order.status === "Dikirim").length;
  $("statDone").textContent = orders.filter((order) => order.status === "Selesai").length;

  const recent = orders.slice(0, 5);

  $("recentOrders").innerHTML = recent.length
    ? recent.map(renderCompactOrder).join("")
    : `<div class="empty">Belum ada pesanan.</div>`;
}

function renderCompactOrder(order) {
  return `
    <div class="notification-item">
      <div>
        <strong>${escapeHtml(order.id)} - ${escapeHtml(order.customer)}</strong>
        <p>${escapeHtml(order.product)} • ${order.qty} cup • ${rupiah(order.total)}</p>
      </div>
      <div>${badge(order.status)}</div>
    </div>
  `;
}

// LAPORAN

function getReportOrders() {
  const start = $("reportStartDate")?.value || "";
  const end = $("reportEndDate")?.value || "";

  return orders.filter((order) => {
    const date = new Date(order.date);
    if (Number.isNaN(date.getTime())) return false;
    const key = date.toISOString().slice(0, 10);
    if (start && key < start) return false;
    if (end && key > end) return false;
    return order.status !== "Dibatalkan";
  });
}

function renderReports() {
  const reportOrders = getReportOrders();
  const totalSales = reportOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const totalCups = reportOrders.reduce((sum, order) => sum + Number(order.qty || 0), 0);
  const done = reportOrders.filter((order) => order.status === "Selesai").length;

  $("reportSales").textContent = rupiah(totalSales);
  $("reportOrders").textContent = reportOrders.length;
  $("reportCups").textContent = totalCups;
  $("reportDone").textContent = done;

  const grouped = {};
  reportOrders.forEach((order) => {
    const date = new Date(order.date);
    const key = Number.isNaN(date.getTime()) ? "Tanpa tanggal" : date.toISOString().slice(0, 10);
    if (!grouped[key]) grouped[key] = { orders: 0, cups: 0, sales: 0 };
    grouped[key].orders += 1;
    grouped[key].cups += Number(order.qty || 0);
    grouped[key].sales += Number(order.total || 0);
  });

  const rows = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  renderReportChart("salesChart", rows, "sales", "Rp");
  renderReportChart("ordersChart", rows, "orders", "Pesanan");

  $("reportTable").innerHTML = rows.length
    ? rows.map(([date, data]) => `<tr><td>${formatReportDate(date)}</td><td>${data.orders}</td><td>${data.cups} cup</td><td>${rupiah(data.sales)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="empty">Belum ada data laporan pada periode tersebut.</td></tr>`;
}

function formatReportDate(date) {
  if (date === "Tanpa tanggal") return date;
  const value = new Date(`${date}T00:00:00`);
  return value.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function renderReportChart(elementId, rows, metric, label) {
  const element = $(elementId);
  if (!element) return;
  if (!rows.length) {
    element.innerHTML = `<div class="chart-empty">Belum ada data untuk ditampilkan.</div>`;
    return;
  }

  const max = Math.max(...rows.map(([, data]) => Number(data[metric] || 0)), 1);
  element.innerHTML = rows.map(([date, data]) => {
    const value = Number(data[metric] || 0);
    const height = Math.max(7, Math.round((value / max) * 100));
    const display = metric === "sales" ? rupiah(value) : `${value} pesanan`;
    return `<div class="chart-column" title="${formatReportDate(date)}: ${display}">
      <div class="chart-value">${metric === "sales" ? rupiahShort(value) : value}</div>
      <div class="chart-bar-area"><div class="chart-bar" style="height:${height}%"></div></div>
      <div class="chart-label">${formatReportDate(date)}</div>
    </div>`;
  }).join("");
}

function rupiahShort(value) {
  if (value >= 1000000) return `Rp${(value / 1000000).toFixed(1).replace(".0", "")}jt`;
  if (value >= 1000) return `Rp${Math.round(value / 1000)}rb`;
  return `Rp${value}`;
}

function resetReportFilter() {
  $("reportStartDate").value = "";
  $("reportEndDate").value = "";
  renderReports();
}

// PESANAN
  
function renderOrders() {
  const body = $("ordersTable");
  if (!body) return;

  if (!orders.length) {
    body.innerHTML = `<tr><td colspan="9" class="empty">Belum ada pesanan.</td></tr>`;
    return;
  }

  body.innerHTML = orders.map((order, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${formatDate(order.date)}</td>
      <td><strong>${escapeHtml(order.customer)}</strong><br><small>${escapeHtml(order.phone)}</small></td>
      <td>${escapeHtml(order.product)}</td>
      <td>${order.qty} cup</td>
      <td>${escapeHtml(order.payment)}</td>
      <td>${rupiah(order.total)}</td>
      <td>${badge(order.status)}</td>
      <td>
        <div class="action-group">
          <button class="mini-btn" data-action="edit-order" data-id="${escapeHtml(order.id)}">Edit</button>
          <button class="mini-btn wa-driver-btn" data-action="driver-whatsapp" data-id="${escapeHtml(order.id)}">WhatsApp</button>
          <button class="mini-btn danger" data-action="cancel-order" data-id="${escapeHtml(order.id)}">Cancel</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function openEditOrder(id) {
  const order = orders.find((item) => item.id === id);
  if (!order) return;

  $("editOrderId").value = order.id;
  $("editName").value = order.customer;
  $("editPhone").value = order.phone;
  $("editAddress").value = order.address;
  $("editQty").value = order.qty;
  $("editPayment").value = order.payment;
  $("editStatus").value = "";

  $("editProduct").innerHTML = products.map((product) => `
    <option value="${escapeHtml(product.name)}">${escapeHtml(product.name)}</option>
  `).join("");

  $("editProduct").value = order.product;
  openModal("orderModal");
}


async function saveOrderEdit(event) {
    event.preventDefault();

    const order = orders.find(
        (item) => item.id === $("editOrderId").value
    );

    if (!order) {
        toast("Pesanan tidak ditemukan.");
        return;
    }

    const product = getProduct($("editProduct").value);

    if (!product) {
        toast("Produk tidak ditemukan.");
        return;
    }

    const updatedOrder = {
        id: order.id,
        customer: $("editName").value.trim(),
        phone: $("editPhone").value.trim(),
        address: $("editAddress").value.trim(),
        product: product.name,
        qty: Number($("editQty").value),
        payment: $("editPayment").value,
        status: $("editStatus").value
    };

    if (
        !updatedOrder.customer ||
        !updatedOrder.phone ||
        !updatedOrder.address ||
        !["Selesai", "Dibatalkan"].includes(updatedOrder.status) ||
        !Number.isInteger(updatedOrder.qty) ||
        updatedOrder.qty < 1
    ) {
        toast("Periksa kembali data pesanan.");
        return;
    }

    try {
        const response = await fetch("admin_update_pesanan.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updatedOrder)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Gagal memperbarui pesanan.");
        }

        closeModal("orderModal");

        await loadOrdersFromDatabase();
        await loadProductsFromDatabase();
        renderAllAdmin();

        toast("Pesanan berhasil diperbarui di database.");
    } catch (error) {
        console.error("Gagal memperbarui pesanan:", error);
        toast(error.message || "Gagal menyimpan perubahan.");
    }
}



function sendOrderToDriver(id) {
  const order = orders.find((item) => item.id === id);
  if (!order) return;

  const tanggal = new Date(String(order.date || new Date()).replace(" ", "T"));
  const tanggalTeks = Number.isNaN(tanggal.getTime())
    ? String(order.date || "-")
    : new Intl.DateTimeFormat("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).format(tanggal).replace(" pukul ", ", ").replace(/\./g, ".");
  const peta = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address || "")}`;

  const message = [
    "*PENGANTARAN BARU*",
    `No. Pesanan : ${order.id}`,
    `Tanggal : ${tanggalTeks}`,
    `Pelanggan : ${order.customer} (${order.phone})`,
    `Alamat : ${order.address}`,
    `Barang : ${order.product} x ${order.qty} cup`,
    `Pembayaran : ${order.payment} (total ${rupiah(order.total)})`,
    `Peta : ${peta}`,
    "Mohon konfirmasi setelah pesanan sampai. Terima kasih."
  ].join("\n");

  // WhatsApp dibuka tanpa nomor tujuan agar admin dapat memilih kontak supir sendiri.
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

async function cancelOrder(id) {
    const order = orders.find(item => item.id === id);

    if (!order || order.status === "Dibatalkan") {
        return;
    }

    const confirmed = confirm(
        `Yakin ingin membatalkan pesanan ${order.id}?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch("admin_update_pesanan.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: order.id,
                customer: order.customer,
                phone: order.phone,
                address: order.address,
                payment: order.payment,
                product: order.product,
                qty: Number(order.qty),
                status: "Dibatalkan"
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Pesanan gagal dibatalkan."
            );
        }

        order.status = "Dibatalkan";

        writeStorage(STORAGE.orders, orders);

        addNotification(
            `Pesanan ${order.id} berhasil dibatalkan oleh admin.`
        );

        await loadOrdersFromDatabase();

        renderAllAdmin();

        toast("Pesanan berhasil dibatalkan.");

    } catch (error) {
        console.error("Gagal membatalkan pesanan:", error);

        toast(
            error.message || "Terjadi kesalahan saat membatalkan pesanan."
        );
    }
}



// PRODUK
  

function renderProducts() {
    const body = $("productsTable");
    if (!body) return;

    const activeProducts = products.filter(
        product => product.status === "Aktif"
    );

    if (activeProducts.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center;">
                    Belum ada produk aktif.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = activeProducts.map((product, index) => `
        <tr>
            <td>${index + 1}</td>

            <td>
                <strong>${escapeHtml(product.name)}</strong>
            </td>

            <td>${rupiah(product.price)}</td>

            <td>${escapeHtml(product.description || "-")}</td>

            <td>
                <button
                    class="mini-btn"
                    data-action="edit-product"
                    data-id="${escapeHtml(product.id)}">
                    Edit
                </button>

                <button
                    class="mini-btn danger"
                    data-action="delete-product"
                    data-id="${escapeHtml(product.id)}">
                    Hapus
                </button>
            </td>
        </tr>
    `).join("");
}

function openEditProduct(id) {
    const product = products.find(
        item => String(item.id) === String(id)
    );

    if (!product) {
        toast("Produk tidak ditemukan.");
        return;
    }

    $("editProductId").value = product.id;
    $("editProductName").value = product.name;
    $("editProductPrice").value = product.price;
    $("editProductDesc").value = product.description || "";

    openModal("editProductModal");
}

async function saveEditProduct(event) {
    event.preventDefault();

    const id = $("editProductId").value;
    const name = $("editProductName").value.trim();
    const price = Number($("editProductPrice").value);
    const description = $("editProductDesc").value.trim();

    if (!name || price < 0 || !Number.isFinite(price)) {
        toast("Nama dan harga produk harus valid.");
        return;
    }

    try {
        const response = await fetch("admin_update_produk.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id,
                name,
                price,
                description
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Produk gagal diperbarui."
            );
        }

        const berhasil = await loadProductsFromDatabase();

        if (!berhasil) {
            toast("Produk tersimpan, tetapi data terbaru gagal dimuat.");
            return;
        }

        closeModal("editProductModal");
        renderProducts();

        addNotification(`Produk ${name} berhasil diperbarui.`);
        toast("Perubahan produk berhasil disimpan.");

    } catch (error) {
        console.error("Gagal mengedit produk:", error);
        toast(error.message || "Terjadi kesalahan saat mengedit produk.");
    }
}

async function saveProduct(event) {
    event.preventDefault();

    const name = $("newProductName").value.trim();
    const price = Number($("newProductPrice").value);
    const description = $("newProductDesc").value.trim();

    if (!name || !Number.isInteger(price) || price <= 0) {
        toast("Nama dan harga produk harus diisi dengan benar.");
        return;
    }

    try {
        const response = await fetch("admin_tambah_produk.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                price,
                description
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Gagal menambahkan produk.");
        }

        await loadProductsFromDatabase();
        renderProducts();

        $("productForm").reset();

        const modal = $("productModal");
        if (modal) modal.classList.remove("show");

        toast("Produk berhasil ditambahkan.");

    } catch (error) {
        console.error("Gagal menambahkan produk:", error);
        toast(error.message || "Gagal menyimpan produk.");
    }
}



async function deleteProduct(id) {
    const product = products.find(
        (item) => String(item.id) === String(id)
    );

    if (!product) {
        toast("Produk tidak ditemukan.");
        return;
    }

    const confirmed = confirm(
        `Nonaktifkan produk "${product.name}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch("admin_nonaktif_produk.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: Number(id)
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Gagal menonaktifkan produk."
            );
        }

        await loadProductsFromDatabase();
        renderProducts();

        toast("Produk berhasil dinonaktifkan.");

    } catch (error) {
        console.error("Gagal menonaktifkan produk:", error);

        toast(
            error.message || "Gagal menonaktifkan produk."
        );
    }
}



// EXPORT

function exportExcel() {
  if (typeof XLSX === "undefined") {
    toast("Library Excel belum berhasil dimuat.");
    return;
  }

  const header = [
    "Tanggal",
    "No. Pesanan",
    "Pelanggan",
    "No. WhatsApp",
    "Produk",
    "Jumlah (cup)",
    "Alamat",
    "Pembayaran",
    "Status",
    "Total"
  ];

  const rows = orders.map((order) => [
    formatDate(order.date),
    order.id,
    order.customer,
    order.phone,
    order.product,
    Number(order.qty) || 0,
    order.address,
    order.payment,
    order.status,
    Number(order.total) || 0
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([
    header,
    ...rows
  ]);

  // Mengatur lebar kolom agar isi lebih mudah dibaca
  worksheet["!cols"] = [
    { wch: 16 },
    { wch: 18 },
    { wch: 25 },
    { wch: 18 },
    { wch: 25 },
    { wch: 15 },
    { wch: 35 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 }
  ];

  // Membuat workbook dan memasukkan worksheet
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Data Pesanan"
  );

  // Mengunduh file Excel asli
  XLSX.writeFile(
    workbook,
    `data-pesanan-gunung-salju-makmur-${Date.now()}.xlsx`
  );

  toast("Data pesanan berhasil diekspor ke Excel.");
}



// MODAL & REFRESH
  

function handleAdminActionClick(event) {
  const closeButton = event.target.closest("[data-close]");

  if (closeButton) {
    event.preventDefault();
    closeModal(closeButton.dataset.close);
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;

  switch (button.dataset.action) {
    case "edit-order":
      openEditOrder(id);
      break;
    case "cancel-order":
      cancelOrder(id);
      break;
    case "driver-whatsapp":
      sendOrderToDriver(id);
      break;
    case "delete-product":
      deleteProduct(id);
      break;
    case "edit-product":
      openEditProduct(id);
      break;
  }
}

function openModal(id) {
  $(id)?.classList.remove("hidden");
}

function closeModal(id) {
  $(id)?.classList.add("hidden");
}

function renderAllAdmin() {
  renderDashboard();
  renderOrders();
  renderProducts();
  renderReports();
  updateNotificationUI();
}

let adminOrdersSnapshot = "";

function startAdminAutoRefresh() {
  setInterval(async () => {
    const berhasil = await loadOrdersFromDatabase();

    if (berhasil) {
      renderDashboard();
      renderOrders();
      renderReports();
    }

    notifications = readStorage(STORAGE.notifications, notifications);
    updateNotificationUI();
  }, 5000);
}


