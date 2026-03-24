export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureEncryptionKey } = await import("./lib/encryption");
    await ensureEncryptionKey();

    const { initScheduler } = await import("./lib/warming/scheduler");
    initScheduler();
  }
}
