/* ================================================================
   APPLICATION LOGIC — KASIR KANTIN (v2 with Expenses & Profit/Loss)
   ================================================================ */

/* ---------------- Configuration ---------------- */
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzinsDZr9ija9EQaCoyz-r41QpuPyjNW7bVp8-nwuib_UeEdVUv0hJvi_Hbv4bjMs1N/exec", // URL Apps Script
  STORE_NAME: "Kasir Kantin",
};

/* ---------------- State ---------------- */
const DEMO = !CONFIG.API_URL;
let MENU = [];
let ORDERS = [];
let EXPENSES = [];
let cart = {}; // { nama: { nama, harga, qty } }
let payStatus = "Lunas";
let keuRange = "today";
let expRange = "today";
let activeCategory = "Semua";
let currentView = "kasir";
let lastSubmittedOrder = null;

const MENU_SEED = [
  { nama: "Sarimi Gelas", harga: 3000, kategori: "Makanan" },
  { nama: "Teajus", harga: 2000, kategori: "Minuman" },
  { nama: "Jasjus", harga: 1000, kategori: "Minuman" },
  { nama: "Nutrisari", harga: 3000, kategori: "Minuman" },
  { nama: "Susu putih", harga: 5000, kategori: "Minuman" },
  { nama: "Susu coklat", harga: 5000, kategori: "Minuman" },
  { nama: "Good day", harga: 5000, kategori: "Minuman" },
  { nama: "Top coffee", harga: 5000, kategori: "Minuman" },
  { nama: "Bengbeng", harga: 5000, kategori: "Snack" },
  { nama: "yupi love", harga: 1000, kategori: "Snack" },
  { nama: "basreng", harga: 500, kategori: "Snack" },
  { nama: "makaroni", harga: 2000, kategori: "Snack" },
  { nama: "taro", harga: 1000, kategori: "Snack" },
  { nama: "suki", harga: 1000, kategori: "Makanan" },
  { nama: "garuda rosta", harga: 1000, kategori: "Snack" },
  { nama: "golden chips", harga: 1000, kategori: "Snack" },
  { nama: "riry", harga: 500, kategori: "Snack" },
  { nama: "yupi gummy", harga: 500, kategori: "Snack" },
  { nama: "air es", harga: 1000, kategori: "Minuman" },
];

const EXPENSE_SEED = [
  { id: "EXP1", waktu: new Date().toISOString(), keterangan: "Beli Air Galon & Es Batu", kategori: "Operasional", jumlah: 15000 },
  { id: "EXP2", waktu: new Date().toISOString(), keterangan: "Restok Teajus & Nutrisari", kategori: "Modal Barang", jumlah: 45000 }
];

/* ---------------- LocalStorage Helpers ---------------- */
const LS = {
  get: (k, def) => {
    try {
      const item = localStorage.getItem(k);
      return item ? JSON.parse(item) : def;
    } catch {
      return def;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      console.error("LS save error", e);
    }
  }
};

/* ---------------- DOM Helpers & Utilities ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const rp = n => "Rp\u00a0" + (Number(n) || 0).toLocaleString("id-ID");

function toast(msg, type = "success") {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.className = "show " + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.className = "";
  }, 2200);
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() &&
         d.getMonth() === n.getMonth() &&
         d.getDate() === n.getDate();
}

function fmtTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getMenuEmoji(nama = "", kategori = "") {
  const lower = nama.toLowerCase();
  if (kategori === "Minuman" || lower.includes("jus") || lower.includes("susu") || lower.includes("tea") || lower.includes("coffee") || lower.includes("es") || lower.includes("air") || lower.includes("nutri")) {
    if (lower.includes("susu")) return "🥛";
    if (lower.includes("coffee") || lower.includes("kopi") || lower.includes("day") || lower.includes("top")) return "☕";
    if (lower.includes("es") || lower.includes("air")) return "🧊";
    return "🧃";
  }
  if (lower.includes("sarimi") || lower.includes("mie") || lower.includes("suki")) return "🍜";
  if (lower.includes("chips") || lower.includes("taro") || lower.includes("rosta") || lower.includes("basreng") || lower.includes("makaroni")) return "🍿";
  if (lower.includes("bengbeng") || lower.includes("yupi") || lower.includes("riry")) return "🍬";
  return "🍱";
}

/* ---------------- Data Layer (API & LocalStorage) ---------------- */
async function apiGet(action) {
  const r = await fetch(CONFIG.API_URL + "?action=" + action);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Gagal mengambil data");
  return j.data;
}

async function apiPost(payload) {
  const r = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Gagal menyimpan data");
  return j.data;
}

async function loadData() {
  if (DEMO) {
    if (!localStorage.getItem("kasir_menu")) LS.set("kasir_menu", MENU_SEED);
    if (!localStorage.getItem("kasir_expenses")) LS.set("kasir_expenses", EXPENSE_SEED);
    
    MENU = LS.get("kasir_menu", MENU_SEED);
    ORDERS = LS.get("kasir_orders", []);
    EXPENSES = LS.get("kasir_expenses", []);
    return;
  }
  
  // Live Mode: Fetch individual endpoints safely
  try {
    const resMenu = await apiGet("getMenu");
    MENU = Array.isArray(resMenu) && resMenu.length > 0 ? resMenu : MENU_SEED.slice();
  } catch (e) {
    console.warn("Error fetching getMenu, using fallback", e);
    MENU = MENU_SEED.slice();
  }

  try {
    const resOrders = await apiGet("getOrders");
    ORDERS = Array.isArray(resOrders) ? resOrders : [];
  } catch (e) {
    console.warn("Error fetching getOrders", e);
    ORDERS = LS.get("kasir_orders", []);
  }

  try {
    const resExpenses = await apiGet("getExpenses");
    EXPENSES = Array.isArray(resExpenses) ? resExpenses : [];
  } catch (e) {
    console.warn("Error fetching getExpenses", e);
    EXPENSES = LS.get("kasir_expenses", []);
  }
}

async function saveOrder(order) {
  if (DEMO) {
    const o = LS.get("kasir_orders", []);
    const newTrx = {
      ...order,
      id: "TRX" + Date.now(),
      waktu: new Date().toISOString()
    };
    o.push(newTrx);
    LS.set("kasir_orders", o);
    return newTrx;
  }
  const result = await apiPost({
    action: "addOrder",
    pelanggan: order.pelanggan,
    status: order.status,
    items: order.items
  });
  return result;
}

async function setPaid(id) {
  if (DEMO) {
    const o = LS.get("kasir_orders", []).map(x => x.id === id ? { ...x, status: "Lunas" } : x);
    LS.set("kasir_orders", o);
    return;
  }
  await apiPost({ action: "markPaid", id: id });
}

async function saveExpense(keterangan, kategori, jumlah) {
  if (DEMO) {
    const exp = LS.get("kasir_expenses", []);
    const newExp = {
      id: "EXP" + Date.now(),
      waktu: new Date().toISOString(),
      keterangan,
      kategori,
      jumlah: Number(jumlah) || 0
    };
    exp.push(newExp);
    LS.set("kasir_expenses", exp);
    return newExp;
  }
  return await apiPost({
    action: "addExpense",
    keterangan,
    kategori,
    jumlah: Number(jumlah) || 0
  });
}

async function deleteExpenseItem(id) {
  if (DEMO) {
    const exp = LS.get("kasir_expenses", []).filter(x => x.id !== id);
    LS.set("kasir_expenses", exp);
    return;
  }
  await apiPost({ action: "deleteExpense", id: id });
}

async function tambahMenu(nama, harga) {
  nama = String(nama || '').trim();
  harga = Number(harga) || 0;
  if (!nama) throw new Error('Nama menu wajib diisi');
  if (DEMO) {
    const i = MENU.findIndex(m => m.nama.toLowerCase() === nama.toLowerCase());
    if (i >= 0) {
      MENU[i].harga = harga;
    } else {
      const emoji = getMenuEmoji(nama);
      const kategori = (emoji === "🧃" || emoji === "🥛" || emoji === "☕" || emoji === "🧊" ? "Minuman" : "Makanan");
      MENU.push({ nama, harga, kategori });
    }
    LS.set('kasir_menu', MENU);
    return { nama, harga };
  }
  const m = await apiPost({ action: 'addMenu', nama, harga });
  const i = MENU.findIndex(x => x.nama.toLowerCase() === nama.toLowerCase());
  if (i >= 0) {
    MENU[i].harga = m.harga;
  } else {
    const emoji = getMenuEmoji(m.nama);
    const kategori = (emoji === "🧃" || emoji === "🥛" || emoji === "☕" || emoji === "🧊" ? "Minuman" : "Makanan");
    MENU.push({ nama: m.nama, harga: m.harga, kategori });
  }
  return m;
}

async function hapusMenu(nama) {
  if (DEMO) {
    MENU = MENU.filter(m => m.nama !== nama);
    LS.set('kasir_menu', MENU);
    return;
  }
  await apiPost({ action: 'deleteMenu', nama });
  MENU = MENU.filter(m => m.nama !== nama);
}

async function hapusPesanan(id) {
  if (DEMO) {
    ORDERS = ORDERS.filter(o => o.id !== id);
    LS.set('kasir_orders', ORDERS);
    return;
  }
  await apiPost({ action: 'deleteOrder', id });
  ORDERS = ORDERS.filter(o => o.id !== id);
}

/* ---------------- Render: Skeleton Loader ---------------- */
function showMenuSkeleton(n = 8) {
  const grid = $("#menuGrid");
  if (!grid) return;
  grid.innerHTML = Array.from({ length: n })
    .map(() => '<div class="skeleton skeleton-card"></div>')
    .join("");
}

/* ---------------- Render: Menu & Categories ---------------- */
function renderCategories() {
  const container = $("#categoryChips");
  if (!container) return;

  const categories = ["Semua", "Minuman", "Makanan", "Snack"];
  container.innerHTML = categories.map(cat => `
    <button class="chip ${activeCategory === cat ? 'active' : ''}" data-cat="${cat}">
      ${cat === 'Semua' ? '✨ Semua' : cat === 'Minuman' ? '🧃 Minuman' : cat === 'Makanan' ? '🍲 Makanan' : '🍿 Snack'}
    </button>
  `).join("");

  container.querySelectorAll(".chip").forEach(btn => {
    btn.onclick = () => {
      activeCategory = btn.dataset.cat;
      renderCategories();
      renderMenu();
    };
  });
}

function renderMenu() {
  const searchInput = $("#menuSearch");
  const q = (searchInput ? searchInput.value : "").toLowerCase().trim();
  const grid = $("#menuGrid");
  if (!grid) return;

  grid.innerHTML = "";

  const list = MENU.filter(m => {
    const matchQuery = m.nama.toLowerCase().includes(q);
    const emoji = getMenuEmoji(m.nama, m.kategori);
    const cat = m.kategori || (emoji === "🧃" || emoji === "🥛" || emoji === "☕" || emoji === "🧊" ? "Minuman" : "Snack");
    const matchCat = (activeCategory === "Semua") || (cat.toLowerCase() === activeCategory.toLowerCase());
    return matchQuery && matchCat;
  });

  if (!list.length) {
    grid.innerHTML = '<div class="empty" style="grid-column: 1/-1;">🔍 Menu tidak ditemukan.</div>';
    return;
  }

  list.forEach(m => {
    const emoji = getMenuEmoji(m.nama, m.kategori);
    const card = document.createElement("div");
    card.className = "menu-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `Tambah ${m.nama} ${rp(m.harga)}`);
    card.innerHTML = `
      <button class="menu-card-del" aria-label="Hapus menu" title="Hapus menu">&times;</button>
      <span class="menu-emoji">${emoji}</span>
      <span class="menu-name">${m.nama}</span>
      <span class="menu-price">${rp(m.harga)}</span>
    `;
    card.onclick = () => {
      addToCart(m);
      flashCartBadge();
    };
    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        addToCart(m);
        flashCartBadge();
      }
    };
    
    const delBtn = card.querySelector(".menu-card-del");
    if (delBtn) {
      delBtn.onclick = (e) => {
        e.stopPropagation();
        onHapusMenu(e, m.nama);
      };
    }
    
    grid.appendChild(card);
  });
}

/* ---------------- Cart Logic & Mobile Sheet ---------------- */
function addToCart(m) {
  if (!cart[m.nama]) {
    cart[m.nama] = { nama: m.nama, harga: m.harga, qty: 0 };
  }
  cart[m.nama].qty++;
  renderCart();
}

function changeQty(nama, d) {
  if (!cart[nama]) return;
  cart[nama].qty += d;
  if (cart[nama].qty <= 0) {
    delete cart[nama];
  }
  renderCart();
}

function cartItems() {
  return Object.values(cart);
}

function cartTotal() {
  return cartItems().reduce((s, i) => s + i.harga * i.qty, 0);
}

function flashCartBadge() {
  const badges = [$("#cartBadgeDesktop"), $("#cartBadgeMobile"), $("#fabCount")];
  badges.forEach(b => {
    if (b) {
      b.classList.remove("pop");
      void b.offsetWidth;
      b.classList.add("pop");
    }
  });
}

function renderCart() {
  const items = cartItems();
  const totalCount = items.reduce((s, i) => s + i.qty, 0);
  const totalAmt = cartTotal();

  if ($("#cartCount")) $("#cartCount").textContent = totalCount;

  // Mobile FAB update
  const fab = $("#fabCart");
  if (fab) {
    if (totalCount > 0) {
      fab.style.display = "flex";
      $("#fabCount").textContent = totalCount;
      $("#fabTotal").textContent = rp(totalAmt);
    } else {
      fab.style.display = "none";
      closeCartSheet();
    }
  }

  // Cart HTML renderer
  const buildCartHTML = (isSheet = false) => {
    if (!items.length) {
      return '<div class="cart-empty">🛒 Belum ada item.<br>Klik menu untuk menambah pesanan.</div>';
    }

    let h = '<div class="cart-list">';
    items.forEach(i => {
      h += `
        <div class="ci">
          <div class="cinm">${i.nama}<small>${rp(i.harga)}</small></div>
          <div class="stepper">
            <button data-m="${i.nama}" data-d="-1" aria-label="Kurangi ${i.nama}">−</button>
            <span>${i.qty}</span>
            <button data-m="${i.nama}" data-d="1" aria-label="Tambah ${i.nama}">+</button>
          </div>
        </div>
      `;
    });
    h += '</div>';

    h += `
      <div class="total-row">
        <span class="lbl">Total</span>
        <span class="amt">${rp(totalAmt)}</span>
      </div>
    `;

    const inputId = isSheet ? "custNameSheet" : "custNameDesktop";
    const custVal = ($(`#${inputId}`) ? $(`#${inputId}`).value : ($("#custNameDesktop") ? $("#custNameDesktop").value : ""));

    h += `
      <div class="field">
        <label for="${inputId}">Nama pelanggan (opsional)</label>
        <input id="${inputId}" placeholder="cth: Meja 3 / Andi" value="${custVal}"/>
      </div>
    `;

    h += `
      <div class="segmented" role="tablist">
        <button class="seg ${payStatus === 'Lunas' ? 'on' : ''}" data-s="Lunas" role="tab" aria-selected="${payStatus === 'Lunas'}">✅ Lunas</button>
        <button class="seg ${payStatus === 'Belum Bayar' ? 'on' : ''}" data-s="Belum Bayar" role="tab" aria-selected="${payStatus === 'Belum Bayar'}">⏳ Belum Bayar</button>
      </div>
    `;

    h += `<button class="btn-primary cart-save-btn" id="${isSheet ? 'saveBtnSheet' : 'saveBtnDesktop'}">Simpan Pesanan · ${rp(totalAmt)}</button>`;
    h += `<button class="btn-ghost cart-clear-btn">Kosongkan Keranjang</button>`;

    return h;
  };

  const desktopBody = $("#cartBodyDesktop");
  if (desktopBody) {
    desktopBody.innerHTML = buildCartHTML(false);
    bindCartEvents(desktopBody, false);
  }

  const sheetBody = $("#cartBodySheet");
  if (sheetBody) {
    sheetBody.innerHTML = buildCartHTML(true);
    bindCartEvents(sheetBody, true);
  }
}

function bindCartEvents(container, isSheet) {
  container.querySelectorAll(".stepper button").forEach(b => {
    b.onclick = () => changeQty(b.dataset.m, Number(b.dataset.d));
  });

  container.querySelectorAll(".segmented button").forEach(b => {
    b.onclick = () => {
      payStatus = b.dataset.s;
      renderCart();
    };
  });

  const saveBtn = container.querySelector(".cart-save-btn");
  if (saveBtn) {
    saveBtn.onclick = () => submitOrder(isSheet);
  }

  const clearBtn = container.querySelector(".cart-clear-btn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm("Kosongkan keranjang pesanan?")) {
        cart = {};
        renderCart();
      }
    };
  }
}

function openCartSheet() {
  const sheet = $("#cartSheet");
  const backdrop = $("#sheetBackdrop");
  if (sheet && backdrop) {
    sheet.classList.add("open");
    backdrop.classList.add("open");
  }
}

function closeCartSheet() {
  const sheet = $("#cartSheet");
  const backdrop = $("#sheetBackdrop");
  if (sheet && backdrop) {
    sheet.classList.remove("open");
    backdrop.classList.remove("open");
  }
}

async function submitOrder(isSheet = false) {
  const items = cartItems();
  if (!items.length) return;

  const btn = isSheet ? $("#saveBtnSheet") : $("#saveBtnDesktop");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Menyimpan...";
  }

  const nameInput = isSheet ? $("#custNameSheet") : $("#custNameDesktop");
  const pelanggan = (nameInput ? nameInput.value : "").trim();

  try {
    await saveOrder({
      pelanggan,
      status: payStatus,
      items: items.map(i => ({ nama: i.nama, harga: i.harga, qty: i.qty }))
    });

    lastSubmittedOrder = {
      pelanggan: pelanggan || "Pelanggan Umum",
      status: payStatus,
      items: items.slice(),
      total: cartTotal(),
      waktu: new Date().toISOString()
    };

    cart = {};
    payStatus = "Lunas";
    closeCartSheet();
    renderCart();

    await loadData();
    refreshAll();
    showReceiptModal(lastSubmittedOrder);
    toast("Pesanan berhasil disimpan ✓", "success");
  } catch (e) {
    toast("Gagal: " + e.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.textContent = `Simpan Pesanan · ${rp(cartTotal())}`;
    }
  }
}

/* ---------------- Receipt Modal ---------------- */
function showReceiptModal(order) {
  const modalBackdrop = $("#receiptBackdrop");
  if (!modalBackdrop || !order) return;

  $("#receiptCust").textContent = order.pelanggan || "Pelanggan Umum";
  $("#receiptStatusTag").innerHTML = tag(order.status);
  $("#receiptTotal").textContent = rp(order.total);

  const itemsContainer = $("#receiptItems");
  itemsContainer.innerHTML = order.items.map(i => `
    <div class="receipt-item">
      <span class="receipt-item-name">${i.qty}x ${i.nama}</span>
      <span class="receipt-item-price">${rp(i.harga * i.qty)}</span>
    </div>
  `).join("");

  modalBackdrop.classList.add("open");
}

function closeReceiptModal() {
  const modalBackdrop = $("#receiptBackdrop");
  if (modalBackdrop) {
    modalBackdrop.classList.remove("open");
  }
}

/* ---------------- Keuangan (Pemasukan, Pengeluaran, & Laba/Rugi) ---------------- */
function filteredOrders() {
  return keuRange === "today"
    ? ORDERS.filter(o => isToday(o.waktu))
    : ORDERS.slice();
}

function filteredExpenses() {
  return expRange === "today"
    ? EXPENSES.filter(e => isToday(e.waktu))
    : EXPENSES.slice();
}

function renderKeuangan() {
  const ordersList = filteredOrders();
  const expList = keuRange === "today"
    ? EXPENSES.filter(e => isToday(e.waktu))
    : EXPENSES.slice();

  const lunasOrders = ordersList.filter(o => o.status === "Lunas");
  const belumOrders = ordersList.filter(o => o.status !== "Lunas");

  const totalPemasukanLunas = lunasOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalBelum = belumOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalPengeluaran = expList.reduce((s, e) => s + (Number(e.jumlah) || 0), 0);
  
  // Laba / Rugi = Pemasukan (Lunas) - Total Pengeluaran
  const labaRugi = totalPemasukanLunas - totalPengeluaran;

  const itemQty = ordersList.reduce((s, o) => s + (o.items || []).reduce((a, i) => a + i.qty, 0), 0);

  // Render Top Financial Cards (Pemasukan, Pengeluaran, Laba/Rugi)
  const heroGrid = $("#keuHeroGrid");
  if (heroGrid) {
    const isProfit = labaRugi >= 0;
    heroGrid.innerHTML = `
      ${statCard("Pemasukan (Lunas)", rp(totalPemasukanLunas), "green", "g", "💰")}
      ${statCard("Total Pengeluaran", rp(totalPengeluaran), "red", "r", "💸")}
      ${statCard("Laba / Rugi", rp(labaRugi), isProfit ? "green" : "red", isProfit ? "g" : "r", isProfit ? "📈" : "📉")}
    `;
  }

  // Render Activity Cards (Belum Dibayar, Jumlah Pesanan, Item Terjual)
  const actGrid = $("#keuActGrid");
  if (actGrid) {
    actGrid.innerHTML = `
      ${statCard("Belum Dibayar", rp(totalBelum), "orange", "o", "⏳")}
      ${statCard("Jumlah Pesanan", ordersList.length, "", "b", "🧾")}
      ${statCard("Item Terjual", itemQty, "", "p", "📦")}
    `;
  }

  // Render Sales Chart
  renderSalesChart(ordersList);

  // Top Products Progress Bars
  const map = {};
  ordersList.forEach(o => {
    (o.items || []).forEach(i => {
      if (!map[i.nama]) map[i.nama] = { qty: 0, sub: 0 };
      map[i.nama].qty += i.qty;
      map[i.nama].sub += i.harga * i.qty;
    });
  });

  const sorted = Object.entries(map).sort((a, b) => b[1].qty - a[1].qty);
  const maxQty = sorted.length ? sorted[0][1].qty : 1;
  const top = sorted.slice(0, 6);

  const tb = $("#topBody");
  if (tb) {
    if (!top.length) {
      tb.innerHTML = '<tr><td colspan="3" class="empty">Belum ada data transaksi.</td></tr>';
    } else {
      tb.innerHTML = top.map(([nama, val]) => {
        const pct = Math.round((val.qty / maxQty) * 100);
        return `
          <tr>
            <td>
              <strong>${nama}</strong>
              <div class="bar-track"><div class="bar-fill" style="width: ${pct}%"></div></div>
            </td>
            <td class="num">${val.qty}</td>
            <td class="num">${rp(val.sub)}</td>
          </tr>
        `;
      }).join("");
    }
  }
}

function statCard(label, val, valClass, icoClass, emoji) {
  return `
    <div class="stat">
      <div class="stat-ico ${icoClass}">${emoji}</div>
      <div>
        <div class="stat-label">${label}</div>
        <div class="stat-value ${valClass}">${val}</div>
      </div>
    </div>
  `;
}

function renderSalesChart(orders) {
  const container = $("#salesChart");
  if (!container) return;

  const slots = {};
  if (keuRange === "today") {
    for (let h = 8; h <= 20; h += 2) {
      const key = `${String(h).padStart(2, '0')}:00`;
      slots[key] = 0;
    }
    orders.forEach(o => {
      if (o.status === "Lunas" && o.waktu) {
        const d = new Date(o.waktu);
        const hour = Math.floor(d.getHours() / 2) * 2;
        const key = `${String(Math.max(8, Math.min(20, hour))).padStart(2, '0')}:00`;
        if (slots[key] !== undefined) slots[key] += (o.total || 0);
      }
    });
  } else {
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      slots[key] = 0;
    }
    orders.forEach(o => {
      if (o.status === "Lunas" && o.waktu) {
        const d = new Date(o.waktu);
        const key = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
        if (slots[key] !== undefined) slots[key] += (o.total || 0);
      }
    });
  }

  const keys = Object.keys(slots);
  const values = Object.values(slots);
  const maxVal = Math.max(...values, 10000);

  const svgWidth = 600;
  const svgHeight = 160;
  const barWidth = 36;
  const gap = (svgWidth - (keys.length * barWidth)) / (keys.length + 1);

  let svgContent = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%; height:100%; overflow:visible;">`;

  keys.forEach((key, idx) => {
    const val = values[idx];
    const barHeight = Math.max(4, Math.round((val / maxVal) * (svgHeight - 40)));
    const x = gap + idx * (barWidth + gap);
    const y = svgHeight - 24 - barHeight;

    svgContent += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="var(--accent)" opacity="${val > 0 ? '0.9' : '0.2'}">
        <title>${key}: ${rp(val)}</title>
      </rect>
      <text x="${x + barWidth / 2}" y="${svgHeight - 6}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-2)">${key}</text>
    `;
    if (val > 0) {
      svgContent += `
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--accent)">${val >= 1000 ? Math.round(val / 1000) + 'k' : val}</text>
      `;
    }
  });

  svgContent += `</svg>`;
  container.innerHTML = svgContent;
}

/* ---------------- Pengeluaran View (BARU) ---------------- */
function renderPengeluaran() {
  const list = filteredExpenses().sort((a, b) => new Date(b.waktu) - new Date(a.waktu));
  const totalExp = list.reduce((s, e) => s + (Number(e.jumlah) || 0), 0);

  if ($("#expTotalVal")) $("#expTotalVal").textContent = rp(totalExp);

  const tb = $("#expBody");
  const mobileContainer = $("#expMobileCards");

  if (!list.length) {
    if (tb) tb.innerHTML = '<tr><td colspan="5" class="empty">💸 Belum ada data pengeluaran.</td></tr>';
    if (mobileContainer) mobileContainer.innerHTML = '<div class="empty">💸 Belum ada data pengeluaran.</div>';
    return;
  }

  // Category Tag Helper
  const expTag = cat => `<span class="tag-cat ${cat ? cat.toLowerCase().replace(/\s+/g, '-') : 'lainnya'}">${cat || 'Lainnya'}</span>`;

  // Desktop Table HTML
  if (tb) {
    tb.innerHTML = list.map(e => `
      <tr>
        <td>${fmtTime(e.waktu)}</td>
        <td><strong>${e.keterangan || "-"}</strong></td>
        <td>${expTag(e.kategori)}</td>
        <td class="num">${rp(e.jumlah)}</td>
        <td style="text-align:right;">
          <button class="btn-danger-sm" data-exp-id="${e.id}" aria-label="Hapus pengeluaran">Hapus</button>
        </td>
      </tr>
    `).join("");
  }

  // Mobile Cards HTML
  if (mobileContainer) {
    mobileContainer.innerHTML = list.map(e => `
      <div class="trx-card">
        <div class="trx-card-head">
          <span>${fmtTime(e.waktu)}</span>
          ${expTag(e.kategori)}
        </div>
        <div class="trx-card-cust">${e.keterangan || "-"}</div>
        <div class="trx-card-foot">
          <span class="trx-card-total red">${rp(e.jumlah)}</span>
          <button class="btn-danger-sm" data-exp-id="${e.id}">Hapus</button>
        </div>
      </div>
    `).join("");
  }

  // Bind Delete buttons
  $$(".btn-danger-sm[data-exp-id]").forEach(b => {
    b.onclick = async () => {
      if (!confirm("Yakin ingin menghapus pengeluaran ini?")) return;
      b.disabled = true;
      b.textContent = "...";
      try {
        await deleteExpenseItem(b.dataset.expId);
        await loadData();
        refreshAll();
        toast("Pengeluaran berhasil dihapus ✓", "success");
      } catch (err) {
        toast("Gagal menghapus: " + err.message, "error");
        b.disabled = false;
        b.textContent = "Hapus";
      }
    };
  });
}

async function handleAddExpense(e) {
  e.preventDefault();
  const ketInput = $("#expKet");
  const katInput = $("#expKat");
  const jmlInput = $("#expJml");
  const submitBtn = $("#expSubmit");

  const keterangan = (ketInput ? ketInput.value : "").trim();
  const kategori = katInput ? katInput.value : "Lainnya";
  const jumlah = Number(jmlInput ? jmlInput.value : 0);

  if (!keterangan || jumlah <= 0) {
    toast("Isi keterangan dan jumlah pengeluaran dengan benar", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan...";

  try {
    await saveExpense(keterangan, kategori, jumlah);
    if (ketInput) ketInput.value = "";
    if (jmlInput) jmlInput.value = "";
    await loadData();
    refreshAll();
    toast("Pengeluaran berhasil ditambahkan ✓", "success");
  } catch (err) {
    toast("Gagal menyimpan pengeluaran: " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Tambah Pengeluaran";
  }
}

async function openMenuModal() {
  const modal = $("#menuBackdrop");
  if (modal) {
    modal.classList.add("open");
    const inputNama = $("#inputNama");
    if (inputNama) inputNama.focus();
  }
}

async function closeMenuModal() {
  const modal = $("#menuBackdrop");
  if (modal) {
    modal.classList.remove("open");
    const form = $("#formTambahMenu");
    if (form) form.reset();
  }
}

async function onSubmitTambahMenu(e) {
  e.preventDefault();
  const inputNama = $("#inputNama");
  const inputHarga = $("#inputHarga");
  const btnSubmit = $("#btnSimpanMenu");

  const nama = inputNama ? inputNama.value : "";
  const harga = inputHarga ? inputHarga.value : 0;

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Menyimpan...";
  }

  try {
    await tambahMenu(nama, harga);
    closeMenuModal();
    await loadData();
    refreshAll();
    renderMenu();
    toast('Menu berhasil ditambahkan ✓');
  } catch (err) {
    toast(err.message || 'Gagal menambah menu', 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Simpan";
    }
  }
}

async function onHapusMenu(ev, nama) {
  ev.stopPropagation();
  if (!confirm(`Hapus menu "${nama}"?`)) return;
  try {
    await hapusMenu(nama);
    await loadData();
    refreshAll();
    renderMenu();
    toast('Menu berhasil dihapus ✓');
  } catch (err) {
    toast(err.message || 'Gagal menghapus menu', 'error');
  }
}

async function onHapusPesanan(id) {
  if (!confirm('Hapus pesanan ini?')) return;
  try {
    await hapusPesanan(id);
    await loadData();
    refreshAll();
    toast('Pesanan berhasil dihapus ✓');
  } catch (err) {
    toast(err.message || 'Gagal menghapus pesanan', 'error');
  }
}

/* ---------------- Histori & Belum Bayar ---------------- */
function tag(s) {
  return s === "Lunas"
    ? '<span class="tag lunas">✅ Lunas</span>'
    : '<span class="tag belum">⏳ Belum Bayar</span>';
}

function renderHistori() {
  const searchInput = $("#histSearch");
  const q = (searchInput ? searchInput.value : "").toLowerCase().trim();

  const list = ORDERS.slice()
    .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))
    .filter(o => {
      const detailStr = o.detail || (o.items || []).map(i => `${i.qty}x ${i.nama}`).join(", ");
      return ((o.pelanggan || "") + " " + detailStr).toLowerCase().includes(q);
    });

  const tb = $("#histBody");
  const mobileContainer = $("#histMobileCards");

  if (!list.length) {
    if (tb) tb.innerHTML = '<tr><td colspan="6" class="empty">📜 Belum ada riwayat transaksi.</td></tr>';
    if (mobileContainer) mobileContainer.innerHTML = '<div class="empty">📜 Belum ada riwayat transaksi.</div>';
    return;
  }

  if (tb) {
    tb.innerHTML = list.map(o => {
      const detailStr = o.detail || (o.items || []).map(i => `${i.qty}x ${i.nama}`).join(", ");
      return `
        <tr>
          <td>${fmtTime(o.waktu)}</td>
          <td><strong>${o.pelanggan || "Pelanggan Umum"}</strong></td>
          <td class="small">${detailStr}</td>
          <td class="num">${rp(o.total)}</td>
          <td>${tag(o.status)}</td>
          <td style="text-align:right;">
            <button class="btn-danger-sm btn-delete-order" data-order-id="${o.id}" aria-label="Hapus pesanan">Hapus</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  if (mobileContainer) {
    mobileContainer.innerHTML = list.map(o => {
      const detailStr = o.detail || (o.items || []).map(i => `${i.qty}x ${i.nama}`).join(", ");
      return `
        <div class="trx-card">
          <div class="trx-card-head">
            <span>${fmtTime(o.waktu)}</span>
            ${tag(o.status)}
          </div>
          <div class="trx-card-cust">${o.pelanggan || "Pelanggan Umum"}</div>
          <div class="trx-card-detail">${detailStr}</div>
          <div class="trx-card-foot">
            <div>
              <span class="small" style="display:block;">Total</span>
              <span class="trx-card-total">${rp(o.total)}</span>
            </div>
            <button class="btn-danger-sm btn-delete-order" data-order-id="${o.id}">Hapus</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // Bind Delete buttons in Histori
  $$("#view-histori .btn-delete-order").forEach(b => {
    b.onclick = () => onHapusPesanan(b.dataset.orderId);
  });
}

function renderBelum() {
  const list = ORDERS.filter(o => o.status !== "Lunas")
    .sort((a, b) => new Date(b.waktu) - new Date(a.waktu));

  const count = list.length;
  $$(".nav-badge-belum").forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? "grid" : "none";
  });

  const tb = $("#belumBody");
  const mobileContainer = $("#belumMobileCards");

  if (!list.length) {
    if (tb) tb.innerHTML = '<tr><td colspan="5" class="empty">🎉 Horay! Tidak ada tagihan tertunda.</td></tr>';
    if (mobileContainer) mobileContainer.innerHTML = '<div class="empty">🎉 Horay! Tidak ada tagihan tertunda.</div>';
    return;
  }

  if (tb) {
    tb.innerHTML = list.map(o => {
      const detailStr = o.detail || (o.items || []).map(i => `${i.qty}x ${i.nama}`).join(", ");
      return `
        <tr>
          <td>${fmtTime(o.waktu)}</td>
          <td><strong>${o.pelanggan || "Pelanggan Umum"}</strong></td>
          <td class="small">${detailStr}</td>
          <td class="num">${rp(o.total)}</td>
          <td style="text-align:right; white-space: nowrap;">
            <button class="btn-sm" data-id="${o.id}">Tandai Lunas</button>
            <button class="btn-danger-sm btn-delete-order" data-order-id="${o.id}" aria-label="Hapus pesanan" style="margin-left: 6px;">Hapus</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  if (mobileContainer) {
    mobileContainer.innerHTML = list.map(o => {
      const detailStr = o.detail || (o.items || []).map(i => `${i.qty}x ${i.nama}`).join(", ");
      return `
        <div class="trx-card">
          <div class="trx-card-head">
            <span>${fmtTime(o.waktu)}</span>
            ${tag(o.status)}
          </div>
          <div class="trx-card-cust">${o.pelanggan || "Pelanggan Umum"}</div>
          <div class="trx-card-detail">${detailStr}</div>
          <div class="trx-card-foot">
            <span class="trx-card-total">${rp(o.total)}</span>
            <div style="display: flex; gap: 8px;">
              <button class="btn-sm" data-id="${o.id}">Tandai Lunas</button>
              <button class="btn-danger-sm btn-delete-order" data-order-id="${o.id}">Hapus</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  $$("#view-belum .btn-sm[data-id]").forEach(b => {
    b.onclick = async () => {
      b.disabled = true;
      b.textContent = "Processing...";
      try {
        await setPaid(b.dataset.id);
        await loadData();
        refreshAll();
        toast("Status berhasil diubah ke Lunas ✓", "success");
      } catch (e) {
        toast("Gagal: " + e.message, "error");
        b.disabled = false;
        b.textContent = "Tandai Lunas";
      }
    };
  });

  // Bind Delete buttons in Belum Bayar
  $$("#view-belum .btn-delete-order").forEach(b => {
    b.onclick = () => onHapusPesanan(b.dataset.orderId);
  });
}

/* ---------------- Navigation & Refresh Controller ---------------- */
function refreshAll() {
  renderKeuangan();
  renderPengeluaran();
  renderHistori();
  renderBelum();
}

function switchView(v) {
  currentView = v;
  $$("nav.desktop-nav button, .bottom-nav button").forEach(b => {
    b.classList.toggle("active", b.dataset.view === v);
  });
  $$(".view").forEach(s => {
    s.classList.toggle("active", s.id === "view-" + v);
  });
}

/* ---------------- Initialization ---------------- */
async function init() {
  if ($("#brandName")) $("#brandName").textContent = CONFIG.STORE_NAME;
  const badge = $("#connBadge");
  const badgeText = $("#connText");
  if (!DEMO && badge && badgeText) {
    badge.classList.add("live");
    badgeText.textContent = "Terhubung ke Sheet";
  }

  $$("nav.desktop-nav button, .bottom-nav button").forEach(b => {
    b.onclick = () => switchView(b.dataset.view);
  });

  let searchTimer;
  const menuSearch = $("#menuSearch");
  if (menuSearch) {
    menuSearch.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderMenu, 150);
    };
  }

  const histSearch = $("#histSearch");
  if (histSearch) {
    histSearch.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderHistori, 150);
    };
  }

  // Setup Keuangan Filter
  $$("#keuFilter .chip").forEach(c => {
    c.onclick = () => {
      keuRange = c.dataset.range;
      $$("#keuFilter .chip").forEach(x => x.classList.toggle("active", x === c));
      renderKeuangan();
    };
  });

  // Setup Pengeluaran Filter
  $$("#expFilter .chip").forEach(c => {
    c.onclick = () => {
      expRange = c.dataset.range;
      $$("#expFilter .chip").forEach(x => x.classList.toggle("active", x === c));
      renderPengeluaran();
    };
  });

  // Form submit event for Expense
  const expForm = $("#expForm");
  if (expForm) {
    expForm.onsubmit = handleAddExpense;
  }

  // Setup Tambah Menu
  const btnAddMenu = $("#btnAddMenu");
  if (btnAddMenu) {
    btnAddMenu.onclick = openMenuModal;
  }
  const btnBatalMenu = $("#btnBatalMenu");
  if (btnBatalMenu) {
    btnBatalMenu.onclick = closeMenuModal;
  }
  const formTambahMenu = $("#formTambahMenu");
  if (formTambahMenu) {
    formTambahMenu.onsubmit = onSubmitTambahMenu;
  }
  const menuBackdrop = $("#menuBackdrop");
  if (menuBackdrop) {
    menuBackdrop.onclick = (e) => {
      if (e.target === menuBackdrop) closeMenuModal();
    };
  }

  const fabCart = $("#fabCart");
  if (fabCart) {
    fabCart.onclick = openCartSheet;
  }
  const sheetBackdrop = $("#sheetBackdrop");
  if (sheetBackdrop) {
    sheetBackdrop.onclick = closeCartSheet;
  }

  const receiptNew = $("#receiptNew");
  if (receiptNew) {
    receiptNew.onclick = closeReceiptModal;
  }
  const receiptBackdrop = $("#receiptBackdrop");
  if (receiptBackdrop) {
    receiptBackdrop.onclick = (e) => {
      if (e.target === receiptBackdrop) closeReceiptModal();
    };
  }

  showMenuSkeleton(8);
  renderCategories();

  try {
    await loadData();
  } catch (e) {
    toast("Gagal memuat data: " + e.message, "error");
  }

  renderMenu();
  renderCart();
  refreshAll();
}

document.addEventListener("DOMContentLoaded", init);
