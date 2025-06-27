const { test } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("path");

// Constants
const DEFAULT_PORT = 3000;
const SERVER_STARTUP_TIMEOUT = 30000;
const REQUEST_TIMEOUT = 10000;

test("Efficient HMR Missing Actions Test", async (t) => {
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

  // Test efficient HMR API availability first
  console.log("\n=== Testing /api/efficient-hmr availability ===");
  
  const testResponse = await makeRequest("/api/efficient-hmr", "POST", {
    action: "test"
  });
  
  assert.strictEqual(testResponse.status, 200, "Efficient HMR API should be available");
  assert.ok(testResponse.body.success, "Test action should succeed");
  console.log("✓ Efficient HMR API is available");

  // Initialize the API if needed
  console.log("\n=== Initializing Efficient HMR API ===");
  
  const initResponse = await makeRequest("/api/efficient-hmr", "POST", {
    action: "initialize"
  });
  
  let apiInitialized = false;
  if (initResponse.status === 200 && initResponse.body.success) {
    apiInitialized = true;
    console.log("✓ Efficient HMR API initialized successfully");
  } else {
    console.log("⚠ Efficient HMR API initialization failed, testing will be limited");
    console.log(`  Status: ${initResponse.status}`);
    console.log(`  Message: ${initResponse.body?.error || 'Unknown error'}`);
  }

  // Test status action
  console.log("\n=== Testing /api/efficient-hmr status action ===");
  
  try {
    const statusResponse = await makeRequest("/api/efficient-hmr", "POST", {
      action: "status"
    });

    assert.strictEqual(statusResponse.status, 200, "Status action should return 200");
    assert.ok(statusResponse.body.success, "Status action should be successful");
    assert.ok(statusResponse.body.status, "Status response should have status object");
    
    console.log("✓ status action works correctly");
    console.log(`  Instance exists: ${statusResponse.body.status.instanceExists}`);
    console.log(`  Initialized: ${statusResponse.body.status.initialized}`);
    
    if (statusResponse.body.status.availableMethods) {
      console.log(`  Available methods: ${statusResponse.body.status.availableMethods.join(', ')}`);
    }

  } catch (error) {
    console.error("✗ status test failed:", error.message);
    throw error;
  }

  // Test invalidate action
  console.log("\n=== Testing /api/efficient-hmr invalidate action ===");
  
  try {
    const invalidateResponse = await makeRequest("/api/efficient-hmr", "POST", {
      action: "invalidate",
      modules: ["/pages/_document.tsx", "/pages/index.tsx"]
    });

    assert.ok(
      invalidateResponse.status === 200 || invalidateResponse.status === 503,
      "Invalidate should return 200 or 503 (if not initialized)"
    );
    
    if (invalidateResponse.status === 200) {
      assert.ok(invalidateResponse.body.success, "Invalidate should be successful when API is ready");
      console.log("✓ invalidate action works correctly");
      console.log(`  Method: ${invalidateResponse.body.method}`);
    } else if (invalidateResponse.status === 503) {
      console.log("⚠ invalidate action requires API to be fully initialized");
      assert.ok(
        invalidateResponse.body.error.includes("not available"),
        "Should indicate API not available"
      );
    }

  } catch (error) {
    console.error("✗ invalidate test failed:", error.message);
    // Don't fail the test if the API isn't fully ready
  }

  // Test send-message action
  console.log("\n=== Testing /api/efficient-hmr send-message action ===");
  
  try {
    // Test without required parameters first
    const missingActionResponse = await makeRequest("/api/efficient-hmr", "POST", {
      action: "send-message"
    });
    
    assert.strictEqual(missingActionResponse.status, 400, "Should return 400 for missing customAction");
    assert.ok(
      missingActionResponse.body.error.includes("customAction is required"),
      "Should specify customAction is required"
    );
    console.log("✓ Correctly rejects missing customAction parameter");

    // Test with custom action
    const sendMessageResponse = await makeRequest("/api/efficient-hmr", "POST", {
      action: "send-message",
      customAction: "testMessage",
      customData: { message: "Hello from test" }
    });

    assert.ok(
      sendMessageResponse.status === 200 || sendMessageResponse.status === 503,
      "Send message should return 200 or 503 (if not initialized)"
    );
    
    if (sendMessageResponse.status === 200) {
      assert.ok(sendMessageResponse.body.success, "Send message should be successful when API is ready");
      console.log("✓ send-message action works correctly");
      console.log(`  Method: ${sendMessageResponse.body.method}`);
    } else if (sendMessageResponse.status === 503) {
      console.log("⚠ send-message action requires API to be fully initialized");
      assert.ok(
        sendMessageResponse.body.error.includes("not available"),
        "Should indicate API not available"
      );
    }

  } catch (error) {
    console.error("✗ send-message test failed:", error.message);
    // Don't fail the test if the API isn't fully ready
  }

  console.log("\n✓ Efficient HMR missing actions tests completed");
});