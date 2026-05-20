import {initBananaMedia} from "./bananaMedia.js";
import {initDialogModal} from "./modal.js";

initBananaMedia();
initDialogModal({
    modalId: "modal",
    openId: "open-modal",
    closeId: "close-modal",
});