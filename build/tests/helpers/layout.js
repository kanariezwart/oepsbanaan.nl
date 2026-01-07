"use strict";

const {waitForMediaDecision, getVisibleMediaType, waitForIntrinsicSize} = require("./media");

/**
 * Shared layout assertion:
 * - visible media fits viewport
 * - fits within budget (default 90% viewport)
 * - centered
 * - never upscales beyond intrinsic size
 */
async function assertCenteredWithinBudgetAndNoUpscale(page, expect, opts = {}) {
    const budget = opts.budget ?? 0.90;
    const centerTolerancePx = opts.centerTolerancePx ?? 5;
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

    // 2) Must fit within the budget
    expect(state.mw).toBeLessThanOrEqual(state.vw * budget + eps);
    expect(state.mh).toBeLessThanOrEqual(state.vh * budget + eps);

    // 3) Must be centered
    const dx = Math.abs(state.cx - state.vw / 2);
    const dy = Math.abs(state.cy - state.vh / 2);
    expect(dx).toBeLessThanOrEqual(centerTolerancePx);
    expect(dy).toBeLessThanOrEqual(centerTolerancePx);

    // 4) Must never upscale above intrinsic size
    expect(state.iw).toBeGreaterThan(0);
    expect(state.ih).toBeGreaterThan(0);
    expect(state.mw).toBeLessThanOrEqual(state.iw + eps);
    expect(state.mh).toBeLessThanOrEqual(state.ih + eps);
}

function isMobileProject(projectName) {
    return /iphone|pixel|android/i.test(projectName);
}

module.exports = {
    assertCenteredWithinBudgetAndNoUpscale,
    isMobileProject,
};
