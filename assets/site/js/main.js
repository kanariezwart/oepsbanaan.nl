/* jshint esversion: 6 */
import {initBananaMedia} from "./bananaMedia.js";
import {initDialogModal} from "./modal.js";

initBananaMedia();
initDialogModal({
    modalId: "modal",
    openId: "openModal",
    closeId: "closeModal",
});