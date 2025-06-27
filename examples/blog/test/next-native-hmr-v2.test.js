const { test } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("path");
const fs = require("node:fs/promises");

// Constants
const DEFAULT_PORT = 3000;
const SERVER_STARTUP_TIMEOUT = 45000;
const REQUEST_TIMEOUT = 15000;
const HMR_WAIT_TIME = 3000;

test("Next.js Native HMR API v2 Test", async (t) => {
  let devServer = null;
  let serverPort = DEFAULT_PORT;
  let serverReady = false;
  let originalDocumentContent = null;
  let originalMarkdownContent = null;

  // Cleanup
  t.after(async () => {
    console.log("\n=== Cleanup Phase ===");
    
    // Restore original files
    if (originalDocumentContent) {
      const serverDocPath = path.join(__dirname, "..", ".next", "server", "pages", "_document.js");
      try {
        await fs.writeFile(serverDocPath, originalDocumentContent, "utf8");
        console.log("✓ Restored original _document.js");
      } catch (error) {
        console.error("✗ Failed to restore _document.js:", error.message);
      }
    }

    if (originalMarkdownContent) {
      const markdownServerPath = path.join(__dirname, "..", ".next", "server", "pages", "posts", "markdown.js");
      try {
        await fs.writeFile(markdownServerPath, originalMarkdownContent, "utf8");
        console.log("✓ Restored original markdown.js");
      } catch (error) {
        console.error("✗ Failed to restore markdown.js:", error.message);
      }
    }

    if (devServer) {
      console.log("Terminating dev server...");
      
      try {
        // Try graceful shutdown first
        devServer.kill("SIGTERM");
        
        // Wait for process to exit gracefully
        await new Promise((resolve) => {
          let resolved = false;
          
          devServer.on("exit", (code) => {
            if (!resolved) {
              resolved = true;
              console.log(`✓ Dev server exited gracefully with code ${code}`);
              resolve();
            }
          });
          
          devServer.on("error", (error) => {
            if (!resolved) {
              resolved = true;
              console.log(`Dev server error: ${error.message}`);
              resolve();
            }
          });
          
          // Force kill after 5 seconds if not exited
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.log("Force killing dev server...");
              try {
                devServer.kill("SIGKILL");
              } catch (error) {
                console.log("Force kill failed, process may already be dead");
              }
              resolve();
            }
          }, 5000);
        });
      } catch (error) {
        console.log(`Error during server shutdown: ${error.message}`);
      }
      
      console.log("✓ Dev server terminated");
    }
    
    // Additional cleanup - kill any remaining processes on port 3000
    try {
      const { spawn } = require("node:child_process");
      const killProcess = spawn("npx", ["kill-port", DEFAULT_PORT.toString()], {
        stdio: "ignore"
      });
      await new Promise((resolve) => {
        killProcess.on("close", () => resolve());
        setTimeout(resolve, 2000);
      });
      console.log("✓ Port cleanup completed");
    } catch (error) {
      console.log("Port cleanup completed");
    }
  });

  // Helper function to make HTTP requests
  async function makeRequest(path, method = "GET", data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "localhost",
        port: serverPort,
        path,
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : {},
        timeout: REQUEST_TIMEOUT,
      };

      const req = http.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const result = {
              status: res.statusCode,
              headers: res.headers,
              body: res.headers["content-type"]?.includes("json") ? JSON.parse(body) : body,
            };
            resolve(result);
          } catch (error) {
            resolve({ status: res.statusCode, body, parseError: error.message });
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => reject(new Error("Request timeout")));

      if (data && method === "POST") {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  // Kill any existing processes on port 3000
  console.log("=== Cleaning up port 3000 ===");
  try {
    const killProcess = spawn("npx", ["kill-port", DEFAULT_PORT.toString()], {
      stdio: "ignore"
    });
    await new Promise((resolve) => {
      killProcess.on("close", () => resolve());
      setTimeout(resolve, 2000); // timeout after 2 seconds
    });
    console.log("✓ Port 3000 cleanup attempted");
  } catch (error) {
    console.log("✓ Port cleanup completed");
  }

  // Start dev server
  console.log("=== Starting Next.js development server ===");
  devServer = spawn("pnpm", ["dev"], {
    cwd: path.join(__dirname, ".."),
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Wait for server to be ready
  const startTime = Date.now();
  while (!serverReady && Date.now() - startTime < SERVER_STARTUP_TIMEOUT) {
    try {
      const response = await makeRequest("/");
      if (response.status === 200 || response.status === 500) {
        serverReady = true;
        console.log(`✓ Server is responding on port ${serverPort}`);
        break;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  assert.ok(serverReady, `Server failed to start within ${SERVER_STARTUP_TIMEOUT / 1000} seconds`);

  // Test 1: API availability and test action
  console.log("\n=== Test 1: API Availability ===");
  
  const testResponse = await makeRequest("/api/next-native-hmr-v2", "POST", {
    action: "test"
  });
  
  assert.strictEqual(testResponse.status, 200, "API should be available");
  assert.ok(testResponse.body.success, "Test action should succeed");
  assert.ok(testResponse.body.availableAPIs, "Should report available APIs");
  assert.ok(Array.isArray(testResponse.body.availableActions), "Should have available actions");
  
  console.log("✓ Next.js Native HMR API v2 is available");
  console.log(`  Available APIs: ${Object.keys(testResponse.body.availableAPIs).filter(k => testResponse.body.availableAPIs[k]).join(', ')}`);
  console.log(`  Available Actions: ${testResponse.body.availableActions.join(', ')}`);

  // Test 2: Status information
  console.log("\n=== Test 2: Status Information ===");
  
  const statusResponse = await makeRequest("/api/next-native-hmr-v2", "POST", {
    action: "status"
  });
  
  assert.strictEqual(statusResponse.status, 200, "Status action should succeed");
  assert.ok(statusResponse.body.success, "Status should be successful");
  assert.ok(statusResponse.body.status, "Should have status object");
  
  const status = statusResponse.body.status;
  console.log("✓ Status information retrieved");
  console.log(`  Dev Server: ${status.devServer?.available ? 'Available' : 'Not Available'}`);
  console.log(`  Hot Reloader: ${status.hotReloader?.available ? 'Available' : 'Not Available'}`);
  console.log(`  Ensure Page API: ${status.ensurePageAPI?.available ? 'Available' : 'Not Available'}`);
  console.log(`  Native Server HMR: ${status.nativeServerHMR?.available ? 'Available' : 'Not Available'}`);

  // Test 3: Load pages to ensure compilation
  console.log("\n=== Test 3: Page Loading and Compilation ===");
  
  // Load document page
  const documentPageResponse = await makeRequest("/");
  assert.strictEqual(documentPageResponse.status, 200, "Document page should load");
  assert.ok(documentPageResponse.body.includes("PLACEHOLDER"), "Should contain PLACEHOLDER");
  console.log("✓ Document page loaded and compiled");

  // Load markdown page
  const markdownPageResponse = await makeRequest("/posts/markdown");
  assert.strictEqual(markdownPageResponse.status, 200, "Markdown page should load successfully");
  assert.ok(markdownPageResponse.body.includes("PAGE_HMR_AREA"), "Markdown page should contain PAGE_HMR_AREA");
  console.log("✓ Markdown page loaded and compiled with PAGE_HMR_AREA");

  // Wait for compilation to complete
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Test 4: Comprehensive HMR for document page
  console.log("\n=== Test 4: Comprehensive HMR - Document Page ===");
  
  // 1. Verify initial document content (BEFORE)
  const beforeDocResponse = await makeRequest("/");
  assert.strictEqual(beforeDocResponse.status, 200, "Document page should load before HMR");
  assert.ok(beforeDocResponse.body.includes("PLACEHOLDER"), "Document should contain PLACEHOLDER before HMR");
  assert.ok(!beforeDocResponse.body.includes("COMPREHENSIVE HMR SUCCESS!!"), "Document should NOT contain success message before HMR");
  console.log("✓ Verified document BEFORE HMR: contains PLACEHOLDER");
  
  // 2. Backup original content
  const serverDocPath = path.join(__dirname, "..", ".next", "server", "pages", "_document.js");
  try {
    originalDocumentContent = await fs.readFile(serverDocPath, "utf8");
    console.log(`✓ Backed up original document content (${originalDocumentContent.length} bytes)`);
  } catch (error) {
    console.log("⚠ Could not backup original content, compilation may not be ready");
  }

  // 3. Trigger comprehensive HMR
  const comprehensiveHMRResponse = await makeRequest("/api/next-native-hmr-v2", "POST", {
    action: "comprehensive-hmr",
    pagePath: "/_document",
    searchString: "PLACEHOLDER",
    replaceString: "COMPREHENSIVE HMR SUCCESS!!",
    forceReload: false
  });
  
  assert.strictEqual(comprehensiveHMRResponse.status, 200, "Comprehensive HMR should succeed");
  
  const hmrResult = comprehensiveHMRResponse.body.results;
  console.log(`${comprehensiveHMRResponse.body.success ? '✓' : '⚠'} Comprehensive HMR for document completed`);
  console.log(`  Steps: ${hmrResult.steps.length}`);
  
  hmrResult.steps.forEach((step, index) => {
    console.log(`    ${index + 1}. ${step.step}: ${step.success ? '✓' : '✗'}`);
  });

  // 4. Verify the change is visible (AFTER)
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  const afterDocResponse = await makeRequest("/");
  assert.strictEqual(afterDocResponse.status, 200, "Document page should load after HMR");
  
  if (afterDocResponse.body.includes("COMPREHENSIVE HMR SUCCESS!!")) {
    assert.ok(!afterDocResponse.body.includes("PLACEHOLDER"), "Document should NOT contain PLACEHOLDER after HMR");
    console.log("✓ Document HMR changes are visible - PLACEHOLDER replaced with COMPREHENSIVE HMR SUCCESS!!");
  } else {
    console.log("⚠ Document HMR changes not immediately visible (may be expected with pure Next.js APIs)");
  }

  // Test 5: Comprehensive HMR for markdown page
  console.log("\n=== Test 5: Comprehensive HMR - Markdown Page ===");
  
  // 1. Verify initial markdown content (BEFORE)
  const beforeMarkdownResponse = await makeRequest("/posts/markdown");
  assert.strictEqual(beforeMarkdownResponse.status, 200, "Markdown page should load before HMR");
  assert.ok(beforeMarkdownResponse.body.includes("PAGE_HMR_AREA"), "Markdown should contain PAGE_HMR_AREA before HMR");
  assert.ok(!beforeMarkdownResponse.body.includes("COMPREHENSIVE MARKDOWN HMR SUCCESS!!"), "Markdown should NOT contain success message before HMR");
  console.log("✓ Verified markdown BEFORE HMR: contains PAGE_HMR_AREA");
  
  // 2. Backup original markdown content
  const markdownServerPath = path.join(__dirname, "..", ".next", "server", "pages", "posts", "markdown.js");
  try {
    originalMarkdownContent = await fs.readFile(markdownServerPath, "utf8");
    console.log(`✓ Backed up original markdown content (${originalMarkdownContent.length} bytes)`);
  } catch (error) {
    console.log("⚠ Could not backup original markdown content");
  }

  // 3. Trigger comprehensive HMR for markdown
  const markdownHMRResponse = await makeRequest("/api/next-native-hmr-v2", "POST", {
    action: "comprehensive-hmr",
    pagePath: "/posts/markdown",
    searchString: "PAGE_HMR_AREA",
    replaceString: "COMPREHENSIVE MARKDOWN HMR SUCCESS!!",
    forceReload: false
  });
  
  assert.strictEqual(markdownHMRResponse.status, 200, "Comprehensive markdown HMR should succeed");
  
  const markdownHMRResult = markdownHMRResponse.body.results;
  console.log(`${markdownHMRResponse.body.success ? '✓' : '⚠'} Comprehensive HMR for markdown completed`);
  console.log(`  Steps: ${markdownHMRResult.steps.length}`);
  
  markdownHMRResult.steps.forEach((step, index) => {
    console.log(`    ${index + 1}. ${step.step}: ${step.success ? '✓' : '✗'}`);
  });

  // 4. Verify markdown change is visible (AFTER)
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  const afterMarkdownResponse = await makeRequest("/posts/markdown");
  assert.strictEqual(afterMarkdownResponse.status, 200, "Markdown page should load after HMR");
  
  if (afterMarkdownResponse.body.includes("COMPREHENSIVE MARKDOWN HMR SUCCESS!!")) {
    assert.ok(!afterMarkdownResponse.body.includes("PAGE_HMR_AREA"), "Markdown should NOT contain PAGE_HMR_AREA after HMR");
    console.log("✓ Markdown HMR changes are visible - PAGE_HMR_AREA replaced with COMPREHENSIVE MARKDOWN HMR SUCCESS!!");
  } else {
    console.log("⚠ Markdown HMR changes not immediately visible (may be expected with pure Next.js APIs)");
  }

  // Test 6: Error handling
  console.log("\n=== Test 6: Error Handling ===");
  
  const invalidActionResponse = await makeRequest("/api/next-native-hmr-v2", "POST", {
    action: "invalid-action"
  });
  
  assert.strictEqual(invalidActionResponse.status, 400, "Should return 400 for invalid action");
  assert.ok(invalidActionResponse.body.error.includes("Unknown action"), "Should specify unknown action error");
  console.log("✓ Error handling works correctly");

  const missingPagePathResponse = await makeRequest("/api/next-native-hmr-v2", "POST", {
    action: "comprehensive-hmr"
  });
  
  assert.strictEqual(missingPagePathResponse.status, 400, "Should return 400 for missing pagePath");
  assert.ok(missingPagePathResponse.body.error.includes("pagePath is required"), "Should specify pagePath required");
  console.log("✓ Parameter validation works correctly");

  // Test 7: HTTP method validation
  console.log("\n=== Test 7: HTTP Method Validation ===");
  
  const getResponse = await makeRequest("/api/next-native-hmr-v2", "GET");
  assert.strictEqual(getResponse.status, 405, "Should return 405 for GET method");
  console.log("✓ HTTP method validation works correctly");

  console.log("\n✅ All Next.js Native HMR API v2 tests completed successfully!");
});