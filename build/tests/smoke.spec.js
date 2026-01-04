/**
 * Playwright smoke tests for oepsbanaan.nl
 *
 * Purpose:
 * - Verify that the homepage loads correctly and shows either video or gif
 * - Verify that either a video (WebM/MP4) or GIF fallback is shown
 * - Verify that the `?banana=<n>` query parameter selects a specific asset
 * - autoplay-block scenario forces GIF fallback
 * - layout: media is centered, stays within 90% viewport, and never upscales
 * - layout: desktop-only rotation (swap viewport dimensions) still centered and no-upscale
 *
 * Design goals:
 * - Tests are browser-agnostic (Chromium, Firefox, WebKit, mobile)
 * - Tests are resilient to codec support differences
 * - On failure, diagnostic artifacts are written to disk
 *
 * Artifacts on failure:
 * - Full-page screenshot
 * - HTML snapshot of the page
 *
 * Environment variables:
 * - BASE_URL        Base URL of the site under test
 * - PW_DEBUG_LOGS=1 Enable additional debug logging
 */

(function () {
    "use strict";

    const {test, expect} = require("@playwright/test");
    const fs = require("fs");
    const path = require("path");

    /**
     * Directory where failure artifacts (screenshots, HTML dumps) are written.
     */
    const ARTIFACTS_DIR = path.join(process.cwd(), "build", "tests", "artifacts");

    /**
     * Ensure that the artifact directory exists.
     */
    function ensureArtifactsDir() {
        if (!fs.existsSync(ARTIFACTS_DIR)) {
            fs.mkdirSync(ARTIFACTS_DIR, {recursive: true});
        }
    }

    /**
     * Convert an arbitrary string into a filesystem-safe filename.
     *
     * @param {string} name - Original name (e.g. test title)
     * @returns {string} Sanitized filename
     */
    function safeName(name) {
        return name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 120);
    }

    /**
     * Conditional debug logger.
     * Logs only when PW_DEBUG_LOGS=1 is set.
     *
     * @param {string} msg - Message to log
     */
    function debugLog(msg) {
        if (process.env.PW_DEBUG_LOGS === "1") {
            // eslint-disable-next-line no-console
            console.log(`[PW] ${msg}`);
        }
    }

    /**
     * Test hook executed after each test.
     *
     * If the test failed:
     * - Capture a full-page screenshot
     * - Dump the current HTML
     * - Attach artifact paths as Playwright annotations
     */
    test.afterEach(async ({page}, testInfo) => {
        if (testInfo.status === testInfo.expectedStatus) return;

        ensureArtifactsDir();

        const base = safeName(`${testInfo.project.name}__${testInfo.title}`);
        const pngPath = path.join(ARTIFACTS_DIR, `${base}.png`);
        const htmlPath = path.join(ARTIFACTS_DIR, `${base}.html`);

        try {
            await page.screenshot({path: pngPath, fullPage: true});
        } catch {
            /* ignore screenshot errors */
        }

        try {
            fs.writeFileSync(htmlPath, await page.content(), "utf-8");
        } catch {
            /* ignore HTML dump errors */
        }

        testInfo.annotations.push({type: "artifact", description: `screenshot: ${pngPath}`});
        testInfo.annotations.push({type: "artifact", description: `html: ${htmlPath}`});
    });

    function isMobileProject(projectName) {
        // Add other mobile names here if you add Pixel, Galaxy, etc.
        return /iphone|pixel|android/i.test(projectName);
    }

    /**
     * Wait for client-side JavaScript to decide which media
     * (video or GIF) should be displayed.
     *
     * The production script dynamically sets `src` attributes
     * and toggles visibility; a short delay is sufficient.
     *
     * @param {import("@playwright/test").Page} page
     */
    async function waitForMediaDecision(page) {
        await page.waitForFunction(() => {
            const v = document.getElementById("banana-video");
            const g = document.getElementById("banana-gif");
            const vis = (el) => !!(el && el.offsetParent !== null);

            // At least one visible...
            if (!(vis(v) || vis(g))) return false;

            // ...and sources should be present (your JS swaps src for webm/mp4 and gif on fallback)
            const webm = document.getElementById("banana-webm");
            const mp4 = document.getElementById("banana-mp4");

            const hasVideoSrc = !!(webm && webm.getAttribute("src")) && !!(mp4 && mp4.getAttribute("src"));
            const hasGifSrc = !!(g && g.getAttribute("src"));

            return hasVideoSrc || hasGifSrc;
        }, {timeout: 5000});
    }

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

    async function waitForIntrinsicSize(page, which) {
        // Ensure intrinsic sizes are available for "no upscale" checks.
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

    async function assertCenteredWithinBudgetAndNoUpscale(page, opts = {}) {
        const budget = opts.budget ?? 0.90;
        const centerTolerancePx = opts.centerTolerancePx ?? 5; // allow tiny rounding differences on mobile
        const eps = opts.eps ?? 2;

        await waitForMediaDecision(page);

        const which = await getVisibleMediaType(page);
        expect(which).not.toBe("none");

        await waitForIntrinsicSize(page, which);

        const state = await page.evaluate((budget) => {
            const v = document.getElementById("banana-video");
            const g = document.getElementById("banana-gif");
            const vis = (el) => !!(el && el.offsetParent !== null);

            const which = vis(v) ? "video" : (vis(g) ? "gif" : "none");
            const el = which === "video" ? v : (which === "gif" ? g : null);
            if (!el) return {ok: false, reason: "no visible media"};

            const r = el.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            const iw = which === "video" ? el.videoWidth : el.naturalWidth;
            const ih = which === "video" ? el.videoHeight : el.naturalHeight;

            return {
                which,
                vw,
                vh,
                mw: r.width,
                mh: r.height,
                cx: r.left + r.width / 2,
                cy: r.top + r.height / 2,
                iw,
                ih,
                budget,
            };
        }, budget);

        // 1) Must fit within viewport
        expect(state.mw).toBeLessThanOrEqual(state.vw + eps);
        expect(state.mh).toBeLessThanOrEqual(state.vh + eps);

        // 2) Must fit within the budget (<= 90% of viewport)
        expect(state.mw).toBeLessThanOrEqual(state.vw * budget + eps);
        expect(state.mh).toBeLessThanOrEqual(state.vh * budget + eps);

        // 3) Must be centered
        const dx = Math.abs(state.cx - state.vw / 2);
        const dy = Math.abs(state.cy - state.vh / 2);
        expect(dx).toBeLessThanOrEqual(centerTolerancePx);
        expect(dy).toBeLessThanOrEqual(centerTolerancePx);

        // 4) Must never upscale above intrinsic media size
        expect(state.iw).toBeGreaterThan(0);
        expect(state.ih).toBeGreaterThan(0);
        expect(state.mw).toBeLessThanOrEqual(state.iw + eps);
        expect(state.mh).toBeLessThanOrEqual(state.ih + eps);
    }

    /**
     * Smoke test:
     * - Loads the homepage
     * - Verifies the banana container exists
     * - Verifies that either a video OR a GIF is visible
     */
    test("index loads and shows video or gif", async ({page, baseURL}, testInfo) => {
        const url = `${baseURL}/index.html`;

        testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});
        debugLog(`Project=${testInfo.project.name} URL=${url}`);

        await page.goto(url, {waitUntil: "domcontentloaded"});
        await waitForMediaDecision(page);

        const container = page.locator("#banana-container");
        const video = page.locator("#banana-video");
        const gif = page.locator("#banana-gif");
        const webmSource = page.locator("#banana-webm");
        const mp4Source = page.locator("#banana-mp4");

        await expect(container).toBeVisible();
        await expect(container).toHaveAttribute("data-banana", /[0-9]+/);

        const videoVisible = await video.isVisible().catch(() => false);
        const gifVisible = await gif.isVisible().catch(() => false);

        const webmSrc = await webmSource.getAttribute("src").catch(() => null);
        const mp4Src = await mp4Source.getAttribute("src").catch(() => null);
        const gifSrc = await gif.getAttribute("src").catch(() => null);

        testInfo.annotations.push({
            type: "state",
            description: `videoVisible=${videoVisible}, gifVisible=${gifVisible}`,
        });
        testInfo.annotations.push({
            type: "sources",
            description: `webm=${webmSrc || "-"} mp4=${mp4Src || "-"} gif=${gifSrc || "-"}`,
        });

        expect(videoVisible || gifVisible).toBeTruthy();

        // If video is visible, verify it is actually playing.
        // We wait for a condition (not a fixed sleep) to reduce flakiness.
        if (videoVisible) {
            await page.waitForFunction(() => {
                const v = document.getElementById("banana-video");
                if (!v) return false;
                return !v.paused || v.currentTime > 0;
            }, {timeout: 5000});

            const isPlaying = await page.evaluate(() => {
                const v = document.getElementById("banana-video");
                return !!(v && (!v.paused || v.currentTime > 0));
            });

            testInfo.annotations.push({type: "media", description: `videoPlaying=${isPlaying}`});
            expect(isPlaying).toBeTruthy();
        }
    });

    test("falls back to gif when autoplay is blocked", async ({page, baseURL}, testInfo) => {
        const url = `${baseURL}/index.html`;

        testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

        // Simulate an autoplay policy failure (Safari-like): play() rejects.
        await page.addInitScript(() => {
            HTMLMediaElement.prototype.play = function () {
                return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"));
            };
        });

        await page.goto(url, {waitUntil: "domcontentloaded"});

        const video = page.locator("#banana-video");
        const gif = page.locator("#banana-gif");

        // Wait until the production JS has toggled inline styles:
        // - video.style.display === "none"
        // - gif.style.display !== "none" ("" means "use default")
        // Also ensure gif src has been updated to /img/<n>.gif
        await page.waitForFunction(() => {
            const v = document.getElementById("banana-video");
            const g = document.getElementById("banana-gif");
            if (!v || !g) return false;

            const vHidden = v.style.display === "none";
            const gShown = g.style.display !== "none";
            const okSrc = typeof g.src === "string" && /\/img\/\d+\.gif$/.test(g.src);

            return vHidden && gShown && okSrc;
        }, {timeout: 5000});

        await expect(video).not.toBeVisible();
        await expect(gif).toBeVisible();

        const dbg = await page.evaluate(() => {
            const v = document.getElementById("banana-video");
            const g = document.getElementById("banana-gif");
            return {
                videoDisplay: v ? v.style.display : null,
                gifDisplay: g ? g.style.display : null,
                gifSrcAttr: g ? g.getAttribute("src") : null,
            };
        });
        testInfo.annotations.push({type: "state", description: JSON.stringify(dbg)});
    });


    /**
     * Smoke test:
     * - Loads the homepage with ?banana=<n>
     * - Verifies that the selected media corresponds to <n>
     */
    test("banana query param selects a specific number", async ({page, baseURL}, testInfo) => {
        const n = 7;
        const url = `${baseURL}/index.html?banana=${n}`;

        testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

        await page.goto(url, {waitUntil: "domcontentloaded"});
        await waitForMediaDecision(page);

        const webmSrc = await page.locator("#banana-webm").getAttribute("src").catch(() => "");
        const mp4Src = await page.locator("#banana-mp4").getAttribute("src").catch(() => "");
        const gifSrc = await page.locator("#banana-gif").getAttribute("src").catch(() => "");

        const joined = [webmSrc, mp4Src, gifSrc].filter(Boolean).join(" ");

        testInfo.annotations.push({
            type: "sources",
            description: `webm=${webmSrc || "-"} mp4=${mp4Src || "-"} gif=${gifSrc || "-"}`,
        });

        expect(joined).toContain(`/${n}.`);
    });

    test("layout: centered, <=90% viewport, and never upscales", async ({page, baseURL}, testInfo) => {
        const url = `${baseURL}/index.html?banana=1`;
        testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

        await page.goto(url, {waitUntil: "domcontentloaded"});
        await assertCenteredWithinBudgetAndNoUpscale(page, {budget: 0.90});
    });

    test("layout: stays centered after rotation (desktop viewport swap)", async ({page, baseURL}, testInfo) => {
        const url = `${baseURL}/index.html?banana=1`;
        testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

        // iOS rotation is covered by iphone-13-landscape; avoid setViewportSize on mobile device emulation.
        if (isMobileProject(testInfo.project.name)) {
            test.skip(true, "Mobile rotation is covered by dedicated landscape projects.");
        }

        await page.goto(url, {waitUntil: "domcontentloaded"});
        await assertCenteredWithinBudgetAndNoUpscale(page, {budget: 0.90});

        const size = page.viewportSize();
        if (!size) return;

        await page.setViewportSize({width: size.height, height: size.width});
        await assertCenteredWithinBudgetAndNoUpscale(page, {budget: 0.90});
    });

})();
