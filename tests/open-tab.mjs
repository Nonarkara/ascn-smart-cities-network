import { expect } from "@playwright/test";

/** Open a grouped door, then the tab. Phone uses the Menu button. */
export async function openTab(page, tab) {
  const link = page.locator(`#tab-nav a[data-tab="${tab}"]`);
  if (await link.isVisible()) {
    await link.click();
    return;
  }
  const menu = page.locator("#nav-menu");
  if (await menu.isVisible() && (await menu.getAttribute("aria-expanded")) !== "true") {
    await menu.click();
  }
  if (!(await link.isVisible())) {
    const btn = page.locator(`.nav-door:has(a[data-tab="${tab}"]) .nav-door-btn`);
    if (await btn.isVisible()) await btn.click();
  }
  await expect(link).toBeVisible();
  await link.click();
}
