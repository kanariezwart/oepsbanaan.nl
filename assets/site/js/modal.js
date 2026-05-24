export function initDialogModal({modalId, openId, closeId}) {
    const modal = document.getElementById(modalId);
    const openBtn = document.getElementById(openId);
    const closeBtn = closeId ? document.getElementById(closeId) : null;

    if (!modal || !openBtn) {
        return null;
    }

    const hasNativeDialog = typeof modal.showModal === "function";
    let lastActiveEl = null;

    function open() {
        lastActiveEl = document.activeElement;
        if (hasNativeDialog) {
            if (!modal.open) {
                modal.showModal();
            }
        } else {
            modal.setAttribute("open", "");
            modal.removeAttribute("hidden");
        }
    }

    function close() {
        if (hasNativeDialog) {
            modal.close();
        } else {
            modal.removeAttribute("open");
            modal.setAttribute("hidden", "");
        }
        lastActiveEl = null;
    }

    openBtn.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            close();
        }
    });

    modal.addEventListener("close", () => {
        (lastActiveEl || openBtn)?.focus();
    });

    modal.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            close();
        }
    });

    return {open, close, modal};
}
