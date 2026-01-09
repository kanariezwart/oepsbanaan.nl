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
        const container = document.getElementById("banana-container");
        const v = document.getElementById("banana-video");
        const g = document.getElementById("banana-gif");

        const vis = (el) => !!(el && el.offsetParent !== null);
        const which = vis(v) ? "video" : (vis(g) ? "gif" : "none");
        const media = which === "video" ? v : (which === "gif" ? g : null);

        if (!container || !media) {
            return { ok: false, reason: "missing container or media" };
        }

        const cr = container.getBoundingClientRect();
        const mr = media.getBoundingClientRect();

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const iw = which === "video" ? media.videoWidth : media.naturalWidth;
        const ih = which === "video" ? media.videoHeight : media.naturalHeight;

        return {
            which,
            vw, // viewport
            vh,
            // container geometry (for centering)
            cx: cr.left + cr.width / 2,
            cy: cr.top + cr.height / 2,

            // media geometry (for sizing)
            mw: mr.width,
            mh: mr.height,

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
