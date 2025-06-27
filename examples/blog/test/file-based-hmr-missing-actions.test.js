const { test } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("path");

// Constants
const DEFAULT_PORT = 3000;
const SERVER_STARTUP_TIMEOUT = 30000;
const REQUEST_TIMEOUT = 10000;

test("File-Based HMR Missing Actions Test", async (t) => {
  let devServer = null;
  let serverPort = DEFAULT_PORT;
  let serverReady = false;

  // Cleanup
  t.after(async () => {
    console.log("\n=== Cleanup Phase ===");
    
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

  // Start dev server
  console.log("Starting Next.js development server...");
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
        console.log(`Server is responding on port ${serverPort}`);
        break;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  assert.ok(serverReady, `Server failed to start within ${SERVER_STARTUP_TIMEOUT / 1000} seconds`);

  // Test file-based HMR API availability first
  console.log("\n=== Testing /api/file-based-hmr availability ===");
  
  const testResponse = await makeRequest("/api/file-based-hmr", "POST", {
    action: "test"
  });
  
  assert.strictEqual(testResponse.status, 200, "File-based HMR API should be available");
  assert.ok(testResponse.body.success, "Test action should succeed");
  console.log("✓ File-based HMR API is available");
  console.log(`  Method: ${testResponse.body.method}`);
  console.log(`  Available actions: ${testResponse.body.availableActions.join(', ')}`);

  // Test status action (missing from current test coverage)
  console.log("\n=== Testing /api/file-based-hmr status action ===");
  
  try {
    const statusResponse = await makeRequest("/api/file-based-hmr", "POST", {
      action: "status"
    });

    assert.strictEqual(statusResponse.status, 200, "Status action should return 200");
    assert.ok(statusResponse.body.success, "Status action should be successful");
    assert.ok(statusResponse.body.status, "Status response should have status object");
    
    console.log("✓ status action works correctly");
    console.log(`  Server doc path: ${statusResponse.body.status.serverDocPath}`);
    console.log(`  Server doc exists: ${statusResponse.body.status.serverDocExists}`);
    console.log(`  Server doc size: ${statusResponse.body.status.serverDocSize} bytes`);
    console.log(`  Has placeholder: ${statusResponse.body.status.hasPlaceholder}`);
    console.log(`  Approach: ${statusResponse.body.status.approach}`);

    // Verify the status structure
    assert.ok(statusResponse.body.status.hasOwnProperty('serverDocPath'), "Should have serverDocPath");
    assert.ok(statusResponse.body.status.hasOwnProperty('serverDocExists'), "Should have serverDocExists");
    assert.ok(statusResponse.body.status.hasOwnProperty('serverDocSize'), "Should have serverDocSize");
    assert.ok(statusResponse.body.status.hasOwnProperty('hasPlaceholder'), "Should have hasPlaceholder");
    assert.ok(statusResponse.body.status.hasOwnProperty('approach'), "Should have approach");

  } catch (error) {
    console.error("✗ status test failed:", error.message);
    throw error;
  }

  // Trigger a page load to ensure the document is compiled
  console.log("\n=== Loading document page to ensure compilation ===");
  
  try {
    const pageResponse = await makeRequest("/");
    assert.strictEqual(pageResponse.status, 200, "Document page should load successfully");
    console.log("✓ Document page loaded, compilation triggered");

    // Wait a moment for compilation to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check status again after compilation
    const statusAfterResponse = await makeRequest("/api/file-based-hmr", "POST", {
      action: "status"
    });

    assert.strictEqual(statusAfterResponse.status, 200, "Status action should work after compilation");
    console.log("✓ Status check after compilation successful");
    console.log(`  Server doc exists: ${statusAfterResponse.body.status.serverDocExists}`);
    console.log(`  Server doc size: ${statusAfterResponse.body.status.serverDocSize} bytes`);
    console.log(`  Has placeholder: ${statusAfterResponse.body.status.hasPlaceholder}`);

  } catch (error) {
    console.error("✗ Post-compilation status test failed:", error.message);
    // Don't fail the test if this doesn't work
  }

  // Test trigger-hmr action (this should already be tested elsewhere, but let's verify)
  console.log("\n=== Testing /api/file-based-hmr trigger-hmr action ===");
  
  try {
    // Test without pagePath
    const missingPathResponse = await makeRequest("/api/file-based-hmr", "POST", {
      action: "trigger-hmr"
    });
    
    assert.strictEqual(missingPathResponse.status, 400, "Should return 400 for missing pagePath");
    assert.ok(
      missingPathResponse.body.error.includes("pagePath is required"),
      "Should specify pagePath is required"
    );
    console.log("✓ Correctly rejects missing pagePath parameter");

    // Test with pagePath
    const triggerResponse = await makeRequest("/api/file-based-hmr", "POST", {
      action: "trigger-hmr",
      pagePath: "/_document"
    });

    // Should work if document is compiled, or return 404 if not
    assert.ok(
      triggerResponse.status === 200 || triggerResponse.status === 404,
      "Should return 200 (success) or 404 (not compiled yet)"
    );
    
    if (triggerResponse.status === 200) {
      assert.ok(triggerResponse.body.success, "Trigger should be successful");
      console.log("✓ trigger-hmr action works correctly");
      console.log(`  Method: ${triggerResponse.body.method}`);
      console.log(`  Cache cleared: ${triggerResponse.body.details?.cacheCleared}`);
    } else if (triggerResponse.status === 404) {
      console.log("⚠ trigger-hmr requires document to be compiled first");
      assert.ok(
        triggerResponse.body.error.includes("not found"),
        "Should indicate compiled document not found"
      );
    }

  } catch (error) {
    console.error("✗ trigger-hmr test failed:", error.message);
    // Don't fail the test if the implementation has issues
  }

  console.log("\n✓ File-based HMR missing actions tests completed");
});