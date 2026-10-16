// Next.js instrumentation hook — runs once when the server boots.
// Fails fast on invalid/missing production configuration instead of
// serving traffic with demo secrets or placeholder keys.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getConfig } = await import("./lib/config");
    const { logger } = await import("./lib/logger");
    const cfg = getConfig(); // throws on invalid config
    logger.info("Configuration validated", {
      nodeEnv: cfg.nodeEnv,
      demoMode: cfg.demoMode,
      biometricMode: cfg.biometricMode,
      keyId: cfg.keyId,
    });
  }
}
