// Next.js Native Server HMR Utility
// Uses Next.js internal APIs extensively instead of custom globals

const path = require("path");

// Import Next.js internal cache management APIs
let deleteCache, deleteFromRequireCache;
try {
  const requireCacheModule = require("next/dist/server/dev/require-cache");
  deleteCache = requireCacheModule.deleteCache;
  deleteFromRequireCache = requireCacheModule.deleteFromRequireCache;
} catch (error) {
  console.warn("[Native Server HMR] Next.js require cache API not available");
}

// Import Next.js HMR types for standardized actions
let HMR_ACTIONS_SENT_TO_BROWSER;
try {
  const hmrTypes = require("next/dist/server/dev/hot-reloader-types");
  HMR_ACTIONS_SENT_TO_BROWSER = hmrTypes.HMR_ACTIONS_SENT_TO_BROWSER;
} catch (error) {
  console.warn("[Native Server HMR] HMR types not available");
}

// Import Next.js hot middleware for WebSocket communication
let WebpackHotMiddleware;
try {
  const hotMiddleware = require("next/dist/server/dev/hot-middleware");
  WebpackHotMiddleware = hotMiddleware.default || hotMiddleware;
} catch (error) {
  console.warn("[Native Server HMR] Hot middleware not available");
}

// Import Next.js dev server for instance access
let NextDevServer;
try {
  NextDevServer = require("next/dist/server/dev/next-dev-server");
} catch (error) {
  console.warn("[Native Server HMR] Dev server not available");
}

// Import Next.js on-demand entry handler for page management
let createOnDemandEntryHandler;
try {
  const onDemandEntry = require("next/dist/server/dev/on-demand-entry-handler");
  createOnDemandEntryHandler = onDemandEntry.createOnDemandEntryHandler;
} catch (error) {
  console.warn("[Native Server HMR] On-demand entry handler not available");
}

// Import compiled debug for logging
let debug;
try {
  debug = require("next/dist/compiled/debug")("next:hmr:native");
} catch (error) {
  debug = (...args) => console.log("[Native Server HMR]", ...args);
}

class NextNativeServerHMR {
  constructor() {
    this.isInitialized = false;
    this.hotReloaderInstance = null;
    this.devServerInstance = null;
    this.entryHandler = null;
    this.webpackHotMiddleware = null;
    this.init();
  }

  init() {
    if (process.env.NODE_ENV !== "development") {
      debug("Not in development mode, skipping initialization");
      return;
    }

    if (this.isInitialized) return;

    debug("Initializing Next.js native server HMR...");

    // Initialize Next.js internal components
    this.initializeNextInternals();

    // Setup WebSocket communication
    this.setupHotMiddleware();

    // Expose native functions (keeping compatibility)
    this.exposeNativeFunctions();

    this.isInitialized = true;
    debug("Next.js native server HMR initialized successfully");
  }

  initializeNextInternals() {
    try {
      // Access existing Next.js dev server instance if available
      this.devServerInstance = global.__NEXT_DEV_SERVER_INSTANCE__ || null;
      this.hotReloaderInstance = global.__NEXT_DEV_HOT_RELOADER__ || null;

      if (this.devServerInstance) {
        debug("Found existing Next.js dev server instance");
      }

      if (this.hotReloaderInstance) {
        debug("Found existing Next.js hot reloader instance");
      }

      // Initialize entry handler for on-demand compilation
      if (createOnDemandEntryHandler && this.devServerInstance) {
        try {
          this.entryHandler = createOnDemandEntryHandler({
            dev: true,
            buildId: this.devServerInstance.buildId || 'development',
            pagesDir: path.join(process.cwd(), 'pages'),
            pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
            isEdgeRuntime: false,
            appDir: null,
          });
          debug("On-demand entry handler initialized");
        } catch (error) {
          debug("Could not initialize entry handler:", error.message);
        }
      }

    } catch (error) {
      debug("Error initializing Next.js internals:", error.message);
    }
  }

  setupHotMiddleware() {
    try {
      if (WebpackHotMiddleware && this.hotReloaderInstance) {
        // Try to access existing middleware or create new one
        if (this.hotReloaderInstance.hotMiddleware) {
          this.webpackHotMiddleware = this.hotReloaderInstance.hotMiddleware;
          debug("Using existing webpack hot middleware");
        } else {
          debug("Hot middleware not directly accessible");
        }
      }
    } catch (error) {
      debug("Error setting up hot middleware:", error.message);
    }
  }

  exposeNativeFunctions() {
    // Expose native server HMR functions globally for compatibility
    global.__NATIVE_SERVER_HMR__ = {
      clearPageCache: (pagePath) => this.clearPageCache(pagePath),
      clearAllPages: () => this.clearAllPages(),
      safeReset: () => this.safeReset(),
      getCacheInfo: () => this.getCacheInfo(),
      invalidateModule: (modulePath) => this.invalidateModule(modulePath),
      clearModuleCache: (modulePath) => this.invalidateModule(modulePath),
      hotSwapModule: (targetPath, virtualChunkPath) => this.hotSwapModule(targetPath, virtualChunkPath),
      publishHMREvent: (event) => this.publishHMREvent(event),
      ensurePage: (pagePath) => this.ensurePage(pagePath),
      invalidatePage: (pagePath) => this.invalidatePage(pagePath),
    };

    debug("Native server-side functions exposed on global.__NATIVE_SERVER_HMR__");
  }

  clearPageCache(pagePath) {
    try {
      let cleared = 0;
      const cacheKeys = Object.keys(__non_webpack_require__.cache);

      // Build comprehensive cache key patterns
      const patterns = this.buildCachePatterns(pagePath);

      debug(`Clearing cache for patterns:`, patterns);

      cacheKeys.forEach((key) => {
        const shouldClear = patterns.some((pattern) =>
          key.includes(pattern) ||
          key.endsWith(pattern) ||
          path.normalize(key) === path.normalize(pattern),
        );

        if (shouldClear) {
          this.nativeDeleteFromCache(key);
          cleared++;
          debug(`Cleared: ${key}`);
        }
      });

      // Also clear via on-demand entry handler if available
      if (this.entryHandler && this.entryHandler.invalidate) {
        try {
          this.entryHandler.invalidate(pagePath);
          debug(`Invalidated via entry handler: ${pagePath}`);
        } catch (error) {
          debug(`Entry handler invalidation note: ${error.message}`);
        }
      }

      return { success: true, cleared, pagePath, patterns, method: "native-api" };
    } catch (error) {
      debug("Error clearing page cache:", error);
      return { success: false, error: error.message, pagePath, method: "native-api" };
    }
  }

  clearAllPages() {
    try {
      let cleared = 0;
      const cacheKeys = Object.keys(__non_webpack_require__.cache);

      cacheKeys.forEach((key) => {
        // Clear Next.js specific patterns
        if (this.isNextJSUserModule(key)) {
          this.nativeDeleteFromCache(key);
          cleared++;
        }
      });

      // Clear via entry handler if available
      if (this.entryHandler && this.entryHandler.dispose) {
        try {
          this.entryHandler.dispose();
          debug("Disposed entry handler cache");
        } catch (error) {
          debug(`Entry handler disposal note: ${error.message}`);
        }
      }

      debug(`Cleared ${cleared} pages and lib modules via native APIs`);
      return { success: true, cleared, type: "all-pages-native", method: "native-api" };
    } catch (error) {
      debug("Error clearing all pages cache:", error);
      return { success: false, error: error.message, type: "all-pages-native", method: "native-api" };
    }
  }

  invalidateModule(modulePath) {
    try {
      const fullPath = path.resolve(process.cwd(), modulePath);
      
      // Use Next.js native deleteCache API first
      if (deleteCache) {
        try {
          deleteCache(fullPath);
          debug(`Native deleteCache successful: ${fullPath}`);
          return { success: true, path: fullPath, method: "next-delete-cache" };
        } catch (error) {
          debug(`Native deleteCache failed: ${error.message}`);
        }
      }

      // Use Next.js native deleteFromRequireCache API
      if (deleteFromRequireCache) {
        try {
          deleteFromRequireCache(fullPath);
          debug(`Native deleteFromRequireCache successful: ${fullPath}`);
          return { success: true, path: fullPath, method: "next-delete-from-require-cache" };
        } catch (error) {
          debug(`Native deleteFromRequireCache failed: ${error.message}`);
        }
      }

      // Fallback to clearAllPages for comprehensive clearing
      const clearResult = this.clearAllPages();
      debug(`Module not found in cache, cleared all pages instead: ${path.basename(fullPath)}`);
      return { 
        success: true, 
        path: fullPath, 
        fallback: "cleared-all-pages-native",
        clearResult 
      };

    } catch (error) {
      debug("Error invalidating module:", error);
      return { success: false, error: error.message, path: modulePath, method: "native-api" };
    }
  }

  safeReset() {
    try {
      debug("Performing safe server-side reset using Next.js native APIs...");

      let cleared = 0;
      let preserved = 0;
      const cacheKeys = Object.keys(require.cache);

      cacheKeys.forEach((key) => {
        if (this.isCriticalNextJSModule(key)) {
          preserved++;
          // Keep these modules
        } else if (this.isNextJSUserModule(key)) {
          this.nativeDeleteFromCache(key);
          cleared++;
        } else {
          preserved++;
        }
      });

      // Reset entry handler if available
      if (this.entryHandler && this.entryHandler.dispose) {
        try {
          this.entryHandler.dispose();
          debug("Entry handler disposed during safe reset");
        } catch (error) {
          debug(`Entry handler disposal note: ${error.message}`);
        }
      }

      debug(`Safe reset completed via native APIs - cleared: ${cleared}, preserved: ${preserved}`);

      return {
        success: true,
        cleared,
        preserved,
        total: cacheKeys.length,
        type: "safe-reset-native",
        method: "native-api",
      };
    } catch (error) {
      debug("Error during safe reset:", error);
      return { success: false, error: error.message, type: "safe-reset-native", method: "native-api" };
    }
  }

  hotSwapModule(targetPath, virtualChunkPath) {
    try {
      debug(`Hot swapping module: ${targetPath} with ${virtualChunkPath}`);

      // Use hot reloader if available
      if (this.hotReloaderInstance && this.hotReloaderInstance.ensurePage) {
        const pagePath = targetPath.replace(/^\/pages/, '').replace(/\.[jt]sx?$/, '');
        
        return this.hotReloaderInstance.ensurePage({ page: pagePath })
          .then(() => {
            debug(`Hot swap via ensurePage successful: ${pagePath}`);
            return { 
              success: true, 
              targetPath, 
              virtualChunkPath, 
              method: "hot-reloader-ensure-page" 
            };
          })
          .catch((error) => {
            debug(`Hot swap via ensurePage failed: ${error.message}`);
            throw error;
          });
      }

      // Fallback to module invalidation
      const invalidateResult = this.invalidateModule(targetPath);
      
      if (invalidateResult.success) {
        return { 
          success: true, 
          targetPath, 
          virtualChunkPath, 
          method: "module-invalidation-fallback",
          invalidateResult 
        };
      } else {
        throw new Error(`Hot swap failed: ${invalidateResult.error}`);
      }

    } catch (error) {
      debug("Error during hot swap:", error);
      return { 
        success: false, 
        error: error.message, 
        targetPath, 
        virtualChunkPath, 
        method: "native-api" 
      };
    }
  }

  publishHMREvent(event) {
    try {
      // Use webpack hot middleware if available
      if (this.webpackHotMiddleware && this.webpackHotMiddleware.publish) {
        this.webpackHotMiddleware.publish(event);
        debug(`Published HMR event via webpack middleware:`, event);
        return { success: true, event, method: "webpack-hot-middleware" };
      }

      // Use hot reloader send if available
      if (this.hotReloaderInstance && this.hotReloaderInstance.send) {
        this.hotReloaderInstance.send(event);
        debug(`Published HMR event via hot reloader:`, event);
        return { success: true, event, method: "hot-reloader-send" };
      }

      debug("No HMR event publishing mechanism available");
      return { success: false, error: "No publishing mechanism available", event };

    } catch (error) {
      debug("Error publishing HMR event:", error);
      return { success: false, error: error.message, event };
    }
  }

  ensurePage(pagePath) {
    try {
      // Use hot reloader ensurePage if available
      if (this.hotReloaderInstance && this.hotReloaderInstance.ensurePage) {
        return this.hotReloaderInstance.ensurePage({ page: pagePath })
          .then(() => {
            debug(`Ensure page successful: ${pagePath}`);
            return { success: true, pagePath, method: "hot-reloader-ensure-page" };
          });
      }

      // Use entry handler if available
      if (this.entryHandler && this.entryHandler.ensurePage) {
        return this.entryHandler.ensurePage(pagePath)
          .then(() => {
            debug(`Ensure page via entry handler successful: ${pagePath}`);
            return { success: true, pagePath, method: "entry-handler-ensure-page" };
          });
      }

      debug(`No ensure page mechanism available for: ${pagePath}`);
      return Promise.resolve({ 
        success: false, 
        error: "No ensure page mechanism available", 
        pagePath 
      });

    } catch (error) {
      debug("Error ensuring page:", error);
      return Promise.resolve({ 
        success: false, 
        error: error.message, 
        pagePath 
      });
    }
  }

  invalidatePage(pagePath) {
    try {
      // Use hot reloader invalidate if available
      if (this.hotReloaderInstance && this.hotReloaderInstance.invalidate) {
        return this.hotReloaderInstance.invalidate({ reloadAfterInvalidation: false })
          .then(() => {
            debug(`Invalidate page successful: ${pagePath}`);
            return { success: true, pagePath, method: "hot-reloader-invalidate" };
          });
      }

      // Fallback to cache clearing
      const clearResult = this.clearPageCache(pagePath);
      return Promise.resolve({
        success: clearResult.success,
        pagePath,
        method: "cache-clear-fallback",
        clearResult
      });

    } catch (error) {
      debug("Error invalidating page:", error);
      return Promise.resolve({ 
        success: false, 
        error: error.message, 
        pagePath 
      });
    }
  }

  getCacheInfo() {
    try {
      const cacheKeys = Object.keys(require.cache);
      const nextJSUserModules = cacheKeys.filter(key => this.isNextJSUserModule(key));
      const criticalModules = cacheKeys.filter(key => this.isCriticalNextJSModule(key));

      return {
        totalCacheSize: cacheKeys.length,
        nextJSUserModules: nextJSUserModules.length,
        criticalModules: criticalModules.length,
        sampleUserModules: nextJSUserModules.slice(0, 5),
        sampleCriticalModules: criticalModules.slice(0, 5),
        workingDirectory: process.cwd(),
        nodeEnv: process.env.NODE_ENV,
        nativeAPIsAvailable: {
          deleteCache: !!deleteCache,
          deleteFromRequireCache: !!deleteFromRequireCache,
          hotReloader: !!this.hotReloaderInstance,
          devServer: !!this.devServerInstance,
          entryHandler: !!this.entryHandler,
          webpackHotMiddleware: !!this.webpackHotMiddleware,
        },
        hmrActionsAvailable: HMR_ACTIONS_SENT_TO_BROWSER ? Object.keys(HMR_ACTIONS_SENT_TO_BROWSER) : [],
        method: "native-api",
      };
    } catch (error) {
      debug("Error getting cache info:", error);
      return { error: error.message, method: "native-api" };
    }
  }

  // Helper methods
  buildCachePatterns(pagePath) {
    return [
      pagePath,
      path.resolve(process.cwd(), pagePath),
      path.resolve(process.cwd(), "pages", pagePath),
      path.resolve(process.cwd(), ".next/server/pages", pagePath.replace(/\.tsx?$/, ".js")),
      path.resolve(process.cwd(), ".next/server/pages", `${pagePath}.js`),
      path.resolve(process.cwd(), "pages", `${pagePath}.tsx`),
      path.resolve(process.cwd(), "pages", `${pagePath}.ts`),
      path.resolve(process.cwd(), "pages", `${pagePath}.jsx`),
      path.resolve(process.cwd(), "pages", `${pagePath}.js`),
    ];
  }

  isNextJSUserModule(key) {
    return (
      key.includes("/pages/") ||
      key.includes("\\pages\\") ||
      key.includes("/.next/server/pages/") ||
      key.includes("\\.next\\server\\pages\\") ||
      key.includes("/_app") ||
      key.includes("/_document") ||
      key.includes("/_error") ||
      key.includes("/lib/") ||
      key.includes("\\lib\\") ||
      key.includes("/components/") ||
      key.includes("\\components\\")
    );
  }

  isCriticalNextJSModule(key) {
    return (
      key.includes("node_modules/next/dist/server") ||
      key.includes("node_modules/react") ||
      key.includes("node_modules/webpack") ||
      key.startsWith("node:") ||
      key.includes("next/dist/server/dev/next-dev-server") ||
      key.includes("next/dist/server/config") ||
      key.includes("next/dist/compiled")
    );
  }

  nativeDeleteFromCache(key) {
    try {
      // Try Next.js native API first
      if (deleteFromRequireCache) {
        return deleteFromRequireCache(key);
      }

      // Fallback to manual deletion with proper cleanup
      const mod = require.cache[key];
      if (mod) {
        // Remove child references from all parent modules
        for (const parent of Object.values(require.cache)) {
          if (parent?.children) {
            const idx = parent.children.indexOf(mod);
            if (idx >= 0) parent.children.splice(idx, 1);
          }
        }
        // Remove parent references from external modules
        for (const child of mod.children) {
          if (child) child.parent = null;
        }
        delete require.cache[key];
        return true;
      }
      return false;
    } catch (error) {
      debug(`Error deleting from cache: ${key}`, error);
      return false;
    }
  }
}

// Auto-initialize if in development
let nativeServerHMR = null;

if (process.env.NODE_ENV === "development") {
  nativeServerHMR = new NextNativeServerHMR();

  // Handle process exit
  process.on("exit", () => {
    debug("Process exiting, cleaning up...");
  });
}

module.exports = {
  NextNativeServerHMR,
  instance: nativeServerHMR,
};