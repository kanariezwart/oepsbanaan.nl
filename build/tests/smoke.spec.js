/**
 * Playwright smoke tests for oepsbanaan.nl
 *
 * Purpose:
 * - Verify that the homepage loads correctly
 * - Verify that either a video (WebM/MP4) or GIF fallback is shown
 * - Verify that the `?banana=<n>` query parameter selects a specific asset
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
            const html = await page.content();
            fs.writeFileSync(htmlPath, html, "utf-8");
        } catch {
            /* ignore HTML dump errors */
        }

        testInfo.annotations.push({type: "artifact", description: `screenshot: ${pngPath}`});
        testInfo.annotations.push({type: "artifact", description: `html: ${htmlPath}`});
    });

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
        await page.waitForTimeout(800);
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

        await test.step("Open index.html", async () => {
            await page.goto(url, {waitUntil: "domcontentloaded"});
        });

        await test.step("Wait for media selection", async () => {
            await waitForMediaDecision(page);
        });

        const container = page.locator("#banana-container");
        const video = page.locator("#banana-video");
        const gif = page.locator("#banana-gif");
        const webmSource = page.locator("#banana-webm");
        const mp4Source = page.locator("#banana-mp4");

        await test.step("Verify container metadata", async () => {
            await expect(container).toBeVisible();
            await expect(container).toHaveAttribute("data-banana", /[0-9]+/);
        });

        await test.step("Verify video OR gif is visible", async () => {
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

            debugLog(`visible: video=${videoVisible} gif=${gifVisible}`);
            debugLog(`src: webm=${webmSrc} mp4=${mp4Src} gif=${gifSrc}`);

            expect(videoVisible || gifVisible).toBeTruthy();

            // If video is visible, verify it actually starts playing.
            // Autoplay can be blocked without triggering a "video error" event.
            if (videoVisible) {
                await test.step("If video is shown, verify it is playing", async () => {
                    await page.waitForTimeout(400);

                    // In some browsers currentTime stays 0 until playback starts.
                    const isPlaying = await page.evaluate(() => {
                        const v = document.getElementById("banana-video");
                        if (!v) return false;
                        // "paused" is the key signal; currentTime advancing is an extra indicator.
                        return !v.paused || v.currentTime > 0;
                    });

                    testInfo.annotations.push({
                        type: "media",
                        description: `videoPlaying=${isPlaying}`,
                    });

                    expect(isPlaying).toBeTruthy();
                });
            }

        });
    });

    test("falls back to gif when autoplay is blocked", async ({page, baseURL}, testInfo) => {
        const url = `${baseURL}/index.html`;

        testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

        // Simulate an autoplay policy failure (Safari-like): play() rejects.
        await page.addInitScript(() => {
            const originalPlay = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function () {
                // Keep original behavior available, but force a NotAllowedError-like rejection.
                try {
                    originalPlay.apply(this, arguments);
                } catch (_) {
                }
                return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"));
            };
        });

        await test.step("Open index.html (autoplay blocked via init script)", async () => {
            await page.goto(url, {waitUntil: "domcontentloaded"});
        });

        await test.step("Wait for JS to attempt play() and fall back", async () => {
            await page.waitForTimeout(800);
        });

        const video = page.locator("#banana-video");
        const gif = page.locator("#banana-gif");

        await test.step("Verify GIF fallback is shown", async () => {
            const videoVisible = await video.isVisible().catch(() => false);
            const gifVisible = await gif.isVisible().catch(() => false);

            testInfo.annotations.push({
                type: "state",
                description: `videoVisible=${videoVisible}, gifVisible=${gifVisible}`,
            });

            expect(gifVisible).toBeTruthy();
            expect(videoVisible).toBeFalsy();
        });
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

        await test.step("Open index.html with banana query parameter", async () => {
            await page.goto(url, {waitUntil: "domcontentloaded"});
        });

        await test.step("Wait for media selection", async () => {
            await waitForMediaDecision(page);
        });

        const webmSrc = await page.locator("#banana-webm").getAttribute("src").catch(() => "");
        const mp4Src = await page.locator("#banana-mp4").getAttribute("src").catch(() => "");
        const gifSrc = await page.locator("#banana-gif").getAttribute("src").catch(() => "");

        const joined = [webmSrc, mp4Src, gifSrc].filter(Boolean).join(" ");

        testInfo.annotations.push({
            type: "sources",
            description: `webm=${webmSrc || "-"} mp4=${mp4Src || "-"} gif=${gifSrc || "-"}`,
        });

        debugLog(`query param sources: ${joined}`);

        await test.step("Assert selected media contains the requested number", async () => {
            expect(joined).toContain(`/${n}.`);
        });
    });


})();