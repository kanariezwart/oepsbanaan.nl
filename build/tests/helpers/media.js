"use strict";

/**
 * Media helpers for oepsbanaan.nl Playwright tests
 *
 * Supports "lazy GIF": <img id="banana-gif"> has NO src until fallback.
 */

async function waitForMediaDecision(page) {
    await page.waitForFunction(() => {
        const v = document.getElementById("banana-video");
        const g = document.getElementById("banana-gif");
        const webm = document.getElementById("banana-webm");
        const mp4 = document.getElementById("banana-mp4");

        const vis = (el) => !!(el && el.offsetParent !== null);
        const videoVisible = vis(v);
        const gifVisible = vis(g);

        if (!(videoVisible || gifVisible)) return false;

        // Video path: both sources must be present
        const hasVideoSrc =
            !!(webm && webm.getAttribute("src")) &&
            !!(mp4 && mp4.getAttribute("src"));

        // GIF path: resolved src ends with /img/<n>.gif when set
        const gifResolved = g ? g.src : "";
        const hasGifResolved =
            typeof gifResolved === "string" &&
            /\/img\/\d+\.gif$/.test(gifResolved);

        return hasVideoSrc || hasGifResolved;
    }, {timeout: 5000});
}

/**
 *
 * @param page
 * @returns {Promise<XPathResult>}
 */
async function getVisibleMediaType(page) {
    return page.evaluate(() => {
        const v = document.getElementById("banana-video");
        const g = document.getElementById("banana-gif");
        const vis = (el) => !!(el && el.offsetParent !== null);
        if (vis(v)) return "video";
        if (vis(g)) return "gif";
        return "none";
    });
}

/**
 *
 * @param page
 * @param which
 * @returns {Promise<void>}
 */
async function waitForIntrinsicSize(page, which) {
    if (which === "video") {
        await page.waitForFunction(() => {
            const v = document.getElementById("banana-video");
            return v && v.videoWidth > 0 && v.videoHeight > 0;
        }, {timeout: 5000});
    } else if (which === "gif") {
        await page.waitForFunction(() => {
            const g = document.getElementById("banana-gif");
            return g && g.naturalWidth > 0 && g.naturalHeight > 0;
        }, {timeout: 5000});
    }
}

/**
 * 
 * @param page
 * @returns {Promise<XPathResult>}
 */
async function getMediaState(page) {
    return page.evaluate(() => {
        const v = document.getElementById("banana-video");
        const g = document.getElementById("banana-gif");
        const webm = document.getElementById("banana-webm");
        const mp4 = document.getElementById("banana-mp4");

        const vis = (el) => !!(el && el.offsetParent !== null);

        return {
            videoVisible: vis(v),
            gifVisible: vis(g),
            webmSrcAttr: webm ? webm.getAttribute("src") : null,
            mp4SrcAttr: mp4 ? mp4.getAttribute("src") : null,
            gifSrcAttr: g ? g.getAttribute("src") : null,
            gifSrcResolved: g ? g.src : null,
        };
    });
}

module.exports = {
    waitForMediaDecision,
    getVisibleMediaType,
    waitForIntrinsicSize,
    getMediaState,
};
