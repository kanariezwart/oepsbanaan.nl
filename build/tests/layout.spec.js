"use strict";

/**
 * PR layout tests — verify that media fits in the viewport and that the
 * "huh?" button stays at a stable position regardless of which banana is shown.
 */

const {test, expect} = require("@playwright/test");
const {waitForMediaDecision, getVisibleMediaType} = require("./helpers/media");
const diag = require("./helpers/diagnostics").withExpect(expect);

diag.attachFailureArtifacts(test);

// Returns a plain {x, y, w, h, left, top, right, bottom} from getBoundingClientRect.
async function getRect(page, selector) {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {x: r.x, y: r.y, w: r.width, h: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom};
    }, selector);
}

test("@pr layout: banana fits in viewport (no overflow, media contained in media-box)", async ({page, baseURL}, testInfo) => {
    const url = `${baseURL}/index.html?banana=1`;
    testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

    const {consoleErrors, pageErrors} = diag.installErrorGates(page);

    await page.goto(url, {waitUntil: "domcontentloaded"});
    await waitForMediaDecision(page);

    // 1) No horizontal overflow
    const overflowX = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    diag.annotate(testInfo, "layout", {overflowX});
    expect(overflowX).toBeFalsy();

    // 2) Media box exists and fits within viewport
    const box = page.locator(".media-box");
    await expect(box).toBeVisible();

    const boxSizes = await page.evaluate(() => {
        const el = document.querySelector(".media-box");
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {bw: r.width, bh: r.height, vw: window.innerWidth, vh: window.innerHeight};
    });

    diag.annotate(testInfo, "media_box_sizes", boxSizes);
    expect(boxSizes).not.toBeNull();
    expect(boxSizes.bw).toBeLessThanOrEqual(boxSizes.vw);
    expect(boxSizes.bh).toBeLessThanOrEqual(boxSizes.vh);

    // 3) Visible media is contained within media-box bounds (with small epsilon)
    const which = await getVisibleMediaType(page);
    diag.annotate(testInfo, "media", {which});
    expect(which).not.toBe("none");

    const mediaSelector = which === "video" ? "#banana-video" : "#banana-gif";

    const bounds = await page.evaluate((sel) => {
        const c = document.querySelector(".media-box");
        const m = document.querySelector(sel);
        if (!c || !m) return {ok: false, reason: "missing elements"};

        const cr = c.getBoundingClientRect();
        const mr = m.getBoundingClientRect();

        const eps = 2; // allow minor rounding across browsers
        const within =
            mr.left >= cr.left - eps &&
            mr.top >= cr.top - eps &&
            mr.right <= cr.right + eps &&
            mr.bottom <= cr.bottom + eps;

        return {
            ok: within,
            eps,
            box: {left: cr.left, top: cr.top, right: cr.right, bottom: cr.bottom, w: cr.width, h: cr.height},
            media: {left: mr.left, top: mr.top, right: mr.right, bottom: mr.bottom, w: mr.width, h: mr.height},
        };
    }, mediaSelector);

    diag.annotate(testInfo, "bounds", bounds);
    expect(bounds.ok).toBeTruthy();

    diag.assertNoJsErrors(testInfo, consoleErrors, pageErrors);
});

test("@pr layout: huh button does not jump between different bananas", async ({page, baseURL}, testInfo) => {
    const {consoleErrors, pageErrors} = diag.installErrorGates(page);

    // Pick a mix: square + landscape + portrait-ish assets.
    // Adjust numbers if you know exact portrait/landscape indices.
    const samples = [1, 2, 3, 8, 10];

    let baseline = null;

    for (const n of samples) {
        const url = `${baseURL}/index.html?banana=${n}`;
        testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});
        diag.debugLog(testInfo, `goto ${url}`);

        await page.goto(url, {waitUntil: "domcontentloaded"});
        await waitForMediaDecision(page);

        const openBtn = page.locator("#open-modal");
        await expect(openBtn).toBeVisible();

        const rect = await getRect(page, "#open-modal");
        diag.annotate(testInfo, `open-modal_rect_${n}`, rect);
        expect(rect).not.toBeNull();

        if (!baseline) {
            baseline = rect;
            continue;
        }

        // Button should be at stable vertical position (tiny tolerance for rounding / font rendering)
        const dy = Math.abs(rect.y - baseline.y);
        diag.annotate(testInfo, `open-modal_delta_${n}`, {dy, baselineY: baseline.y, y: rect.y});
        expect(dy).toBeLessThanOrEqual(2);
    }

    diag.assertNoJsErrors(testInfo, consoleErrors, pageErrors);
});
