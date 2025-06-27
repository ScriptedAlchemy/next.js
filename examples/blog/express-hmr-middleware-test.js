/**
 * Express-style HMR Middleware Test
 * This script explores:
 * 1. Express-style middleware patterns for HMR
 * 2. Request/response interceptors for HMR endpoints
 * 3. Global HMR registry access patterns
 * 4. Integration with Next.js development server
 */

const { WebpackHotMiddleware } = require("next/dist/server/dev/hot-middleware");
const {
  HMR_ACTIONS_SENT_TO_BROWSER,
} = require("next/dist/server/dev/hot-reloader-types");

console.log("🔥 Express-style HMR Middleware Test\n");

// Express-style HMR middleware factory
function createHMRMiddleware(options = {}) {
  const { interceptors = {}, logLevel = "info", customActions = {} } = options;

  let hotMiddleware = null;
  let isInitialized = false;

  // Middleware function (Express-style)
  const middleware = (req, res, next) => {
    // Handle HMR-related requests
    if (req.url && req.url.startsWith("/__nextjs_original-stack-frame")) {
      console.log(`🔍 [${logLevel}] HMR stack frame request: ${req.url}`);
    } else if (req.url && req.url.startsWith("/__nextjs_launch-editor")) {
      console.log(`🔍 [${logLevel}] HMR launch editor request: ${req.url}`);
    } else if (req.url && req.url.includes("_next/webpack-hmr")) {
      console.log(`🔍 [${logLevel}] HMR webpack request: ${req.url}`);
    }

    // Apply interceptors based on URL patterns
    for (const [pattern, interceptor] of Object.entries(interceptors)) {
      if (req.url && req.url.includes(pattern)) {
        console.log(`🔧 Applying interceptor for pattern: ${pattern}`);
        return interceptor(req, res, next);
      }
    }

    if (next) next();
  };

  // Initialize HMR middleware
  middleware.init = (compilers, versionInfo, devtoolsUrl) => {
    if (isInitialized) {
      console.log("⚠️ HMR middleware already initialized");
      return middleware;
    }

    hotMiddleware = new WebpackHotMiddleware(
      compilers,
      versionInfo,
      devtoolsUrl,
    );
    isInitialized = true;

    console.log("✅ Express-style HMR middleware initialized");
    return middleware;
  };

  // Add custom action handler
  middleware.addAction = (actionName, handler) => {
    customActions[actionName] = handler;
    console.log(`✅ Added custom action: ${actionName}`);
    return middleware;
  };

  // Publish events through the middleware
  middleware.publish = (action, data = {}) => {
    if (!hotMiddleware) {
      console.log("❌ HMR middleware not initialized");
      return middleware;
    }

    // Check for custom action handlers
    if (customActions[action]) {
      const result = customActions[action](data);
      if (result === false) {
        console.log(`🚫 Custom action ${action} prevented default behavior`);
        return middleware;
      }
      if (result && typeof result === "object") {
        data = { ...data, ...result };
      }
    }

    const payload = {
      action,
      timestamp: Date.now(),
      ...data,
    };

    hotMiddleware.publish(payload);
    console.log(`📢 Published via middleware: ${action}`);
    return middleware;
  };

  // Handle WebSocket upgrades
  middleware.handleUpgrade = (request, socket, head) => {
    if (!hotMiddleware) {
      console.log("❌ Cannot handle upgrade - HMR middleware not initialized");
      return;
    }

    console.log("🔄 Handling WebSocket upgrade for HMR");
    // In a real implementation, this would handle the WebSocket upgrade
    // For testing, we'll simulate it
    const mockClient = {
      send: (data) => console.log("📡 WebSocket message:", JSON.parse(data)),
      addEventListener: (event, callback) =>
        console.log(`📝 WebSocket ${event} listener added`),
    };

    hotMiddleware.onHMR(mockClient);
  };

  // Get middleware instance
  middleware.getInstance = () => hotMiddleware;

  // Get connection stats
  middleware.getStats = () => {
    if (!hotMiddleware) return null;
    return {
      initialized: isInitialized,
      clientsConnected: hotMiddleware.eventStream.clients.size,
      customActions: Object.keys(customActions).length,
    };
  };

  return middleware;
}

// Test global HMR registry patterns
function testGlobalHMRRegistry() {
  console.log("🌐 Testing global HMR registry patterns...\n");

  // Create a global HMR registry
  const globalHMRRegistry = {
    middlewares: new Map(),
    broadcasters: new Set(),

    register(name, middleware) {
      this.middlewares.set(name, middleware);
      console.log(`📝 Registered HMR middleware: ${name}`);
      return this;
    },

    unregister(name) {
      const removed = this.middlewares.delete(name);
      if (removed) {
        console.log(`🗑️ Unregistered HMR middleware: ${name}`);
      }
      return this;
    },

    broadcast(action, data) {
      for (const [name, middleware] of this.middlewares) {
        if (middleware.publish) {
          console.log(`📢 Broadcasting ${action} to ${name}`);
          middleware.publish(action, data);
        }
      }
      return this;
    },

    getMiddleware(name) {
      return this.middlewares.get(name);
    },

    getAllMiddlewares() {
      return Array.from(this.middlewares.keys());
    },

    getStats() {
      const stats = {};
      for (const [name, middleware] of this.middlewares) {
        if (middleware.getStats) {
          stats[name] = middleware.getStats();
        }
      }
      return stats;
    },
  };

  // Make it globally accessible
  if (typeof global !== "undefined") {
    global.__NEXT_HMR_REGISTRY__ = globalHMRRegistry;
    console.log(
      "✅ Global HMR registry attached to global.__NEXT_HMR_REGISTRY__",
    );
  }

  return globalHMRRegistry;
}

// Main test function
async function runTests() {
  console.log("1. Creating Express-style HMR middleware...");

  // Create middleware with custom options
  const hmrMiddleware = createHMRMiddleware({
    interceptors: {
      "webpack-hmr": (req, res, next) => {
        console.log("🔧 Custom webpack-hmr interceptor triggered");
        // Add custom headers
        if (res.setHeader) {
          res.setHeader("X-Custom-HMR", "true");
        }
        if (next) next();
      },
      "_next/static": (req, res, next) => {
        console.log("🔧 Custom static file interceptor triggered");
        if (next) next();
      },
    },
    logLevel: "debug",
  });

  // Add custom actions
  hmrMiddleware
    .addAction("CUSTOM_BUILD_START", (data) => {
      console.log("🔨 Custom build start action triggered");
      return { buildId: Date.now(), ...data };
    })
    .addAction("CUSTOM_BUILD_END", (data) => {
      console.log("🏁 Custom build end action triggered");
      return { completedAt: Date.now(), ...data };
    });

  console.log("\n2. Initializing HMR middleware...");

  // Mock compilers for initialization
  const mockCompilers = [
    { hooks: { invalid: { tap: () => {} }, done: { tap: () => {} } } },
    { hooks: { invalid: { tap: () => {} }, done: { tap: () => {} } } },
    { hooks: { invalid: { tap: () => {} }, done: { tap: () => {} } } },
  ];

  hmrMiddleware.init(
    mockCompilers,
    { version: "14.0.0" },
    "http://localhost:3000",
  );

  console.log("\n3. Testing global HMR registry...");
  const registry = testGlobalHMRRegistry();

  // Register middlewares in the global registry
  registry
    .register("main", hmrMiddleware)
    .register("secondary", createHMRMiddleware({ logLevel: "error" }));

  console.log("   Registered middlewares:", registry.getAllMiddlewares());

  console.log("\n4. Testing Express-style request handling...");

  // Mock Express request/response objects
  const mockRequests = [
    { url: "/__nextjs_original-stack-frame?file=test.js" },
    { url: "/_next/webpack-hmr?page=/" },
    { url: "/_next/static/chunks/main.js" },
    { url: "/api/test" },
  ];

  mockRequests.forEach((req, index) => {
    console.log(`\n   Request ${index + 1}: ${req.url}`);
    const res = {
      setHeader: (key, value) =>
        console.log(`     Header set: ${key}=${value}`),
    };
    const next = () => console.log("     Next() called");

    hmrMiddleware(req, res, next);
  });

  console.log("\n5. Testing HMR event publishing...");

  // Test publishing various events
  hmrMiddleware
    .publish(HMR_ACTIONS_SENT_TO_BROWSER.BUILDING)
    .publish("CUSTOM_BUILD_START", { project: "test-app" })
    .publish(HMR_ACTIONS_SENT_TO_BROWSER.BUILT, {
      hash: "abc123",
      errors: [],
      warnings: [],
    })
    .publish("CUSTOM_BUILD_END", { status: "success" });

  console.log("\n6. Testing global registry broadcasting...");

  registry.broadcast(HMR_ACTIONS_SENT_TO_BROWSER.RELOAD_PAGE, {
    data: "/test-page",
  });

  console.log("\n7. Testing WebSocket upgrade simulation...");

  hmrMiddleware.handleUpgrade(
    { url: "/_next/webpack-hmr" },
    {}, // mock socket
    Buffer.from("mock-head"),
  );

  console.log("\n8. Final statistics...");

  console.log("   Middleware stats:", hmrMiddleware.getStats());
  console.log("   Registry stats:", registry.getStats());

  console.log("\n🎉 Express-style HMR middleware test completed!");

  // Test accessing global registry from another context
  setTimeout(() => {
    console.log("\n9. Testing global registry access...");
    if (global.__NEXT_HMR_REGISTRY__) {
      console.log("✅ Global HMR registry accessible");
      console.log(
        "   Available middlewares:",
        global.__NEXT_HMR_REGISTRY__.getAllMiddlewares(),
      );

      // Clean up
      delete global.__NEXT_HMR_REGISTRY__;
      console.log("🧹 Global registry cleaned up");
    }
  }, 1000);
}

// Run all tests
runTests().catch(console.error);
