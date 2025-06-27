// Alternative approach: Hook into existing Next.js dev server hot reloader
// Instead of creating a new compiler, access the running one

const path = require("path");

class ExistingHMRHook {
  constructor() {
    this.devServerInstance = null;
    this.hotReloaderInstance = null;
    this.initialized = false;
  }

  /**
   * Attempt to hook into the existing Next.js dev server's hot reloader
   * This would be more efficient than creating a new compiler
   */
  async initialize() {
    try {
      // Method 1: Try to access via global dev server reference
      if (global.__NEXT_DEV_SERVER_INSTANCE__) {
        this.devServerInstance = global.__NEXT_DEV_SERVER_INSTANCE__;
        this.hotReloaderInstance =
          this.devServerInstance.bundlerService?.bundler;

        if (this.hotReloaderInstance) {
          console.log(
            "[Existing HMR Hook] Successfully hooked into existing dev server",
          );
          this.initialized = true;
          return true;
        }
      }

      // Method 2: Hook into Next.js dev server startup process
      // This would require patching the dev server initialization
      const DevServer = require("next/dist/server/dev/next-dev-server").default;

      // Store original start method
      if (!DevServer.prototype._originalStart) {
        DevServer.prototype._originalStart = DevServer.prototype.start;

        DevServer.prototype.start = async function (...args) {
          const result = await this._originalStart.apply(this, args);

          // Store reference for our hook
          global.__NEXT_DEV_SERVER_INSTANCE__ = this;

          return result;
        };
      }

      // Method 3: Access via require cache inspection
      // Look for existing DevServer instances in the module cache
      for (const key in require.cache) {
        const mod = require.cache[key];
        if (mod && mod.exports && typeof mod.exports === "object") {
          if (
            mod.exports.constructor &&
            mod.exports.constructor.name === "DevServer"
          ) {
            this.devServerInstance = mod.exports;
            this.hotReloaderInstance =
              this.devServerInstance.bundlerService?.bundler;

            if (this.hotReloaderInstance) {
              console.log(
                "[Existing HMR Hook] Found existing DevServer via require cache",
              );
              this.initialized = true;
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error("[Existing HMR Hook] Error during initialization:", error);
      return false;
    }
  }

  /**
   * Trigger HMR using the existing hot reloader (more efficient)
   */
  async triggerHMR(pagePath, forceReload = false) {
    if (!this.initialized || !this.hotReloaderInstance) {
      throw new Error("Not hooked into existing hot reloader");
    }

    try {
      console.log(`[Existing HMR Hook] Triggering HMR for: ${pagePath}`);

      // Use the existing compiler system instead of creating a new one
      await this.hotReloaderInstance.ensurePage({
        page: pagePath,
        clientOnly: false,
        appDirLocale: undefined,
        definition: undefined,
        url: pagePath,
      });

      // Invalidate using the existing system
      await this.hotReloaderInstance.invalidate({
        reloadAfterInvalidation: forceReload,
      });

      // Send HMR message through existing WebSocket connections
      if (this.hotReloaderInstance.send) {
        if (forceReload || pagePath === "/_document") {
          this.hotReloaderInstance.send({
            action: "reload",
            data: `Existing hook reload for ${pagePath}`,
          });
        } else {
          this.hotReloaderInstance.send({
            action: "serverComponentChanges",
            pages: [pagePath],
            data: `Existing hook server change for ${pagePath}`,
          });
        }
      }

      return {
        success: true,
        method: "existing-hot-reloader-hook",
        pagePath,
        reusedCompiler: true,
        memoryEfficient: true,
      };
    } catch (error) {
      console.error(
        `[Existing HMR Hook] Error triggering HMR for ${pagePath}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get information about the hooked hot reloader
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasDevServer: !!this.devServerInstance,
      hasHotReloader: !!this.hotReloaderInstance,
      approach: "existing-instance-hook",
      memoryEfficient: true,
      reusingCompiler: this.initialized,
      multiCompilerActive: this.hotReloaderInstance?.multiCompiler
        ? true
        : false,
    };
  }
}

module.exports = ExistingHMRHook;
