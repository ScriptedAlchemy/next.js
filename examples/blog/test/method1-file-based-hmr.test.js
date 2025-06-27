const { test } = require("node:test");
const assert = require("node:assert");
const { spawn, exec } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { promisify } = require("node:util");

const execAsync = promisify(exec);

test("Method 1: File-Based HMR Test", async (t) => {
  let devServer = null;
  let serverPort = 3000;
  let stdout = "";
  let stderr = "";
  let originalDocumentContent = null;

  // Kill any existing processes on common Next.js ports
  try {
    await execAsync("npx kill-port 3000 3001 3002 3003").catch(() => {});
  } catch (e) {
    // Ignore errors, ports might not be in use
  }

  // Start the dev server
  devServer = spawn("pnpm", ["dev"], { cwd: __dirname + "/.." });
  devServer.stdout.on("data", (data) => (stdout += data.toString()));
  devServer.stderr.on("data", (data) => (stderr += data.toString()));

  t.after(async () => {
    console.log("--- Method 1 Test stdout ---");
    console.log(stdout);
    console.log("--- Method 1 Test stderr ---");
    console.log(stderr);

    // Restore original server document if we have it
    if (originalDocumentContent) {
      const serverDocPath = path.join(
        __dirname,
        "..",
        ".next",
        "server",
        "pages",
        "_document.js",
      );
      try {
        await fs.writeFile(serverDocPath, originalDocumentContent, "utf8");
        console.log("Restored original server _document.js");
      } catch (error) {
        console.log("Could not restore original document:", error.message);
      }
    }

    if (devServer) {
      devServer.kill();
    }
    // Clean up any remaining processes
    try {
      await execAsync("npx kill-port 3000 3001 3002 3003").catch(() => {});
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // Wait for the server to be ready and detect the port
  await new Promise((resolve, reject) => {
    const checkServer = (port) => {
      http
        .get(`http://localhost:${port}`, (res) => {
          if (res.statusCode === 200) {
            serverPort = port;
            console.log(`✅ Server ready on port ${port}`);
            resolve();
          }
        })
        .on("error", () => {});
    };

    const interval = setInterval(() => {
      // Check if stderr contains port information
      const portMatch = stderr.match(/Local:\s+http:\/\/localhost:(\d+)/);
      if (portMatch) {
        const detectedPort = parseInt(portMatch[1]);
        if (detectedPort !== serverPort) {
          serverPort = detectedPort;
          console.log(`Detected server running on port ${serverPort}`);
        }
      }

      checkServer(serverPort);
    }, 1000);

    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Server startup timeout"));
    }, 30000);
  });

  // Helper function to make HTTP requests
  async function makeRequest(path, method = "GET", data = null) {
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
  }

  console.log("🧪 Testing Method 1: File-Based HMR Approach");
  console.log("===========================================");

  // Test 1: Initial page state
  console.log("1. Testing initial page state...");
  const initialPage = await makeRequest("/");
  assert.strictEqual(initialPage.status, 200, "Initial page should return 200");
  assert.ok(
    initialPage.body.includes("PLACEHOLDER"),
    "Initial page should contain PLACEHOLDER",
  );
  assert.ok(
    !initialPage.body.includes("Hello world!!"),
    "Page should NOT contain Hello world!! initially",
  );
  console.log("   ✅ Initial page test passed");

  // Test 2: File-based chunk replacement API endpoint
  console.log("2. Testing file-based HMR API endpoint...");
  const fileHMRResponse = await makeRequest("/api/file-based-hmr", "POST", {
    action: "test",
  });
  assert.strictEqual(
    fileHMRResponse.status,
    200,
    "File-based HMR API should be available",
  );
  console.log("   ✅ File-based HMR API available");

  // Test 3: Trigger file-based HMR
  console.log("3. Triggering file-based HMR...");
  const hmrTrigger = await makeRequest("/api/file-based-hmr", "POST", {
    action: "trigger-hmr",
    pagePath: "/_document",
  });
  assert.strictEqual(hmrTrigger.status, 200, "HMR trigger should succeed");
  assert.ok(hmrTrigger.body.success, "HMR should report success");
  console.log("   ✅ File-based HMR triggered successfully");

  // Test 4: Verify page was updated
  console.log("4. Verifying page update after file-based HMR...");
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for update

  // First reload to trigger recompilation
  const firstReload = await makeRequest("/");
  console.log(`   First reload status: ${firstReload.status}`);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Second reload should show the updated content
  const secondReload = await makeRequest("/");
  console.log(`   Second reload status: ${secondReload.status}`);

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Third reload to ensure updated content is visible
  const updatedPage = await makeRequest("/");
  assert.strictEqual(updatedPage.status, 200, "Updated page should return 200");
  assert.ok(
    updatedPage.body.includes("Hello world!!"),
    "Page should contain Hello world!! after file-based HMR",
  );
  console.log("   ✅ File-based HMR successfully updated page");

  console.log("\n🎉 Method 1: File-Based HMR Test Complete!");
  console.log("✅ File-based chunk replacement: WORKING");
  console.log("✅ API endpoint integration: WORKING");
  console.log("✅ Page update verification: WORKING");
});
