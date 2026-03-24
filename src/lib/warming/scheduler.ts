import cron from "node-cron";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "dev-cron-secret";

async function triggerCron(path: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    const res = await fetch(`${APP_URL}${path}`, {
      method: "POST",
      headers: {
        "x-cron-secret": CRON_SECRET,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`Cron ${path} failed: ${res.status}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`Cron ${path} timed out after 120s`);
    } else {
      console.error(`Cron ${path} error:`, err);
    }
  }
}

export function initScheduler(): void {
  console.log("Initializing warming scheduler...");

  // Main warming loop: every 10 minutes during 6am-10pm UTC
  cron.schedule("*/10 6-22 * * *", () => {
    console.log("[Cron] Running warming batch...");
    triggerCron("/api/cron/warming");
  });

  // Content pool refill: every 2 hours
  cron.schedule("0 */2 * * *", () => {
    console.log("[Cron] Refilling content pool...");
    triggerCron("/api/cron/generate-content");
  });

  // Daily stats aggregation: midnight UTC
  cron.schedule("0 0 * * *", () => {
    console.log("[Cron] Aggregating daily stats...");
    triggerCron("/api/cron/aggregate-stats");
  });

  // Webmail engagement: every 20 minutes during 6am-10pm UTC
  cron.schedule("*/20 6-22 * * *", () => {
    console.log("[Cron] Running webmail engagement check...");
    triggerCron("/api/cron/webmail-engagement");
  });

  console.log("Warming scheduler initialized with 4 cron jobs.");
}
