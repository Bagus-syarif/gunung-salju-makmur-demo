// HALAMAN CUSTOMER
   

let customerOrder = {
  product: null,
  qty: 1,
  name: "",
  phone: "",
  address: "",
  note: "",
  payment: "Transfer"
};

let customerOrderRefreshTimer = null;
let customerOrderRefreshBusy = false;

async function setupCustomer() {
  bindCustomerNavigation();
  bindOrderFlow();

  // Halaman pelanggan mengambil produk dan status pesanan dari database.
  await Promise.all([
    loadProductsFromDatabase(),
    loadCustomerOrdersFromDatabase()
  ]);

  renderCustomerProducts();
  renderCustomerOrders();
  updateCustomerOrderCount();
  startCustomerOrderAutoRefresh();
}

 // NAVIGASI CUSTOMER
  

function bindCustomerNavigation() {
  document.querySelectorAll("[data-nav]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      openCustomerPage(element.dataset.nav);
    });
  });
}

function openCustomerPage(page) {
  document.querySelectorAll(".customer-page").forEach((section) => {
    section.classList.remove("active-page");
  });

  const target = $(`${page}`);
  if (target) {
    target.classList.add("active-page");
  }

  document.querySelectorAll(".customer-menu [data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === page);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (page === "orders") {
    loadCustomerOrdersFromDatabase().then(() => {
      renderCustomerOrders();
      updateCustomerOrderCount();
    });
  }
}

/* ---------------------------------------------------------
   PRODUK
   --------------------------------------------------------- */

function renderCustomerProducts() {
  renderHomeProducts();
  renderOrderProducts();
  updateHomePrice();
}

function renderHomeProducts() {
  const container = $("homeProductList");
  if (!container) return;

  container.innerHTML = products.map((product) => `
    <article class="customer-product-card">
      <div class="mini-product-visual">
        <img src="assets/es-cup-soft.png" alt="Es cup Gunung Salju Makmur" loading="lazy">
      </div>
      <div class="customer-product-info">
        <span class="available">TERSEDIA</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description || "Es cup Gunung Salju Makmur.")}</p>
        <div class="product-bottom">
          <strong>${rupiah(product.price)} <small>/ cup</small></strong>
          <button class="customer-btn primary small" data-product-order="${escapeHtml(product.id)}">Pesan</button>
        </div>
      </div>
    </article>
  `).join("");

  container.querySelectorAll("[data-product-order]").forEach((button) => {
    button.addEventListener("click", () => {
      openCustomerPage("order");
      setTimeout(() => focusOrderProduct(button.dataset.productOrder), 50);
    });
  });
}

function renderOrderProducts() {
  const container = $("orderProductList");
  if (!container) return;

  container.innerHTML = products.map((product) => `
    <article class="order-product-modern">
      <div class="order-product-visual">
        <img src="assets/es-cup-soft.png" alt="Es cup Gunung Salju Makmur" loading="lazy">
      </div>
      <div class="order-product-details">
        <span class="available">TERSEDIA</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description || "Es cup untuk kebutuhan usaha.")}</p>
        <strong class="modern-price">${rupiah(product.price)} <small>/ cup</small></strong>
      </div>
      <div class="order-product-buy">
        <span>Jumlah Pesanan</span>
        <div class="modern-qty">
          <button type="button" data-minus="${escapeHtml(product.id)}">−</button>
          <input id="qty-${escapeHtml(product.id)}" type="number" min="1" value="1">
          <button type="button" data-plus="${escapeHtml(product.id)}">+</button>
        </div>
        <button type="button" class="customer-btn primary" data-start-order="${escapeHtml(product.id)}">Lanjut Pesan →</button>
      </div>
    </article>
  `).join("");

  container.querySelectorAll("[data-minus]").forEach((button) => {
    button.addEventListener("click", () => changeProductQty(button.dataset.minus, -1));
  });

  container.querySelectorAll("[data-plus]").forEach((button) => {
    button.addEventListener("click", () => changeProductQty(button.dataset.plus, 1));
  });

  container.querySelectorAll("[data-start-order]").forEach((button) => {
    button.addEventListener("click", () => startCustomerOrder(button.dataset.startOrder));
  });
}

function focusOrderProduct(productId) {
  const element = document.getElementById(`qty-${productId}`);
  if (element) element.focus();
}

function changeProductQty(productId, change) {
  const input = document.getElementById(`qty-${productId}`);
  if (!input) return;

  input.value = Math.max(1, Number(input.value || 1) + change);
}

function startCustomerOrder(productId) {
  const product = products.find((item) => item.id === productId);
  const input = document.getElementById(`qty-${productId}`);

  if (!product || !input) return;

  customerOrder.product = product;
  customerOrder.qty = Math.max(1, Number(input.value) || 1);

  setOrderStep("customer");
}

function updateHomePrice() {
  const element = $("homeProductPrice");
  if (element && products[0]) {
    element.textContent = rupiah(products[0].price);
  }
}


/* ---------------------------------------------------------
   SINKRONISASI PESANAN PELANGGAN DENGAN DATABASE
   --------------------------------------------------------- */

function getCustomerOrderReferences() {
  let references = readStorage(STORAGE.customerOrderRefs, null);

  // Migrasi ringan untuk pesanan lama yang sebelumnya tersimpan di browser.
  if (!Array.isArray(references)) {
    references = orders
      .filter((order) => order && order.id && order.phone)
      .map((order) => ({ id: String(order.id), phone: String(order.phone) }));
    writeStorage(STORAGE.customerOrderRefs, references);
  }

  // Batasi referensi yang dikirim agar permintaan tetap ringan.
  return references.slice(0, 100);
}

async function loadCustomerOrdersFromDatabase() {
  const references = getCustomerOrderReferences();

  if (references.length === 0) {
    orders = [];
    return true;
  }

  try {
    const response = await fetch("customer_pesanan_api.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ references })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Gagal memuat status pesanan.");
    }

    // Database menjadi sumber status terbaru, bukan localStorage.
    orders = Array.isArray(result.data) ? result.data : [];
    return true;
  } catch (error) {
    console.error("Gagal memuat pesanan pelanggan:", error);
    return false;
  }
}

function startCustomerOrderAutoRefresh() {
  if (customerOrderRefreshTimer) {
    clearInterval(customerOrderRefreshTimer);
  }

  customerOrderRefreshTimer = setInterval(async () => {
    if (document.visibilityState !== "visible" || customerOrderRefreshBusy) return;

    customerOrderRefreshBusy = true;
    const success = await loadCustomerOrdersFromDatabase();

    if (success) {
      renderCustomerOrders();
      updateCustomerOrderCount();
    }

    customerOrderRefreshBusy = false;
  }, 5000);

  // Saat pengguna kembali ke tab website, ambil status terbaru.
  if (!window.customerVisibilityHandlerAttached) {
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || customerOrderRefreshBusy) return;

      customerOrderRefreshBusy = true;
      const success = await loadCustomerOrdersFromDatabase();
      if (success) {
        renderCustomerOrders();
        updateCustomerOrderCount();
      }
      customerOrderRefreshBusy = false;
    });

    window.customerVisibilityHandlerAttached = true;
  }
}

// ALUR PEMESANAN
   

function bindOrderFlow() {
    $("customerDataForm")?.addEventListener("submit", saveCustomerData);

    $("confirmOrderBtn")?.addEventListener("click", confirmCustomerOrder);

    document.querySelectorAll("[data-order-back]").forEach((button) => {
        button.addEventListener("click", () => {
            setOrderStep(button.dataset.orderBack);
        });
    });
}

function setOrderStep(step) {
  const panels = {
    product: "orderStepProduct",
    customer: "orderStepCustomer",
    payment: "orderStepPayment",
    done: "orderStepDone"
  };

  Object.values(panels).forEach((id) => {
    $(id)?.classList.add("hidden");
  });

  $(panels[step])?.classList.remove("hidden");

  const steps = document.querySelectorAll(".order-stepper .step");
  const order = ["product", "customer", "payment", "done"];
  const currentIndex = order.indexOf(step);

  steps.forEach((element, index) => {
    element.classList.toggle("active", index <= currentIndex);
  });
}

function saveCustomerData(event) {
  event.preventDefault();

  customerOrder.name = $("customerName").value.trim();
  customerOrder.phone = $("customerPhone").value.trim();
  customerOrder.address = $("customerAddress").value.trim();
  customerOrder.note = $("customerNote").value.trim();

  if (!customerOrder.product) {
    toast("Silakan pilih produk terlebih dahulu.");
    setOrderStep("product");
    return;
  }

  renderCheckoutSummary();
  setOrderStep("payment");
}

function renderCheckoutSummary() {
  const container = $("checkoutSummary");
  if (!container || !customerOrder.product) return;

  const total = customerOrder.product.price * customerOrder.qty;

  container.innerHTML = `
    <div class="summary-row"><span>Produk</span><strong>${escapeHtml(customerOrder.product.name)}</strong></div>
    <div class="summary-row"><span>Jumlah</span><strong>${customerOrder.qty} cup</strong></div>
    <div class="summary-row"><span>Nama</span><strong>${escapeHtml(customerOrder.name)}</strong></div>
    <div class="summary-row"><span>No. WhatsApp</span><strong>${escapeHtml(customerOrder.phone)}</strong></div>
    <div class="summary-row"><span>Alamat</span><strong>${escapeHtml(customerOrder.address)}</strong></div>
    <div class="summary-total"><span>Total</span><strong>${rupiah(total)}</strong></div>
  `;
}

async function confirmCustomerOrder() {
  if (!customerOrder.product) {
    toast("Silakan pilih produk terlebih dahulu.");
    return;
  }

  const button = $("confirmOrderBtn");
  const payment = document.querySelector(
    'input[name="customerPayment"]:checked'
  )?.value || "Transfer";

  customerOrder.payment = payment;

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Memproses...";
    }

    const response = await fetch("simpan_pesanan.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nama_pelanggan: customerOrder.name,
        no_hp: customerOrder.phone,
        alamat: customerOrder.address,
        id_produk: Number(customerOrder.product.id),
        jumlah: Number(customerOrder.qty),
        metode_pembayaran: customerOrder.payment
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Pesanan gagal disimpan."
      );
    }

    const order = {
      id: result.kode_pesanan,
      date: new Date().toISOString().slice(0, 10),
      customer: customerOrder.name,
      phone: customerOrder.phone,
      product: customerOrder.product.name,
      qty: customerOrder.qty,
      address: customerOrder.address,
      payment: customerOrder.payment,
      status: "Diproses",
      total: Number(result.total_harga)
    };

    // Simpan referensi pesanan milik pelanggan pada browser ini.
    const references = getCustomerOrderReferences();
    if (!references.some((item) => item.id === order.id)) {
      references.unshift({ id: order.id, phone: customerOrder.phone });
      writeStorage(STORAGE.customerOrderRefs, references.slice(0, 100));
    }

    const refreshed = await loadCustomerOrdersFromDatabase();
    if (!refreshed) {
      // Tetap tampilkan pesanan yang baru dibuat bila koneksi baca sedang gagal.
      orders.unshift(order);
    }

    $("successOrderId").textContent = order.id;

    setOrderStep("done");
    updateCustomerOrderCount();
    renderCustomerOrders();

    toast(`Pesanan ${order.id} berhasil dibuat.`);

  } catch (error) {
    console.error("Gagal menyimpan pesanan:", error);
    toast(error.message || "Terjadi kesalahan saat membuat pesanan.");

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Konfirmasi Pesanan";
    }
  }
}

// PESANAN SAYA
   
function updateCustomerOrderCount() {
  const count = document.querySelector(".customer-orders-count");
  if (!count) return;

  count.textContent = orders.length;
}

function renderCustomerOrders() {
  const container = $("customerOrdersList");
  if (!container) return;

  if (!orders.length) {
    container.innerHTML = `<div class="empty-order"><div>▣</div><h3>Belum ada pesanan</h3><p>Pesanan yang kamu buat akan muncul di sini.</p></div>`;
    return;
  }

  container.innerHTML = orders.map((order) => `
    <article class="customer-order-card">
      <div class="customer-order-head">
        <div><span>NO. PESANAN</span><strong>${escapeHtml(order.id)}</strong></div>
        <div>${badge(order.status)}</div>
      </div>
      <div class="customer-order-main">
        <div class="customer-order-product"><div class="order-thumb"><span>GS</span></div><div><h3>${escapeHtml(order.product)}</h3><p>${order.qty} cup • ${formatDate(order.date)}</p></div></div>
        <strong class="order-total-value">${rupiah(order.total)}</strong>
      </div>
      <div class="status-track">
        ${renderStatusStep("Pesanan dibuat", order.status, "Pesanan dibuat")}
        ${renderStatusLine(order.status)}
        ${renderStatusStep("Diproses", order.status, "Diproses")}
        ${renderStatusLine(order.status)}
        ${renderStatusStep("Selesai", order.status, "Selesai")}
      </div>
      ${order.status === "Diproses" || order.status === "Menunggu" ? '<p class="order-auto-note">Otomatis selesai dalam <strong>7 hari</strong> bila belum diubah admin.</p>' : ''}
      <div class="customer-order-meta"><span>Pembayaran: <strong>${escapeHtml(order.payment)}</strong></span><span>${escapeHtml(order.address)}</span></div>
    </article>
  `).join("");
}

function renderStatusStep(label, currentStatus, stepStatus) {
  const progress = currentStatus === "Selesai" ? 2
    : currentStatus === "Diproses" || currentStatus === "Menunggu" ? 1
    : currentStatus === "Dibatalkan" ? 0 : 0;
  const stepIndex = stepStatus === "Pesanan dibuat" ? 0
    : stepStatus === "Diproses" ? 1 : 2;
  const done = stepIndex <= progress;
  return `<div class="status-step ${done ? "done" : ""}"><b>${done ? "✓" : ""}</b><span>${label}</span></div>`;
}

function renderStatusLine(status) {
  return `<i class="status-line ${["Diproses", "Selesai"].includes(status) ? "done" : ""}"></i>`;
}
