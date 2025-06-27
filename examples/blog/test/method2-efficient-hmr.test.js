const { test } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { promisify } = require("node:util");

const execAsync = promisify(require("node:child_process").exec);

// Test configuration constants
const TEST_CONFIG = {
  SERVER_PORT: 3000,
  SERVER_STARTUP_TIMEOUT: 90000,
  HMR_WAIT_TIME: 2000,
  VERIFICATION_WAIT_TIME: 3000,
  RETRY_ATTEMPTS: 5,
  RETRY_DELAY: 1000,
  FORCE_KILL_TIMEOUT: 2000,
  PORT_CLEANUP_TIMEOUT: 1500,
  FINAL_CLEANUP_WAIT: 1000
};

// Expected content markers
const CONTENT_MARKERS = {
  PLACEHOLDER: "PLACEHOLDER",
  UPDATED_DOCUMENT: "Hello world!!",
  MARKDOWN_ORIGINAL: "PAGE_HMR_AREA",
  MARKDOWN_UPDATED: "Efficient HMR SUCCESS ON MARKDOWN!"
};

test("Method 2: Efficient HMR - API-based Hot Module Replacement", async (t) => {
  // Test state variables
  let devServer = null;
  let serverPort = TEST_CONFIG.SERVER_PORT;
  let originalDocumentContent = null;
  let stdout = "";
  let stderr = "";

  // ========================================
  // SETUP: Helper Functions
  // ========================================

  /**
   * Makes HTTP requests to the test server with proper error handling
   * @param {string} requestPath - The path to request
   * @param {string} method - HTTP method (GET, POST)
   * @param {Object|null} requestBody - Request body for POST requests
   * @returns {Promise<{status: number, body: any}>} Response object
   */
  async function makeRequest(requestPath = "/", method = "GET", requestBody = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "localhost",
        port: serverPort,
        path: requestPath,
        method,
        headers: requestBody ? { "Content-Type": "application/json" } : {},
        timeout: 10000
      };

      const req = http.request(options, (res) => {
        let responseData = "";
        res.on("data", (chunk) => (responseData += chunk));
        res.on("end", () => {
          try {
            const responseBody = method === "POST" && res.headers["content-type"]?.includes("application/json")
              ? JSON.parse(responseData)
              : responseData;
            resolve({ 
              status: res.statusCode, 
              body: responseBody,
              headers: res.headers
            });
          } catch (parseError) {
            resolve({ 
              status: res.statusCode, 
              body: responseData,
              parseError: parseError.message
            });
          }
        });
      });

      req.on("error", (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout after 10 seconds"));
      });
      
      if (requestBody && method === "POST") {
        req.write(JSON.stringify(requestBody));
      }
      req.end();
    });
  }

  /**
   * Waits for a specified amount of time
   * @param {number} milliseconds - Time to wait
   * @returns {Promise<void>}
   */
  function waitFor(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  // ========================================
  // SETUP: Cleanup and Test Teardown
  // ========================================

  t.after(async () => {
    console.log("\n🧹 Starting Method 2 test cleanup...");
    
    // Restore original document content if available
    if (originalDocumentContent) {
      try {
        const serverDocPath = path.join(__dirname, "..", ".next", "server", "pages", "_document.js");
        await fs.writeFile(serverDocPath, originalDocumentContent, "utf8");
        console.log("   ✅ Restored original server _document.js");
      } catch (error) {
        console.log(`   ⚠️  Could not restore original document: ${error.message}`);
      }
    }

    // Force kill dev server with timeout
    if (devServer && !devServer.killed) {
      console.log("   🔪 Terminating dev server...");
      
      const killPromise = new Promise((resolve) => {
        let serverKilled = false;
        
        const forceKillTimeout = setTimeout(() => {
          if (!serverKilled) {
            console.log("   🔪 Force killing dev server (timeout)");
            try {
              devServer.kill("SIGKILL");
            } catch (killError) {
              // Server already dead
            }
            serverKilled = true;
            resolve();
          }
        }, TEST_CONFIG.FORCE_KILL_TIMEOUT);
        
        devServer.on("exit", () => {
          if (!serverKilled) {
            clearTimeout(forceKillTimeout);
            serverKilled = true;
            console.log("   ✅ Dev server exited gracefully");
            resolve();
          }
        });
        
        // Try graceful termination first
        try {
          devServer.kill("SIGTERM");
        } catch (termError) {
          console.log("   ⚠️  SIGTERM failed, trying SIGKILL");
          try {
            devServer.kill("SIGKILL");
          } catch (killError) {
            // Server already dead
          }
        }
      });
      
      await killPromise;
    }
    
    // Port cleanup
    console.log("   🔪 Cleaning up ports...");
    try {
      const killPromises = ["3000", "3001"].map(port => 
        new Promise((resolve) => {
          const killProcess = spawn("npx", ["kill-port", port], { stdio: "ignore" });
          
          const timeout = setTimeout(() => {
            try {
              killProcess.kill("SIGKILL");
            } catch (killError) {
              // Process already dead
            }
            resolve();
          }, TEST_CONFIG.PORT_CLEANUP_TIMEOUT);
          
          killProcess.on("close", () => {
            clearTimeout(timeout);
            resolve();
          });
          
          killProcess.on("error", () => {
            clearTimeout(timeout);
            resolve();
          });
        })
      );
      
      await Promise.all(killPromises);
      console.log("   ✅ Port cleanup completed");
      
      // Final wait to ensure cleanup
      await waitFor(TEST_CONFIG.FINAL_CLEANUP_WAIT);
      
    } catch (cleanupError) {
      console.log(`   ⚠️  Port cleanup failed: ${cleanupError.message}`);
    }
    
    // Dump stdio for debugging
    console.log("\n📋 DUMPING STDIO/STDERR OUTPUT:");
    console.log("=" * 50);
    console.log("--- STDOUT ---");
    console.log(stdout || "(no stdout)");
    console.log("\n--- STDERR ---");
    console.log(stderr || "(no stderr)");
    console.log("=" * 50);
    
    console.log("🧹 Method 2 cleanup completed");
  });

  // ========================================
  // SETUP: Environment and Server Startup
  // ========================================

  try {
    console.log("🧪 Testing Method 2: Efficient HMR");
    console.log("==================================");

    // Kill any existing processes on ports 3000-3001
    console.log("🧹 Initial cleanup of existing processes...");
    try {
      await execAsync("npx kill-port 3000 3001").catch(() => {});
      await execAsync("lsof -ti:3000 | xargs kill -9").catch(() => {});
      await execAsync("lsof -ti:3001 | xargs kill -9").catch(() => {});
      await waitFor(2000);
      console.log("✅ Initial cleanup completed");
    } catch (cleanupError) {
      console.log("⚠️  Initial cleanup had issues, continuing...");
    }

    // Start Next.js dev server
    console.log("🚀 Starting Next.js dev server...");
    devServer = spawn("npm", ["run", "dev"], {
      cwd: path.join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Capture output for debugging
    devServer.stdout.on("data", (data) => (stdout += data.toString()));
    devServer.stderr.on("data", (data) => (stderr += data.toString()));

    // Wait for server to be ready with proper error handling
    let serverReady = false;
    const serverStartupPromise = new Promise((resolve, reject) => {
      const startupTimeout = setTimeout(() => {
        if (!serverReady) {
          reject(new Error(`Server startup timeout after ${TEST_CONFIG.SERVER_STARTUP_TIMEOUT}ms`));
        }
      }, TEST_CONFIG.SERVER_STARTUP_TIMEOUT);
      
      let outputBuffer = "";

      const checkServerReady = (data) => {
        const output = data.toString();
        outputBuffer += output;
        
        // Look for server ready indicators
        const readyIndicators = [
          "Ready on", "ready on", "Local:", "Ready in", "✓ Ready"
        ];
        
        if (readyIndicators.some(indicator => output.includes(indicator) || outputBuffer.includes(indicator))) {
          clearTimeout(startupTimeout);
          serverReady = true;
          console.log("✅ Server ready detected");
          resolve();
        }
      };

      devServer.stdout.on("data", checkServerReady);
      devServer.stderr.on("data", checkServerReady);

      devServer.on("error", (serverError) => {
        clearTimeout(startupTimeout);
        reject(new Error(`Server startup error: ${serverError.message}`));
      });

      devServer.on("exit", (exitCode) => {
        if (!serverReady) {
          clearTimeout(startupTimeout);
          reject(new Error(`Server exited with code ${exitCode} before becoming ready`));
        }
      });
    });

    await serverStartupPromise;
    console.log("✅ Server ready on port 3000");
    
    // Wait for initialization to complete
    await waitFor(TEST_CONFIG.VERIFICATION_WAIT_TIME);

    // Store original document content for restoration
    const serverDocPath = path.join(__dirname, "..", ".next", "server", "pages", "_document.js");
    try {
      originalDocumentContent = await fs.readFile(serverDocPath, "utf8");
      console.log("📋 Stored original server document for restoration");
    } catch (readError) {
      console.log("📋 No existing compiled document found (normal on first run)");
    }

    // ========================================
    // TEST EXECUTION: API Validation
    // ========================================

    // Test API endpoint availability
    console.log("\n📡 Testing Efficient HMR API endpoint...");
    let testResponse;
    try {
      testResponse = await makeRequest("/api/efficient-hmr", "POST", { action: "test" });
    } catch (requestError) {
      assert.fail(`Failed to reach Efficient HMR API: ${requestError.message}`);
    }
    
    assert.strictEqual(testResponse.status, 200, "Efficient HMR API should return 200 status");
    assert.ok(testResponse.body?.success, "Efficient HMR API should return success response");
    console.log("✅ Efficient HMR endpoint: Available");

    // Initialize the Efficient HMR API
    console.log("⚡ Initializing Efficient HMR API...");
    let initResponse;
    try {
      initResponse = await makeRequest("/api/efficient-hmr", "POST", { action: "initialize" });
    } catch (requestError) {
      assert.fail(`Failed to initialize Efficient HMR API: ${requestError.message}`);
    }
    
    assert.strictEqual(initResponse.status, 200, "Efficient HMR initialization should return 200 status");
    assert.ok(initResponse.body?.success, `Efficient HMR initialization failed: ${initResponse.body?.error || "Unknown error"}`);
    console.log("✅ Efficient HMR initialization: Success");

    // ========================================
    // TEST EXECUTION: Document Page HMR
    // ========================================

    console.log("\n2A. Testing Document Page HMR via Efficient API...");
    
    // First visit the document page to trigger compilation
    console.log("   Visiting document page to ensure compilation...");
    let docPageVisit;
    try {
      docPageVisit = await makeRequest("/");
    } catch (requestError) {
      assert.fail(`Failed to visit document page: ${requestError.message}`);
    }
    
    assert.strictEqual(docPageVisit.status, 200, "Document page should be accessible");
    assert.ok(docPageVisit.body.includes(CONTENT_MARKERS.PLACEHOLDER), "Document page should contain PLACEHOLDER initially");
    console.log("   ✅ Document page visited and compiled");
    
    // Wait for compilation to complete
    await waitFor(TEST_CONFIG.VERIFICATION_WAIT_TIME);
    
    // Trigger HMR for document page
    let hmrTriggerDoc;
    try {
      hmrTriggerDoc = await makeRequest("/api/efficient-hmr", "POST", {
        action: "trigger-hmr",
        pagePath: "/_document",
        forceReload: true,
      });
    } catch (requestError) {
      assert.fail(`Failed to trigger document HMR: ${requestError.message}`);
    }

    assert.strictEqual(hmrTriggerDoc.status, 200, "HMR trigger should return 200 status");
    assert.ok(hmrTriggerDoc.body.success, `Document HMR trigger failed: ${hmrTriggerDoc.body?.error || "Unknown error"}`);
    console.log("✅ Efficient HMR document trigger: Success");

    // Wait for HMR to take effect
    await waitFor(TEST_CONFIG.HMR_WAIT_TIME);
    
    // Verify document page update with retry logic
    console.log("   Verifying document page update...");
    let documentUpdated = false;
    let finalDocumentResponse;
    
    for (let attempt = 1; attempt <= TEST_CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        finalDocumentResponse = await makeRequest("/");
        if (finalDocumentResponse.body.includes(CONTENT_MARKERS.UPDATED_DOCUMENT)) {
          console.log(`   ✅ Document page updated after ${attempt} attempt(s)`);
          documentUpdated = true;
          break;
        }
      } catch (requestError) {
        console.log(`   ⚠️  Attempt ${attempt} failed: ${requestError.message}`);
      }
      
      if (attempt < TEST_CONFIG.RETRY_ATTEMPTS) {
        await waitFor(TEST_CONFIG.RETRY_DELAY);
      }
    }

    if (!documentUpdated) {
      // Provide debug information for failure
      const placeholderIndex = finalDocumentResponse?.body?.indexOf(CONTENT_MARKERS.PLACEHOLDER) ?? -1;
      const updatedContentIndex = finalDocumentResponse?.body?.indexOf(CONTENT_MARKERS.UPDATED_DOCUMENT) ?? -1;
      console.log(`   Debug: PLACEHOLDER found at index: ${placeholderIndex}`);
      console.log(`   Debug: ${CONTENT_MARKERS.UPDATED_DOCUMENT} found at index: ${updatedContentIndex}`);
      
      assert.fail(`Document HMR failed - content not updated after ${TEST_CONFIG.RETRY_ATTEMPTS} attempts`);
    }
    
    console.log("✅ Efficient HMR: Document page successfully updated");

    // ========================================
    // TEST EXECUTION: Markdown Page HMR
    // ========================================

    console.log("\n2B. Testing Markdown Page HMR via Efficient API...");
    
    // First visit the markdown page to trigger compilation
    console.log("   Visiting markdown page to ensure compilation...");
    let markdownPageVisit;
    try {
      markdownPageVisit = await makeRequest("/posts/markdown");
    } catch (requestError) {
      assert.fail(`Failed to visit markdown page: ${requestError.message}`);
    }
    
    assert.strictEqual(markdownPageVisit.status, 200, "Markdown page should be accessible");
    assert.ok(markdownPageVisit.body.includes(CONTENT_MARKERS.MARKDOWN_ORIGINAL), "Markdown page should contain PAGE_HMR_AREA");
    console.log("   ✅ Markdown page visited and compiled");
    
    // Wait for compilation to complete
    await waitFor(TEST_CONFIG.VERIFICATION_WAIT_TIME);
    
    // Trigger HMR for markdown page
    let hmrTriggerMarkdown;
    try {
      hmrTriggerMarkdown = await makeRequest("/api/efficient-hmr", "POST", {
        action: "trigger-hmr",
        pagePath: "/posts/markdown",
        searchString: CONTENT_MARKERS.MARKDOWN_ORIGINAL,
        replaceString: CONTENT_MARKERS.MARKDOWN_UPDATED,
        forceReload: true,
      });
    } catch (requestError) {
      assert.fail(`Failed to trigger markdown HMR: ${requestError.message}`);
    }

    assert.strictEqual(hmrTriggerMarkdown.status, 200, "Markdown HMR trigger should return 200 status");
    assert.ok(hmrTriggerMarkdown.body.success, `Markdown HMR trigger failed: ${hmrTriggerMarkdown.body?.error || "Unknown error"}`);
    console.log("✅ Efficient HMR markdown trigger: Success");

    // Wait for HMR to take effect
    await waitFor(TEST_CONFIG.HMR_WAIT_TIME);
    
    // Verify markdown page update
    let updatedMarkdownPage;
    try {
      updatedMarkdownPage = await makeRequest("/posts/markdown");
    } catch (requestError) {
      assert.fail(`Failed to verify markdown page update: ${requestError.message}`);
    }

    assert.ok(updatedMarkdownPage.body.includes(CONTENT_MARKERS.MARKDOWN_UPDATED), 
      "Markdown page should contain updated content after HMR");
    console.log("✅ Efficient HMR: Markdown page successfully updated");
    
    // Restore original markdown content
    console.log("   Restoring original markdown content...");
    let restoreMarkdown;
    try {
      restoreMarkdown = await makeRequest("/api/efficient-hmr", "POST", {
        action: "trigger-hmr",
        pagePath: "/posts/markdown",
        searchString: CONTENT_MARKERS.MARKDOWN_UPDATED,
        replaceString: CONTENT_MARKERS.MARKDOWN_ORIGINAL,
        forceReload: true,
      });
    } catch (requestError) {
      console.log(`   ⚠️  Failed to restore markdown content: ${requestError.message}`);
    }
    
    if (restoreMarkdown?.body?.success) {
      console.log("   ✅ Restored original markdown content");
    } else {
      console.log(`   ⚠️  Markdown restoration may have failed: ${restoreMarkdown?.body?.error || "Unknown error"}`);
    }

    console.log("\n🎉 Method 2: Efficient HMR Test Complete!");

  } catch (testError) {
    console.error(`\n❌ Method 2 test failed: ${testError.message}`);
    
    // Provide additional context for debugging
    if (testError.stack) {
      console.error("Stack trace:", testError.stack);
    }
    
    // Re-throw to fail the test properly
    throw testError;
  }
});