"use strict";

const {test, expect} = require("@playwright/test");
const {waitForMediaDecision, getVisibleMediaType} = require("./helpers/media");
const diag = require("./helpers/diagnostics").withExpect(expect);

diag.attachFailureArtifacts(test);

test("@pr layout: banana always fits in viewport (no overflow, media contained)", async ({page, baseURL}, testInfo) => {
    const url = `${baseURL}/index.html?banana=1`;
    testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

    const {consoleErrors, pageErrors} = diag.installErrorGates(page);

    await page.goto(url, {waitUntil: "domcontentloaded"});
    await waitForMediaDecision(page);

    // 1) No horizontal overflow on any project (desktop + mobile)
    const overflowX = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    diag.annotate(testInfo, "layout", {overflowX});
    expect(overflowX).toBeFalsy();

    // 2) Container fits within viewport
    const container = page.locator("#banana-container");
    await expect(container).toBeVisible();

    const sizes = await page.evaluate(() => {
        const el = document.getElementById("banana-container");
        const r = el.getBoundingClientRect();
        return {cw: r.width, ch: r.height, vw: window.innerWidth, vh: window.innerHeight};
    });
    diag.annotate(testInfo, "sizes", sizes);

    expect(sizes.cw).toBeLessThanOrEqual(sizes.vw);
    expect(sizes.ch).toBeLessThanOrEqual(sizes.vh);

    // 3) Visible media is contained within container bounds
    const which = await getVisibleMediaType(page);
    diag.annotate(testInfo, "media", {which});
    expect(which).not.toBe("none");

    const mediaSelector = which === "video" ? "#banana-video" : "#banana-gif";
    const bounds = await page.evaluate((sel) => {
        const c = document.getElementById("banana-container");
        const m = document.querySelector(sel);
        if (!c || !m) return {ok: false, reason: "missing elements"};

        const cr = c.getBoundingClientRect();
        const mr = m.getBoundingClientRect();

        const eps = 1;
        const within =
            mr.left >= cr.left - eps &&
            mr.top >= cr.top - eps &&
            mr.right <= cr.right + eps &&
            mr.bottom <= cr.bottom + eps;

        return {
            ok: within,
            eps,
            container: {left: cr.left, top: cr.top, right: cr.right, bottom: cr.bottom, w: cr.width, h: cr.height},
            media: {left: mr.left, top: mr.top, right: mr.right, bottom: mr.bottom, w: mr.width, h: mr.height},
        };
    }, mediaSelector);

    diag.annotate(testInfo, "bounds", bounds);
    expect(bounds.ok).toBeTruthy();

    diag.assertNoJsErrors(testInfo, consoleErrors, pageErrors);
});
