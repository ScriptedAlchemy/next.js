#!/usr/bin/env node

/**
 * DevServer Accessor - A practical implementation for accessing running Next.js DevServer instances
 *
 * This script demonstrates the most viable methods for accessing a running DevServer:
 * 1. Through the render-server initializations registry
 * 2. By monkey-patching Next.js internals during startup
 * 3. Via process-level hooks and event listeners
 */

const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

class DevServerAccessor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      projectDir: options.projectDir || process.cwd(),
      pollInterval: options.pollInterval || 1000,
      verbose: options.verbose || false,
      ...options,
    };

    this.serverInstances = new Map();
    this.isMonitoring = false;
    this.monitorTimer = null;

    this.log("🚀 DevServer Accessor initialized");
  }

  log(message, ...args) {
    if (this.options.verbose) {
      console.log(`[DevServerAccessor] ${message}`, ...args);
    }
  }

  /**
   * Method 1: Access server through render-server initializations
   * This is the most direct approach as it accesses the internal registry
   */
  async getServerFromRenderServerRegistry(dir = this.options.projectDir) {
    try {
      const renderServerPath = path.join(
        __dirname,
        "node_modules/next/dist/server/lib/render-server.js",
      );

      if (!fs.existsSync(renderServerPath)) {
        throw new Error("render-server.js not found");
      }

      // Clear module cache to get fresh instance
      delete require.cache[
        require.resolve("./node_modules/next/dist/server/lib/render-server.js")
      ];

      const renderServer = require("./node_modules/next/dist/server/lib/render-server.js");

      if (typeof renderServer.getServerField === "function") {
        try {
          const serverInstance = await renderServer.getServerField(
            dir,
            "server",
          );

          if (serverInstance) {
            this.log("✅ Found server instance via render-server registry");
            this.serverInstances.set(dir, {
              instance: serverInstance,
              type: "render-server-registry",
              accessedAt: new Date(),
              methods: Object.getOwnPropertyNames(serverInstance).filter(
                (name) => typeof serverInstance[name] === "function",
              ),
            });

            this.emit("serverFound", {
              dir,
              instance: serverInstance,
              type: "render-server-registry",
            });

            return serverInstance;
          }
        } catch (serverError) {
          this.log(
            "❌ Server not initialized in render-server registry:",
            serverError.message,
          );
        }
      }

      return null;
    } catch (error) {
      this.log("❌ Failed to access render-server registry:", error.message);
      return null;
    }
  }

  /**
   * Method 2: Monkey-patch Next.js initialization to capture server instances
   */
  setupServerCaptureHooks() {
    try {
      // Hook into the Next.js server creation process
      const nextServerPath = require.resolve(
        "./node_modules/next/dist/server/next.js",
      );
      const renderServerPath = require.resolve(
        "./node_modules/next/dist/server/lib/render-server.js",
      );

      // Monkey-patch the render-server initialize function
      if (fs.existsSync(renderServerPath)) {
        const renderServer = require(renderServerPath);

        if (typeof renderServer.initialize === "function") {
          const originalInitialize = renderServer.initialize;

          renderServer.initialize = async (opts) => {
            this.log("🔧 Intercepted render-server initialization");

            const result = await originalInitialize.call(renderServer, opts);

            if (result && result.server) {
              this.log("✅ Captured server instance during initialization");

              this.serverInstances.set(opts.dir || process.cwd(), {
                instance: result.server,
                type: "initialization-hook",
                accessedAt: new Date(),
                opts: opts,
              });

              this.emit("serverFound", {
                dir: opts.dir || process.cwd(),
                instance: result.server,
                type: "initialization-hook",
              });
            }

            return result;
          };

          this.log("✅ Server capture hooks installed");
          return true;
        }
      }

      return false;
    } catch (error) {
      this.log("❌ Failed to setup server capture hooks:", error.message);
      return false;
    }
  }

  /**
   * Method 3: Monitor process for server-related events and child processes
   */
  startProcessMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.log("🔍 Starting process monitoring");

    // Monitor child processes that might be Next.js servers
    const originalSpawn = require("child_process").spawn;
    const originalFork = require("child_process").fork;

    require("child_process").spawn = (...args) => {
      const [command, cmdArgs] = args;

      if (
        command.includes("node") &&
        cmdArgs &&
        (cmdArgs.some((arg) => arg.includes("next-dev")) ||
          cmdArgs.some((arg) => arg.includes("start-server")))
      ) {
        this.log("🔄 Detected Next.js server process spawn");
        this.emit("serverProcessDetected", { command, args: cmdArgs });
      }

      return originalSpawn.apply(this, args);
    };

    require("child_process").fork = (...args) => {
      const [modulePath] = args;

      if (modulePath && modulePath.includes("start-server")) {
        this.log("🔄 Detected Next.js server fork");
        this.emit("serverProcessDetected", { modulePath, args });
      }

      return originalFork.apply(this, args);
    };

    // Set up periodic polling
    this.monitorTimer = setInterval(() => {
      this.pollForServers();
    }, this.options.pollInterval);

    this.log("✅ Process monitoring started");
  }

  /**
   * Periodically poll for server instances
   */
  async pollForServers() {
    // Try to get server from render-server registry
    const server = await this.getServerFromRenderServerRegistry();

    if (server && !this.serverInstances.has(this.options.projectDir)) {
      this.log("🎯 Found new server instance during polling");
    }

    // Check for any process title changes that might indicate server status
    if (
      process.title.includes("next-server") ||
      process.title.includes("next-render-worker")
    ) {
      this.emit("processTitle", process.title);
    }
  }

  /**
   * Method 4: HTTP-based server detection
   */
  async detectServerByHTTP(ports = [3000, 3001, 3002, 8080]) {
    const http = require("http");
    const detectedServers = [];

    for (const port of ports) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.request(
            {
              hostname: "localhost",
              port: port,
              path: "/_next/static/development/_buildManifest.js",
              method: "HEAD",
              timeout: 2000,
            },
            (res) => {
              if (res.statusCode === 200) {
                detectedServers.push({
                  port,
                  status: res.statusCode,
                  headers: res.headers,
                });

                this.emit("httpServerDetected", { port, headers: res.headers });
              }
              resolve();
            },
          );

          req.on("error", resolve);
          req.on("timeout", () => {
            req.destroy();
            resolve();
          });

          req.end();
        });
      } catch (error) {
        // Continue checking other ports
      }
    }

    return detectedServers;
  }

  /**
   * Get all discovered server instances
   */
  getServerInstances() {
    return Array.from(this.serverInstances.entries()).map(([dir, data]) => ({
      dir,
      ...data,
    }));
  }

  /**
   * Get server instance for specific directory
   */
  getServerInstance(dir = this.options.projectDir) {
    return this.serverInstances.get(dir);
  }

  /**
   * Stop monitoring and cleanup
   */
  stop() {
    this.isMonitoring = false;

    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    this.log("🛑 DevServer Accessor stopped");
  }

  /**
   * Start all monitoring methods
   */
  async start() {
    this.log("🎬 Starting DevServer Accessor");

    // Setup hooks first (before server might be created)
    this.setupServerCaptureHooks();

    // Start monitoring
    this.startProcessMonitoring();

    // Try immediate detection
    const server = await this.getServerFromRenderServerRegistry();
    if (!server) {
      this.log("⏳ No server found initially, will keep monitoring...");
    }

    // Detect via HTTP
    const httpServers = await this.detectServerByHTTP();
    if (httpServers.length > 0) {
      this.log(`🌐 Detected ${httpServers.length} HTTP servers`);
    }

    return this;
  }

  /**
   * Utility method to interact with discovered servers
   */
  async executeOnServer(dir, method, ...args) {
    const serverData = this.getServerInstance(dir);

    if (!serverData || !serverData.instance) {
      throw new Error(`No server instance found for directory: ${dir}`);
    }

    const server = serverData.instance;

    if (typeof server[method] !== "function") {
      throw new Error(`Method ${method} not available on server instance`);
    }

    return await server[method](...args);
  }
}

// Example usage and demo
async function demo() {
  console.log("🎭 DevServer Accessor Demo\n");

  const accessor = new DevServerAccessor({
    verbose: true,
    pollInterval: 2000,
  });

  // Set up event listeners
  accessor.on("serverFound", (data) => {
    console.log("🎉 Server found!", {
      dir: data.dir,
      type: data.type,
      constructor: data.instance.constructor.name,
    });

    // Example: Try to get some server information
    try {
      if (data.instance.hostname) {
        console.log("  📍 Hostname:", data.instance.hostname);
      }
      if (data.instance.port) {
        console.log("  🔌 Port:", data.instance.port);
      }
    } catch (e) {
      console.log("  ❓ Could not access server properties");
    }
  });

  accessor.on("httpServerDetected", (data) => {
    console.log("🌐 HTTP server detected on port", data.port);
  });

  accessor.on("serverProcessDetected", (data) => {
    console.log("🔄 Server process detected:", data.command || data.modulePath);
  });

  // Start the accessor
  await accessor.start();

  console.log("👀 Monitoring for Next.js DevServer instances...");
  console.log(
    '💡 Start your Next.js dev server with "npm run dev" to see it in action!',
  );
  console.log("🛑 Press Ctrl+C to stop\n");

  // Periodic status report
  setInterval(() => {
    const instances = accessor.getServerInstances();
    if (instances.length > 0) {
      console.log(
        `📊 Currently tracking ${instances.length} server instance(s):`,
      );
      instances.forEach((instance, i) => {
        console.log(`  ${i + 1}. ${instance.dir} (${instance.type})`);
      });
    }
  }, 10000);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n👋 Shutting down...");
    accessor.stop();
    process.exit(0);
  });

  // Keep alive
  process.stdin.resume();
}

// Export for use as a module
module.exports = DevServerAccessor;

// Run demo if this script is executed directly
if (require.main === module) {
  demo().catch(console.error);
}
