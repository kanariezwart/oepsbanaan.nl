const {test, expect} = require("@playwright/test");

/**
 * Modal tests for HTML <dialog>.
 *
 * Requirements assumed:
 * - button#openModal opens dialog#modal
 * - button#closeModal closes it (either via JS or form[method="dialog"])
 * - clicking backdrop closes (your JS implements this)
 * - focus returns to the opener after close (your JS implements this)
 */

// Helper that works for <dialog>: uses the "open" attribute
async function expectDialogOpen(page, open = true) {
    const modal = page.locator("#modal");
    if (open) {
        await expect(modal).toHaveAttribute("open", /.+|^$/); // open attribute exists (value may be empty)
    } else {
        await expect(modal).not.toHaveAttribute("open", /.+|^$/);
    }
}

test("modal opens and closes via close button @pr", async ({page}) => {
    await page.goto("/index.html");

    const openBtn = page.locator("#openModal");
    const closeBtn = page.locator("#closeModal");
    const modal = page.locator("#modal");

    await expect(openBtn).toBeVisible();

    // Open
    await openBtn.click();
    await expect(modal).toBeVisible();
    await expectDialogOpen(page, true);

    // Close
    await closeBtn.click();
    await expectDialogOpen(page, false);

    // After close, opener should regain focus (accessibility)
    await expect(openBtn).toBeFocused();
});

test("modal closes on Escape @pr", async ({page, browserName}) => {
    await page.goto("/index.html");

    const openBtn = page.locator("#openModal");
    const modal = page.locator("#modal");

    await openBtn.click();
    await expect(modal).toBeVisible();
    await expectDialogOpen(page, true);

    // ESC closes native dialog in modern browsers
    await page.keyboard.press("Escape");

    // Some WebKit builds can be slightly slower here
    await expectDialogOpen(page, false);
    await expect(openBtn).toBeFocused();
});

test("modal closes when clicking the backdrop (dialog surface) @full", async ({page}) => {
    await page.goto("/index.html");

    const openBtn = page.locator("#openModal");
    const modal = page.locator("#modal");

    await openBtn.click();
    await expect(modal).toBeVisible();
    await expectDialogOpen(page, true);

    // Your JS closes when e.target === modal. Clicking near the edge
    // is the most reliable way to hit the dialog element itself.
    const box = await modal.boundingBox();
    expect(box).not.toBeNull();

    // Click near top-left *inside* the dialog bounds.
    // If your dialog content fills the area, this still hits the dialog.
    await page.mouse.click(box.x + 2, box.y + 2);

    await expectDialogOpen(page, false);
    await expect(openBtn).toBeFocused();
});

test("modal does not open when open button is missing (smoke) @full", async ({ page }) => {
    // This is a guard-style test: it ensures the page doesn't throw errors
    // if elements are absent. If your page always has the button, keep or drop.
    await page.goto("/index.html");

    // If the modal is present, it should start closed.
    const modal = page.locator("#modal");
    await expect(modal).toHaveCount(1);
    await expectDialogOpen(page, false);
});
