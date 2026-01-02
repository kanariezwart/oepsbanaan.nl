const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ARTIFACTS_DIR = path.join(process.cwd(), "build", "tests", "artifacts");

function ensureArtifactsDir() {
    if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

function safeName(name) {
    return name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 120);
}

function debugLog(msg) {
    if (process.env.PW_DEBUG_LOGS === "1") {
        // eslint-disable-next-line no-console
        console.log(`[PW] ${msg}`);
    }
}

// Bewijs bij falen (screenshot + html dump)
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;

    ensureArtifactsDir();

    const base = safeName(`${testInfo.project.name}__${testInfo.title}`);
    const pngPath = path.join(ARTIFACTS_DIR, `${base}.png`);
    const htmlPath = path.join(ARTIFACTS_DIR, `${base}.html`);

    try {
        await page.screenshot({ path: pngPath, fullPage: true });
    } catch (_) {
        // ignore
    }

    try {
        const html = await page.content();
        fs.writeFileSync(htmlPath, html, "utf-8");
    } catch (_) {
        // ignore
    }

    testInfo.annotations.push({ type: "artifact", description: `screenshot: ${pngPath}` });
    testInfo.annotations.push({ type: "artifact", description: `html: ${htmlPath}` });
});

async function waitForMediaDecision(page) {
    // Jouw script togglet display en zet src’s; klein beetje wachttijd is ok.
    await page.waitForTimeout(800);
}

test("index loads and shows video or gif", async ({ page, baseURL }, testInfo) => {
    const url = `${baseURL}/index.html`;

    testInfo.annotations.push({ type: "info", description: `Navigate: ${url}` });
    debugLog(`Project=${testInfo.project.name} URL=${url}`);

    await test.step("Open index.html", async () => {
        await page.goto(url, { waitUntil: "domcontentloaded" });
    });

    await test.step("Wait for JS to choose media", async () => {
        await waitForMediaDecision(page);
    });

    const container = page.locator("#banana-container");
    const video = page.locator("#banana-video");
    const gif = page.locator("#banana-gif");
    const webmSource = page.locator("#banana-webm");
    const mp4Source = page.locator("#banana-mp4");

    await test.step("Check container exists and has data-banana", async () => {
        await expect(container).toBeVisible();
        await expect(container).toHaveAttribute("data-banana", /[0-9]+/);
    });

    await test.step("Assert video OR gif is visible", async () => {
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
    });
});

test("banana query param selects a specific number", async ({ page, baseURL }, testInfo) => {
    const n = 7;
    const url = `${baseURL}/index.html?banana=${n}`;

    testInfo.annotations.push({ type: "info", description: `Navigate: ${url}` });

    await test.step("Open index.html with ?banana=n", async () => {
        await page.goto(url, { waitUntil: "domcontentloaded" });
    });

    await test.step("Wait for JS to choose media", async () => {
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
