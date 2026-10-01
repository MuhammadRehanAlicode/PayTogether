document.addEventListener("DOMContentLoaded", () => {
    const bell = document.querySelector("[data-notification-bell]");
    const menu = document.querySelector("[data-notification-menu]");
    const count = document.querySelector("[data-notification-count]");
    if (!bell || !menu || !count) return;

    const token = localStorage.getItem("access_token") || localStorage.getItem("accessToken");
    if (!token) {
        count.hidden = true;
        menu.replaceChildren();
        menu.innerHTML = '<p class="notification-empty">Sign in to view notifications.</p>';
    }

    bell.addEventListener("click", () => {
        const isOpen = menu.classList.toggle("is-open");
        bell.setAttribute("aria-expanded", String(isOpen));
        if (isOpen) {
            positionNotificationMenu();
            loadNotifications();
        }
    });
    document.addEventListener("click", (event) => {
        if (!event.target.closest("[data-notification-wrap]")) {
            menu.classList.remove("is-open");
            bell.setAttribute("aria-expanded", "false");
        }
    });

    if (!token) return;

    function positionNotificationMenu() {
        if (window.innerWidth > 639) return;
        const bounds = bell.getBoundingClientRect();
        const menuWidth = Math.min(370, window.innerWidth - 24);
        const left = Math.max(12, Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - 12));
        const top = Math.max(12, Math.min(bounds.bottom + 8, window.innerHeight - 180));
        menu.style.setProperty("--notification-left", `${left}px`);
        menu.style.setProperty("--notification-top", `${top}px`);
    }

    window.addEventListener("resize", positionNotificationMenu);
    window.addEventListener("scroll", positionNotificationMenu, { passive: true });

    function loadNotifications() {
        fetch("/api/notifications/", { headers: { Authorization: `Bearer ${token}` } })
            .then((response) => response.ok ? response.json() : Promise.reject())
            .then(({ count: total, notifications }) => {
            count.textContent = total > 9 ? "9+" : total;
            count.hidden = !total;
            menu.replaceChildren();
            if (!notifications.length) {
                menu.innerHTML = '<p class="notification-empty">You are all caught up.</p>';
                return;
            }
            notifications.forEach((notice) => {
                const item = document.createElement("a");
                item.className = `notification-item ${notice.kind}`;
                item.href = notice.action_url;
                item.innerHTML = `<span class="notification-dot"></span><span><strong>${escapeNotice(notice.title)}</strong><small>${escapeNotice(notice.body)}</small><em>${escapeNotice(notice.action_label)}</em></span>`;
                menu.appendChild(item);
            });
            })
            .catch(() => {
                count.hidden = true;
                menu.replaceChildren();
                menu.innerHTML = '<p class="notification-empty">Notifications could not load. Try again.</p>';
            });
    }

    loadNotifications();
});

function escapeNotice(value) {
    const element = document.createElement("span");
    element.textContent = value || "";
    return element.innerHTML;
}
