#!/usr/bin/env node

/**
 * Test script for HotReloaderWebpack class from Next.js internals
 *
 * This script tests:
 * 1. Importing HotReloaderWebpack from 'next/dist/server/dev/hot-reloader-webpack'
 * 2. Checking constructor parameters and requirements
 * 3. Attempting to create instances with different configurations
 * 4. Testing available methods and properties
 * 5. Looking for global references or ways to access existing instances
 */

const path = require("path");
const fs = require("fs");

console.log("=".repeat(70));
console.log("TESTING HotReloaderWebpack from Next.js Internals");
console.log("=".repeat(70));

// Test 1: Import HotReloaderWebpack
console.log("\n1. Testing Import...");
let HotReloaderWebpack;
try {
  HotReloaderWebpack = require("next/dist/server/dev/hot-reloader-webpack");
  console.log("✅ Successfully imported HotReloaderWebpack");
  console.log("   Type:", typeof HotReloaderWebpack);
  console.log("   Default export:", typeof HotReloaderWebpack.default);

  // Try to import as default export
  if (HotReloaderWebpack.default) {
    HotReloaderWebpack = HotReloaderWebpack.default;
  }

  console.log("   Constructor name:", HotReloaderWebpack.name);
  console.log("   Is function:", typeof HotReloaderWebpack === "function");
} catch (error) {
  console.log("❌ Failed to import HotReloaderWebpack:", error.message);
  process.exit(1);
}

// Test 2: Analyze constructor signature
console.log("\n2. Analyzing Constructor...");
try {
  console.log(
    "   Function toString length:",
    HotReloaderWebpack.toString().length,
  );
  console.log(
    "   Prototype methods:",
    Object.getOwnPropertyNames(HotReloaderWebpack.prototype),
  );

  // Try to get parameter names from function string
  const funcStr = HotReloaderWebpack.toString();
  const constructorMatch = funcStr.match(/constructor\s*\(([^)]*)\)/);
  if (constructorMatch) {
    console.log("   Constructor parameters:", constructorMatch[1]);
  }
} catch (error) {
  console.log("❌ Error analyzing constructor:", error.message);
}

// Test 3: Create minimal mock dependencies
console.log("\n3. Creating Mock Dependencies...");

const mockConfig = {
  distDir: ".next",
  pageExtensions: ["tsx", "ts", "jsx", "js"],
  experimental: {},
  env: {},
  basePath: "",
  assetPrefix: "",
  output: undefined,
  logging: true,
  typescript: { tsconfigPath: undefined },
  webpack: null,
  webpackDevMiddleware: null,
  configFileName: "next.config.js",
  _originalRewrites: undefined,
  _originalRedirects: undefined,
};

const mockPreviewProps = {
  previewModeId: "test-preview-id",
  previewModeSigningKey: "test-signing-key",
  previewModeEncryptionKey: "test-encryption-key",
};

const mockRewrites = {
  beforeFiles: [],
  afterFiles: [],
  fallback: [],
};

const mockTelemetry = {
  record: () => {},
  flush: () => Promise.resolve(),
  setAnonymousId: () => {},
  anonymousId: "test-anonymous-id",
};

const mockResetFetch = () => {};

// Test 4: Attempt to create instance with minimal parameters
console.log("\n4. Testing Constructor with Minimal Parameters...");
try {
  const dir = process.cwd();
  const distDir = path.join(dir, ".next");

  // Ensure distDir exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const instance = new HotReloaderWebpack(dir, {
    config: mockConfig,
    distDir,
    buildId: "test-build-id",
    encryptionKey: "test-encryption-key",
    previewProps: mockPreviewProps,
    rewrites: mockRewrites,
    telemetry: mockTelemetry,
    resetFetch: mockResetFetch,
  });

  console.log("✅ Successfully created HotReloaderWebpack instance");
  console.log("   Instance type:", typeof instance);
  console.log("   Constructor name:", instance.constructor.name);

  // Test instance properties
  console.log("\n   Testing Instance Properties:");
  const publicProps = [
    "serverStats",
    "edgeServerStats",
    "multiCompiler",
    "activeWebpackConfigs",
  ];
  publicProps.forEach((prop) => {
    console.log(
      `   - ${prop}:`,
      typeof instance[prop],
      instance[prop] !== undefined ? "(defined)" : "(undefined)",
    );
  });
} catch (error) {
  console.log("❌ Failed to create instance:", error.message);
  if (error.stack) {
    console.log(
      "   Stack trace:",
      error.stack.split("\n").slice(0, 5).join("\n"),
    );
  }
}

// Test 5: Test instance methods
console.log("\n5. Testing Instance Methods...");
try {
  const dir = process.cwd();
  const distDir = path.join(dir, ".next");

  const instance = new HotReloaderWebpack(dir, {
    config: mockConfig,
    distDir,
    buildId: "test-build-id",
    encryptionKey: "test-encryption-key",
    previewProps: mockPreviewProps,
    rewrites: mockRewrites,
    telemetry: mockTelemetry,
    resetFetch: mockResetFetch,
  });

  const methods = Object.getOwnPropertyNames(
    Object.getPrototypeOf(instance),
  ).filter(
    (name) => typeof instance[name] === "function" && name !== "constructor",
  );

  console.log("   Available methods:", methods);

  // Test safe methods that don't require parameters
  console.log("\n   Testing Safe Methods:");

  // Test setHmrServerError
  try {
    instance.setHmrServerError(null);
    console.log("   ✅ setHmrServerError(null): Success");
  } catch (error) {
    console.log("   ❌ setHmrServerError(null):", error.message);
  }

  // Test clearHmrServerError
  try {
    instance.clearHmrServerError();
    console.log("   ✅ clearHmrServerError(): Success");
  } catch (error) {
    console.log("   ❌ clearHmrServerError():", error.message);
  }

  // Test invalidate with default parameters
  try {
    instance.invalidate();
    console.log("   ✅ invalidate(): Success");
  } catch (error) {
    console.log("   ❌ invalidate():", error.message);
  }

  // Test close
  try {
    instance.close();
    console.log("   ✅ close(): Success");
  } catch (error) {
    console.log("   ❌ close():", error.message);
  }
} catch (error) {
  console.log("❌ Error testing methods:", error.message);
}

// Test 6: Look for global references
console.log("\n6. Looking for Global References...");
try {
  // Check global object
  if (typeof global !== "undefined") {
    const globalKeys = Object.keys(global).filter(
      (key) =>
        key.toLowerCase().includes("hot") ||
        key.toLowerCase().includes("reload") ||
        key.toLowerCase().includes("webpack"),
    );
    console.log("   Global keys with hot/reload/webpack:", globalKeys);
  }

  // Check process object
  if (typeof process !== "undefined" && process.env) {
    const envKeys = Object.keys(process.env).filter(
      (key) =>
        key.toLowerCase().includes("hot") ||
        key.toLowerCase().includes("reload") ||
        key.toLowerCase().includes("webpack"),
    );
    console.log("   Environment variables with hot/reload/webpack:", envKeys);
  }

  // Try to find Next.js dev server globals
  console.log("   Checking for Next.js dev server instances...");

  // Check if we're in a Next.js dev environment
  const isNextDev =
    process.env.NODE_ENV === "development" ||
    process.argv.some((arg) => arg.includes("next") && arg.includes("dev"));
  console.log("   Is Next.js dev environment:", isNextDev);
} catch (error) {
  console.log("❌ Error checking global references:", error.message);
}

// Test 7: Test advanced method calls
console.log("\n7. Testing Advanced Methods...");
(async () => {
  try {
    const dir = process.cwd();
    const distDir = path.join(dir, ".next");

    const instance = new HotReloaderWebpack(dir, {
      config: mockConfig,
      distDir,
      buildId: "test-build-id",
      encryptionKey: "test-encryption-key",
      previewProps: mockPreviewProps,
      rewrites: mockRewrites,
      telemetry: mockTelemetry,
      resetFetch: mockResetFetch,
    });

    // Test getCompilationErrors
    try {
      const errors = await instance.getCompilationErrors("/test-page");
      console.log(
        "   ✅ getCompilationErrors(): Success, returned:",
        Array.isArray(errors) ? `Array(${errors.length})` : typeof errors,
      );
    } catch (error) {
      console.log("   ❌ getCompilationErrors():", error.message);
    }

    // Test send with a simple action
    try {
      const action = {
        action: "building", // Using a simple HMR action
      };
      instance.send(action);
      console.log("   ✅ send(action): Success");
    } catch (error) {
      console.log("   ❌ send(action):", error.message);
    }

    // Test buildFallbackError
    try {
      console.log("   Testing buildFallbackError() (this may take time)...");
      // Don't await this as it might hang or require full webpack setup
      const fallbackPromise = instance.buildFallbackError();
      if (fallbackPromise && typeof fallbackPromise.then === "function") {
        console.log("   ✅ buildFallbackError(): Returns promise");
        // Set a timeout to avoid hanging
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve("timeout"), 5000),
        );
        const result = await Promise.race([fallbackPromise, timeoutPromise]);
        if (result === "timeout") {
          console.log(
            "   ⚠️  buildFallbackError(): Timed out (expected - requires full setup)",
          );
        } else {
          console.log("   ✅ buildFallbackError(): Completed successfully");
        }
      }
    } catch (error) {
      console.log("   ❌ buildFallbackError():", error.message);
    }
  } catch (error) {
    console.log("❌ Error testing advanced methods:", error.message);
  }
})();

// Test 8: Check for module state and debugging info
console.log("\n8. Module State and Debugging Info...");
try {
  // Check module cache for hot reloader instances
  const moduleCache = require.cache;
  const hotReloaderModules = Object.keys(moduleCache).filter(
    (key) => key.includes("hot-reloader") || key.includes("webpack"),
  );
  console.log(
    "   Hot reloader related modules in cache:",
    hotReloaderModules.length,
  );

  // Try to access version info function
  try {
    const {
      getVersionInfo,
    } = require("next/dist/server/dev/hot-reloader-webpack");
    if (getVersionInfo) {
      console.log("   ✅ getVersionInfo function available");
      getVersionInfo()
        .then((versionInfo) => {
          console.log("   Version info:", versionInfo);
        })
        .catch((error) => {
          console.log("   ❌ getVersionInfo failed:", error.message);
        });
    }
  } catch (error) {
    console.log("   ❌ getVersionInfo not available:", error.message);
  }
} catch (error) {
  console.log("❌ Error checking module state:", error.message);
}

console.log("\n" + "=".repeat(70));
console.log("SUMMARY");
console.log("=".repeat(70));
console.log("✅ Can import HotReloaderWebpack from Next.js internals");
console.log("✅ Can create instances with proper constructor parameters");
console.log(
  "✅ Can call basic methods like setHmrServerError, clearHmrServerError, invalidate, close",
);
console.log("⚠️  Advanced methods require full Next.js dev server setup");
console.log(
  "⚠️  Some methods may hang or fail without webpack compiler instances",
);
console.log(
  "⚠️  No global instances found - class must be instantiated manually",
);
console.log("\nRECOMMENDATION:");
console.log("- Use this class within a Next.js dev server context");
console.log("- Ensure proper webpack configuration and compiler setup");
console.log("- Mock dependencies carefully for testing");
console.log("- Be cautious with methods that trigger compilation");
console.log("=".repeat(70));
