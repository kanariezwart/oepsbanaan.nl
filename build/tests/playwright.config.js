const {devices} = require("@playwright/test");

module.exports = {
    testDir: ".",
    timeout: 30_000,
    expect: { timeout: 5_000 },
    reporter: "line",

    // baseURL comes from env, with fallback
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

        // Mobile (viewport + UA + touch) - portrait
        { name: "pixel-5", use: { ...devices["Pixel 5"] } },
        { name: "iphone-13", use: { ...devices["iPhone 13"] } },

        // Mobile - landscape
        // Keep UA/touch/mobile settings from the device, but swap the viewport.
        { name: "iphone-13-landscape", use: { ...devices["iPhone 13"], viewport: {width: 844, height: 390}, },},
    ],
};
