"use strict";

const {test, expect} = require("@playwright/test");
const {waitForMediaDecision, getVisibleMediaType, getMediaState} = require("./helpers/media");
const diag = require("./helpers/diagnostics").withExpect(expect);

diag.attachFailureArtifacts(test);

function collectRequests(page, predicate) {
    const hits = [];
    page.on("request", (req) => {
        const u = req.url();
        if (predicate(u, req)) hits.push(u);
    });
    return hits;
}

test("@pr index loads and shows video or gif", async ({page, baseURL}, testInfo) => {
    const url = `${baseURL}/index.html`;
    testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});
    diag.debugLog(testInfo, `goto ${url}`);

    const {consoleErrors, pageErrors} = diag.installErrorGates(page);

    await page.goto(url, {waitUntil: "domcontentloaded"});
    await waitForMediaDecision(page);

    const container = page.locator("#banana-container");
    await expect(container).toBeVisible();
    await expect(container).toHaveAttribute("data-banana", /[0-9]+/);

    const state = await getMediaState(page);
    diag.annotate(testInfo, "media_state", state);

    expect(state.videoVisible || state.gifVisible).toBeTruthy();

    if (state.videoVisible) {
        await page.waitForFunction(() => {
            const v = document.getElementById("banana-video");
            if (!v) return false;
            return !v.paused || v.currentTime > 0;
        }, {timeout: 5000});

        const isPlaying = await page.evaluate(() => {
            const v = document.getElementById("banana-video");
            return !!(v && (!v.paused || v.currentTime > 0));
        });

        diag.annotate(testInfo, "video", {isPlaying});
        expect(isPlaying).toBeTruthy();
    }

    diag.assertNoJsErrors(testInfo, consoleErrors, pageErrors);
});

test("@pr falls back to gif when autoplay is blocked", async ({page, baseURL}, testInfo) => {
    const url = `${baseURL}/index.html`;
    testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

    const {consoleErrors, pageErrors} = diag.installErrorGates(page);

    // Simulate an autoplay policy failure: play() rejects.
    await page.addInitScript(() => {
        HTMLMediaElement.prototype.play = function () {
            return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"));
        };
    });

    await page.goto(url, {waitUntil: "domcontentloaded"});

    await page.waitForFunction(() => {
        const v = document.getElementById("banana-video");
        const g = document.getElementById("banana-gif");
        if (!v || !g) return false;

        const vHidden = v.style.display === "none";
        const gShown = g.style.display !== "none";
        const okResolved = typeof g.src === "string" && /\/img\/\d+\.gif$/.test(g.src);

        return vHidden && gShown && okResolved;
    }, {timeout: 5000});

    const state = await getMediaState(page);
    diag.annotate(testInfo, "media_state", state);

    await expect(page.locator("#banana-video")).not.toBeVisible();
    await expect(page.locator("#banana-gif")).toBeVisible();

    diag.assertNoJsErrors(testInfo, consoleErrors, pageErrors);
});

test("@pr banana query param selects a specific number", async ({page, baseURL}, testInfo) => {
    const n = 7;
    const url = `${baseURL}/index.html?banana=${n}`;
    testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

    const {consoleErrors, pageErrors} = diag.installErrorGates(page);

    await page.goto(url, {waitUntil: "domcontentloaded"});
    await waitForMediaDecision(page);

    const state = await getMediaState(page);
    diag.annotate(testInfo, "media_state", state);

    const joined = [state.webmSrcAttr, state.mp4SrcAttr, state.gifSrcAttr, state.gifSrcResolved]
        .filter(Boolean)
        .join(" ");

    expect(joined).toContain(`/${n}.`);

    diag.assertNoJsErrors(testInfo, consoleErrors, pageErrors);
});

test("@pr does not request GIF when video is used", async ({page, baseURL}, testInfo) => {
    const url = `${baseURL}/index.html?banana=1`;
    testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

    const {consoleErrors, pageErrors} = diag.installErrorGates(page);

    const gifRequests = collectRequests(page, (u) => /\/img\/\d+\.gif(\?.*)?$/.test(u));

    await page.goto(url, {waitUntil: "domcontentloaded"});
    await waitForMediaDecision(page);

    const which = await getVisibleMediaType(page);
    diag.annotate(testInfo, "net", {which, gifRequests: gifRequests.length, sample: gifRequests.slice(0, 5)});

    if (which === "video") {
        expect(gifRequests.length).toBe(0);
    }

    diag.assertNoJsErrors(testInfo, consoleErrors, pageErrors);
});
