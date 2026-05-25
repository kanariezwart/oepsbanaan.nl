"use strict";

const fs = require("fs");
const path = require("path");

const ARTIFACTS_DIR = path.join(process.cwd(), "build", "tests", "artifacts");

function ensureArtifactsDir() {
    if (!fs.existsSync(ARTIFACTS_DIR)) {
        fs.mkdirSync(ARTIFACTS_DIR, {recursive: true});
    }
}

// Converts a test title to a safe filename by replacing special characters.
function safeName(name) {
    return name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 120);
}

/**
 * Optional debug logging (CLI)
 * Enable with: PW_DEBUG_LOGS=1
 */
function debugLog(testInfo, msg) {
    if (process.env.PW_DEBUG_LOGS !== "1") {return;}
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(`[PW ${ts}] [${testInfo.project.name}] ${msg}`);
}

/**
 * Attach JSON-ish objects as Playwright annotations for easy CLI review.
 */
function annotate(testInfo, type, obj) {
    try {
        testInfo.annotations.push({type, description: JSON.stringify(obj)});
    } catch {
        testInfo.annotations.push({type, description: String(obj)});
    }
}

/**
 * Install strict JS error gates on a Page:
 * - any console.error => fail
 * - any pageerror (uncaught exception) => fail
 */
function installErrorGates(page) {
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (msg) => {
        if (msg.type() === "error") {consoleErrors.push(msg.text());}
    });

    page.on("pageerror", (err) => {
        pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    return {consoleErrors, pageErrors};
}

/**
 * Standard afterEach hook:
 * If test failed, dump screenshot + HTML to build/tests/artifacts.
 */
function attachFailureArtifacts(test) {
    test.afterEach(async ({page}, testInfo) => {
        if (testInfo.status === testInfo.expectedStatus) {return;}

        ensureArtifactsDir();

        const base = safeName(`${testInfo.project.name}__${testInfo.title}`);
        const pngPath = path.join(ARTIFACTS_DIR, `${base}.png`);
        const htmlPath = path.join(ARTIFACTS_DIR, `${base}.html`);

        try {
            await page.screenshot({path: pngPath, fullPage: true});
        } catch {
            /* ignore */
        }

        try {
            fs.writeFileSync(htmlPath, await page.content(), "utf-8");
        } catch {
            /* ignore */
        }

        testInfo.annotations.push({type: "artifact", description: `screenshot: ${pngPath}`});
        testInfo.annotations.push({type: "artifact", description: `html: ${htmlPath}`});
    });
}

function assertNoJsErrors(testInfo, consoleErrors, pageErrors) {
    if (consoleErrors.length || pageErrors.length) {
        annotate(testInfo, "js_errors", {consoleErrors, pageErrors});
    }
    expect(consoleErrors, "console.error was emitted").toEqual([]);
    expect(pageErrors, "pageerror (uncaught exception) was emitted").toEqual([]);
}

// `expect` is only available from @playwright/test; inject it from specs if you want.
function withExpect(_expect) {
    expect = _expect;
    return module.exports;
}

// Internal mutable reference used by assertNoJsErrors
let expect;

module.exports = {
    attachFailureArtifacts,
    annotate,
    debugLog,
    installErrorGates,
    assertNoJsErrors,
    withExpect,
};
