"use strict";

/**
 * Full-suite layout tests — verify centering, viewport budget, and rotation
 * across all configured browser/device projects.
 * Runs only in the @full project set (slower, not needed on every PR).
 */

const {test, expect} = require("@playwright/test");
const {assertCenteredWithinBudgetAndNoUpscale, isMobileProject} = require("./helpers/layout");
const diag = require("./helpers/diagnostics").withExpect(expect);

diag.attachFailureArtifacts(test);

test("@full layout: centered, <=90% viewport, and never upscales", async ({page, baseURL}, testInfo) => {
    const url = `${baseURL}/index.html?banana=1`;
    testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

    const {consoleErrors, pageErrors} = diag.installErrorGates(page);

    await page.goto(url, {waitUntil: "domcontentloaded"});
    await assertCenteredWithinBudgetAndNoUpscale(page, expect, {budget: 0.90});

    diag.assertNoJsErrors(testInfo, consoleErrors, pageErrors);
});

test("@full layout: stays centered after rotation (desktop viewport swap)", async ({page, baseURL}, testInfo) => {
    const url = `${baseURL}/index.html?banana=1`;
    testInfo.annotations.push({type: "info", description: `Navigate: ${url}`});

    if (isMobileProject(testInfo.project.name)) {
        test.skip(true, "Mobile rotation is covered by dedicated landscape projects.");
    }

    const {consoleErrors, pageErrors} = diag.installErrorGates(page);

    await page.goto(url, {waitUntil: "domcontentloaded"});
    await assertCenteredWithinBudgetAndNoUpscale(page, expect, {budget: 0.90});

    const size = page.viewportSize();
    if (!size) {return;}

    diag.debugLog(testInfo, `rotate viewport ${size.width}x${size.height} -> ${size.height}x${size.width}`);

    await page.setViewportSize({width: size.height, height: size.width});
    await assertCenteredWithinBudgetAndNoUpscale(page, expect, {budget: 0.90});

    diag.assertNoJsErrors(testInfo, consoleErrors, pageErrors);
});
