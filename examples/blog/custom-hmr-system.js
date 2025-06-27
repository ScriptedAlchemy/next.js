#!/usr/bin/env node

/**
 * Custom HMR System using setupDevBundler
 *
 * This script demonstrates how to create your own HMR access system
 * using the setupDevBundler function from Next.js internals.
 *
 * Features:
 * - Create custom bundler instance
 * - Programmatic HMR control
 * - Custom file watching
 * - HMR event broadcasting
 * - Error handling and recovery
 */

const path = require("path");
const fs = require("fs");
const http = require("http");
const { WebSocketServer } = require("ws");

class CustomHMRSystem {
  constructor(options = {}) {
    this.options = {
      port: 3000,
      wsPort: 3001,
      projectDir: process.cwd(),
      ...options,
    };

    this.bundlerResult = null;
    this.hotReloader = null;
    this.wsServer = null;
    this.clients = new Set();
    this.isRunning = false;
  }

  async initialize() {
    console.log("🚀 Initializing Custom HMR System...\n");

    try {
      // Set up development environment
      process.env.NODE_ENV = "development";

      // Import Next.js dependencies
      const {
        setupDevBundler,
      } = require("next/dist/server/lib/router-utils/setup-dev-bundler");
      const loadConfig = require("next/dist/server/config").default;
      const { findPagesDir } = require("next/dist/lib/find-pages-dir");
      const {
        setupFsCheck,
      } = require("next/dist/server/lib/router-utils/filesystem");

      console.log("📁 Project:", this.options.projectDir);

      // Load Next.js configuration
      const nextConfig = await loadConfig(
        "development",
        this.options.projectDir,
      );
      const { pagesDir, appDir } = findPagesDir(this.options.projectDir);

      console.log("📄 Pages dir:", pagesDir || "None");
      console.log("📱 App dir:", appDir || "None");

      // Set up filesystem checker
      const fsChecker = await setupFsCheck({
        appDir,
        pagesDir,
        dir: this.options.projectDir,
        config: nextConfig,
        minimalMode: false,
        dev: true,
      });

      // Create enhanced telemetry
      const telemetry = {
        record: (event) => {
          console.log(`📊 [Telemetry] ${event.eventName || "Event"}`);
          this.broadcastToClients({
            type: "telemetry",
            event: event.eventName || "unknown",
          });
        },
      };

      // Set up bundler options
      const setupOpts = {
        renderServer: { instance: null },
        dir: this.options.projectDir,
        turbo: process.env.TURBOPACK === "1",
        appDir,
        pagesDir,
        telemetry,
        isCustomServer: true, // Mark as custom server
        fsChecker,
        nextConfig,
        port: this.options.port,
        onDevServerCleanup: undefined,
        resetFetch: () => {
          console.log("🔄 [HMR] Reset fetch called");
          this.broadcastToClients({
            type: "reset-fetch",
            timestamp: Date.now(),
          });
        },
      };

      console.log("⚙️  Setting up dev bundler...");
      console.log(`   Engine: ${setupOpts.turbo ? "Turbopack" : "Webpack"}`);
      console.log(`   Port: ${this.options.port}`);
      console.log(`   WebSocket Port: ${this.options.wsPort}`);

      // Initialize the bundler
      this.bundlerResult = await setupDevBundler(setupOpts);
      this.hotReloader = this.bundlerResult.hotReloader;

      // Override the send method to intercept HMR messages
      const originalSend = this.hotReloader.send.bind(this.hotReloader);
      this.hotReloader.send = (action) => {
        console.log(
          `🔥 [HMR] Action: ${action.action || action.type || "unknown"}`,
        );

        // Broadcast to our WebSocket clients
        this.broadcastToClients({
          type: "hmr-action",
          action: action.action || action.type,
          data: action.data || action,
          timestamp: Date.now(),
        });

        // Call original send
        return originalSend(action);
      };

      console.log("✅ Custom HMR System initialized!\n");
      return this;
    } catch (error) {
      console.error(
        "❌ Failed to initialize Custom HMR System:",
        error.message,
      );
      throw error;
    }
  }

  /**
   * Start the WebSocket server for client communication
   */
  startWebSocketServer() {
    console.log("🌐 Starting WebSocket server...");

    this.wsServer = new WebSocketServer({ port: this.options.wsPort });

    this.wsServer.on("connection", (ws) => {
      console.log("🔌 Client connected to Custom HMR System");
      this.clients.add(ws);

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: "welcome",
          message: "Connected to Custom HMR System",
          timestamp: Date.now(),
        }),
      );

      ws.on("close", () => {
        console.log("🔌 Client disconnected");
        this.clients.delete(ws);
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(message, ws);
        } catch (error) {
          console.error("❌ Invalid WebSocket message:", error.message);
        }
      });
    });

    console.log(`✅ WebSocket server running on port ${this.options.wsPort}`);
  }

  /**
   * Handle messages from WebSocket clients
   */
  handleClientMessage(message, ws) {
    console.log(`📨 [Client] ${message.type}:`, message.data || "");

    switch (message.type) {
      case "invalidate":
        this.invalidateModules(message.reload || false);
        break;

      case "ensure-page":
        this.ensurePage(message.page || "/");
        break;

      case "get-errors":
        this.getAndSendErrors(message.page || "/", ws);
        break;

      case "trigger-error":
        this.setTestError(message.error || "Test error from client");
        break;

      case "clear-errors":
        this.clearErrors();
        break;

      default:
        console.log("❓ Unknown client message type:", message.type);
    }
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  broadcastToClients(message) {
    const data = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(data);
      }
    });
  }

  /**
   * Set up custom file watchers
   */
  setupFileWatchers() {
    console.log("👀 Setting up file watchers...");

    const watchPaths = [
      path.join(this.options.projectDir, "pages"),
      path.join(this.options.projectDir, "components"),
      path.join(this.options.projectDir, "lib"),
      path.join(this.options.projectDir, "styles"),
    ].filter((p) => fs.existsSync(p));

    watchPaths.forEach((watchPath) => {
      fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (filename) {
          console.log(`📝 [Watcher] ${eventType}: ${filename}`);

          this.broadcastToClients({
            type: "file-change",
            eventType,
            filename,
            path: watchPath,
            timestamp: Date.now(),
          });

          // Auto-invalidate on file changes
          this.invalidateModules(false);
        }
      });

      console.log(`   👀 Watching: ${watchPath}`);
    });
  }

  /**
   * Programmatic HMR operations
   */
  async invalidateModules(reload = false) {
    console.log(`🔄 [HMR] Invalidating modules (reload: ${reload})`);

    try {
      await this.hotReloader.invalidate({ reloadAfterInvalidation: reload });

      this.broadcastToClients({
        type: "modules-invalidated",
        reload,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("❌ Failed to invalidate modules:", error.message);
    }
  }

  async ensurePage(pagePath) {
    console.log(`📄 [HMR] Ensuring page: ${pagePath}`);

    try {
      await this.hotReloader.ensurePage({
        page: pagePath,
        clientOnly: false,
        definition: undefined,
      });

      this.broadcastToClients({
        type: "page-ensured",
        page: pagePath,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(`❌ Failed to ensure page ${pagePath}:`, error.message);
    }
  }

  async getAndSendErrors(pagePath, client) {
    try {
      const errors = await this.hotReloader.getCompilationErrors(pagePath);

      const message = {
        type: "compilation-errors",
        page: pagePath,
        errors: errors.map((err) => ({
          message: err.message,
          stack: err.stack,
          name: err.name,
        })),
        timestamp: Date.now(),
      };

      if (client) {
        client.send(JSON.stringify(message));
      } else {
        this.broadcastToClients(message);
      }
    } catch (error) {
      console.error(`❌ Failed to get errors for ${pagePath}:`, error.message);
    }
  }

  setTestError(errorMessage) {
    console.log(`❌ [HMR] Setting test error: ${errorMessage}`);

    const error = new Error(errorMessage);
    this.hotReloader.setHmrServerError(error);

    this.broadcastToClients({
      type: "error-set",
      error: errorMessage,
      timestamp: Date.now(),
    });
  }

  clearErrors() {
    console.log("✅ [HMR] Clearing errors");

    this.hotReloader.clearHmrServerError();

    this.broadcastToClients({
      type: "errors-cleared",
      timestamp: Date.now(),
    });
  }

  /**
   * Start the complete custom HMR system
   */
  async start() {
    try {
      await this.initialize();
      this.startWebSocketServer();
      this.setupFileWatchers();

      this.isRunning = true;

      console.log("\n🎉 Custom HMR System is running!");
      console.log(`   HMR Server: Ready`);
      console.log(`   WebSocket: ws://localhost:${this.options.wsPort}`);
      console.log(`   Project: ${this.options.projectDir}`);
      console.log("\n📡 Broadcasting HMR events to connected clients...\n");

      // Keep the process alive
      process.on("SIGINT", () => {
        console.log("\n🛑 Shutting down Custom HMR System...");
        this.stop();
        process.exit(0);
      });
    } catch (error) {
      console.error("💥 Failed to start Custom HMR System:", error.message);
      throw error;
    }
  }

  /**
   * Stop the custom HMR system
   */
  stop() {
    console.log("🛑 Stopping Custom HMR System...");

    this.isRunning = false;

    if (this.wsServer) {
      this.wsServer.close();
    }

    if (this.hotReloader) {
      this.hotReloader.close();
    }

    console.log("✅ Custom HMR System stopped");
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      running: this.isRunning,
      clients: this.clients.size,
      bundlerType: this.hotReloader?.constructor.name,
      hasWebpackConfigs: !!this.hotReloader?.activeWebpackConfigs,
      hasTurbopackProject: !!this.hotReloader?.turbopackProject,
    };
  }
}

/**
 * Create a simple HTML client for testing
 */
function createTestClient() {
  const clientHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Custom HMR System Test Client</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .log { background: #f8f9fa; padding: 10px; border: 1px solid #dee2e6; height: 300px; overflow-y: auto; }
        button { padding: 8px 16px; margin: 5px; cursor: pointer; }
        .controls { margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔥 Custom HMR System Test Client</h1>
        
        <div id="status" class="status disconnected">
            Disconnected from HMR System
        </div>
        
        <div class="controls">
            <button onclick="invalidateModules()">🔄 Invalidate Modules</button>
            <button onclick="ensurePage('/')">📄 Ensure Home Page</button>
            <button onclick="getErrors('/')">🐛 Get Errors</button>
            <button onclick="triggerError()">❌ Trigger Error</button>
            <button onclick="clearErrors()">✅ Clear Errors</button>
        </div>
        
        <h3>📡 HMR Events Log:</h3>
        <div id="log" class="log"></div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:3001');
        const statusEl = document.getElementById('status');
        const logEl = document.getElementById('log');
        
        function log(message, type = 'info') {
            const time = new Date().toLocaleTimeString();
            const logLine = document.createElement('div');
            logLine.innerHTML = \`[\${time}] \${message}\`;
            logLine.style.color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'black';
            logEl.appendChild(logLine);
            logEl.scrollTop = logEl.scrollHeight;
        }
        
        ws.onopen = () => {
            statusEl.textContent = '✅ Connected to Custom HMR System';
            statusEl.className = 'status connected';
            log('Connected to HMR System', 'success');
        };
        
        ws.onclose = () => {
            statusEl.textContent = '❌ Disconnected from HMR System';
            statusEl.className = 'status disconnected';
            log('Disconnected from HMR System', 'error');
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            log(\`[\${data.type}] \${JSON.stringify(data, null, 2)}\`);
        };
        
        function sendMessage(type, data = {}) {
            ws.send(JSON.stringify({ type, ...data }));
        }
        
        function invalidateModules() {
            sendMessage('invalidate', { reload: false });
        }
        
        function ensurePage(page) {
            sendMessage('ensure-page', { page });
        }
        
        function getErrors(page) {
            sendMessage('get-errors', { page });
        }
        
        function triggerError() {
            sendMessage('trigger-error', { error: 'Test error from web client' });
        }
        
        function clearErrors() {
            sendMessage('clear-errors');
        }
    </script>
</body>
</html>`;

  fs.writeFileSync(
    path.join(process.cwd(), "hmr-test-client.html"),
    clientHTML,
  );
  console.log("📄 Test client created: hmr-test-client.html");
}

// Export for use as a module
module.exports = { CustomHMRSystem, createTestClient };

// Run if called directly
if (require.main === module) {
  const system = new CustomHMRSystem({
    port: 3000,
    wsPort: 3001,
  });

  // Create test client
  createTestClient();

  // Start the system
  system.start().catch((error) => {
    console.error("💥 Failed to start system:", error);
    process.exit(1);
  });
}
