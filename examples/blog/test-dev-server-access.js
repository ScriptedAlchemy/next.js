#!/usr/bin/env node

/**
 * Test script to explore different methods of accessing running Next.js DevServer instances
 *
 * This script attempts various strategies to access a running dev server:
 * 1. Direct require of Next.js internals and singleton patterns
 * 2. Process and global object inspection
 * 3. Module cache inspection
 * 4. IPC communication patterns
 * 5. Event listener hooks
 * 6. File system watchers
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

console.log("🔍 Next.js DevServer Access Methods Test\n");

// Method 1: Check for global/process references
function checkGlobalReferences() {
  console.log("📋 Method 1: Checking global/process references");

  const checks = [
    "global.__NEXT_SERVER__",
    "global.__NEXT_DEV_SERVER__",
    "global.nextServer",
    "global.devServer",
    "globalThis.__NEXT_SERVER__",
    "globalThis.__NEXT_DEV_SERVER__",
    "process.nextServer",
    "process.devServer",
    "process.__NEXT_SERVER__",
    "process.__NEXT_DEV_SERVER__",
  ];

  checks.forEach((check) => {
    try {
      const value = eval(check);
      console.log(`  ✅ ${check}:`, value ? "Found" : "Undefined");
    } catch (e) {
      console.log(`  ❌ ${check}: Not accessible`);
    }
  });

  // Check process.env for any Next.js related variables
  console.log("  📝 Process env variables:");
  Object.keys(process.env)
    .filter((key) => key.includes("NEXT"))
    .forEach((key) => {
      console.log(`    ${key}: ${process.env[key]}`);
    });

  console.log("");
}

// Method 2: Inspect Next.js render-server initializations
function checkRenderServerInitializations() {
  console.log("📋 Method 2: Checking render-server initializations");

  try {
    // Try to access the internal render-server module
    const renderServerPath = path.join(
      __dirname,
      "node_modules/next/dist/server/lib/render-server.js",
    );

    if (fs.existsSync(renderServerPath)) {
      console.log("  ✅ Found render-server.js");

      // Try to require it and check for initializations
      try {
        const renderServer = require("./node_modules/next/dist/server/lib/render-server.js");
        console.log("  ✅ Successfully required render-server module");
        console.log("  📝 Available exports:", Object.keys(renderServer));

        // Try to get server field for current directory
        if (typeof renderServer.getServerField === "function") {
          renderServer
            .getServerField(process.cwd(), "server")
            .then((server) => {
              console.log("  ✅ Successfully accessed server field:", !!server);
              if (server) {
                console.log("  📝 Server type:", server.constructor.name);
                console.log(
                  "  📝 Server methods:",
                  Object.getOwnPropertyNames(server).filter(
                    (name) => typeof server[name] === "function",
                  ),
                );
              }
            })
            .catch((err) => {
              console.log("  ❌ Failed to get server field:", err.message);
            });
        } else {
          console.log("  ❌ getServerField not available");
        }
      } catch (requireError) {
        console.log(
          "  ❌ Failed to require render-server:",
          requireError.message,
        );
      }
    } else {
      console.log("  ❌ render-server.js not found");
    }
  } catch (error) {
    console.log("  ❌ Error checking render-server:", error.message);
  }

  console.log("");
}

// Method 3: Check module cache for Next.js instances
function checkModuleCache() {
  console.log("📋 Method 3: Checking module cache");

  const relevantModules = Object.keys(require.cache).filter(
    (modulePath) =>
      modulePath.includes("next") &&
      (modulePath.includes("dev-server") || modulePath.includes("next-server")),
  );

  if (relevantModules.length > 0) {
    console.log("  ✅ Found relevant modules in cache:");
    relevantModules.forEach((modulePath) => {
      console.log(`    ${path.basename(modulePath)}`);

      try {
        const module = require.cache[modulePath];
        if (module && module.exports) {
          console.log(
            `      Exports: ${Object.keys(module.exports).join(", ")}`,
          );
        }
      } catch (e) {
        console.log(`      Failed to inspect: ${e.message}`);
      }
    });
  } else {
    console.log("  ❌ No relevant Next.js modules found in cache");
  }

  console.log("");
}

// Method 4: Process event listening
function setupProcessEventListening() {
  console.log("📋 Method 4: Setting up process event listening");

  const originalEmit = process.emit;
  let eventCount = 0;

  process.emit = function (event, ...args) {
    if (
      event.toString().includes("next") ||
      event.toString().includes("server")
    ) {
      eventCount++;
      console.log(
        `  📡 Process event: ${event}`,
        args.length > 0 ? "with args" : "",
      );
    }
    return originalEmit.apply(this, arguments);
  };

  // Set up a timer to report on events
  setTimeout(() => {
    console.log(`  📊 Captured ${eventCount} relevant process events`);
    process.emit = originalEmit; // Restore original
  }, 5000);

  console.log("  ✅ Event listener installed (will report in 5 seconds)");
  console.log("");
}

// Method 5: Check for active HTTP servers
function checkActiveServers() {
  console.log("📋 Method 5: Checking for active HTTP servers");

  // Check common Next.js dev server ports
  const commonPorts = [3000, 3001, 3002, 8080, 8000];

  commonPorts.forEach((port) => {
    const http = require("http");
    const req = http.request(
      {
        hostname: "localhost",
        port: port,
        path: "/",
        method: "HEAD",
        timeout: 1000,
      },
      (res) => {
        console.log(
          `  ✅ Server found on port ${port} (status: ${res.statusCode})`,
        );

        // Check for Next.js specific headers
        const nextHeaders = Object.keys(res.headers).filter(
          (header) =>
            header.toLowerCase().includes("next") ||
            header.toLowerCase().includes("x-powered-by"),
        );

        if (nextHeaders.length > 0) {
          console.log(`    📝 Next.js headers: ${nextHeaders.join(", ")}`);
        }

        req.destroy();
      },
    );

    req.on("error", () => {
      // Port not active, ignore
    });

    req.on("timeout", () => {
      req.destroy();
    });

    req.end();
  });

  console.log("");
}

// Method 6: File system watching approach
function setupFileSystemWatch() {
  console.log("📋 Method 6: Setting up file system watch");

  const nextConfigPath = path.join(process.cwd(), "next.config.js");
  const packageJsonPath = path.join(process.cwd(), "package.json");

  try {
    if (fs.existsSync(nextConfigPath)) {
      fs.watchFile(nextConfigPath, { interval: 1000 }, (curr, prev) => {
        console.log(
          "  📁 Next.js config file changed - dev server might be restarting",
        );
      });
      console.log("  ✅ Watching next.config.js");
    }

    if (fs.existsSync(packageJsonPath)) {
      fs.watchFile(packageJsonPath, { interval: 1000 }, (curr, prev) => {
        console.log("  📁 Package.json changed");
      });
      console.log("  ✅ Watching package.json");
    }
  } catch (error) {
    console.log("  ❌ Failed to setup file watchers:", error.message);
  }

  console.log("");
}

// Method 7: Try to hook into Next.js CLI
function hookNextCLI() {
  console.log("📋 Method 7: Attempting to hook into Next.js CLI");

  try {
    const nextDevPath = path.join(
      __dirname,
      "node_modules/next/dist/cli/next-dev.js",
    );

    if (fs.existsSync(nextDevPath)) {
      console.log("  ✅ Found next-dev.js");

      // Try to access the CLI module
      try {
        const nextDev = require("./node_modules/next/dist/cli/next-dev.js");
        console.log("  ✅ Successfully required next-dev module");
        console.log("  📝 Available exports:", Object.keys(nextDev));

        // Check if we can hook into the nextDev function
        if (typeof nextDev.nextDev === "function") {
          console.log("  ✅ nextDev function is available");

          // We could potentially monkey-patch this function to capture server instances
          const originalNextDev = nextDev.nextDev;
          console.log("  📝 Original nextDev function captured");
        }
      } catch (requireError) {
        console.log("  ❌ Failed to require next-dev:", requireError.message);
      }
    } else {
      console.log("  ❌ next-dev.js not found");
    }
  } catch (error) {
    console.log("  ❌ Error checking next-dev:", error.message);
  }

  console.log("");
}

// Method 8: Inter-process communication approach
function setupIPCCommunication() {
  console.log("📋 Method 8: Setting up IPC communication");

  // Check if we're in a child process that could communicate with the main process
  if (process.send) {
    console.log("  ✅ IPC channel available");

    // Send a message to parent asking for server instance
    process.send({ type: "REQUEST_SERVER_INSTANCE" });

    process.on("message", (message) => {
      if (message && message.type === "SERVER_INSTANCE") {
        console.log("  ✅ Received server instance via IPC");
        console.log("  📝 Server data:", message.data);
      }
    });
  } else {
    console.log("  ❌ No IPC channel available");
  }

  console.log("");
}

// Method 9: Direct Next.js API approach
function tryDirectNextAPI() {
  console.log("📋 Method 9: Trying direct Next.js API");

  try {
    const next = require("next");
    console.log("  ✅ Successfully required Next.js");

    // Check if there's a way to get existing instances
    if (typeof next === "function") {
      console.log("  ✅ Next.js is a function (createServer)");

      // Try to access any internal state
      if (next.prototype) {
        console.log(
          "  📝 Next.js prototype methods:",
          Object.getOwnPropertyNames(next.prototype),
        );
      }

      // Check the Next.js module for any global state
      const nextModule = require.cache[require.resolve("next")];
      if (nextModule && nextModule.exports) {
        console.log(
          "  📝 Next.js module exports:",
          Object.keys(nextModule.exports),
        );
      }
    }
  } catch (error) {
    console.log("  ❌ Failed to require Next.js:", error.message);
  }

  console.log("");
}

// Method 10: Runtime inspection of process
function inspectProcessRuntime() {
  console.log("📋 Method 10: Inspecting process runtime");

  // Check process title
  console.log(`  📝 Process title: ${process.title}`);

  // Check if we're in a Next.js worker process
  if (process.env.__NEXT_PRIVATE_RENDER_WORKER) {
    console.log(
      `  ✅ Running in Next.js render worker: ${process.env.__NEXT_PRIVATE_RENDER_WORKER}`,
    );
  }

  if (process.env.__NEXT_PRIVATE_WORKER) {
    console.log(`  ✅ Running in Next.js worker process`);
  }

  // Check for Next.js specific process properties
  const nextProps = Object.getOwnPropertyNames(process).filter(
    (prop) => prop.includes("next") || prop.includes("Next"),
  );

  if (nextProps.length > 0) {
    console.log("  📝 Next.js related process properties:", nextProps);
  }

  // Check process.versions for any Next.js info
  console.log("  📝 Node version:", process.version);
  console.log("  📝 Process versions:", Object.keys(process.versions));

  console.log("");
}

// Main execution
async function main() {
  console.log("Starting comprehensive Next.js DevServer access test...\n");

  // Run all methods
  checkGlobalReferences();
  checkRenderServerInitializations();
  checkModuleCache();
  setupProcessEventListening();
  checkActiveServers();
  setupFileSystemWatch();
  hookNextCLI();
  setupIPCCommunication();
  tryDirectNextAPI();
  inspectProcessRuntime();

  console.log(
    "🏁 Test completed. Keep this script running to monitor for any server events...",
  );
  console.log(
    '💡 To test with a live dev server, run "npm run dev" in another terminal.\n',
  );

  // Keep the process alive to monitor events
  process.stdin.resume();
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down test script...");
  process.exit(0);
});

// Run the test
main().catch(console.error);
