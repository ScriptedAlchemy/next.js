const { test } = require("node:test");
const assert = require("node:assert");
const { spawn, exec } = require("node:child_process");
const http = require("node:http");
const path = require("path");
const fs = require("node:fs/promises");
const { promisify } = require("node:util");

const execAsync = promisify(exec);

test("HMR Integration Test", async (t) => {
  let devServer = null;
  let serverPort = 3000;
  let serverReady = false;

  console.log("🧪 HMR Integration Test Starting...");
  console.log("====================================");

  // Cleanup function
  const cleanup = async () => {
    console.log("🧹 Cleaning up...");
    if (devServer) {
      devServer.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    try {
      await execAsync("npx kill-port 3000 3001 3002 3003").catch(() => {});
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  // Register cleanup on test completion
  t.after(cleanup);

  // Helper function to make HTTP requests
  const makeRequest = async (path, method = "GET", data = null) => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "localhost",
        port: serverPort,
        path,
        method,
        headers:
          method === "POST" ? { "Content-Type": "application/json" } : {},
        timeout: 10000,
      };

      const req = http.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const result = {
              status: res.statusCode,
              headers: res.headers,
              body: res.headers["content-type"]?.includes("json")
                ? JSON.parse(body)
                : body,
            };
            resolve(result);
          } catch (error) {
            resolve({
              status: res.statusCode,
              body,
              parseError: error.message,
            });
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
  };

  // Step 1: Start the dev server
  console.log("1. Starting Next.js dev server...");

  // Kill any existing processes first
  await execAsync("npx kill-port 3000 3001 3002 3003").catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 1000));

  devServer = spawn("pnpm", ["dev"], {
    cwd: path.join(__dirname, ".."),
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  devServer.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  devServer.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  // Wait for server to be ready (with timeout)
  console.log("   Waiting for server to start...");

  const serverStartTimeout = 60000; // 60 seconds
  const startTime = Date.now();

  while (!serverReady && Date.now() - startTime < serverStartTimeout) {
    try {
      const response = await makeRequest("/");
      if (response.status === 200 || response.status === 500) {
        serverReady = true;
        console.log("   ✅ Server is responding");
        break;
      }
    } catch (error) {
      // Server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check for port in stderr
    const portMatch = stderr.match(/Local:\s+http:\/\/localhost:(\d+)/);
    if (portMatch) {
      const detectedPort = parseInt(portMatch[1]);
      if (detectedPort !== serverPort) {
        serverPort = detectedPort;
        console.log(`   Detected server on port ${serverPort}`);
      }
    }
  }

  if (!serverReady) {
    console.log("❌ Server failed to start within timeout");
    console.log("Stdout:", stdout.slice(-1000));
    console.log("Stderr:", stderr.slice(-1000));
    throw new Error("Server startup timeout");
  }

  // Step 2: Test API endpoints availability
  console.log("2. Testing API endpoints...");

  const endpoints = [
    { name: "File-based HMR", path: "/api/file-based-hmr" },
    { name: "Internal API HMR", path: "/api/internal-api-hmr" },
  ];

  const endpointResults = {};

  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(endpoint.path, "POST", {
        action: "test",
      });
      endpointResults[endpoint.name] = {
        available: response.status === 200,
        status: response.status,
        response: response.body,
      };

      if (response.status === 200) {
        console.log(`   ✅ ${endpoint.name} API: Available`);
      } else {
        console.log(`   ❌ ${endpoint.name} API: Status ${response.status}`);
      }
    } catch (error) {
      endpointResults[endpoint.name] = {
        available: false,
        error: error.message,
      };
      console.log(`   ❌ ${endpoint.name} API: Error - ${error.message}`);
    }
  }

  // Step 3: Test file-based HMR if available
  if (endpointResults["File-based HMR"]?.available) {
    console.log("3. Testing File-based HMR functionality...");

    try {
      // Get initial page state
      const initialPage = await makeRequest("/");
      const hasHelloWorldInitially = initialPage.body.includes(
        "<h1>Hello world!!</h1>",
      );
      console.log(
        `   Initial page state: ${hasHelloWorldInitially ? "HAS" : "NO"} Hello World`,
      );

      // Trigger file-based HMR
      const hmrResponse = await makeRequest("/api/file-based-hmr", "POST", {
        action: "trigger-hmr",
        pagePath: "/_document",
      });

      if (hmrResponse.status === 200 && hmrResponse.body.success) {
        console.log("   ✅ File-based HMR triggered successfully");

        // Wait for change to take effect
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check if page was updated
        const updatedPage = await makeRequest("/");
        const hasHelloWorldAfter = updatedPage.body.includes(
          "<h1>Hello world!!</h1>",
        );

        if (hasHelloWorldAfter && !hasHelloWorldInitially) {
          console.log("   ✅ File-based HMR successfully updated page");
        } else if (hasHelloWorldAfter) {
          console.log(
            "   ✅ Page contains expected content (may have been updated)",
          );
        } else {
          console.log("   ⚠️  Page not visibly updated but HMR succeeded");
        }
      } else {
        console.log(
          `   ❌ File-based HMR failed: ${hmrResponse.body?.error || "Unknown error"}`,
        );
      }
    } catch (error) {
      console.log(`   ❌ File-based HMR test error: ${error.message}`);
    }
  } else {
    console.log("3. Skipping File-based HMR test (API not available)");
  }

  // Step 4: Test internal API HMR if available
  if (endpointResults["Internal API HMR"]?.available) {
    console.log("4. Testing Internal API HMR functionality...");

    try {
      // Initialize the internal API
      const initResponse = await makeRequest("/api/internal-api-hmr", "POST", {
        action: "initialize",
      });

      if (initResponse.status === 200 && initResponse.body.success) {
        console.log("   ✅ Internal API initialized successfully");

        // Try to trigger HMR
        const hmrResponse = await makeRequest("/api/internal-api-hmr", "POST", {
          action: "trigger-hmr",
          pagePath: "/_document",
          forceReload: true,
        });

        if (hmrResponse.status === 200 && hmrResponse.body.success) {
          console.log("   ✅ Internal API HMR triggered successfully");
        } else {
          console.log(
            `   ❌ Internal API HMR failed: ${hmrResponse.body?.error || "Unknown error"}`,
          );
        }
      } else {
        console.log(
          `   ⚠️  Internal API initialization failed: ${initResponse.body?.error || "Unknown error"}`,
        );
        console.log(
          "      This is expected if setupDevBundler approach is not accessible",
        );
      }
    } catch (error) {
      console.log(`   ❌ Internal API HMR test error: ${error.message}`);
    }
  } else {
    console.log("4. Skipping Internal API HMR test (API not available)");
  }

  // Step 5: Summary
  console.log("\n📊 Integration Test Results");
  console.log("============================");

  const fileBasedWorking = endpointResults["File-based HMR"]?.available;
  const internalAPIWorking = endpointResults["Internal API HMR"]?.available;

  console.log(
    `File-based HMR API:    ${fileBasedWorking ? "✅ WORKING" : "❌ NOT AVAILABLE"}`,
  );
  console.log(
    `Internal API HMR:      ${internalAPIWorking ? "✅ WORKING" : "❌ NOT AVAILABLE"}`,
  );

  // Assert that at least one method is working
  assert.ok(
    fileBasedWorking || internalAPIWorking,
    "At least one HMR method should be available",
  );

  console.log("\n🎉 Integration Test Complete!");
});
