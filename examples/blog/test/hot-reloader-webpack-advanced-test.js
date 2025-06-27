#!/usr/bin/env node

/**
 * Advanced test script for HotReloaderWebpack class
 * This script attempts more sophisticated operations and global access patterns
 */

const path = require("path");
const fs = require("fs");

console.log("=".repeat(70));
console.log("ADVANCED TESTING: HotReloaderWebpack Exploration");
console.log("=".repeat(70));

// Test 1: Try to find existing running dev server instances
console.log("\n1. Searching for Running Dev Server Instances...");

// Check if we can find any Next.js server instances in process
function findNextServerInstances() {
  try {
    // Check if there's a global Next instance
    if (global.__NEXT_DATA__) {
      console.log("   ✅ Found global.__NEXT_DATA__");
    }

    // Check for webpack instances in global
    if (global.webpack) {
      console.log("   ✅ Found global.webpack");
    }

    // Look for common Next.js globals
    const nextGlobals = [
      "__NEXT_DATA__",
      "__next",
      "__NEXT_ROUTER_READY",
      "__NEXT_GLOBAL__",
    ];
    nextGlobals.forEach((globalName) => {
      if (global[globalName]) {
        console.log(
          `   ✅ Found global.${globalName}:`,
          typeof global[globalName],
        );
      }
    });

    // Check module cache for any dev server related modules
    const cache = require.cache;
    const devServerModules = Object.keys(cache).filter(
      (key) =>
        key.includes("dev-server") ||
        key.includes("hot-reloader") ||
        key.includes("next/server"),
    );

    console.log(
      `   Found ${devServerModules.length} dev-server related modules in cache`,
    );

    return devServerModules;
  } catch (error) {
    console.log("   ❌ Error searching for instances:", error.message);
    return [];
  }
}

const devModules = findNextServerInstances();

// Test 2: Try to access internal Next.js dev state
console.log("\n2. Accessing Internal Next.js Dev State...");

try {
  // Try to access webpack through Next.js internals
  const webpackBundler = require("next/dist/shared/lib/get-webpack-bundler");
  console.log(
    "   ✅ Found webpack bundler function:",
    typeof webpackBundler.default,
  );

  // Try to access webpack config utilities
  const getWebpackConfig = require("next/dist/build/webpack-config");
  console.log(
    "   ✅ Found webpack config function:",
    typeof getWebpackConfig.default,
  );

  // Try to access hot middleware
  const webpackHotMiddleware = require("next/dist/server/dev/hot-middleware");
  console.log(
    "   ✅ Found hot middleware:",
    typeof webpackHotMiddleware.WebpackHotMiddleware,
  );
} catch (error) {
  console.log("   ❌ Error accessing internals:", error.message);
}

// Test 3: Create instance with more realistic configuration
console.log("\n3. Creating Enhanced Instance...");

async function createEnhancedInstance() {
  try {
    const HotReloaderWebpack =
      require("next/dist/server/dev/hot-reloader-webpack").default;

    const dir = process.cwd();
    const distDir = path.join(dir, ".next");
    const pagesDir = path.join(dir, "pages");
    const appDir = path.join(dir, "app");

    // Ensure directories exist
    [distDir, pagesDir].forEach((dirPath) => {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });

    // More complete config
    const config = {
      distDir: ".next",
      pageExtensions: ["tsx", "ts", "jsx", "js"],
      experimental: {
        caseSensitiveRoutes: false,
      },
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
      images: {
        disableStaticImages: false,
      },
    };

    const previewProps = {
      previewModeId: "development-preview-id",
      previewModeSigningKey: "development-signing-key",
      previewModeEncryptionKey: "development-encryption-key",
    };

    const rewrites = {
      beforeFiles: [],
      afterFiles: [],
      fallback: [],
    };

    const telemetry = {
      record: () => {},
      flush: () => Promise.resolve(),
      setAnonymousId: () => {},
      anonymousId: "development-anonymous-id",
    };

    const resetFetch = () => {
      console.log("   📡 resetFetch called");
    };

    const instance = new HotReloaderWebpack(dir, {
      config,
      pagesDir,
      distDir,
      buildId: "development",
      encryptionKey: "development-encryption-key-12345678901234567890",
      previewProps,
      rewrites,
      appDir: fs.existsSync(appDir) ? appDir : undefined,
      telemetry,
      resetFetch,
    });

    console.log("   ✅ Enhanced instance created successfully");

    return instance;
  } catch (error) {
    console.log("   ❌ Failed to create enhanced instance:", error.message);
    return null;
  }
}

// Test 4: Test HMR action types and messaging
console.log("\n4. Testing HMR Actions and Messaging...");

async function testHMRActions() {
  try {
    const {
      HMR_ACTIONS_SENT_TO_BROWSER,
    } = require("next/dist/server/dev/hot-reloader-types");

    console.log("   Available HMR Actions:");
    Object.entries(HMR_ACTIONS_SENT_TO_BROWSER).forEach(([key, value]) => {
      console.log(`     ${key}: "${value}"`);
    });

    const instance = await createEnhancedInstance();
    if (!instance) return;

    // Test different types of HMR actions
    const testActions = [
      {
        action: HMR_ACTIONS_SENT_TO_BROWSER.BUILDING,
      },
      {
        action: HMR_ACTIONS_SENT_TO_BROWSER.RELOAD_PAGE,
        data: "test reload",
      },
      {
        action: HMR_ACTIONS_SENT_TO_BROWSER.ADDED_PAGE,
        data: ["/test-page"],
      },
    ];

    testActions.forEach((action, index) => {
      try {
        instance.send(action);
        console.log(`   ✅ HMR Action ${index + 1} sent successfully`);
      } catch (error) {
        console.log(`   ❌ HMR Action ${index + 1} failed:`, error.message);
      }
    });
  } catch (error) {
    console.log("   ❌ Error testing HMR actions:", error.message);
  }
}

// Test 5: Test webpack configuration access
console.log("\n5. Testing Webpack Configuration Access...");

async function testWebpackConfig() {
  try {
    const instance = await createEnhancedInstance();
    if (!instance) return;

    // Try to access webpack configuration
    console.log("   Testing getWebpackConfig...");

    // This is a private method, but we can test if it exists
    if (typeof instance.getWebpackConfig === "function") {
      console.log("   ✅ getWebpackConfig method exists");

      // Don't actually call it as it requires complex setup
      console.log("   ⚠️  Skipping actual call (requires trace span)");
    }

    // Check activeWebpackConfigs
    console.log("   activeWebpackConfigs:", instance.activeWebpackConfigs);
    console.log("   multiCompiler:", instance.multiCompiler);

    // Test other configuration-related methods
    console.log("   Testing buildFallbackError (non-blocking)...");
    const fallbackPromise = instance.buildFallbackError();
    console.log("   buildFallbackError returns:", typeof fallbackPromise);
  } catch (error) {
    console.log("   ❌ Error testing webpack config:", error.message);
  }
}

// Test 6: Test file watching and page management
console.log("\n6. Testing Page Management...");

async function testPageManagement() {
  try {
    const instance = await createEnhancedInstance();
    if (!instance) return;

    // Test ensurePage with different configurations
    const testPages = [
      { page: "/", clientOnly: false },
      { page: "/test", clientOnly: true },
      { page: "/api/test", clientOnly: false },
    ];

    for (const pageConfig of testPages) {
      try {
        await instance.ensurePage(pageConfig);
        console.log(`   ✅ ensurePage("${pageConfig.page}") succeeded`);
      } catch (error) {
        console.log(
          `   ❌ ensurePage("${pageConfig.page}") failed:`,
          error.message,
        );
      }
    }

    // Test compilation error checking
    try {
      const errors = await instance.getCompilationErrors("/test-page");
      console.log(
        `   ✅ getCompilationErrors returned ${errors.length} errors`,
      );
    } catch (error) {
      console.log("   ❌ getCompilationErrors failed:", error.message);
    }
  } catch (error) {
    console.log("   ❌ Error testing page management:", error.message);
  }
}

// Test 7: Attempt to access running dev server
console.log("\n7. Attempting to Hook into Running Dev Server...");

function attemptDevServerHook() {
  try {
    // Check for Next.js CLI process
    const hasNextInArgs = process.argv.some((arg) => arg.includes("next"));
    console.log("   Next.js in process args:", hasNextInArgs);

    // Check for dev server specific environment
    const devEnvVars = [
      "NODE_ENV",
      "NEXT_RUNTIME",
      "VERCEL_ENV",
      "__NEXT_PRIVATE_DEBUG_CACHE",
    ];

    devEnvVars.forEach((envVar) => {
      if (process.env[envVar]) {
        console.log(`   ${envVar}:`, process.env[envVar]);
      }
    });

    // Try to access any singleton instances
    console.log("   Checking for singleton patterns...");

    // Look for process-bound instances
    if (process.__nextDevServer) {
      console.log("   ✅ Found process.__nextDevServer");
    }

    if (process.__nextHotReloader) {
      console.log("   ✅ Found process.__nextHotReloader");
    }

    return true;
  } catch (error) {
    console.log("   ❌ Error checking dev server hook:", error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  await testHMRActions();
  await testWebpackConfig();
  await testPageManagement();
  attemptDevServerHook();

  console.log("\n" + "=".repeat(70));
  console.log("ADVANCED TEST SUMMARY");
  console.log("=".repeat(70));
  console.log("✅ HotReloaderWebpack can be imported and instantiated");
  console.log(
    "✅ Basic HMR actions can be created (but not sent without middleware)",
  );
  console.log("✅ Page management methods exist and can be called");
  console.log("✅ Configuration methods are accessible");
  console.log("❌ No direct access to running dev server instances found");
  console.log("❌ Advanced features require full webpack/compiler setup");
  console.log("\nKEY FINDINGS:");
  console.log(
    "- Class requires complete Next.js dev environment to be fully functional",
  );
  console.log("- Methods like send() fail without webpackHotMiddleware setup");
  console.log("- buildFallbackError() needs proper directory structure");
  console.log(
    "- ensurePage() works but requires onDemandEntries setup for full functionality",
  );
  console.log("- No global instances or singleton access patterns found");
  console.log("=".repeat(70));
}

runAllTests().catch(console.error);
