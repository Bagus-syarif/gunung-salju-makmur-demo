// DATA & FUNGSI DASAR SISTEM 
    
const STORAGE = {
  products: "gsm_products_v2",
  orders: "gsm_orders_v2",
  customerOrderRefs: "gsm_customer_order_refs_v1",
  notifications: "gsm_notifications_v2",
  adminLogin: "gsm_admin_login_v2"
};

const ADMIN = {
  username: "admin",
  password: "admin123"
};

const defaultProducts = [
  {
    id: "PRD-001",
    name: "Es Cup",
    price: 10000,
    description: "Es cup untuk kebutuhan minuman dan usaha."
  }
];

const defaultOrders = [
  {
    id: "PSN-001",
    date: "2026-09-22",
    customer: "Toko ABC",
    phone: "081234567890",
    product: "Es Cup",
    qty: 20,
    address: "BSD, Tangerang Selatan",
    payment: "Transfer",
    status: "Diproses",
    total: 200000,
    note: ""
  },
  {
    id: "PSN-002",
    date: "2026-09-21",
    customer: "Warung XYZ",
    phone: "082233445566",
    product: "Es Cup",
    qty: 10,
    address: "Serpong, Tangerang Selatan",
    payment: "COD",
    status: "Dikirim",
    total: 100000,
    note: ""
  }
];

let products = readStorage(STORAGE.products, defaultProducts);
let orders = readStorage(STORAGE.orders, defaultOrders);
let notifications = readStorage(STORAGE.notifications, []);

function $(id) {
  return document.getElementById(id);
}

function readStorage(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}


function formatDate(value) {
    if (!value) return "-";

    // Mendukung format tanggal dari MySQL maupun ISO
    const date = new Date(String(value).replace(" ", "T"));

    if (isNaN(date.getTime())) {
        return "Tanggal tidak valid";
    }

    return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}




function nextId(prefix, list) {
  return `${prefix}-${String(list.length + 1).padStart(3, "0")}`;
}

function getProduct(name) {
  return products.find((item) => item.name === name);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);
}

function statusClass(status) {
  return {
    Diproses: "processing",
    Dikirim: "shipping",
    Selesai: "done",
    Dibatalkan: "cancelled"
  }[status] || "processing";
}

function badge(status) {
  return `<span class="badge ${statusClass(status)}">${escapeHtml(status)}</span>`;
}

function toast(message) {
  const element = $("toast");
  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2800);
}

async function loadOrdersFromDatabase() {
    try {
        const response = await fetch("admin_pesanan_api.php");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error("Gagal mengambil data pesanan.");
        }

        orders = result.data;

        console.log("Pesanan dari database:", orders);
        console.log("Jumlah pesanan:", orders.length);

        return true;

    } catch (error) {
        console.error("Gagal memuat pesanan:", error);
        toast("Gagal memuat data pesanan dari database.");

        return false;
    }
}


async function loadProductsFromDatabase() {
    try {
        const response = await fetch("admin_produk_api.php");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error("Gagal mengambil data produk.");
        }

        products = result.data;

        console.log("Produk dari database:", products);

        return true;

    } catch (error) {
        console.error("Gagal memuat produk:", error);
        toast("Gagal memuat data produk dari database.");

        return false;
    }
}



console.log(
  "Fungsi database tersedia:",
  typeof loadOrdersFromDatabase
);

