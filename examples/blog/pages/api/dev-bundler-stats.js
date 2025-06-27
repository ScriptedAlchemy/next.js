// API endpoint to access enhanced dev bundler service statistics and functionality
export default function handler(req, res) {
  if (req.method === "GET") {
    return handleGetStats(req, res);
  } else if (req.method === "POST") {
    return handlePostAction(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}

function handleGetStats(req, res) {
  try {
    // Check if enhanced dev bundler service API is available
    const ensurePageAPI = global.__NEXT_ENSURE_PAGE_API__;
    const hotReloader = global.__NEXT_DEV_HOT_RELOADER__;
    const bundler = global.__NEXT_DEV_BUNDLER__;
    const bundlerService = global.__NEXT_DEV_BUNDLER_SERVICE__;

    if (!ensurePageAPI) {
      return res.status(503).json({
        success: false,
        error: "Enhanced dev bundler service not available",
        hint: "Make sure you're running in development mode with the dev-bundler-service patch applied",
      });
    }

    const stats = ensurePageAPI.getStats();

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      
      // Enhanced ensurePage API status
      ensurePageAPI: {
        available: true,
        totalHooks: ensurePageAPI.hooks.pre.length + ensurePageAPI.hooks.post.length,
        preHooks: ensurePageAPI.hooks.pre.length,
        postHooks: ensurePageAPI.hooks.post.length,
        stats: stats,
      },
      
      // Global access availability
      globalAccess: {
        hotReloader: !!hotReloader,
        bundler: !!bundler,
        bundlerService: !!bundlerService,
        ensurePageAPI: !!ensurePageAPI,
      },
      
      // Development environment info
      environment: {
        nodeEnv: process.env.NODE_ENV,
        isDevelopment: process.env.NODE_ENV === "development",
        platform: process.platform,
      },
    });
  } catch (error) {
    console.error("[Dev Bundler Stats API] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
}

function handlePostAction(req, res) {
  try {
    const { action, ...params } = req.body;
    const ensurePageAPI = global.__NEXT_ENSURE_PAGE_API__;

    if (!ensurePageAPI) {
      return res.status(503).json({
        success: false,
        error: "Enhanced dev bundler service not available",
      });
    }

    switch (action) {
      case "clear-stats":
        ensurePageAPI.clearStats();
        return res.json({
          success: true,
          action: "clear-stats",
          message: "EnsurePage statistics cleared",
        });

      case "add-pre-hook":
        if (!params.hookName) {
          return res.status(400).json({
            error: "hookName is required for add-pre-hook action",
          });
        }
        
        // Add a sample pre-hook
        const preHook = async (definition, callInfo) => {
          console.log(`[Custom Pre Hook: ${params.hookName}] Page: ${definition.page}`);
        };
        preHook.name = params.hookName;
        
        ensurePageAPI.addPreHook(preHook);
        return res.json({
          success: true,
          action: "add-pre-hook",
          hookName: params.hookName,
          message: "Pre-hook added successfully",
        });

      case "add-post-hook":
        if (!params.hookName) {
          return res.status(400).json({
            error: "hookName is required for add-post-hook action",
          });
        }
        
        // Add a sample post-hook
        const postHook = async (definition, result, callInfo) => {
          console.log(`[Custom Post Hook: ${params.hookName}] Page: ${definition.page}, Duration: ${callInfo.duration}ms`);
        };
        postHook.name = params.hookName;
        
        ensurePageAPI.addPostHook(postHook);
        return res.json({
          success: true,
          action: "add-post-hook",
          hookName: params.hookName,
          message: "Post-hook added successfully",
        });

      case "clear-hooks":
        ensurePageAPI.clearHooks();
        return res.json({
          success: true,
          action: "clear-hooks",
          message: "All hooks cleared",
        });

      case "trigger-ensure-page":
        if (!params.page) {
          return res.status(400).json({
            error: "page is required for trigger-ensure-page action",
          });
        }
        
        // Trigger ensurePage directly
        const definition = {
          page: params.page,
          clientOnly: params.clientOnly || false,
          definition: undefined,
          url: params.url || params.page,
        };
        
        ensurePageAPI.originalEnsurePage(definition)
          .then(() => {
            console.log(`[Dev Bundler Stats API] Successfully triggered ensurePage for: ${params.page}`);
          })
          .catch((error) => {
            console.error(`[Dev Bundler Stats API] Error triggering ensurePage for ${params.page}:`, error);
          });
        
        return res.json({
          success: true,
          action: "trigger-ensure-page",
          page: params.page,
          message: "EnsurePage triggered (check console for results)",
        });

      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`,
          availableActions: [
            "clear-stats",
            "add-pre-hook", 
            "add-post-hook",
            "clear-hooks",
            "trigger-ensure-page"
          ],
        });
    }
  } catch (error) {
    console.error("[Dev Bundler Stats API] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
}