/**
 * Advanced HMR Middleware Test
 * This script demonstrates:
 * 1. Creating a custom HMR middleware with hooks
 * 2. Intercepting and modifying HMR events
 * 3. Creating custom HMR event publishers
 * 4. Implementing middleware patterns for HMR control
 */

const { WebpackHotMiddleware } = require("next/dist/server/dev/hot-middleware");
const {
  HMR_ACTIONS_SENT_TO_BROWSER,
} = require("next/dist/server/dev/hot-reloader-types");
const EventEmitter = require("events");

console.log("🚀 Advanced HMR Middleware Test\n");

// Create a custom HMR middleware wrapper
class CustomHMRMiddleware extends EventEmitter {
  constructor() {
    super();
    this.middleware = null;
    this.interceptors = new Map();
    this.hooks = {
      beforePublish: [],
      afterPublish: [],
      onClientConnect: [],
      onClientDisconnect: [],
    };
  }

  // Initialize with a WebpackHotMiddleware instance
  initialize(compilers, versionInfo, devtoolsUrl) {
    this.middleware = new WebpackHotMiddleware(
      compilers,
      versionInfo,
      devtoolsUrl,
    );

    // Wrap the original publish method to add hooks
    const originalPublish = this.middleware.publish.bind(this.middleware);
    this.middleware.publish = (payload) => {
      // Run beforePublish hooks
      this.hooks.beforePublish.forEach((hook) => {
        try {
          payload = hook(payload) || payload;
        } catch (err) {
          console.error("BeforePublish hook error:", err);
        }
      });

      // Apply interceptors
      if (this.interceptors.has(payload.action)) {
        const interceptor = this.interceptors.get(payload.action);
        payload = interceptor(payload) || payload;
      }

      // Emit event for custom handling
      this.emit("hmr-event", payload);

      // Call original publish
      originalPublish(payload);

      // Run afterPublish hooks
      this.hooks.afterPublish.forEach((hook) => {
        try {
          hook(payload);
        } catch (err) {
          console.error("AfterPublish hook error:", err);
        }
      });
    };

    // Wrap the onHMR method to track client connections
    const originalOnHMR = this.middleware.onHMR.bind(this.middleware);
    this.middleware.onHMR = (client) => {
      console.log("📱 New HMR client connected");

      // Run onClientConnect hooks
      this.hooks.onClientConnect.forEach((hook) => {
        try {
          hook(client);
        } catch (err) {
          console.error("OnClientConnect hook error:", err);
        }
      });

      // Add close listener
      client.addEventListener("close", () => {
        console.log("📱 HMR client disconnected");
        this.hooks.onClientDisconnect.forEach((hook) => {
          try {
            hook(client);
          } catch (err) {
            console.error("OnClientDisconnect hook error:", err);
          }
        });
      });

      originalOnHMR(client);
    };

    console.log("✅ Custom HMR middleware initialized");
  }

  // Add a hook for specific lifecycle events
  addHook(event, callback) {
    if (this.hooks[event]) {
      this.hooks[event].push(callback);
      console.log(`✅ Added ${event} hook`);
    } else {
      console.log(`❌ Unknown hook event: ${event}`);
    }
    return this;
  }

  // Add an interceptor for specific HMR actions
  addInterceptor(action, interceptor) {
    this.interceptors.set(action, interceptor);
    console.log(`✅ Added interceptor for ${action} action`);
    return this;
  }

  // Programmatically publish HMR events
  publishCustomEvent(action, data = {}) {
    if (!this.middleware) {
      console.log("❌ Middleware not initialized");
      return;
    }

    const payload = {
      action,
      timestamp: Date.now(),
      custom: true,
      ...data,
    };

    this.middleware.publish(payload);
    console.log(`📢 Published custom event: ${action}`);
    return this;
  }

  // Get middleware stats
  getStats() {
    if (!this.middleware) return null;

    return {
      clientsConnected: this.middleware.eventStream.clients.size,
      closed: this.middleware.closed,
      hooksRegistered: Object.keys(this.hooks).reduce((acc, key) => {
        acc[key] = this.hooks[key].length;
        return acc;
      }, {}),
      interceptorsRegistered: this.interceptors.size,
    };
  }

  // Close the middleware
  close() {
    if (this.middleware) {
      this.middleware.close();
      console.log("✅ Custom HMR middleware closed");
    }
  }
}

// Test the custom middleware
async function testCustomMiddleware() {
  console.log("1. Creating custom HMR middleware...");

  const customHMR = new CustomHMRMiddleware();

  // Create mock compilers
  const mockCompilers = [
    { hooks: { invalid: { tap: () => {} }, done: { tap: () => {} } } },
    { hooks: { invalid: { tap: () => {} }, done: { tap: () => {} } } },
    { hooks: { invalid: { tap: () => {} }, done: { tap: () => {} } } },
  ];

  const versionInfo = { version: "14.0.0" };
  const devtoolsUrl = "http://localhost:3000";

  customHMR.initialize(mockCompilers, versionInfo, devtoolsUrl);

  console.log("\n2. Adding hooks and interceptors...");

  // Add lifecycle hooks
  customHMR
    .addHook("beforePublish", (payload) => {
      console.log(`🔄 Before publish: ${payload.action}`);
      // Modify payload if needed
      if (payload.action === HMR_ACTIONS_SENT_TO_BROWSER.BUILDING) {
        payload.customMessage = "Custom build message added";
      }
      return payload;
    })
    .addHook("afterPublish", (payload) => {
      console.log(`✅ After publish: ${payload.action}`);
    })
    .addHook("onClientConnect", (client) => {
      console.log("👋 Client connected hook triggered");
    });

  // Add interceptors
  customHMR
    .addInterceptor(HMR_ACTIONS_SENT_TO_BROWSER.BUILDING, (payload) => {
      console.log("🔧 Intercepting BUILDING action");
      return {
        ...payload,
        intercepted: true,
        originalAction: payload.action,
      };
    })
    .addInterceptor(HMR_ACTIONS_SENT_TO_BROWSER.BUILT, (payload) => {
      console.log("🔧 Intercepting BUILT action");
      return {
        ...payload,
        buildTime: Date.now(),
        intercepted: true,
      };
    });

  // Listen for HMR events
  customHMR.on("hmr-event", (payload) => {
    console.log(
      `🎯 HMR Event received: ${payload.action}`,
      payload.custom ? "(custom)" : "(standard)",
    );
  });

  console.log("\n3. Testing programmatic event publishing...");

  // Publish various HMR events
  customHMR
    .publishCustomEvent(HMR_ACTIONS_SENT_TO_BROWSER.BUILDING)
    .publishCustomEvent(HMR_ACTIONS_SENT_TO_BROWSER.BUILT, {
      hash: "abc123",
      errors: [],
      warnings: [],
    })
    .publishCustomEvent(HMR_ACTIONS_SENT_TO_BROWSER.SYNC, {
      hash: "def456",
      errors: [],
      warnings: [],
      versionInfo,
    })
    .publishCustomEvent("CUSTOM_ACTION", {
      message: "This is a custom HMR event",
      data: { foo: "bar" },
    });

  console.log("\n4. Middleware stats:");
  console.log(JSON.stringify(customHMR.getStats(), null, 2));

  console.log("\n5. Testing WebSocket client simulation...");

  // Create a mock WebSocket client
  const mockClient = {
    send: (data) => console.log("📤 Mock client received:", JSON.parse(data)),
    addEventListener: (event, callback) => {
      console.log(`📝 Mock client registered ${event} listener`);
      // Simulate close after 2 seconds
      if (event === "close") {
        setTimeout(() => {
          console.log("🔌 Simulating client disconnect...");
          callback();
        }, 2000);
      }
    },
  };

  // Simulate client connection
  customHMR.middleware.onHMR(mockClient);

  // Publish an event to connected client
  setTimeout(() => {
    customHMR.publishCustomEvent(HMR_ACTIONS_SENT_TO_BROWSER.RELOAD_PAGE, {
      data: "/test-page",
    });
  }, 1000);

  // Wait for client disconnect simulation
  setTimeout(() => {
    console.log("\n6. Final stats:");
    console.log(JSON.stringify(customHMR.getStats(), null, 2));

    // Clean up
    customHMR.close();
    console.log("\n🎉 Advanced HMR middleware test completed!");
  }, 3000);
}

// Run the test
testCustomMiddleware().catch(console.error);
