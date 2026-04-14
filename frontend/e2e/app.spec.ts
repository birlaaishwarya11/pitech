import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORDERS_FILE = path.resolve(__dirname, "../../Orders Jan 14 2026.csv");
const ASSETS_FILE = path.resolve(
  __dirname,
  "../../Asset List with Capacity (as of 1.28.26).csv"
);
const hasRealData = fs.existsSync(ORDERS_FILE) && fs.existsSync(ASSETS_FILE);

// ─── Page load & layout ──────────────────────────────────────────────────
test.describe("Page load", () => {
  test("shows page title and upload section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Delivery Route Planner")).toBeVisible();
    await expect(page.locator("text=Upload Files")).toBeVisible();
    await expect(page.locator("text=Orders file")).toBeVisible();
    await expect(page.locator("text=Assets file")).toBeVisible();
  });

  test("backend status resolves to connected", async ({ page }) => {
    await page.goto("/");
    // Status starts as "checking", should resolve to "connected"
    await expect(page.locator("text=connected")).toBeVisible({
      timeout: 15_000,
    });
  });
});

// ─── Schedule controls ──────────────────────────────────────────────────
test.describe("Schedule controls", () => {
  test("depot time inputs exist with correct defaults", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Depot opens")).toBeVisible();
    await expect(page.locator("text=Depot closes")).toBeVisible();
  });

  test("wave toggle defaults to 2 and can switch to 1", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Wave 2 cutoff")).toBeVisible();
    await page.locator("button", { hasText: "1 wave" }).click();
    await expect(page.locator("text=Wave 2 cutoff")).not.toBeVisible();
  });
});

// ─── Special Instructions UI ─────────────────────────────────────────────
test.describe("Special Instructions", () => {
  test("all 5 accordion sections visible", async ({ page }) => {
    await page.goto("/");
    for (const label of [
      "Skip orders",
      "Assign to truck",
      "Deliver first",
      "Override time window",
      "Delivery notes",
    ]) {
      await expect(page.locator(`text=${label}`)).toBeVisible();
    }
  });

  test("can add and remove skip entries", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=Skip orders").click();
    await page.locator("text=Add skip").click();
    await page.locator("text=Add skip").click();
    const inputs = page.locator('input[placeholder="e.g. 977187"]');
    expect(await inputs.count()).toBe(2);

    // Fill first, then remove it via the X button
    await inputs.first().fill("12345");
    const row = inputs.first().locator("..");
    await row.locator("button").click();
    expect(await inputs.count()).toBe(1);
  });

  test("can add lock entry with name and truck", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=Assign to truck").click();
    await page.locator("text=Add assignment").click();
    await page.locator('input[placeholder="Stop name"]').first().fill("POTS");
    await page.locator('input[placeholder="Truck"]').first().fill("FB-1");
    await expect(
      page.locator('input[placeholder="Stop name"]').first()
    ).toHaveValue("POTS");
    await expect(
      page.locator('input[placeholder="Truck"]').first()
    ).toHaveValue("FB-1");
  });

  test("can toggle to raw text mode and back", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=Raw text").click();
    await expect(page.locator("textarea")).toBeVisible();
    await page.locator("text=Guided").click();
    await expect(page.locator("text=Skip orders")).toBeVisible();
  });
});

// ─── Generate button state ───────────────────────────────────────────────
test.describe("Generate button", () => {
  test("disabled without files uploaded", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator("button", { hasText: /Generate Routes/i });
    await expect(btn).toBeDisabled();
  });
});

// ─── Full optimization flow (requires real data) ─────────────────────────
test.describe("Full optimization flow", () => {
  test.skip(!hasRealData, "Real data files not available");

  test("upload, optimize, and view results", async ({ page }) => {
    test.setTimeout(300_000); // solver can take minutes

    await page.goto("/");

    // Upload both files
    await page.locator('input[type="file"]').first().setInputFiles(ORDERS_FILE);
    await page
      .locator('input[type="file"]')
      .nth(1)
      .setInputFiles(ASSETS_FILE);

    // Generate should be enabled now
    const btn = page.locator("button", { hasText: /Generate Routes/i });
    await expect(btn).toBeEnabled();
    await btn.click();

    // Should show loading state
    await expect(
      page.locator("text=Optimizing routes")
    ).toBeVisible({ timeout: 10_000 });

    // Wait for route map (solver + matrix can take a while)
    await expect(page.locator("text=Route map")).toBeVisible({
      timeout: 300_000,
    });

    // Results should show
    await expect(page.locator("text=Route plan ready")).toBeVisible();
    await expect(
      page.locator("button", { hasText: "Download Route Plan" })
    ).toBeVisible();

    // Fleet summary should appear
    await expect(page.locator("text=Fleet summary")).toBeVisible();
    await expect(page.locator("text=Trucks used")).toBeVisible();

    // Route summary table should be present
    await expect(page.locator("text=Route Summary")).toBeVisible();
  });
});

// ─── Error handling ──────────────────────────────────────────────────────
test.describe("Error handling", () => {
  test("shows error for invalid CSV", async ({ page }) => {
    test.setTimeout(30_000);

    await page.goto("/");

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "bad.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("this,is,not,valid\n1,2,3,4"),
      });
    await page
      .locator('input[type="file"]')
      .nth(1)
      .setInputFiles({
        name: "bad_assets.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("also,invalid\nx,y"),
      });

    await page.locator("button", { hasText: /Generate Routes/i }).click();

    // Should show error — could be a toast or inline message
    await expect(
      page.locator('[data-sonner-toast][data-type="error"], text=/failed|error/i').first()
    ).toBeVisible({ timeout: 20_000 });
  });
});
