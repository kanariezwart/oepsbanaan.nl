const {test, expect} = require("@playwright/test");

test("layout: banana always fits in viewport (no overflow, media contained)", async ({page, baseURL}, testInfo) => {
    const url = `${baseURL}/index.html?banana=1`;
    testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

    await page.goto(url, {waitUntil: "domcontentloaded"});
    await page.waitForTimeout(800); // jouw bestaande "media decision" timing

    // 1) No horizontal overflow on any project (desktop + iphone)
    const overflowX = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflowX).toBeFalsy();

    // 2) Container fits within viewport
    const container = page.locator("#banana-container");
    await expect(container).toBeVisible();

    const {cw, ch, vw, vh} = await page.evaluate(() => {
        const el = document.getElementById("banana-container");
        const r = el.getBoundingClientRect();
        return {
            cw: r.width,
            ch: r.height,
            vw: window.innerWidth,
            vh: window.innerHeight,
        };
    });

    expect(cw).toBeLessThanOrEqual(vw);
    expect(ch).toBeLessThanOrEqual(vh);

    // 3) Visible media is contained within container bounds
    const video = page.locator("#banana-video");
    const gif = page.locator("#banana-gif");

    const which = await page.evaluate(() => {
        const v = document.getElementById("banana-video");
        const g = document.getElementById("banana-gif");

        const vVis = !!(v && v.offsetParent !== null);
        const gVis = !!(g && g.offsetParent !== null);

        return vVis ? "video" : (gVis ? "gif" : "none");
    });

    expect(which).not.toBe("none");

    const mediaSelector = which === "video" ? "#banana-video" : "#banana-gif";
    const {ok} = await page.evaluate((sel) => {
        const c = document.getElementById("banana-container");
        const m = document.querySelector(sel);
        if (!c || !m) return {ok: false};

        const cr = c.getBoundingClientRect();
        const mr = m.getBoundingClientRect();

        // allow a tiny epsilon for subpixel rounding
        const eps = 1;

        const within =
            mr.left >= cr.left - eps &&
            mr.top >= cr.top - eps &&
            mr.right <= cr.right + eps &&
            mr.bottom <= cr.bottom + eps;

        return {ok: within};
    }, mediaSelector);

    expect(ok).toBeTruthy();
});
