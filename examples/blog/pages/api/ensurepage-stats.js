// API endpoint to check ensurePage hook statistics and functionality
export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check if ensurePage hook is installed
    const hookInstalled = !!global.__ENSUREPAGE_HOOK_INSTALLED__;
    
    // Get hook statistics if available
    let hookStats = null;
    if (global.__ENSUREPAGE_HOOK__) {
      hookStats = global.__ENSUREPAGE_HOOK__.getStats();
    }

    // Check if hot reloader is available
    const hotReloaderAvailable = !!global.__NEXT_DEV_HOT_RELOADER__;
    
    // Check if dev server instance is available
    const devServerAvailable = !!global.__NEXT_DEV_SERVER_INSTANCE__;

    return res.status(200).json({
      success: true,
      ensurePageHook: {
        installed: hookInstalled,
        stats: hookStats,
        working: hookStats && hookStats.totalCalls > 0,
      },
      globalAccess: {
        hotReloader: hotReloaderAvailable,
        devServer: devServerAvailable,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[EnsurePage Stats API] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
}