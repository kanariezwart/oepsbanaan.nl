const { devices } = require("@playwright/test");

module.exports = {
    testDir: ".",
    timeout: 30_000,
    expect: { timeout: 5_000 },
    reporter: "line",

    // Belangrijk: baseURL komt uit env, met fallback
    use: {
        baseURL: process.env.BASE_URL || "http://127.0.0.1:8080",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },

    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox",  use: { ...devices["Desktop Firefox"] } },
        { name: "webkit",   use: { ...devices["Desktop Safari"] } },

        // Mobiel (viewport + UA + touch)
        { name: "iphone-13", use: { ...devices["iPhone 13"] } },
    ],
};
