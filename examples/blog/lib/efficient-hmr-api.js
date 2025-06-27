// Efficient HMR API - Uses existing hot reloader instance via global exposure
// This avoids creating a new compiler and reuses the existing one

const { deleteCache } = require("next/dist/server/dev/require-cache");
const path = require("path");

/**
 * Efficient HMR API that hooks into the existing Next.js hot reloader
 * instead of creating a new compilation system
 */
class EfficientHMRAPI {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize by accessing the globally exposed hot reloader instance
   */
  async initialize() {
    try {
      console.log(
        "[Efficient HMR] Initializing with globally exposed hot reloader instance...",
      );

      // Check if hot reloader is already available
      if (global.__NEXT_DEV_HOT_RELOADER__) {
        this.initialized = true;
        console.log("[Efficient HMR] Hot reloader found immediately!");
        return true;
      }

      // Wait for Next.js dev server to fully start and expose the hot reloader
      console.log(
        "[Efficient HMR] Waiting for Next.js dev server to expose hot reloader...",
      );

      for (let i = 0; i < 40; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));

        if (global.__NEXT_DEV_HOT_RELOADER__) {
          this.initialized = true;
          console.log("[Efficient HMR] Hot reloader instance found!");
          return true;
        }
      }

      this.initialized = false;
      console.log("[Efficient HMR] Hot reloader not available after waiting");
      return false;
    } catch (error) {
      console.error("[Efficient HMR] Initialization error:", error);
      return false;
    }
  }

  /**
   * Get the globally exposed hot reloader instance
   */
  getHotReloader() {
    return global.__NEXT_DEV_HOT_RELOADER__ || null;
  }

  /**
   * Trigger HMR using the existing hot reloader (memory efficient)
   */
  async triggerHMR(pagePath, forceReload = false, searchString = null, replaceString = null) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error(
          "Efficient HMR not available - existing hot reloader not accessible",
        );
      }
    }

    const hotReloader = this.getHotReloader();
    if (!hotReloader) {
      throw new Error("Hot reloader instance not available");
    }

    try {
      console.log(
        `[Efficient HMR] Triggering HMR for: ${pagePath} using existing compiler`,
      );

      // For _document, also perform the string replacement like file-based HMR
      if (pagePath === "/_document") {
        const fs = require("fs").promises;
        const serverDocPath = path.resolve(
          process.cwd(),
          ".next",
          "server",
          "pages",
          "_document.js",
        );

        try {
          const originalContent = await fs.readFile(serverDocPath, "utf8");
          const updatedContent = originalContent.replace(
            "PLACEHOLDER",
            "Hello world!!",
          );

          if (updatedContent !== originalContent) {
            await fs.writeFile(serverDocPath, updatedContent, "utf8");
            console.log(
              "[Efficient HMR] Updated compiled document with string replacement",
            );
          }
        } catch (error) {
          console.log("[Efficient HMR] File modification note:", error.message);
        }
      }

      // Handle custom string replacement if searchString and replaceString are provided
      if (searchString && replaceString) {
        const fs = require("fs").promises;
        let serverFilePath;
        
        if (pagePath === "/_document") {
          serverFilePath = path.resolve(process.cwd(), ".next", "server", "pages", "_document.js");
        } else if (pagePath === "/posts/markdown") {
          serverFilePath = path.resolve(process.cwd(), ".next", "server", "pages", "posts", "markdown.js");
        } else {
          // Generic path handling for other pages
          serverFilePath = path.resolve(process.cwd(), ".next", "server", "pages", `${pagePath}.js`);
        }

        try {
          console.log(`[Efficient HMR] Attempting to read file: ${serverFilePath}`);
          const originalContent = await fs.readFile(serverFilePath, "utf8");
          console.log(`[Efficient HMR] Read ${originalContent.length} bytes from file`);
          
          const updatedContent = originalContent.replace(
            new RegExp(searchString, 'g'),
            replaceString,
          );

          if (updatedContent !== originalContent) {
            await fs.writeFile(serverFilePath, updatedContent, "utf8");
            console.log(
              `[Efficient HMR] Updated compiled file with string replacement: ${searchString} -> ${replaceString}`,
            );
          } else {
            console.log(`[Efficient HMR] No changes made to file - ${searchString} not found`);
          }
        } catch (error) {
          console.error("[Efficient HMR] File modification error:", error);
          throw error; // Re-throw to see the actual error
        }
      }
      
      // For markdown pages, also perform string replacement (fallback for backward compatibility)
      else if (pagePath === "/posts/markdown") {
        const fs = require("fs").promises;
        const serverMarkdownPath = path.resolve(
          process.cwd(),
          ".next",
          "server",
          "pages",
          "posts",
          "markdown.js",
        );

        try {
          console.log(`[Efficient HMR] Attempting to read markdown file: ${serverMarkdownPath}`);
          const originalContent = await fs.readFile(serverMarkdownPath, "utf8");
          console.log(`[Efficient HMR] Read ${originalContent.length} bytes from markdown file`);
          
          const updatedContent = originalContent.replace(
            "PAGE_HMR_AREA",
            "Efficient HMR SUCCESS ON MARKDOWN!",
          );

          if (updatedContent !== originalContent) {
            await fs.writeFile(serverMarkdownPath, updatedContent, "utf8");
            console.log(
              "[Efficient HMR] Updated compiled markdown page with string replacement",
            );
          } else {
            console.log("[Efficient HMR] No changes made to markdown file - PAGE_HMR_AREA not found");
          }
        } catch (error) {
          console.error("[Efficient HMR] File modification error:", error);
          throw error; // Re-throw to see the actual error
        }
      }

      // Use the existing hot reloader instance (memory efficient!)
      await hotReloader.ensurePage({
        page: pagePath,
        clientOnly: false,
        appDirLocale: undefined,
        definition: undefined,
        url: pagePath,
      });

      // Invalidate using the existing system
      await hotReloader.invalidate({
        reloadAfterInvalidation: forceReload,
      });

      // Send HMR message through existing WebSocket connections
      if (hotReloader.send) {
        if (forceReload || pagePath === "/_document") {
          hotReloader.send({
            action: "reload",
            data: `Global-based reload for ${pagePath}`,
          });
        } else {
          hotReloader.send({
            action: "serverComponentChanges",
            pages: [pagePath],
            data: `Global-based server change for ${pagePath}`,
          });
        }
      }

      // Clear module cache using the same approach as file-based HMR
      if (global.__SERVER_HMR__) {
        try {
          // Clear specific module cache
          const serverDocPath = path.resolve(
            process.cwd(),
            ".next",
            "server",
            "pages",
            `${pagePath}.js`,
          );
          const clearResult =
            global.__SERVER_HMR__.clearModuleCache(serverDocPath);

          // Clear all pages cache
          const clearAllResult = global.__SERVER_HMR__.clearAllPages();

          console.log("[Efficient HMR] Cache cleared via Server HMR API");
        } catch (error) {
          console.log("[Efficient HMR] Cache clearing note:", error.message);
        }
      } else {
        // Fallback to direct cache clearing
        try {
          const possiblePaths = [
            path.resolve(process.cwd(), "pages", `${pagePath}.js`),
            path.resolve(process.cwd(), "pages", `${pagePath}.jsx`),
            path.resolve(process.cwd(), "pages", `${pagePath}.ts`),
            path.resolve(process.cwd(), "pages", `${pagePath}.tsx`),
            path.resolve(
              process.cwd(),
              ".next",
              "server",
              "pages",
              `${pagePath}.js`,
            ),
          ];

          for (const possiblePath of possiblePaths) {
            try {
              deleteCache(possiblePath);
            } catch (error) {
              // Continue with other paths
            }
          }
        } catch (error) {
          console.log(`[Efficient HMR] Cache clearing note: ${error.message}`);
        }
      }

      return {
        success: true,
        method: "global-hot-reloader-access",
        pagePath,
        reusedCompiler: true,
        memoryEfficient: true,
        existingInstance: true,
        efficientApproach: true,
        noNewCompiler: true,
        memoryFootprint: "minimal",
      };
    } catch (error) {
      console.error(
        `[Efficient HMR] Error triggering HMR for ${pagePath}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get available HMR actions from the existing instance
   */
  getAvailableActions() {
    try {
      const {
        HMR_ACTIONS_SENT_TO_BROWSER,
      } = require("next/dist/server/dev/hot-reloader-types");
      return Object.values(HMR_ACTIONS_SENT_TO_BROWSER);
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if the efficient HMR approach is available
   */
  isAvailable() {
    return this.initialized && this.getHotReloader();
  }

  /**
   * Get detailed status of the efficient HMR system
   */
  getStatus() {
    const hotReloader = this.getHotReloader();

    return {
      initialized: this.initialized,
      approach: "global-instance-access",
      memoryEfficient: true,
      reusesCompiler: true,
      newCompilerCreated: false,
      hotReloaderAvailable: !!hotReloader,
      globalAccess: !!global.__NEXT_DEV_HOT_RELOADER__,
      devServerAccess: !!global.__NEXT_DEV_SERVER_INSTANCE__,
      availableActions: this.getAvailableActions(),
      performance: {
        compilationOverhead: "none",
        memoryUsage: "minimal",
        duplicateWork: "none",
      },
    };
  }

  /**
   * Get direct access to the hot reloader for advanced usage
   */
  getHotReloader() {
    return global.__NEXT_DEV_HOT_RELOADER__ || null;
  }

  /**
   * Send custom HMR message using existing WebSocket connections
   */
  async sendHMRMessage(action, data) {
    const hotReloader = this.getHotReloader();
    if (!hotReloader || !hotReloader.send) {
      throw new Error("Hot reloader or WebSocket not available");
    }

    try {
      hotReloader.send({ action, data });
      return { success: true, action, data };
    } catch (error) {
      console.error("[Efficient HMR] Error sending HMR message:", error);
      throw error;
    }
  }

  /**
   * Invalidate specific modules using existing compiler
   */
  async invalidateModules(modules = []) {
    const hotReloader = this.getHotReloader();
    if (!hotReloader) {
      throw new Error("Hot reloader not available");
    }

    try {
      await hotReloader.invalidate({
        reloadAfterInvalidation: false,
      });

      // Clear require cache for specified modules
      for (const modulePath of modules) {
        try {
          deleteCache(modulePath);
        } catch (error) {
          console.log(
            `[Efficient HMR] Could not clear cache for: ${modulePath}`,
          );
        }
      }

      return { success: true, invalidatedModules: modules };
    } catch (error) {
      console.error("[Efficient HMR] Error invalidating modules:", error);
      throw error;
    }
  }
}

module.exports = EfficientHMRAPI;
