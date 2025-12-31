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

    srcWebm.src = '/img/webm/' + n + '.webm';
    srcMp4.src = '/img/mp4/' + n + '.mp4';
    gif.src = '/img/' + n + '.gif';

    // try to load video
    video.style.display = "";
    video.load();

    video.addEventListener("error", () => {
        video.style.display = "none";
        gif.style.display = "";
    }, {once: true});

})();
