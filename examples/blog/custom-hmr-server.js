#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");

console.log("=== Custom HMR Server using setupDevBundler ===\n");

class CustomHMRServer {
  constructor() {
    this.devBundler = null;
    this.hotReloader = null;
    this.wsServer = null;
    this.httpServer = null;
    this.clients = new Set();
  }

  async initialize() {
    console.log("🚀 Initializing Custom HMR Server...");

    // Setup Next.js dev bundler
    await this.setupDevBundler();

    // Setup WebSocket server for HMR communication
    await this.setupWebSocketServer();

    // Setup HTTP server for API endpoints
    await this.setupHttpServer();

    console.log("✅ Custom HMR Server initialized successfully!\n");
  }

  async setupDevBundler() {
    console.log("⚙️ Setting up Next.js dev bundler...");

    const {
      setupDevBundler,
    } = require("next/dist/server/lib/router-utils/setup-dev-bundler");
    const {
      setupFsCheck,
    } = require("next/dist/server/lib/router-utils/filesystem");
    const { default: loadNextConfig } = require("next/dist/server/config");
    const { Telemetry } = require("next/dist/telemetry/storage");

    const dir = process.cwd();
    const pagesDir = path.join(dir, "pages");
    const appDir = path.join(dir, "app");

    const nextConfig = await loadNextConfig("development", dir);
    const fsChecker = await setupFsCheck({
      dir,
      dev: true,
      config: nextConfig,
    });
    const telemetry = new Telemetry({ distDir: nextConfig.distDir });
    const renderServer = {};

    const setupOpts = {
      renderServer,
      dir,
      turbo: false,
      appDir: fs.existsSync(appDir) ? appDir : undefined,
      pagesDir: fs.existsSync(pagesDir) ? pagesDir : undefined,
      telemetry,
      isCustomServer: false,
      fsChecker,
      nextConfig,
      port: 3001, // Use different port for our custom server
      onDevServerCleanup: undefined,
      resetFetch: () => {},
    };

    this.devBundler = await setupDevBundler(setupOpts);
    this.hotReloader = this.devBundler.hotReloader;

    // Start the hot reloader
    await this.hotReloader.start();

    console.log("✅ Dev bundler ready");
  }

  async setupWebSocketServer() {
    console.log("🔌 Setting up WebSocket server...");

    this.wsServer = new WebSocket.Server({ port: 3002 });

    this.wsServer.on("connection", (ws) => {
      console.log("👤 Client connected to HMR WebSocket");
      this.clients.add(ws);

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: "connected",
          message: "Connected to Custom HMR Server",
        }),
      );

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(data, ws);
        } catch (err) {
          console.log("❌ Invalid message from client:", err.message);
        }
      });

      ws.on("close", () => {
        console.log("👤 Client disconnected from HMR WebSocket");
        this.clients.delete(ws);
      });
    });

    console.log("✅ WebSocket server listening on port 3002");
  }

  async setupHttpServer() {
    console.log("🌐 Setting up HTTP API server...");

    this.httpServer = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      this.handleHttpRequest(req, res);
    });

    this.httpServer.listen(3003, () => {
      console.log("✅ HTTP API server listening on port 3003");
    });
  }

  async handleClientMessage(data, ws) {
    console.log("📨 Received message from client:", data.type);

    switch (data.type) {
      case "reload-page":
        await this.reloadPage(data.page || "/");
        break;

      case "check-errors":
        const errors = await this.checkErrors(data.page || "/");
        ws.send(
          JSON.stringify({
            type: "error-check-result",
            page: data.page || "/",
            errors,
          }),
        );
        break;

      case "rebuild-all":
        await this.rebuildAll();
        break;

      default:
        console.log("❓ Unknown message type:", data.type);
    }
  }

  async handleHttpRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    console.log("📡 HTTP API request:", pathname);

    try {
      if (pathname === "/api/reload") {
        const page = url.searchParams.get("page") || "/";
        const result = await this.reloadPage(page);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: result, page }));
      } else if (pathname === "/api/errors") {
        const page = url.searchParams.get("page") || "/";
        const errors = await this.checkErrors(page);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ page, errors }));
      } else if (pathname === "/api/rebuild") {
        const result = await this.rebuildAll();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: result }));
      } else if (pathname === "/api/status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "running",
            connectedClients: this.clients.size,
            hotReloaderActive: !!this.hotReloader,
          }),
        );
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (error) {
      console.error("❌ API error:", error.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  async reloadPage(page) {
    console.log(`🔄 Reloading page: ${page}`);
    try {
      await this.hotReloader.ensurePage({
        page,
        clientOnly: false,
        appPaths: null,
        definition: undefined,
        isApp: false,
        url: page,
      });

      // Send HMR message
      this.hotReloader.send({
        action: "reloadPage",
        page,
      });

      // Notify WebSocket clients
      this.broadcastToClients({
        type: "page-reloaded",
        page,
      });

      console.log(`✅ Page ${page} reloaded successfully`);
      return true;
    } catch (err) {
      console.log(`❌ Failed to reload page ${page}:`, err.message);
      return false;
    }
  }

  async checkErrors(page) {
    console.log(`🔍 Checking errors for page: ${page}`);
    try {
      const errors = await this.hotReloader.getCompilationErrors(page);
      console.log(`✅ Found ${errors.length} errors`);
      return errors;
    } catch (err) {
      console.log("❌ Failed to check errors:", err.message);
      return [];
    }
  }

  async rebuildAll() {
    console.log("🔨 Rebuilding all pages...");
    try {
      this.hotReloader.send({ action: "building" });

      await this.hotReloader.invalidate({
        reloadAfterInvalidation: true,
      });

      this.hotReloader.send({ action: "built" });

      // Notify WebSocket clients
      this.broadcastToClients({
        type: "rebuild-complete",
      });

      console.log("✅ Full rebuild completed");
      return true;
    } catch (err) {
      console.log("❌ Failed to rebuild:", err.message);
      return false;
    }
  }

  broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  async shutdown() {
    console.log("🛑 Shutting down Custom HMR Server...");

    if (this.hotReloader) {
      this.hotReloader.close();
    }

    if (this.wsServer) {
      this.wsServer.close();
    }

    if (this.httpServer) {
      this.httpServer.close();
    }

    console.log("✅ Shutdown complete");
  }
}

async function startServer() {
  const server = new CustomHMRServer();

  // Handle cleanup
  const cleanup = async () => {
    console.log("\n🛑 Received shutdown signal...");
    await server.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    await server.initialize();

    console.log("🎉 Custom HMR Server is running!\n");
    console.log("📊 Server endpoints:");
    console.log("   WebSocket: ws://localhost:3002");
    console.log("   HTTP API:  http://localhost:3003");
    console.log("");
    console.log("🔧 Available API endpoints:");
    console.log("   GET  /api/status           - Server status");
    console.log("   GET  /api/reload?page=/    - Reload a page");
    console.log("   GET  /api/errors?page=/    - Check compilation errors");
    console.log("   GET  /api/rebuild          - Rebuild all pages");
    console.log("");
    console.log("💡 Example usage:");
    console.log("   curl http://localhost:3003/api/status");
    console.log("   curl http://localhost:3003/api/reload?page=/");
    console.log("   curl http://localhost:3003/api/errors");
    console.log("");
    console.log("🎯 This demonstrates how to use setupDevBundler to create");
    console.log("   your own HMR server with full programmatic control!");
    console.log("");
    console.log("Press Ctrl+C to stop the server.");

    // Test the server with some initial operations
    setTimeout(async () => {
      console.log("\n🧪 Running server self-test...");
      await server.checkErrors("/");
      console.log("✅ Self-test complete\n");
    }, 2000);
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

// Start the server
startServer();
