// Next.js Native Server HMR Utility
// Uses Next.js exact internal APIs - copied directly from Next.js source

const path = require("path");

// Import Next.js exact cache management APIs
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

// Import Next.js exact webpack cache clear implementation
let clearModuleContext;
try {
  const sandboxModule = require("next/dist/server/web/sandbox");
  clearModuleContext = sandboxModule.clearModuleContext;
} catch (error) {
  console.warn("[Native Server HMR] Clear module context not available");
}

// Import Next.js on-demand entry handler - exact same as Next.js uses
let onDemandEntryHandler;
try {
  const entryHandlerModule = require("next/dist/server/dev/on-demand-entry-handler");
  onDemandEntryHandler = entryHandlerModule.onDemandEntryHandler;
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

const ADDED = Symbol('added');
const BUILDING = Symbol('building');
const BUILT = Symbol('built');

class NextNativeServerHMR {
  constructor() {
    this.isInitialized = false;
    this.hotReloaderInstance = null;
    this.devServerInstance = null;
    this.entryHandler = null;
    this.webpackHotMiddleware = null;
    this.entries = {};
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
      if (onDemandEntryHandler && this.hotReloaderInstance) {
          this.entryHandler = onDemandEntryHandler.onDemandEntryHandler({
            hotReloader: this.hotReloaderInstance,
            maxInactiveAge: 25 * 1000,
            multiCompiler: this.hotReloaderInstance.multiCompiler,
            nextConfig: this.hotReloaderInstance.nextConfig,
            pagesBufferLength: 2,
            pagesDir: this.hotReloaderInstance.pagesDir,
            rootDir: this.hotReloaderInstance.dir,
            appDir: this.hotReloaderInstance.appDir,
          });
          debug("On-demand entry handler initialized");
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
      ensurePage: (page, clientOnly) => this.ensurePage({page, clientOnly, appPaths: null, definition: undefined, isApp: false}),
      invalidateModule: (modulePath) => this.invalidateModule(modulePath),
      clearModuleCache: (modulePath) => this.invalidateModule(modulePath), // Alias for compatibility
      getCacheInfo: () => this.getCacheInfo(),
      clearAllPages: () => this.clearAllPageCache(), // New method for clearing all
      publishHMREvent: (event) => this.publishHMREvent(event),
    };

    debug("Native server-side functions exposed on global.__NATIVE_SERVER_HMR__");
  }

  async ensurePage({ page, clientOnly, appPaths, definition, isApp, url }) {
    if (!this.entryHandler) {
      debug("On-demand entry handler not initialized");
      return;
    }
    try {
      await this.entryHandler.ensurePage({ page, appPaths, definition, isApp, url });
    } catch (error) {
      debug(`Error ensuring page: ${page}`, error);
    }
  }

  // Use Next.js exact cache invalidation pattern (from nextjs-require-cache-hot-reloader.ts)
  invalidateModule(targetPath) {
    try {
      // Clear module context first (exact Next.js pattern)
      if (clearModuleContext) {
        clearModuleContext(targetPath);
      }
      
      // Use Next.js deleteCache (exact same call pattern)
      if (deleteCache) {
        deleteCache(targetPath);
        debug(`Invalidated module: ${targetPath}`);
        return { success: true, path: targetPath, method: "next-internal-apis" };
      } else {
        debug("deleteCache not available");
        return { success: false, error: "deleteCache not available" };
      }
    } catch (error) {
      debug("Error invalidating module:", error);
      return { success: false, error: error.message, path: targetPath };
    }
  }

  // Next.js exact pattern for clearing compiled page entries
  clearCompiledPages(compilation) {
    try {
      if (!compilation || !compilation.entrypoints) {
        return { success: false, error: "No compilation data available" };
      }

      // Exact Next.js pattern from nextjs-require-cache-hot-reloader.ts lines 40-52
      const entries = [...compilation.entrypoints.keys()].filter((entry) => {
        const isAppPath = entry.toString().startsWith('app/')
        return entry.toString().startsWith('pages/') || isAppPath
      })

      let clearedCount = 0;
      for (const page of entries) {
        const outputPath = path.join(
          compilation.outputOptions.path,
          page + '.js'
        )
        
        // Use exact Next.js pattern
        if (clearModuleContext) {
          clearModuleContext(outputPath);
        }
        deleteCache(outputPath);
        clearedCount++;
      }

      return { 
        success: true, 
        clearedCount, 
        method: "next-webpack-entrypoints",
        entries: entries.map(e => e.toString())
      };
    } catch (error) {
      debug("Error clearing compiled pages:", error);
      return { success: false, error: error.message };
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

  // Use Next.js exact cache info pattern - simpler, no custom filtering
  getCacheInfo() {
    try {
      const cacheKeys = Object.keys(require.cache);
      
      return {
        totalCacheSize: cacheKeys.length,
        workingDirectory: process.cwd(),
        nodeEnv: process.env.NODE_ENV,
        nativeAPIsAvailable: {
          deleteCache: !!deleteCache,
          deleteFromRequireCache: !!deleteFromRequireCache,
          clearModuleContext: !!clearModuleContext,
          hotReloader: !!this.hotReloaderInstance,
          devServer: !!this.devServerInstance,
          entryHandler: !!this.entryHandler,
        },
        hmrActionsAvailable: HMR_ACTIONS_SENT_TO_BROWSER ? Object.keys(HMR_ACTIONS_SENT_TO_BROWSER) : [],
        method: "next-internal-apis",
      };
    } catch (error) {
      debug("Error getting cache info:", error);
      return { error: error.message, method: "next-internal-apis" };
    }
  }

  // Next.js exact pattern for clearing all page cache (no custom filtering)
  clearAllPageCache() {
    try {
      const cacheKeys = Object.keys(require.cache);
      let clearedCount = 0;
      
      // Clear all user modules in the current working directory
      // This is safer than custom filtering - matches Next.js approach
      const cwd = process.cwd();
      for (const key of cacheKeys) {
        if (key.startsWith(cwd) && !key.includes('node_modules')) {
          if (clearModuleContext) {
            clearModuleContext(key);
          }
          deleteCache(key);
          clearedCount++;
        }
      }
      
      return { 
        success: true, 
        clearedCount, 
        method: "next-internal-deleteCache"
      };
    } catch (error) {
      debug("Error clearing all page cache:", error);
      return { success: false, error: error.message };
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
