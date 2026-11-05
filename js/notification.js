/* =========================================================
   NOTIFIKASI
   ========================================================= */

function addNotification(message) {
  notifications.unshift({
    id: Date.now(),
    message,
    time: new Date().toLocaleString("id-ID"),
    read: false
  });

  notifications = notifications.slice(0, 50);
  writeStorage(STORAGE.notifications, notifications);
  updateNotificationUI();

  if (
    document.body.dataset.page === "admin" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification("Gunung Salju Makmur", { body: message });
  }
}

function updateNotificationUI() {
  const unread = notifications.filter((item) => !item.read).length;
  const count = $("notifCount");
  const dot = $("bellDot");

  if (count) {
    count.textContent = unread;
    count.style.display = unread ? "inline-block" : "none";
  }

  if (dot) {
    dot.style.display = unread ? "block" : "none";
  }

  renderNotifications();
}

function renderNotifications() {
  const list = $("notificationList");
  if (!list) return;

  if (!notifications.length) {
    list.innerHTML = `<div class="empty">Belum ada notifikasi.</div>`;
    return;
  }

  list.innerHTML = notifications.map((item) => `
    <div class="notification-item ${item.read ? "" : "unread"}">
      <div>
        <p>${escapeHtml(item.message)}</p>
        <small>${escapeHtml(item.time)}</small>
      </div>
      ${item.read ? "" : "<strong>Baru</strong>"}
    </div>
  `).join("");
}

function markNotificationsRead() {
  notifications = notifications.map((item) => ({
    ...item,
    read: true
  }));

  writeStorage(STORAGE.notifications, notifications);
  updateNotificationUI();
}

function requestNotificationPermission() {
  if (
    "Notification" in window &&
    Notification.permission === "default"
  ) {
    Notification.requestPermission();
  }
}
