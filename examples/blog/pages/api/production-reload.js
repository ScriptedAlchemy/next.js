// Production-safe reload API endpoint
// Uses process management for graceful reload in production

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, secret } = req.body;

  // In production, require a secret for security
  if (process.env.NODE_ENV === "production") {
    const expectedSecret = process.env.RELOAD_SECRET || process.env.API_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      return res.status(401).json({ 
        error: "Unauthorized", 
        message: "Valid secret required in production" 
      });
    }
  }

  try {
    console.log(`[Production Reload API] Processing action: ${action}`);

    switch (action) {
      case "test":
        return res.json({
          success: true,
          message: "Production reload API is working",
          environment: process.env.NODE_ENV,
          method: "process-based-reload",
          timestamp: new Date().toISOString(),
        });

      case "reload-info":
        return res.json({
          success: true,
          info: {
            environment: process.env.NODE_ENV,
            processId: process.pid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version,
            platform: process.platform,
            cwd: process.cwd(),
            productionReloadAvailable: true,
          }
        });

      case "graceful-reload":
        // In production, the best approach is to trigger a graceful restart
        // This would typically be handled by your process manager (PM2, systemd, etc.)
        
        if (process.env.NODE_ENV === "production") {
          // Schedule a graceful shutdown
          console.log('[Production Reload] Scheduling graceful reload...');
          
          // Send response before shutting down
          res.json({
            success: true,
            message: "Graceful reload scheduled",
            processId: process.pid,
            method: "process-exit-restart"
          });

          // Give time for response to be sent
          setTimeout(() => {
            console.log('[Production Reload] Exiting process for restart...');
            // Process manager (PM2, Docker, K8s) will restart the app
            process.exit(0);
          }, 1000);

          return;
        } else {
          // In development, use the HMR mechanism
          if (global.__NATIVE_SERVER_HMR__ && global.__NATIVE_SERVER_HMR__.reloadAll) {
            const result = global.__NATIVE_SERVER_HMR__.reloadAll();
            return res.json({
              success: true,
              result,
              environment: "development",
              message: "Development HMR reload completed"
            });
          } else {
            return res.json({
              success: false,
              error: "HMR not available in development",
              environment: "development"
            });
          }
        }

      case "memory-cleanup":
        // Production-safe memory cleanup
        try {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
            console.log('[Production Reload] Forced garbage collection');
          }

          // Clear non-critical caches
          const beforeMemory = process.memoryUsage();
          
          // Clear module caches for non-critical modules
          const cacheKeys = Object.keys(require.cache);
          let cleared = 0;
          
          for (const key of cacheKeys) {
            // Only clear user modules, not node_modules or Next.js internals
            if (key.includes('/pages/') || key.includes('/components/') || key.includes('/lib/')) {
              if (!key.includes('node_modules') && !key.includes('.next')) {
                try {
                  delete require.cache[key];
                  cleared++;
                } catch (e) {
                  // Some modules might not be clearable
                }
              }
            }
          }

          const afterMemory = process.memoryUsage();

          return res.json({
            success: true,
            message: "Memory cleanup completed",
            modulesCleared: cleared,
            memoryBefore: beforeMemory,
            memoryAfter: afterMemory,
            memorySaved: {
              heapUsed: beforeMemory.heapUsed - afterMemory.heapUsed,
              external: beforeMemory.external - afterMemory.external,
            }
          });
        } catch (error) {
          return res.json({
            success: false,
            error: "Memory cleanup failed",
            message: error.message
          });
        }

      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`,
          availableActions: [
            "test",
            "reload-info",
            "graceful-reload",
            "memory-cleanup"
          ],
          note: "In production, use graceful-reload with proper secret"
        });
    }
  } catch (error) {
    console.error("[Production Reload API] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}

module.exports = handler;
module.exports.default = handler;