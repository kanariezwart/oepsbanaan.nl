export function initDialogModal({modalId, openId, closeId}) {
    const modal = document.getElementById(modalId),
        openBtn = document.getElementById(openId),
        closeBtn = closeId ? document.getElementById(closeId) : null;

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
            if (modal.open) {
                modal.close();
            }
        } else {
            modal.removeAttribute("open");
            modal.setAttribute("hidden", "");
        }
    }

    openBtn.addEventListener("click", open);
    if (closeBtn) {
        closeBtn.addEventListener("click", close);
    }

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            close();
        }
    });

    modal.addEventListener("close", () => {
        const el = lastActiveEl || openBtn;
        if (el && typeof el.focus === "function") {
            el.focus();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.hasAttribute("open")) {
            close();
        }
    });

    return {open, close, modal};
}
