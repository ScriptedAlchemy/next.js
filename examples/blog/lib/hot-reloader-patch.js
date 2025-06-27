// Hot Reloader Patching System
// Patches Next.js to expose the existing hot reloader instance

const path = require('path');

/**
 * Patches Next.js dev server to capture and expose the hot reloader instance
 * Uses multiple strategies to ensure we can access the running instance
 */
class HotReloaderPatch {
  constructor() {
    this.hotReloaderInstance = null;
    this.devBundlerService = null;
    this.patchesApplied = false;
  }

  /**
   * Apply patches to capture the hot reloader instance when Next.js creates it
   */
  applyPatches() {
    if (this.patchesApplied) {
      return;
    }

    console.log('[Hot Reloader Patch] Applying patches to capture existing hot reloader...');

    try {
      // Method 1: Patch DevBundlerService to capture instance
      this.patchDevBundlerService();
      
      // Method 2: Patch setupDevBundler to capture hot reloader
      this.patchSetupDevBundler();
      
      // Method 3: Patch Next.js dev server startup
      this.patchDevServer();

      this.patchesApplied = true;
      console.log('[Hot Reloader Patch] All patches applied successfully');
    } catch (error) {
      console.error('[Hot Reloader Patch] Error applying patches:', error);
    }
  }

  /**
   * Patch DevBundlerService to capture the bundler instance
   */
  patchDevBundlerService() {
    try {
      const DevBundlerService = require('next/dist/server/lib/dev-bundler-service').DevBundlerService;
      
      if (!DevBundlerService.prototype._originalConstructor) {
        DevBundlerService.prototype._originalConstructor = DevBundlerService;
        
        const originalConstructor = DevBundlerService;
        
        function PatchedDevBundlerService(bundler, handler) {
          const instance = originalConstructor.call(this, bundler, handler);
          
          // Capture the hot reloader instance
          global.__DEV_BUNDLER_SERVICE__ = this;
          global.__HOT_RELOADER_INSTANCE__ = bundler?.hotReloader;
          
          console.log('[Hot Reloader Patch] Captured DevBundlerService and hot reloader');
          
          return instance;
        }
        
        // Copy prototype
        PatchedDevBundlerService.prototype = DevBundlerService.prototype;
        
        // Replace the constructor
        require.cache[require.resolve('next/dist/server/lib/dev-bundler-service')].exports.DevBundlerService = PatchedDevBundlerService;
        
        console.log('[Hot Reloader Patch] DevBundlerService patched');
      }
    } catch (error) {
      console.log('[Hot Reloader Patch] DevBundlerService patch failed (expected):', error.message);
    }
  }

  /**
   * Patch setupDevBundler function to capture hot reloader
   */
  patchSetupDevBundler() {
    try {
      const setupDevBundlerModule = require('next/dist/server/lib/router-utils/setup-dev-bundler');
      
      if (setupDevBundlerModule.setupDevBundler && !setupDevBundlerModule._originalSetupDevBundler) {
        setupDevBundlerModule._originalSetupDevBundler = setupDevBundlerModule.setupDevBundler;
        
        setupDevBundlerModule.setupDevBundler = async function(opts) {
          console.log('[Hot Reloader Patch] setupDevBundler called, capturing result...');
          
          const result = await setupDevBundlerModule._originalSetupDevBundler(opts);
          
          // Capture the hot reloader from the result
          if (result && result.hotReloader) {
            global.__HOT_RELOADER_INSTANCE__ = result.hotReloader;
            global.__DEV_BUNDLER_RESULT__ = result;
            
            console.log('[Hot Reloader Patch] Hot reloader captured from setupDevBundler');
          }
          
          return result;
        };
        
        console.log('[Hot Reloader Patch] setupDevBundler patched');
      }
    } catch (error) {
      console.log('[Hot Reloader Patch] setupDevBundler patch failed:', error.message);
    }
  }

  /**
   * Patch Next.js DevServer to capture instance
   */
  patchDevServer() {
    try {
      const NextDevServer = require('next/dist/server/dev/next-dev-server').default;
      
      if (!NextDevServer.prototype._originalPrepare) {
        NextDevServer.prototype._originalPrepare = NextDevServer.prototype.prepare;
        
        NextDevServer.prototype.prepare = async function() {
          const result = await this._originalPrepare();
          
          // Capture the dev server instance
          global.__NEXT_DEV_SERVER_INSTANCE__ = this;
          
          // Try to capture hot reloader from bundler service
          if (this.bundlerService && this.bundlerService.bundler && this.bundlerService.bundler.hotReloader) {
            global.__HOT_RELOADER_INSTANCE__ = this.bundlerService.bundler.hotReloader;
            console.log('[Hot Reloader Patch] Hot reloader captured from DevServer');
          }
          
          return result;
        };
        
        console.log('[Hot Reloader Patch] DevServer patched');
      }
    } catch (error) {
      console.log('[Hot Reloader Patch] DevServer patch failed:', error.message);
    }
  }

  /**
   * Get the captured hot reloader instance
   */
  getHotReloader() {
    // Try multiple sources for the hot reloader
    if (global.__HOT_RELOADER_INSTANCE__) {
      return global.__HOT_RELOADER_INSTANCE__;
    }
    
    if (global.__DEV_BUNDLER_SERVICE__ && global.__DEV_BUNDLER_SERVICE__.bundler) {
      return global.__DEV_BUNDLER_SERVICE__.bundler.hotReloader;
    }
    
    if (global.__DEV_BUNDLER_RESULT__ && global.__DEV_BUNDLER_RESULT__.hotReloader) {
      return global.__DEV_BUNDLER_RESULT__.hotReloader;
    }
    
    if (global.__NEXT_DEV_SERVER_INSTANCE__) {
      const bundlerService = global.__NEXT_DEV_SERVER_INSTANCE__.bundlerService;
      if (bundlerService && bundlerService.bundler && bundlerService.bundler.hotReloader) {
        return bundlerService.bundler.hotReloader;
      }
    }
    
    return null;
  }

  /**
   * Get status of the patch system
   */
  getStatus() {
    const hotReloader = this.getHotReloader();
    
    return {
      patchesApplied: this.patchesApplied,
      hotReloaderAvailable: !!hotReloader,
      globalReferences: {
        hotReloaderInstance: !!global.__HOT_RELOADER_INSTANCE__,
        devBundlerService: !!global.__DEV_BUNDLER_SERVICE__,
        devBundlerResult: !!global.__DEV_BUNDLER_RESULT__,
        nextDevServerInstance: !!global.__NEXT_DEV_SERVER_INSTANCE__
      },
      hotReloaderMethods: hotReloader ? Object.getOwnPropertyNames(Object.getPrototypeOf(hotReloader)) : [],
      approach: 'existing-instance-capture',
      memoryEfficient: true
    };
  }

  /**
   * Initialize and try to get existing hot reloader
   */
  async initialize() {
    this.applyPatches();
    
    // Wait a bit for patches to take effect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const hotReloader = this.getHotReloader();
    
    if (hotReloader) {
      console.log('[Hot Reloader Patch] Successfully captured existing hot reloader instance');
      this.hotReloaderInstance = hotReloader;
      return true;
    } else {
      console.log('[Hot Reloader Patch] Hot reloader not yet available, patches are waiting for Next.js startup');
      return false;
    }
  }

  /**
   * Trigger HMR using the captured existing hot reloader
   */
  async triggerHMR(pagePath, forceReload = false) {
    const hotReloader = this.getHotReloader();
    
    if (!hotReloader) {
      throw new Error('No hot reloader instance available - Next.js dev server may not be fully started');
    }

    try {
      console.log(`[Hot Reloader Patch] Triggering HMR for: ${pagePath} using existing instance`);

      // Use the existing hot reloader instance (memory efficient!)
      await hotReloader.ensurePage({
        page: pagePath,
        clientOnly: false,
        appDirLocale: undefined,
        definition: undefined,
        url: pagePath
      });

      // Invalidate using the existing system
      await hotReloader.invalidate({
        reloadAfterInvalidation: forceReload
      });

      // Send HMR message through existing WebSocket connections
      if (hotReloader.send) {
        if (forceReload || pagePath === '/_document') {
          hotReloader.send({
            action: 'reload',
            data: `Patch-based reload for ${pagePath}`
          });
        } else {
          hotReloader.send({
            action: 'serverComponentChanges',
            pages: [pagePath],
            data: `Patch-based server change for ${pagePath}`
          });
        }
      }

      return {
        success: true,
        method: 'existing-hot-reloader-patch',
        pagePath,
        reusedCompiler: true,
        memoryEfficient: true,
        existingInstance: true
      };

    } catch (error) {
      console.error(`[Hot Reloader Patch] Error triggering HMR for ${pagePath}:`, error);
      throw error;
    }
  }
}

// Auto-initialize when required
let hotReloaderPatch = null;

function getHotReloaderPatch() {
  if (!hotReloaderPatch) {
    hotReloaderPatch = new HotReloaderPatch();
    hotReloaderPatch.applyPatches();
  }
  return hotReloaderPatch;
}

module.exports = {
  HotReloaderPatch,
  getHotReloaderPatch
};