/**
 * Server-side HMR API endpoint
 * Leverages Next.js's built-in HMR infrastructure for development-time hot module replacement
 *
 * @description This API provides programmatic access to Next.js server-side HMR functionality
 * including module hot swapping, cache management, and debugging utilities.
 *
 * @author Next.js Development Team
 * @version 1.1.0
 */

/**
 * Validates request body parameters based on the action type
 * @param {string} action - The HMR action to perform
 * @param {Object} body - The request body
 * @returns {Object|null} Validation error or null if valid
 */
function validateRequestBody(action, body) {
  const { targetPath, virtualChunkPath, modulePath } = body;

  switch (action) {
    case "hot-swap-module":
      if (!targetPath || typeof targetPath !== "string") {
        return {
          error:
            "targetPath is required and must be a string for hot-swap-module",
        };
      }
      if (!virtualChunkPath || typeof virtualChunkPath !== "string") {
        return {
          error:
            "virtualChunkPath is required and must be a string for hot-swap-module",
        };
      }
      break;
    case "clear-module-cache":
      if (!modulePath || typeof modulePath !== "string") {
        return {
          error:
            "modulePath is required and must be a string for clear-module-cache",
        };
      }
      break;
    default:
      // No validation required for other actions
      break;
  }
  return null;
}

/**
 * Main API handler for server HMR operations
 * @param {import('next').NextApiRequest} req - The API request object
 * @param {import('next').NextApiResponse} res - The API response object
 */
export default function handler(req, res) {
  // Method validation
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      allowedMethods: ["POST"],
    });
  }

  // Environment validation
  if (process.env.NODE_ENV !== "development") {
    return res.status(400).json({
      error: "HMR API only available in development",
      currentEnv: process.env.NODE_ENV,
    });
  }

  // Input validation
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({
      error: "Request body is required and must be valid JSON",
    });
  }

  const { action, targetPath, virtualChunkPath, modulePath } = req.body;

  // Action validation
  if (!action || typeof action !== "string") {
    return res.status(400).json({
      error: "Action parameter is required and must be a string",
    });
  }

  // Check if server HMR is available
  if (!global.__NATIVE_SERVER_HMR__) {
    return res.status(500).json({
      error: "Server HMR not initialized",
      suggestion: "Make sure next.config.js is loading server-hmr.js",
      troubleshooting: "Verify that the HMR native module is properly loaded",
    });
  }

  try {
    console.log(
      `[Server HMR API] Processing action: ${action} at ${new Date().toISOString()}`,
    );

    // Validate request body based on action type
    const validationError = validateRequestBody(action, req.body);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    switch (action) {
      case "test":
        return res.json({
          success: true,
          message: "Server HMR API is working",
          availableFunctions: Object.keys(global.__NATIVE_SERVER_HMR__),
          timestamp: new Date().toISOString(),
          version: "1.1.0",
        });

      case "cache-info":
        const cacheInfo = global.__NATIVE_SERVER_HMR__.getCacheInfo();
        return res.json({
          success: true,
          result: cacheInfo,
          timestamp: new Date().toISOString(),
        });

      case "hot-swap-module":
        console.log(
          `[Server HMR API] Hot swapping module: ${targetPath} -> ${virtualChunkPath}`,
        );
        const swapResult = global.__NATIVE_SERVER_HMR__.hotSwapModule(
          targetPath,
          virtualChunkPath,
        );
        return res.json({
          success: swapResult.success,
          result: swapResult,
          timestamp: new Date().toISOString(),
        });

      case "clear-module-cache":
        console.log(
          `[Server HMR API] Clearing module cache for: ${modulePath}`,
        );
        const clearResult =
          global.__NATIVE_SERVER_HMR__.clearModuleCache(modulePath);
        return res.json({
          success: clearResult.success,
          result: clearResult,
          timestamp: new Date().toISOString(),
        });

      case "clear-all-pages":
        console.log(`[Server HMR API] Clearing all page caches`);
        const clearAllResult = global.__NATIVE_SERVER_HMR__.clearAllPages();
        return res.json({
          success: clearAllResult.success,
          result: clearAllResult,
          timestamp: new Date().toISOString(),
        });

      case "safe-reset":
        console.log(`[Server HMR API] Performing safe reset`);
        const resetResult = global.__NATIVE_SERVER_HMR__.safeReset();
        return res.json({
          success: resetResult.success,
          result: resetResult,
          timestamp: new Date().toISOString(),
        });

      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`,
          availableActions: [
            "test",
            "cache-info",
            "hot-swap-module",
            "clear-module-cache",
            "clear-all-pages",
            "safe-reset",
          ],
          documentation: "See API documentation for usage examples",
        });
    }
  } catch (error) {
    console.error("[Server HMR API] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      action: action,
      timestamp: new Date().toISOString(),
    });
  }
}
