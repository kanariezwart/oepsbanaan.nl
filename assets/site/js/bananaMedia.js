/**
 * Banana media loader
 *
 * Responsibilities:
 * - Select banana index (random or via query param)
 * - Wire up video autoplay with GIF fallback
 *
 * This module is intentionally split into:
 * - Pure helpers (exported, unit-testable)
 * - initBananaMedia (DOM side-effects)
 */

/* ------------------ Pure helpers ------------------ */

/**
 * Determine which banana index should be used.
 *
 * @param {number} imageMax - Max available banana images
 * @param {string|null} requestedParam - Value from URLSearchParams.get("banana")
 * @returns {number}
 */
export function selectBananaIndex(imageMax, requestedParam) {
    const max = Number(imageMax) || 1;
    const requested = Number(requestedParam);

    if (Number.isInteger(requested) && requested > 0 && requested <= max) {
        return requested;
    }

    return Math.floor(Math.random() * max) + 1;
}

/**
 * Build media URLs for a banana index.
 *
 * @param {number} index
 */
export function buildBananaSources(index) {
    return {
        webm: `/img/webm/${index}.webm`,
        mp4: `/img/mp4/${index}.mp4`,
        gif: `/img/${index}.gif`,
    };
}

/* ------------------ DOM / media wiring ------------------ */
export function initBananaMedia({
                                    containerId = "banana-container",
                                    videoId = "banana-video",
                                    gifId = "banana-gif",
                                    webmId = "banana-webm",
                                    mp4Id = "banana-mp4",
                                    searchParams = new URL(location.href).searchParams,
                                } = {}) {
    const container = document.getElementById(containerId),
        video = document.getElementById(videoId),
        gif = document.getElementById(gifId),
        srcWebm = document.getElementById(webmId),
        srcMp4 = document.getElementById(mp4Id);

    if (!container || !video || !gif || !srcWebm || !srcMp4) {
        return null;
    }

    const imageMax = parseInt(container.dataset.banana, 10) || 1;
    const index = selectBananaIndex(imageMax,
        searchParams.get("banana")
    );

    const sources = buildBananaSources(index);

    srcWebm.src = sources.webm;
    srcMp4.src = sources.mp4;

    function showGifFallback() {
        gif.src = sources.gif;
        video.style.display = "none";
        gif.style.display = "";
    }

    // Autoplay robustness (Safari/iOS friendly)
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;

    video.addEventListener("error", showGifFallback, {once: true});

    video.load();

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(showGifFallback);
    }

    // Return minimal API for tests / debugging
    return {
        index,
        sources,
        video,
        gif,
    };
}
