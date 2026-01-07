"use strict";

const {devices} = require("@playwright/test");

const isCI = !!process.env.CI;

// Choose a project set:
// - full: all browsers + mobile variants (default)
// - pr: faster subset for PRs / quick checks
const PROJECT_SET = process.env.PROJECT_SET || "full";

// PR: only @pr tests
// FULL: @pr + @full tests
const grep = PROJECT_SET === "pr" ? /@pr/ : /@pr|@full/;

const PROJECTS_FULL = [
    {name: "chromium", use: {...devices["Desktop Chrome"]}},
    {name: "firefox", use: {...devices["Desktop Firefox"]}},
    {name: "webkit", use: {...devices["Desktop Safari"]}},
    {name: "pixel-5", use: {...devices["Pixel 5"]}},
    {name: "iphone-13", use: {...devices["iPhone 13"]}},
    {name: "iphone-13-landscape", use: {...devices["iPhone 13"], viewport: {width: 844, height: 390}}},
];

const PROJECTS_PR = [
    {name: "chromium", use: {...devices["Desktop Chrome"]}},
    {name: "webkit", use: {...devices["Desktop Safari"]}},
    {name: "iphone-13", use: {...devices["iPhone 13"]}},
];

const projects = PROJECT_SET === "pr" ? PROJECTS_PR : PROJECTS_FULL;

module.exports = {
    testDir: ".",
    timeout: 30_000,
    expect: {timeout: 5_000},
    reporter: "line",

    grep,

    // CI: retry once; local: no retries
    retries: isCI ? 1 : 0,

    use: {
        baseURL: process.env.BASE_URL || "http://127.0.0.1:8080",

        // Useful balance:
        // - CI: trace on first retry (best for flaky triage)
        // - Local: retain-on-failure (handy when iterating)
        trace: isCI ? "on-first-retry" : "retain-on-failure",

        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },

    projects,
};
