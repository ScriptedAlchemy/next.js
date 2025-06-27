// Efficient HMR API endpoint - Uses existing hot reloader instance
// This approach reuses the existing compiler instead of creating a new one

console.log("[Efficient HMR API] Loading efficient HMR API...");
const EfficientHMRAPI = require("../../lib/efficient-hmr-api");

// Singleton instance
let efficientHMRInstance = null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.NODE_ENV !== "development") {
    return res
      .status(400)
      .json({ error: "Efficient HMR only available in development" });
  }

  const { action, pagePath, forceReload, customAction, customData, modules, searchString, replaceString } =
    req.body;

  try {
    console.log(`[Efficient HMR API] Processing action: ${action}`);

    switch (action) {
      case "test":
        return res.json({
          success: true,
          message: "Efficient HMR API is working",
          method: "existing-instance-patch",
          approach: "memory-efficient",
          availableActions: [
            "test",
            "initialize",
            "trigger-hmr",
            "status",
            "send-message",
            "invalidate",
          ],
          timestamp: new Date().toISOString(),
        });

      case "initialize":
        return await initializeEfficientAPI(res);

      case "status":
        const status = getEfficientAPIStatus();
        return res.json({
          success: true,
          status,
        });

      case "trigger-hmr":
        if (!pagePath) {
          return res.status(400).json({
            error: "pagePath is required for trigger-hmr action",
          });
        }
        return await triggerEfficientHMR(pagePath, forceReload || false, res, searchString, replaceString);

      case "send-message":
        if (!customAction) {
          return res.status(400).json({
            error: "customAction is required for send-message action",
          });
        }
        return await sendCustomHMRMessage(customAction, customData, res);

      case "invalidate":
        return await invalidateModules(modules || [], res);

      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`,
          availableActions: [
            "test",
            "initialize",
            "trigger-hmr",
            "status",
            "send-message",
            "invalidate",
          ],
        });
    }
  } catch (error) {
    console.error("[Efficient HMR API] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      method: "efficient-hmr",
    });
  }
}

async function initializeEfficientAPI(res) {
  try {
    console.log("[Efficient HMR API] Initializing efficient HMR API...");

    if (!efficientHMRInstance) {
      efficientHMRInstance = new EfficientHMRAPI();
    }

    const success = await efficientHMRInstance.initialize();

    if (success) {
      const status = efficientHMRInstance.getStatus();
      return res.json({
        success: true,
        message: "Efficient HMR API initialized successfully",
        status,
        approach: "existing-instance-reuse",
        performance: {
          memoryEfficient: true,
          noNewCompiler: true,
          reusesExistingInstance: true,
        },
      });
    } else {
      return res.status(503).json({
        success: false,
        error: "Efficient HMR API initialization failed",
        reason: "Could not access existing hot reloader instance",
        suggestions: [
          "Make sure Next.js dev server is fully started",
          "Patches may need time to capture the hot reloader instance",
          "Try again in a few seconds",
        ],
      });
    }
  } catch (error) {
    console.error("[Efficient HMR API] Initialization error:", error);
    return res.status(500).json({
      success: false,
      error: "Initialization failed",
      message: error.message,
    });
  }
}

function getEfficientAPIStatus() {
  if (!efficientHMRInstance) {
    return {
      instanceExists: false,
      initialized: false,
      message: "Efficient HMR API not yet created",
    };
  }

  const status = efficientHMRInstance.getStatus();
  return {
    instanceExists: true,
    ...status,
    availableMethods: efficientHMRInstance.isAvailable()
      ? ["triggerHMR", "sendHMRMessage", "invalidateModules", "getStatus"]
      : ["initialize"],
    memoryComparison: {
      efficientApproach: "Reuses existing compiler (0 additional memory)",
      setupDevBundlerApproach: "Creates new compiler (~50-100MB additional)",
      fileBasedApproach: "No compiler needed (minimal memory)",
    },
  };
}

async function triggerEfficientHMR(pagePath, forceReload, res, searchString, replaceString) {
  try {
    if (!efficientHMRInstance) {
      console.log("[Efficient HMR API] Instance not found, auto-initializing...");
      efficientHMRInstance = new EfficientHMRAPI();
      const success = await efficientHMRInstance.initialize();
      if (!success) {
        return res.status(400).json({
          success: false,
          error: "Efficient HMR API not initialized and auto-initialization failed",
          suggestion: "Call initialize action first or check if hot reloader is available",
        });
      }
    }

    if (!efficientHMRInstance.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: "Efficient HMR API not available",
        status: efficientHMRInstance.getStatus(),
        suggestion:
          "Initialization may have failed or hot reloader not accessible",
      });
    }

    console.log(
      `[Efficient HMR API] Triggering efficient HMR for: ${pagePath}`,
    );
    const result = await efficientHMRInstance.triggerHMR(pagePath, forceReload, searchString, replaceString);

    return res.json({
      success: true,
      method: "efficient-hmr",
      result,
      performance: {
        approach: "existing-instance-reuse",
        memoryFootprint: "minimal",
        compilationOverhead: "none",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      `[Efficient HMR API] Error triggering HMR for ${pagePath}:`,
      error,
    );
    return res.status(500).json({
      success: false,
      error: "HMR trigger failed",
      message: error.message,
      pagePath,
      forceReload,
    });
  }
}

async function sendCustomHMRMessage(action, data, res) {
  try {
    if (!efficientHMRInstance || !efficientHMRInstance.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: "Efficient HMR API not available",
      });
    }

    const result = await efficientHMRInstance.sendHMRMessage(action, data);

    return res.json({
      success: true,
      method: "efficient-hmr-message",
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Efficient HMR API] Error sending custom message:", error);
    return res.status(500).json({
      success: false,
      error: "Custom HMR message failed",
      message: error.message,
      action,
      data,
    });
  }
}

async function invalidateModules(modules, res) {
  try {
    if (!efficientHMRInstance || !efficientHMRInstance.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: "Efficient HMR API not available",
      });
    }

    const result = await efficientHMRInstance.invalidateModules(modules);

    return res.json({
      success: true,
      method: "efficient-hmr-invalidate",
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Efficient HMR API] Error invalidating modules:", error);
    return res.status(500).json({
      success: false,
      error: "Module invalidation failed",
      message: error.message,
      modules,
    });
  }
}

// Cleanup on process exit
process.on("beforeExit", () => {
  if (efficientHMRInstance) {
    console.log("[Efficient HMR API] Process exiting, cleaning up...");
  }
});
