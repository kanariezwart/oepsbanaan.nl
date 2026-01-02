(function () {
    "use strict";

    const container = document.getElementById("banana-container"),
        video = document.getElementById("banana-video"),
        gif = document.getElementById("banana-gif"),
        srcWebm = document.getElementById("banana-webm"),
        srcMp4 = document.getElementById("banana-mp4");

    if (!container || !video || !gif || !srcWebm || !srcMp4) {
        return;
    }

    const params = (new URL(location.href)).searchParams,
        imageMax = parseInt(container.dataset.banana, 10) || 1,
        requested = parseInt(params.get("banana"), 10);

    // find a random number between 1 and imageMax
    let n = Math.floor(Math.random() * imageMax) + 1;
    // requested number is a valid positive number and not higher than image max
    if (requested > 0 && requested <= imageMax) {
        n = requested;
    }

    // update video source
    srcWebm.src = '/img/webm/' + n + '.webm';
    srcMp4.src = '/img/mp4/' + n + '.mp4';

    function showGif() {
        gif.src = '/img/' + n + '.gif';
        video.style.display = "none";
        gif.style.display = "";
    }

    // Make autoplay more likely to succeed (esp. Safari/iOS)
    video.addEventListener("error", showGif, { once: true });
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;

    // try to load video
    video.load();
    // Some browsers (Safari esp.) won't emit "error" when autoplay is blocked.
    // Try to play and fallback if it is rejected.
    const p = video.play();
    if (p && typeof p.catch === "function") {
        p.catch(showGif);
    }

})();
