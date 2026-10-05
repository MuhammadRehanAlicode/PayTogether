document.addEventListener("DOMContentLoaded", () => {
    const wrappers = [...document.querySelectorAll("[data-notification-wrap]")]
        .map((wrap) => ({
            wrap,
            bell: wrap.querySelector("[data-notification-bell]"),
            menu: wrap.querySelector("[data-notification-menu]"),
            count: wrap.querySelector("[data-notification-count]"),
        }))
        .filter(({ bell, menu, count }) => bell && menu && count);

    if (!wrappers.length) return;

    const token = localStorage.getItem("access_token") || localStorage.getItem("accessToken");
    let notificationsRequest;

    wrappers.forEach((item) => {
        item.bell.addEventListener("click", async () => {
            const shouldOpen = !item.menu.classList.contains("is-open");
            closeMenus();
            if (!shouldOpen) return;

            item.menu.classList.add("is-open");
            item.bell.setAttribute("aria-expanded", "true");
            positionNotificationMenu(item);
            await loadNotifications(item);
        });
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest("[data-notification-wrap]")) closeMenus();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMenus();
    });
    window.addEventListener("resize", repositionOpenMenus);
    window.addEventListener("scroll", repositionOpenMenus, { passive: true });
    window.visualViewport?.addEventListener("resize", repositionOpenMenus);
    window.visualViewport?.addEventListener("scroll", repositionOpenMenus, { passive: true });

    if (!token) {
        wrappers.forEach(({ count, menu }) => {
            count.hidden = true;
            menu.innerHTML = '<p class="notification-empty">Sign in to view notifications.</p>';
        });
        return;
    }

    // Load the badge count on every header, even on pages with separate
    // mobile and desktop notification controls.
    wrappers.forEach((item) => loadNotifications(item));

    function closeMenus() {
        wrappers.forEach(({ bell, menu }) => {
            menu.classList.remove("is-open");
            bell.setAttribute("aria-expanded", "false");
        });
    }

    function repositionOpenMenus() {
        wrappers.filter(({ menu }) => menu.classList.contains("is-open"))
            .forEach(positionNotificationMenu);
    }

    function positionNotificationMenu({ bell, menu }) {
        if (window.innerWidth > 639) {
            menu.style.removeProperty("--notification-left");
            menu.style.removeProperty("--notification-top");
            return;
        }
        const bounds = bell.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportWidth = viewport?.width || document.documentElement.clientWidth;
        const viewportHeight = viewport?.height || document.documentElement.clientHeight;
        const viewportLeft = viewport?.offsetLeft || 0;
        const viewportTop = viewport?.offsetTop || 0;
        const gutter = 12;
        const menuWidth = Math.min(370, viewportWidth - gutter * 2);
        const menuHeight = menu.getBoundingClientRect().height;
        const left = Math.max(viewportLeft + gutter, Math.min(
            bounds.right - menuWidth,
            viewportLeft + viewportWidth - menuWidth - gutter,
        ));
        const below = bounds.bottom + 8;
        const maxTop = viewportTop + viewportHeight - Math.min(menuHeight, viewportHeight - gutter * 2) - gutter;
        const top = below <= maxTop
            ? Math.max(viewportTop + gutter, below)
            : Math.max(viewportTop + gutter, bounds.top - menuHeight - 8);
        menu.style.setProperty("--notification-left", `${left}px`);
        menu.style.setProperty("--notification-top", `${top}px`);
    }

    async function loadNotifications(item) {
        try {
            notificationsRequest ||= fetch("/api/notifications/", {
                headers: { Authorization: `Bearer ${token}` },
            }).then((response) => {
                if (!response.ok) throw new Error("Notifications could not load.");
                return response.json();
            });
            const { count: total, notifications } = await notificationsRequest;
            notificationsRequest = null;
            item.count.textContent = total > 9 ? "9+" : total;
            item.count.hidden = !total;
            item.menu.replaceChildren();
            if (!notifications.length) {
                item.menu.innerHTML = '<p class="notification-empty">You are all caught up.</p>';
                positionNotificationMenu(item);
                return;
            }
            notifications.forEach((notice) => {
                const link = document.createElement("a");
                link.className = `notification-item ${notice.kind}`;
                link.href = notice.action_url;
                link.innerHTML = `<span class="notification-dot"></span><span><strong>${escapeNotice(notice.title)}</strong><small>${escapeNotice(notice.body)}</small><em>${escapeNotice(notice.action_label)}</em></span>`;
                item.menu.appendChild(link);
            });
            positionNotificationMenu(item);
        } catch {
            // Permit a later tap to retry if the request failed.
            notificationsRequest = null;
            item.count.hidden = true;
            item.menu.innerHTML = '<p class="notification-empty">Notifications could not load. Try again.</p>';
        }
    }
});

function escapeNotice(value) {
    const element = document.createElement("span");
    element.textContent = value || "";
    return element.innerHTML;
}
