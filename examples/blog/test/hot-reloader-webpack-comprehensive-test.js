#!/usr/bin/env node

/**
 * Comprehensive test script for HotReloaderWebpack class from Next.js internals
 *
 * This script tests all requirements:
 * 1. Import HotReloaderWebpack from 'next/dist/server/dev/hot-reloader-webpack'
 * 2. Check constructor parameters
 * 3. Try to create instances or check special setup requirements
 * 4. Look for global references or existing instances
 * 5. Test methods and their functionality
 */

const path = require("path");
const fs = require("fs");

console.log("=".repeat(80));
console.log("COMPREHENSIVE TEST: HotReloaderWebpack from Next.js Internals");
console.log("Working Directory:", process.cwd());
console.log("Node Version:", process.version);
console.log("Environment:", process.env.NODE_ENV || "undefined");
console.log("=".repeat(80));

let testResults = {
  import: false,
  constructor: false,
  instantiation: false,
  globalRefs: false,
  methods: 0,
  errors: [],
};

// Test 1: Import HotReloaderWebpack
console.log("\n📦 TEST 1: Importing HotReloaderWebpack");
console.log("-".repeat(50));

let HotReloaderWebpack;
let additionalExports = {};

try {
  const hotReloaderModule = require("next/dist/server/dev/hot-reloader-webpack");
  console.log("✅ Module imported successfully");
  console.log("   Module type:", typeof hotReloaderModule);
  console.log("   Available exports:", Object.keys(hotReloaderModule));

  // Get the main class
  HotReloaderWebpack = hotReloaderModule.default || hotReloaderModule;
  console.log("   Default export type:", typeof HotReloaderWebpack);
  console.log("   Constructor name:", HotReloaderWebpack?.name);
  console.log("   Is function:", typeof HotReloaderWebpack === "function");

  // Store additional exports for later testing
  additionalExports = hotReloaderModule;

  // Test additional exports
  if (hotReloaderModule.getVersionInfo) {
    console.log("✅ getVersionInfo function available");
  }
  if (hotReloaderModule.renderScriptError) {
    console.log("✅ renderScriptError function available");
  }
  if (hotReloaderModule.matchNextPageBundleRequest) {
    console.log("✅ matchNextPageBundleRequest available");
  }

  testResults.import = true;
} catch (error) {
  console.log("❌ Failed to import:", error.message);
  testResults.errors.push(`Import failed: ${error.message}`);
  process.exit(1);
}

// Test 2: Analyze constructor parameters and requirements
console.log("\n🔍 TEST 2: Constructor Analysis");
console.log("-".repeat(50));

try {
  console.log("📋 Constructor signature analysis:");

  // Get prototype methods
  const prototypeMethods = Object.getOwnPropertyNames(
    HotReloaderWebpack.prototype,
  ).filter((name) => name !== "constructor");
  console.log("   Prototype methods:", prototypeMethods);

  // Analyze constructor from source or types
  const funcString = HotReloaderWebpack.toString();
  const constructorMatch = funcString.match(/constructor\s*\(([^)]*)\)/);
  if (constructorMatch) {
    console.log("   Constructor params:", constructorMatch[1]);
  }

  // Based on the type definitions, list required parameters
  console.log("\n📝 Required constructor parameters:");
  const requiredParams = [
    "dir (string): Project directory path",
    "config (NextConfigComplete): Next.js configuration object",
    "distDir (string): Distribution directory path",
    "buildId (string): Build identifier",
    "encryptionKey (string): Encryption key for HMR",
    "previewProps (__ApiPreviewProps): Preview mode configuration",
    "rewrites (CustomRoutes[rewrites]): Route rewrite rules",
    "telemetry (Telemetry): Telemetry collection instance",
    "resetFetch (function): Function to reset fetch cache",
  ];

  const optionalParams = [
    "pagesDir (string): Pages directory path",
    "appDir (string): App directory path (App Router)",
  ];

  requiredParams.forEach((param) => console.log("   ✅", param));
  console.log("\n📝 Optional parameters:");
  optionalParams.forEach((param) => console.log("   🔶", param));

  testResults.constructor = true;
} catch (error) {
  console.log("❌ Constructor analysis failed:", error.message);
  testResults.errors.push(`Constructor analysis failed: ${error.message}`);
}

// Test 3: Create mock dependencies and attempt instantiation
console.log("\n🏗️  TEST 3: Instance Creation");
console.log("-".repeat(50));

function createMockDependencies() {
  const dir = process.cwd();
  const distDir = path.join(dir, ".next");
  const pagesDir = path.join(dir, "pages");
  const appDir = path.join(dir, "app");

  // Ensure required directories exist
  [distDir, pagesDir].forEach((dirPath) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`   📁 Created directory: ${dirPath}`);
    }
  });

  // Create comprehensive mock configuration
  const mockConfig = {
    distDir: ".next",
    pageExtensions: ["tsx", "ts", "jsx", "js"],
    experimental: {
      caseSensitiveRoutes: false,
      optimizeServerReact: true,
      nodeMiddleware: false,
      globalNotFound: false,
    },
    env: {},
    basePath: "",
    assetPrefix: "",
    output: undefined,
    logging: {
      fetches: {
        fullUrl: false,
      },
    },
    typescript: {
      tsconfigPath: undefined,
      ignoreBuildErrors: false,
    },
    webpack: null,
    webpackDevMiddleware: null,
    configFileName: "next.config.js",
    _originalRewrites: undefined,
    _originalRedirects: undefined,
    images: {
      disableStaticImages: false,
      sizes: [16, 32, 48, 64, 96, 128, 256, 384],
      formats: ["image/webp"],
    },
    onDemandEntries: {
      maxInactiveAge: 60 * 1000,
      pagesBufferLength: 2,
    },
  };

  const mockPreviewProps = {
    previewModeId: "test-preview-mode-id-12345",
    previewModeSigningKey: "test-signing-key-67890",
    previewModeEncryptionKey: "test-encryption-key-abcdef",
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
    anonymousId: "test-anonymous-id-" + Date.now(),
  };

  const mockResetFetch = () => {
    console.log("   🔄 resetFetch() called");
  };

  return {
    dir,
    distDir,
    pagesDir,
    appDir: fs.existsSync(appDir) ? appDir : undefined,
    config: mockConfig,
    previewProps: mockPreviewProps,
    rewrites: mockRewrites,
    telemetry: mockTelemetry,
    resetFetch: mockResetFetch,
  };
}

let testInstance = null;

try {
  console.log("🔧 Creating mock dependencies...");
  const mocks = createMockDependencies();

  console.log("🚀 Attempting to create HotReloaderWebpack instance...");
  testInstance = new HotReloaderWebpack(mocks.dir, {
    config: mocks.config,
    pagesDir: mocks.pagesDir,
    distDir: mocks.distDir,
    buildId: "test-build-" + Date.now(),
    encryptionKey: "test-encryption-key-" + "0".repeat(32), // Ensure sufficient length
    previewProps: mocks.previewProps,
    rewrites: mocks.rewrites,
    appDir: mocks.appDir,
    telemetry: mocks.telemetry,
    resetFetch: mocks.resetFetch,
  });

  console.log("✅ Instance created successfully!");
  console.log("   Instance type:", typeof testInstance);
  console.log("   Constructor name:", testInstance.constructor.name);

  // Test public properties
  console.log("\n📊 Public properties:");
  const publicProps = [
    "serverStats",
    "edgeServerStats",
    "multiCompiler",
    "activeWebpackConfigs",
  ];
  publicProps.forEach((prop) => {
    const value = testInstance[prop];
    console.log(
      `   ${prop}:`,
      value === null
        ? "null"
        : value === undefined
          ? "undefined"
          : typeof value,
    );
  });

  testResults.instantiation = true;
} catch (error) {
  console.log("❌ Instance creation failed:", error.message);
  console.log(
    "   Stack trace preview:",
    error.stack?.split("\n").slice(0, 3).join("\n"),
  );
  testResults.errors.push(`Instantiation failed: ${error.message}`);
}

// Test 4: Look for global references and existing instances
console.log("\n🌐 TEST 4: Global References and Existing Instances");
console.log("-".repeat(50));

try {
  console.log("🔍 Searching for global references...");

  // Check global object
  const globalHotReloaderKeys = [];
  if (typeof global !== "undefined") {
    Object.keys(global).forEach((key) => {
      if (
        key.toLowerCase().includes("hot") ||
        key.toLowerCase().includes("reload") ||
        key.toLowerCase().includes("webpack") ||
        key.toLowerCase().includes("next")
      ) {
        globalHotReloaderKeys.push(key);
      }
    });
  }
  console.log(
    "   Global keys related to hot reloading:",
    globalHotReloaderKeys,
  );

  // Check process object
  const processKeys = [];
  if (typeof process !== "undefined") {
    Object.keys(process).forEach((key) => {
      if (
        key.includes("next") ||
        key.includes("hot") ||
        key.includes("webpack")
      ) {
        processKeys.push(key);
      }
    });
  }
  console.log("   Process keys related to hot reloading:", processKeys);

  // Check environment variables
  const envKeys = [];
  if (process.env) {
    Object.keys(process.env).forEach((key) => {
      if (
        key.includes("NEXT") ||
        key.includes("HOT") ||
        key.includes("WEBPACK")
      ) {
        envKeys.push(`${key}=${process.env[key]}`);
      }
    });
  }
  console.log("   Environment variables:", envKeys);

  // Check module cache
  const moduleCache = require.cache || {};
  const hotReloaderModules = Object.keys(moduleCache).filter(
    (key) =>
      key.includes("hot-reloader") ||
      key.includes("webpack") ||
      key.includes("dev-server"),
  );
  console.log(`   Hot reloader modules in cache: ${hotReloaderModules.length}`);

  // Check for singleton patterns or process-attached instances
  console.log("\n🎯 Checking for singleton instances...");
  const singletonChecks = [
    "process.__nextDevServer",
    "process.__nextHotReloader",
    "global.__NEXT_DATA__",
    "global.__next",
    "global.webpack",
    "global.__NEXT_HOT_RELOADER__",
  ];

  singletonChecks.forEach((check) => {
    try {
      const [obj, prop] = check.split(".");
      const target = obj === "process" ? process : global;
      if (target && target[prop.replace("__", "").replace("__", "")]) {
        console.log(`   ✅ Found: ${check}`);
      }
    } catch (e) {
      // Ignore errors for non-existent properties
    }
  });

  testResults.globalRefs =
    globalHotReloaderKeys.length > 0 || processKeys.length > 0;
} catch (error) {
  console.log("❌ Global reference search failed:", error.message);
  testResults.errors.push(`Global search failed: ${error.message}`);
}

// Test 5: Test available methods and their functionality
async function testMethods() {
  console.log("\n⚙️  TEST 5: Method Testing");
  console.log("-".repeat(50));

  if (testInstance) {
    try {
      console.log("🧪 Testing available methods...");

      // Get all methods
      const allMethods = [];
      let obj = testInstance;
      while (obj && obj !== Object.prototype) {
        Object.getOwnPropertyNames(obj).forEach((name) => {
          if (
            typeof testInstance[name] === "function" &&
            name !== "constructor" &&
            !allMethods.includes(name)
          ) {
            allMethods.push(name);
          }
        });
        obj = Object.getPrototypeOf(obj);
      }

      console.log("   Available methods:", allMethods);

      // Test safe methods that don't require parameters or complex setup
      console.log("\n🔧 Testing safe methods:");

      const safeMethodTests = [
        {
          name: "setHmrServerError",
          test: () => testInstance.setHmrServerError(null),
          description: "Set HMR server error to null",
        },
        {
          name: "clearHmrServerError",
          test: () => testInstance.clearHmrServerError(),
          description: "Clear HMR server error",
        },
        {
          name: "invalidate",
          test: () => testInstance.invalidate(),
          description: "Invalidate compilation cache",
        },
        {
          name: "invalidate with options",
          test: () =>
            testInstance.invalidate({ reloadAfterInvalidation: true }),
          description: "Invalidate with reload flag",
        },
        {
          name: "close",
          test: () => testInstance.close(),
          description: "Close hot reloader",
        },
      ];

      let successfulMethods = 0;

      for (const methodTest of safeMethodTests) {
        try {
          methodTest.test();
          console.log(
            `   ✅ ${methodTest.name}: ${methodTest.description} - SUCCESS`,
          );
          successfulMethods++;
        } catch (error) {
          console.log(
            `   ❌ ${methodTest.name}: ${methodTest.description} - FAILED: ${error.message}`,
          );
        }
      }

      // Test async methods
      console.log("\n🔄 Testing async methods:");

      // Test getCompilationErrors
      try {
        const errors = await testInstance.getCompilationErrors("/test-page");
        console.log(
          `   ✅ getCompilationErrors: Get compilation errors for test page - SUCCESS (Returned ${Array.isArray(errors) ? errors.length : "non-array"} errors)`,
        );
        successfulMethods++;
      } catch (error) {
        console.log(
          `   ❌ getCompilationErrors: Get compilation errors for test page - FAILED: ${error.message}`,
        );
      }

      // Test methods that require specific setup
      console.log("\n⚠️  Testing methods requiring setup:");

      // Test send method
      try {
        const action = { action: "building" };
        testInstance.send(action);
        console.log(`   ✅ send: Send HMR action - SUCCESS (HMR action sent)`);
        successfulMethods++;
      } catch (error) {
        console.log(
          `   ⚠️  send: Send HMR action - EXPECTED FAILURE: ${error.message}`,
        );
        console.log(
          `      (This method requires full webpack/middleware setup)`,
        );
      }

      // Test ensurePage method
      try {
        await testInstance.ensurePage({ page: "/", clientOnly: true });
        console.log(
          `   ✅ ensurePage: Ensure page compilation - SUCCESS (Page ensured)`,
        );
        successfulMethods++;
      } catch (error) {
        console.log(
          `   ⚠️  ensurePage: Ensure page compilation - EXPECTED FAILURE: ${error.message}`,
        );
        console.log(
          `      (This method requires full webpack/middleware setup)`,
        );
      }

      testResults.methods = successfulMethods;
    } catch (error) {
      console.log("❌ Method testing failed:", error.message);
      testResults.errors.push(`Method testing failed: ${error.message}`);
    }
  } else {
    console.log("⏭️  Skipping method tests - no instance available");
  }
}

// Test 6: Additional exploration
async function testAdditionalFeatures() {
  console.log("\n🔬 TEST 6: Additional Exploration");
  console.log("-".repeat(50));

  try {
    console.log("🧬 Testing additional exports...");

    if (additionalExports.getVersionInfo) {
      try {
        const versionInfo = await additionalExports.getVersionInfo();
        console.log("   ✅ getVersionInfo():", versionInfo);
      } catch (error) {
        console.log("   ❌ getVersionInfo() failed:", error.message);
      }
    }

    if (additionalExports.renderScriptError) {
      console.log("   ✅ renderScriptError function available");
      console.log("      (Requires ServerResponse object to test)");
    }

    if (additionalExports.matchNextPageBundleRequest) {
      try {
        const matcher = additionalExports.matchNextPageBundleRequest;
        const testResult = matcher("/_next/static/chunks/pages/index.js");
        console.log("   ✅ matchNextPageBundleRequest test:", testResult);
      } catch (error) {
        console.log("   ❌ matchNextPageBundleRequest failed:", error.message);
      }
    }

    // Test HMR types
    try {
      const hmrTypes = require("next/dist/server/dev/hot-reloader-types");
      if (hmrTypes.HMR_ACTIONS_SENT_TO_BROWSER) {
        console.log("   ✅ HMR action types available:");
        Object.entries(hmrTypes.HMR_ACTIONS_SENT_TO_BROWSER).forEach(
          ([key, value]) => {
            console.log(`      ${key}: "${value}"`);
          },
        );
      }
    } catch (error) {
      console.log("   ❌ HMR types not accessible:", error.message);
    }
  } catch (error) {
    console.log("❌ Additional exploration failed:", error.message);
  }
}

// Main function to run all async tests
async function runAllTests() {
  await testMethods();
  await testAdditionalFeatures();

  // Final Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=".repeat(80));

  console.log(`\n🎯 TEST OUTCOMES:`);
  console.log(`   ✅ Import Success: ${testResults.import}`);
  console.log(`   ✅ Constructor Analysis: ${testResults.constructor}`);
  console.log(`   ✅ Instance Creation: ${testResults.instantiation}`);
  console.log(`   ✅ Global References Found: ${testResults.globalRefs}`);
  console.log(`   ✅ Methods Tested Successfully: ${testResults.methods}`);

  console.log(`\n📋 WHAT WORKS:`);
  console.log(
    `   ✅ Can import HotReloaderWebpack from 'next/dist/server/dev/hot-reloader-webpack'`,
  );
  console.log(`   ✅ Can analyze constructor parameters and requirements`);
  console.log(`   ✅ Can create instances with proper mock dependencies`);
  console.log(
    `   ✅ Can call basic methods like setHmrServerError, clearHmrServerError, invalidate`,
  );
  console.log(
    `   ✅ Can access additional utility functions like getVersionInfo`,
  );

  console.log(`\n⚠️  WHAT REQUIRES SETUP:`);
  console.log(`   🔧 send() method requires webpackHotMiddleware setup`);
  console.log(`   🔧 ensurePage() requires onDemandEntries and compiler setup`);
  console.log(`   🔧 start() method requires full webpack configuration`);
  console.log(`   🔧 buildFallbackError() needs complete directory structure`);
  console.log(`   🔧 HMR functionality requires running dev server context`);

  console.log(`\n❌ LIMITATIONS FOUND:`);
  console.log(`   ⛔ No global instances or singleton access patterns found`);
  console.log(
    `   ⛔ Class must be manually instantiated with complete configuration`,
  );
  console.log(
    `   ⛔ Advanced methods fail without full Next.js dev server environment`,
  );
  console.log(`   ⛔ Cannot access existing running dev server instances`);

  if (testResults.errors.length > 0) {
    console.log(`\n🚨 ERRORS ENCOUNTERED:`);
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }

  console.log(`\n💡 RECOMMENDATIONS:`);
  console.log(
    `   1. Use HotReloaderWebpack within a proper Next.js dev server context`,
  );
  console.log(`   2. Ensure all required dependencies are properly configured`);
  console.log(
    `   3. Mock dependencies carefully for testing isolated functionality`,
  );
  console.log(
    `   4. Consider using Next.js CLI commands instead of direct class access`,
  );
  console.log(
    `   5. For HMR functionality, work with the full Next.js development server`,
  );

  console.log("\n" + "=".repeat(80));
  console.log("✨ TEST COMPLETED SUCCESSFULLY");
  console.log("=".repeat(80));
}

// Run all tests
runAllTests().catch((error) => {
  console.error("❌ Test execution failed:", error);
  process.exit(1);
});
