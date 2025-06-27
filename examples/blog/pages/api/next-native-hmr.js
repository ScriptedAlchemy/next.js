// Next.js Native HMR API - Comprehensive endpoint using all available Next.js internals
// Leverages dev server, hot reloader, bundler service, and all native APIs

const path = require("path");
const fs = require("fs").promises;

// Import all available Next.js internal APIs
let deleteCache, deleteFromRequireCache;
try {
  const requireCacheModule = require("next/dist/server/dev/require-cache");
  deleteCache = requireCacheModule.deleteCache;
  deleteFromRequireCache = requireCacheModule.deleteFromRequireCache;
} catch (error) {
  console.warn("[Next Native HMR] Require cache API not available");
}

// Removed problematic imports that were causing JSON parse errors
// let HMR_ACTIONS_SENT_TO_BROWSER;
// let setupDevBundler;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.NODE_ENV !== "development") {
    return res.status(400).json({ 
      error: "Next.js Native HMR only available in development" 
    });
  }

  const body = req.body;

  const { 
    action, 
    pagePath, 
    searchString, 
    replaceString, 
    forceReload,
    customEvent,
    modules,
    enableHooks,
    resetType 
  } = body;

  try {
    console.log(`[Next Native HMR API] Processing action: ${action}`);

    switch (action) {
      case "test":
        return await handleTest(res);

      case "status":
        return await handleStatus(res);

      case "comprehensive-hmr":
        return await handleComprehensiveHMR(pagePath, searchString, replaceString, forceReload, res);

      case "dev-server-info":
        return await handleDevServerInfo(res);

      case "hot-reloader-info":
        return await handleHotReloaderInfo(res);

      case "bundler-service-info":
        return await handleBundlerServiceInfo(res);

      case "native-cache-operations":
        return await handleNativeCacheOperations(modules, resetType, res);

      case "websocket-broadcast":
        return await handleWebSocketBroadcast(customEvent, res);

      case "compilation-hooks":
        return await handleCompilationHooks(enableHooks, res);

      case "ensure-page-enhanced":
        return await handleEnsurePageEnhanced(pagePath, res);

      case "invalidate-advanced":
        return await handleInvalidateAdvanced(pagePath, modules, res);

      case "performance-metrics":
        return await handlePerformanceMetrics(res);

      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`,
          availableActions: [
            "test", "status", "comprehensive-hmr", "dev-server-info",
            "hot-reloader-info", "bundler-service-info", "native-cache-operations",
            "websocket-broadcast", "compilation-hooks", "ensure-page-enhanced",
            "invalidate-advanced", "performance-metrics"
          ],
        });
    }
  } catch (error) {
    console.error("[Next Native HMR API] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      method: "next-native-hmr",
    });
  }
}

async function handleTest(res) {
  return res.json({
    success: true,
    message: "Next.js Native HMR API is working",
    method: "comprehensive-next-js-internals",
    availableAPIs: {
      deleteCache: !!deleteCache,
      deleteFromRequireCache: !!deleteFromRequireCache,
      hmrActions: false,
      setupDevBundler: false,
      devServer: !!global.__NEXT_DEV_SERVER_INSTANCE__,
      hotReloader: !!global.__NEXT_DEV_HOT_RELOADER__,
      ensurePageAPI: !!global.__NEXT_ENSURE_PAGE_API__,
      nativeServerHMR: !!global.__NATIVE_SERVER_HMR__,
    },
    availableActions: [
      "test", "status", "comprehensive-hmr", "dev-server-info",
      "hot-reloader-info", "bundler-service-info", "native-cache-operations",
      "websocket-broadcast", "compilation-hooks", "ensure-page-enhanced",
      "invalidate-advanced", "performance-metrics"
    ],
    timestamp: new Date().toISOString(),
  });
}

async function handleStatus(res) {
  const devServer = global.__NEXT_DEV_SERVER_INSTANCE__;
  const hotReloader = global.__NEXT_DEV_HOT_RELOADER__;
  const ensurePageAPI = global.__NEXT_ENSURE_PAGE_API__;
  const nativeServerHMR = global.__NATIVE_SERVER_HMR__;

  return res.json({
    success: true,
    status: {
      devServer: {
        available: !!devServer,
        buildId: devServer?.getBuildId?.() || null,
        pagesDir: devServer?.pagesDir || null,
        appDir: devServer?.appDir || null,
        distDir: devServer?.distDir || null,
        hasServerComponentsHmrCache: !!devServer?.serverComponentsHmrCache,
      },
      hotReloader: {
        available: !!hotReloader,
        hasActiveConfigs: !!(hotReloader?.activeWebpackConfigs?.length),
        hasTurbopackProject: !!hotReloader?.turbopackProject,
        hasHotMiddleware: !!hotReloader?.hotMiddleware,
      },
      ensurePageAPI: {
        available: !!ensurePageAPI,
        totalCalls: ensurePageAPI?.calls?.length || 0,
        hasHooks: !!(ensurePageAPI?.hooks?.pre?.length || ensurePageAPI?.hooks?.post?.length),
        stats: ensurePageAPI?.getStats?.() || null,
      },
      nativeServerHMR: {
        available: !!nativeServerHMR,
        methods: nativeServerHMR ? Object.keys(nativeServerHMR) : [],
      },
      nativeAPIs: {
        deleteCache: !!deleteCache,
        deleteFromRequireCache: !!deleteFromRequireCache,
        hmrActions: [],
        setupDevBundler: false,
      },
    },
  });
}

async function handleComprehensiveHMR(pagePath, searchString, replaceString, forceReload, res) {
  if (!pagePath) {
    return res.status(400).json({
      error: "pagePath is required for comprehensive-hmr action",
    });
  }

  const results = {
    pagePath,
    searchString: searchString || (pagePath === "/_document" ? "PLACEHOLDER" : "PAGE_HMR_AREA"),
    replaceString: replaceString || "COMPREHENSIVE HMR SUCCESS!!",
    forceReload: !!forceReload,
    steps: [],
  };

  try {
    // Step 1: File modification using native file operations
    console.log("[Next Native HMR] Step 1: File modification");
    const fileResult = await performFileModification(pagePath, results.searchString, results.replaceString);
    results.steps.push({ step: "file-modification", success: fileResult.success, details: fileResult });

    // Step 2: Native cache invalidation using all available APIs
    console.log("[Next Native HMR] Step 2: Native cache invalidation");
    const cacheResult = await performNativeCacheInvalidation(pagePath);
    results.steps.push({ step: "native-cache-invalidation", success: cacheResult.success, details: cacheResult });

    // Step 3: Dev server integration
    console.log("[Next Native HMR] Step 3: Dev server integration");
    const devServerResult = await performDevServerIntegration(pagePath);
    results.steps.push({ step: "dev-server-integration", success: devServerResult.success, details: devServerResult });

    // Step 4: Hot reloader operations
    console.log("[Next Native HMR] Step 4: Hot reloader operations");
    const hotReloaderResult = await performHotReloaderOperations(pagePath, forceReload);
    results.steps.push({ step: "hot-reloader-operations", success: hotReloaderResult.success, details: hotReloaderResult });

    // Step 5: Enhanced ensure page with hooks
    console.log("[Next Native HMR] Step 5: Enhanced ensure page");
    const ensurePageResult = await performEnhancedEnsurePage(pagePath);
    results.steps.push({ step: "enhanced-ensure-page", success: ensurePageResult.success, details: ensurePageResult });

    // Step 6: WebSocket broadcasting
    console.log("[Next Native HMR] Step 6: WebSocket broadcasting");
    const websocketResult = await performWebSocketBroadcasting(pagePath, forceReload);
    results.steps.push({ step: "websocket-broadcasting", success: websocketResult.success, details: websocketResult });

    const overallSuccess = results.steps.every(step => step.success);

    return res.json({
      success: overallSuccess,
      method: "comprehensive-next-native-hmr",
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[Next Native HMR] Comprehensive HMR error:", error);
    return res.status(500).json({
      success: false,
      error: "Comprehensive HMR failed",
      message: error.message,
      results,
    });
  }
}

async function handleDevServerInfo(res) {
  const devServer = global.__NEXT_DEV_SERVER_INSTANCE__;
  
  if (!devServer) {
    return res.json({
      success: false,
      error: "Dev server instance not available",
    });
  }

  const info = {
    buildId: devServer.getBuildId?.(),
    pagesDir: devServer.pagesDir,
    appDir: devServer.appDir,
    distDir: devServer.distDir,
    hasPage: typeof devServer.hasPage === 'function',
    hasEnsurePage: typeof devServer.ensurePage === 'function',
    hasFindPageComponents: typeof devServer.findPageComponents === 'function',
    hasGetCompilationError: typeof devServer.getCompilationError === 'function',
    hasHandleRequest: typeof devServer.handleRequest === 'function',
    hasGetRouteMatchers: typeof devServer.getRouteMatchers === 'function',
    bundlerService: {
      available: !!devServer.bundlerService,
      methods: devServer.bundlerService ? Object.getOwnPropertyNames(devServer.bundlerService) : [],
    },
    nextConfig: {
      available: !!devServer.nextConfig,
      experimental: devServer.nextConfig?.experimental ? Object.keys(devServer.nextConfig.experimental) : [],
    },
  };

  return res.json({
    success: true,
    devServerInfo: info,
  });
}

async function handleHotReloaderInfo(res) {
  const hotReloader = global.__NEXT_DEV_HOT_RELOADER__;
  
  if (!hotReloader) {
    return res.json({
      success: false,
      error: "Hot reloader instance not available",
    });
  }

  const info = {
    activeWebpackConfigs: hotReloader.activeWebpackConfigs?.length || 0,
    hasTurbopackProject: !!hotReloader.turbopackProject,
    hasHotMiddleware: !!hotReloader.hotMiddleware,
    availableMethods: Object.getOwnPropertyNames(hotReloader).filter(name => 
      typeof hotReloader[name] === 'function'
    ),
    hotMiddleware: {
      available: !!hotReloader.hotMiddleware,
      hasPublish: !!(hotReloader.hotMiddleware?.publish),
      hasOnHMR: !!(hotReloader.hotMiddleware?.onHMR),
      hasClose: !!(hotReloader.hotMiddleware?.close),
    },
  };

  return res.json({
    success: true,
    hotReloaderInfo: info,
  });
}

async function handleBundlerServiceInfo(res) {
  const devServer = global.__NEXT_DEV_SERVER_INSTANCE__;
  const bundlerService = devServer?.bundlerService;
  
  if (!bundlerService) {
    return res.json({
      success: false,
      error: "Bundler service not available",
    });
  }

  const info = {
    availableMethods: Object.getOwnPropertyNames(bundlerService).filter(name => 
      typeof bundlerService[name] === 'function'
    ),
    properties: Object.getOwnPropertyNames(bundlerService).filter(name => 
      typeof bundlerService[name] !== 'function'
    ),
  };

  return res.json({
    success: true,
    bundlerServiceInfo: info,
  });
}

async function handleNativeCacheOperations(modules, resetType, res) {
  const results = {
    operations: [],
    totalCleared: 0,
    totalPreserved: 0,
  };

  // Native deleteCache operations
  if (deleteCache && modules?.length) {
    for (const modulePath of modules) {
      try {
        deleteCache(modulePath);
        results.operations.push({ 
          operation: "deleteCache", 
          module: modulePath, 
          success: true 
        });
        results.totalCleared++;
      } catch (error) {
        results.operations.push({ 
          operation: "deleteCache", 
          module: modulePath, 
          success: false, 
          error: error.message 
        });
      }
    }
  }

  // Native deleteFromRequireCache operations
  if (deleteFromRequireCache && modules?.length) {
    for (const modulePath of modules) {
      try {
        deleteFromRequireCache(modulePath);
        results.operations.push({ 
          operation: "deleteFromRequireCache", 
          module: modulePath, 
          success: true 
        });
        results.totalCleared++;
      } catch (error) {
        results.operations.push({ 
          operation: "deleteFromRequireCache", 
          module: modulePath, 
          success: false, 
          error: error.message 
        });
      }
    }
  }

  // Native server HMR operations
  if (global.__NATIVE_SERVER_HMR__) {
    if (resetType === "safe-reset") {
      try {
        const resetResult = global.__NATIVE_SERVER_HMR__.safeReset();
        results.operations.push({ 
          operation: "native-safe-reset", 
          success: resetResult.success, 
          details: resetResult 
        });
        results.totalCleared += resetResult.cleared || 0;
        results.totalPreserved += resetResult.preserved || 0;
      } catch (error) {
        results.operations.push({ 
          operation: "native-safe-reset", 
          success: false, 
          error: error.message 
        });
      }
    } else if (resetType === "clear-all") {
      try {
        const clearResult = global.__NATIVE_SERVER_HMR__.clearAllPages();
        results.operations.push({ 
          operation: "native-clear-all-pages", 
          success: clearResult.success, 
          details: clearResult 
        });
        results.totalCleared += clearResult.cleared || 0;
      } catch (error) {
        results.operations.push({ 
          operation: "native-clear-all-pages", 
          success: false, 
          error: error.message 
        });
      }
    }
  }

  return res.json({
    success: true,
    nativeCacheOperations: results,
  });
}

async function handleWebSocketBroadcast(customEvent, res) {
  const hotReloader = global.__NEXT_DEV_HOT_RELOADER__;
  const results = [];

  // Default event if none provided
  const event = customEvent || {
    action: "sync",
    data: "Next.js Native HMR test broadcast",
    timestamp: Date.now(),
  };

  // Hot reloader send
  if (hotReloader?.send) {
    try {
      hotReloader.send(event);
      results.push({ method: "hot-reloader-send", success: true });
    } catch (error) {
      results.push({ method: "hot-reloader-send", success: false, error: error.message });
    }
  }

  // Hot middleware publish
  if (hotReloader?.hotMiddleware?.publish) {
    try {
      hotReloader.hotMiddleware.publish(event);
      results.push({ method: "hot-middleware-publish", success: true });
    } catch (error) {
      results.push({ method: "hot-middleware-publish", success: false, error: error.message });
    }
  }

  return res.json({
    success: results.some(r => r.success),
    websocketBroadcast: {
      event,
      results,
      channelsUsed: results.length,
    },
  });
}

async function handleCompilationHooks(enableHooks, res) {
  const ensurePageAPI = global.__NEXT_ENSURE_PAGE_API__;
  
  if (!ensurePageAPI) {
    return res.json({
      success: false,
      error: "Enhanced ensure page API not available",
    });
  }

  if (enableHooks) {
    // Add pre and post hooks
    ensurePageAPI.addPreHook((definition) => {
      console.log(`[Pre Hook] Ensuring page: ${definition.page}`);
    });

    ensurePageAPI.addPostHook((definition, result, duration) => {
      console.log(`[Post Hook] Page ensured: ${definition.page} (${duration}ms)`);
    });
  } else {
    ensurePageAPI.clearHooks();
  }

  const stats = ensurePageAPI.getStats();

  return res.json({
    success: true,
    compilationHooks: {
      enabled: enableHooks,
      stats,
      totalCalls: ensurePageAPI.calls?.length || 0,
      preHooks: ensurePageAPI.hooks?.pre?.length || 0,
      postHooks: ensurePageAPI.hooks?.post?.length || 0,
    },
  });
}

async function handleEnsurePageEnhanced(pagePath, res) {
  if (!pagePath) {
    return res.status(400).json({
      error: "pagePath is required for ensure-page-enhanced action",
    });
  }

  const results = [];
  
  // Hot reloader ensure page
  const hotReloader = global.__NEXT_DEV_HOT_RELOADER__;
  if (hotReloader?.ensurePage) {
    try {
      await hotReloader.ensurePage({ 
        page: pagePath, 
        clientOnly: false,
        url: pagePath 
      });
      results.push({ method: "hot-reloader-ensure-page", success: true });
    } catch (error) {
      results.push({ method: "hot-reloader-ensure-page", success: false, error: error.message });
    }
  }

  // Dev server ensure page
  const devServer = global.__NEXT_DEV_SERVER_INSTANCE__;
  if (devServer?.ensurePage) {
    try {
      await devServer.ensurePage({ pathname: pagePath });
      results.push({ method: "dev-server-ensure-page", success: true });
    } catch (error) {
      results.push({ method: "dev-server-ensure-page", success: false, error: error.message });
    }
  }

  // Enhanced ensure page API
  const ensurePageAPI = global.__NEXT_ENSURE_PAGE_API__;
  if (ensurePageAPI?.originalEnsurePage) {
    try {
      await ensurePageAPI.originalEnsurePage({ page: pagePath });
      results.push({ method: "enhanced-ensure-page-api", success: true });
    } catch (error) {
      results.push({ method: "enhanced-ensure-page-api", success: false, error: error.message });
    }
  }

  // Native server HMR ensure page
  if (global.__NATIVE_SERVER_HMR__?.ensurePage) {
    try {
      const result = await global.__NATIVE_SERVER_HMR__.ensurePage(pagePath);
      results.push({ method: "native-server-hmr-ensure-page", success: result.success, details: result });
    } catch (error) {
      results.push({ method: "native-server-hmr-ensure-page", success: false, error: error.message });
    }
  }

  return res.json({
    success: results.some(r => r.success),
    ensurePageEnhanced: {
      pagePath,
      results,
      methodsUsed: results.length,
    },
  });
}

async function handleInvalidateAdvanced(pagePath, modules, res) {
  const results = [];

  // Hot reloader invalidate
  const hotReloader = global.__NEXT_DEV_HOT_RELOADER__;
  if (hotReloader?.invalidate) {
    try {
      await hotReloader.invalidate({ reloadAfterInvalidation: false });
      results.push({ method: "hot-reloader-invalidate", success: true });
    } catch (error) {
      results.push({ method: "hot-reloader-invalidate", success: false, error: error.message });
    }
  }

  // Page-specific invalidation
  if (pagePath && global.__NATIVE_SERVER_HMR__?.invalidatePage) {
    try {
      const result = await global.__NATIVE_SERVER_HMR__.invalidatePage(pagePath);
      results.push({ method: "native-invalidate-page", success: result.success, details: result });
    } catch (error) {
      results.push({ method: "native-invalidate-page", success: false, error: error.message });
    }
  }

  // Module-specific invalidation
  if (modules?.length) {
    for (const modulePath of modules) {
      if (global.__NATIVE_SERVER_HMR__?.invalidateModule) {
        try {
          const result = global.__NATIVE_SERVER_HMR__.invalidateModule(modulePath);
          results.push({ 
            method: "native-invalidate-module", 
            module: modulePath,
            success: result.success, 
            details: result 
          });
        } catch (error) {
          results.push({ 
            method: "native-invalidate-module", 
            module: modulePath,
            success: false, 
            error: error.message 
          });
        }
      }
    }
  }

  return res.json({
    success: results.some(r => r.success),
    invalidateAdvanced: {
      pagePath,
      modules,
      results,
      operationsPerformed: results.length,
    },
  });
}

async function handlePerformanceMetrics(res) {
  const ensurePageAPI = global.__NEXT_ENSURE_PAGE_API__;
  const cacheKeys = Object.keys(require.cache);
  
  return res.json({
    success: true,
    performanceMetrics: {
      ensurePageStats: ensurePageAPI?.getStats?.() || null,
      cacheMetrics: {
        totalModules: cacheKeys.length,
        userModules: cacheKeys.filter(key => 
          key.includes('/pages/') || key.includes('/lib/') || key.includes('/components/')
        ).length,
        nextModules: cacheKeys.filter(key => 
          key.includes('node_modules/next/')
        ).length,
      },
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: Date.now(),
    },
  });
}

// Helper functions for comprehensive HMR
async function performFileModification(pagePath, searchString, replaceString) {
  try {
    const serverFilePath = resolveServerFilePath(pagePath);
    const originalContent = await fs.readFile(serverFilePath, "utf8");
    const updatedContent = originalContent.replace(new RegExp(searchString, 'g'), replaceString);
    
    if (updatedContent !== originalContent) {
      await fs.writeFile(serverFilePath, updatedContent, "utf8");
      return { 
        success: true, 
        serverFilePath, 
        originalSize: originalContent.length,
        updatedSize: updatedContent.length,
        replacements: (originalContent.match(new RegExp(searchString, 'g')) || []).length
      };
    } else {
      return { 
        success: false, 
        error: `Search string "${searchString}" not found`,
        serverFilePath 
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function performNativeCacheInvalidation(pagePath) {
  const results = [];
  const serverFilePath = resolveServerFilePath(pagePath);

  if (deleteCache) {
    try {
      deleteCache(serverFilePath);
      results.push({ api: "deleteCache", success: true });
    } catch (error) {
      results.push({ api: "deleteCache", success: false, error: error.message });
    }
  }

  if (deleteFromRequireCache) {
    try {
      deleteFromRequireCache(serverFilePath);
      results.push({ api: "deleteFromRequireCache", success: true });
    } catch (error) {
      results.push({ api: "deleteFromRequireCache", success: false, error: error.message });
    }
  }

  return { 
    success: results.some(r => r.success), 
    results,
    serverFilePath 
  };
}

async function performDevServerIntegration(pagePath) {
  const devServer = global.__NEXT_DEV_SERVER_INSTANCE__;
  const results = [];

  if (devServer?.hasPage) {
    try {
      const hasPage = await devServer.hasPage(pagePath);
      results.push({ operation: "hasPage", success: true, hasPage });
    } catch (error) {
      results.push({ operation: "hasPage", success: false, error: error.message });
    }
  }

  if (devServer?.getCompilationError) {
    try {
      const compilationError = await devServer.getCompilationError(pagePath);
      results.push({ operation: "getCompilationError", success: true, hasError: !!compilationError });
    } catch (error) {
      results.push({ operation: "getCompilationError", success: false, error: error.message });
    }
  }

  return { 
    success: results.length > 0, 
    results,
    devServerAvailable: !!devServer 
  };
}

async function performHotReloaderOperations(pagePath, forceReload) {
  const hotReloader = global.__NEXT_DEV_HOT_RELOADER__;
  const results = [];

  if (hotReloader?.ensurePage) {
    try {
      await hotReloader.ensurePage({ page: pagePath, clientOnly: false });
      results.push({ operation: "ensurePage", success: true });
    } catch (error) {
      results.push({ operation: "ensurePage", success: false, error: error.message });
    }
  }

  if (hotReloader?.invalidate) {
    try {
      await hotReloader.invalidate({ reloadAfterInvalidation: forceReload });
      results.push({ operation: "invalidate", success: true, forceReload });
    } catch (error) {
      results.push({ operation: "invalidate", success: false, error: error.message });
    }
  }

  return { 
    success: results.some(r => r.success), 
    results,
    hotReloaderAvailable: !!hotReloader 
  };
}

async function performEnhancedEnsurePage(pagePath) {
  const ensurePageAPI = global.__NEXT_ENSURE_PAGE_API__;
  
  if (!ensurePageAPI?.originalEnsurePage) {
    return { success: false, error: "Enhanced ensure page API not available" };
  }

  try {
    const startTime = Date.now();
    await ensurePageAPI.originalEnsurePage({ page: pagePath });
    const duration = Date.now() - startTime;
    
    const stats = ensurePageAPI.getStats();
    
    return { 
      success: true, 
      duration,
      stats: {
        totalCalls: stats.totalCalls,
        successfulCalls: stats.successfulCalls,
        averageDuration: stats.averageDuration,
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function performWebSocketBroadcasting(pagePath, forceReload) {
  const hotReloader = global.__NEXT_DEV_HOT_RELOADER__;
  const results = [];

  const message = {
    action: forceReload ? ("reload") : 
                         ("serverComponentChanges"),
    data: `Comprehensive HMR for ${pagePath}`,
    pages: forceReload ? undefined : [pagePath],
    timestamp: Date.now(),
  };

  if (hotReloader?.send) {
    try {
      hotReloader.send(message);
      results.push({ channel: "hot-reloader-send", success: true });
    } catch (error) {
      results.push({ channel: "hot-reloader-send", success: false, error: error.message });
    }
  }

  if (hotReloader?.hotMiddleware?.publish) {
    try {
      hotReloader.hotMiddleware.publish(message);
      results.push({ channel: "hot-middleware-publish", success: true });
    } catch (error) {
      results.push({ channel: "hot-middleware-publish", success: false, error: error.message });
    }
  }

  return { 
    success: results.some(r => r.success), 
    results,
    message 
  };
}

function resolveServerFilePath(pagePath) {
  if (pagePath === "/_document") {
    return path.resolve(process.cwd(), ".next", "server", "pages", "_document.js");
  } else if (pagePath === "/posts/markdown") {
    return path.resolve(process.cwd(), ".next", "server", "pages", "posts", "markdown.js");
  } else {
    const cleanPath = pagePath.startsWith('/') ? pagePath.slice(1) : pagePath;
    return path.resolve(process.cwd(), ".next", "server", "pages", `${cleanPath}.js`);
  }
}