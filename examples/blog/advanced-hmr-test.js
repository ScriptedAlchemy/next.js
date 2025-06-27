#!/usr/bin/env node

const path = require("path");
const fs = require("fs");

/**
 * Advanced HMR Test Script
 *
 * This script demonstrates how to use setupDevBundler to create your own
 * HMR access and control the Hot Module Replacement system programmatically.
 */

class ProgrammaticHMRController {
  constructor() {
    this.bundlerResult = null;
    this.hotReloader = null;
    this.isInitialized = false;
  }

  async initialize() {
    console.log("🚀 Initializing Programmatic HMR Controller...\n");

    try {
      // Import required dependencies
      const {
        setupDevBundler,
      } = require("next/dist/server/lib/router-utils/setup-dev-bundler");
      const loadConfig = require("next/dist/server/config").default;
      const { findPagesDir } = require("next/dist/lib/find-pages-dir");
      const {
        setupFsCheck,
      } = require("next/dist/server/lib/router-utils/filesystem");

      // Set up environment
      process.env.NODE_ENV = "development";
      const projectDir = process.cwd();

      console.log("📁 Project directory:", projectDir);

      // Load configuration
      const nextConfig = await loadConfig("development", projectDir);
      const { pagesDir, appDir } = findPagesDir(projectDir);

      console.log("📄 Pages directory:", pagesDir || "None");
      console.log("📱 App directory:", appDir || "None");

      // Set up filesystem checker
      const fsChecker = await setupFsCheck({
        appDir,
        pagesDir,
        dir: projectDir,
        config: nextConfig,
        minimalMode: false,
        dev: true,
      });

      // Create telemetry mock
      const telemetry = {
        record: (event) => {
          console.log(`📊 [Telemetry] ${event.eventName || "Event"}`);
        },
      };

      // Set up bundler options
      const setupOpts = {
        renderServer: { instance: null },
        dir: projectDir,
        turbo: process.env.TURBOPACK === "1",
        appDir,
        pagesDir,
        telemetry,
        isCustomServer: false,
        fsChecker,
        nextConfig,
        port: 3000,
        onDevServerCleanup: undefined,
        resetFetch: () => console.log("🔄 [HMR] Reset fetch called"),
      };

      console.log("⚙️  Setting up dev bundler...");
      console.log(`   Using ${setupOpts.turbo ? "Turbopack" : "Webpack"}`);

      // Initialize the bundler
      this.bundlerResult = await setupDevBundler(setupOpts);
      this.hotReloader = this.bundlerResult.hotReloader;
      this.isInitialized = true;

      console.log("✅ HMR Controller initialized successfully!\n");

      return this;
    } catch (error) {
      console.error("❌ Failed to initialize HMR Controller:", error.message);
      throw error;
    }
  }

  /**
   * Send HMR actions to the browser
   */
  sendHMRAction(action, data = null) {
    if (!this.isInitialized) {
      throw new Error("HMR Controller not initialized");
    }

    console.log(`🔥 [HMR] Sending action: ${action.action || action}`);

    const actionObj = typeof action === "string" ? { action } : action;
    if (data) actionObj.data = data;

    this.hotReloader.send(actionObj);
  }

  /**
   * Invalidate modules and trigger recompilation
   */
  async invalidateModules(reloadAfterInvalidation = false) {
    if (!this.isInitialized) {
      throw new Error("HMR Controller not initialized");
    }

    console.log(
      `🔄 [HMR] Invalidating modules (reload: ${reloadAfterInvalidation})`,
    );

    await this.hotReloader.invalidate({
      reloadAfterInvalidation,
    });
  }

  /**
   * Ensure a specific page is compiled
   */
  async ensurePage(pagePath, options = {}) {
    if (!this.isInitialized) {
      throw new Error("HMR Controller not initialized");
    }

    console.log(`📄 [HMR] Ensuring page: ${pagePath}`);

    const pageOptions = {
      page: pagePath,
      clientOnly: false,
      definition: undefined,
      ...options,
    };

    await this.hotReloader.ensurePage(pageOptions);
  }

  /**
   * Get compilation errors for a specific page
   */
  async getCompilationErrors(pagePath) {
    if (!this.isInitialized) {
      throw new Error("HMR Controller not initialized");
    }

    console.log(`🐛 [HMR] Getting compilation errors for: ${pagePath}`);

    return await this.hotReloader.getCompilationErrors(pagePath);
  }

  /**
   * Set an HMR server error
   */
  setHMRError(error) {
    if (!this.isInitialized) {
      throw new Error("HMR Controller not initialized");
    }

    console.log(`❌ [HMR] Setting server error: ${error.message}`);
    this.hotReloader.setHmrServerError(error);
  }

  /**
   * Clear HMR server errors
   */
  clearHMRError() {
    if (!this.isInitialized) {
      throw new Error("HMR Controller not initialized");
    }

    console.log("✅ [HMR] Clearing server errors");
    this.hotReloader.clearHmrServerError();
  }

  /**
   * Get information about the HMR system
   */
  getHMRInfo() {
    if (!this.isInitialized) {
      throw new Error("HMR Controller not initialized");
    }

    return {
      type: this.hotReloader.constructor.name,
      methods: Object.getOwnPropertyNames(
        Object.getPrototypeOf(this.hotReloader),
      ),
      serverFields: this.bundlerResult.serverFields,
      hasWebpackConfigs: !!this.hotReloader.activeWebpackConfigs,
      hasTurbopackProject: !!this.hotReloader.turbopackProject,
      stats: {
        server: !!this.hotReloader.serverStats,
        edge: !!this.hotReloader.edgeServerStats,
      },
    };
  }

  /**
   * Monitor file changes (example of advanced usage)
   */
  setupFileWatcher(filePath, callback) {
    if (!this.isInitialized) {
      throw new Error("HMR Controller not initialized");
    }

    const fs = require("fs");

    console.log(`👀 [HMR] Watching file: ${filePath}`);

    fs.watchFile(filePath, (curr, prev) => {
      console.log(`📝 [HMR] File changed: ${filePath}`);
      callback(curr, prev);
    });
  }

  /**
   * Clean up and close the HMR system
   */
  close() {
    if (this.isInitialized && this.hotReloader) {
      console.log("🛑 [HMR] Closing HMR Controller...");
      this.hotReloader.close();
      this.isInitialized = false;
    }
  }
}

/**
 * Demonstration function
 */
async function demonstrateHMRUsage() {
  console.log("🎯 Programmatic HMR Control Demonstration\n");
  console.log("=".repeat(50) + "\n");

  const hmrController = new ProgrammaticHMRController();

  try {
    // Initialize the controller
    await hmrController.initialize();

    // Display HMR system information
    console.log("📊 HMR System Information:");
    const hmrInfo = hmrController.getHMRInfo();
    console.log(`   Type: ${hmrInfo.type}`);
    console.log(`   Available methods: ${hmrInfo.methods.length}`);
    console.log(`   Has Webpack configs: ${hmrInfo.hasWebpackConfigs}`);
    console.log(`   Has Turbopack project: ${hmrInfo.hasTurbopackProject}`);
    console.log("");

    // Test various HMR actions
    console.log("🔥 Testing HMR Actions:");

    // Send building action
    hmrController.sendHMRAction("building");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send built action
    hmrController.sendHMRAction({
      action: "built",
      hash: "test-hash-" + Date.now(),
      errors: [],
      warnings: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Test page ensuring
    console.log("\n📄 Testing Page Operations:");

    // Check if we have pages to work with
    const pagesDir = path.join(process.cwd(), "pages");
    if (fs.existsSync(pagesDir)) {
      const indexPath = path.join(pagesDir, "index.js");
      if (fs.existsSync(indexPath)) {
        await hmrController.ensurePage("/");

        // Get compilation errors
        const errors = await hmrController.getCompilationErrors("/");
        console.log(`   Compilation errors for /: ${errors.length}`);
      }
    }

    // Test invalidation
    console.log("\n🔄 Testing Module Invalidation:");
    await hmrController.invalidateModules(false);

    // Test error handling
    console.log("\n❌ Testing Error Handling:");
    const testError = new Error("Test HMR error");
    hmrController.setHMRError(testError);

    await new Promise((resolve) => setTimeout(resolve, 100));

    hmrController.clearHMRError();

    console.log("\n✅ All HMR operations completed successfully!");

    // Example of advanced usage: File watching
    console.log("\n👀 Advanced Usage Example:");
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(packageJsonPath)) {
      hmrController.setupFileWatcher(packageJsonPath, (curr, prev) => {
        console.log("   Package.json was modified, triggering HMR...");
        hmrController.invalidateModules(true);
      });
      console.log("   File watcher set up for package.json");
    }

    console.log("\n🎉 HMR demonstration completed!");
    console.log("\n📋 Summary of capabilities:");
    console.log("✅ Import and initialize setupDevBundler");
    console.log("✅ Access hotReloader instance programmatically");
    console.log("✅ Send HMR actions to browser");
    console.log("✅ Invalidate modules and trigger recompilation");
    console.log("✅ Ensure specific pages are compiled");
    console.log("✅ Handle compilation errors");
    console.log("✅ Set and clear HMR server errors");
    console.log("✅ Set up custom file watchers");
    console.log("✅ Full programmatic control over HMR system");
  } catch (error) {
    console.error("\n💥 Demonstration failed:", error.message);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
  } finally {
    // Clean up
    hmrController.close();
  }
}

// Export for use as a module
module.exports = { ProgrammaticHMRController, demonstrateHMRUsage };

// Run demonstration if called directly
if (require.main === module) {
  demonstrateHMRUsage()
    .then(() => {
      console.log("\n✨ Demonstration script finished");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n💥 Demonstration failed:", err);
      process.exit(1);
    });
}
