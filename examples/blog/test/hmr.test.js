const { test } = require("node:test");
const assert = require("node:assert");
const { spawn, exec } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { promisify } = require("node:util");

const execAsync = promisify(exec);

test("HMR test", async (t) => {
  // Kill any existing processes on common Next.js ports
  try {
    await execAsync("npx kill-port 3000 3001 3002 3003").catch(() => {});
  } catch (e) {
    // Ignore errors, ports might not be in use
  }

  const devServer = spawn("pnpm", ["next", "dev"], { cwd: __dirname + "/.." });
  let stdout = "";
  let stderr = "";
  devServer.stdout.on("data", (data) => (stdout += data.toString()));
  devServer.stderr.on("data", (data) => (stderr += data.toString()));

  let originalDocumentContent = null;

  t.after(async () => {
    console.log("--- stdout ---");
    console.log(stdout);
    console.log("--- stderr ---");
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
      await fs.writeFile(serverDocPath, originalDocumentContent, "utf8");
      console.log("Restored original server _document.js");
    }

    devServer.kill();
    // Clean up any remaining processes
    try {
      await execAsync("npx kill-port 3000 3001 3002 3003").catch(() => {});
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // Wait for the server to be ready and detect the port
  let serverPort = 3000;
  await new Promise((resolve, reject) => {
    const checkServer = (port) => {
      http
        .get(`http://localhost:${port}`, (res) => {
          if (res.statusCode === 200) {
            serverPort = port;
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

    // Clear interval on timeout
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

  // First browse to the page to generate the _document.js file
  console.log("Browsing to page initially to generate document...");
  const initialPage = await makeRequest("/");
  assert.strictEqual(initialPage.status, 200, "Initial page should return 200");
  console.log("Initial page loaded, document should be generated");

  // Verify the page contains PLACEHOLDER
  assert.ok(
    initialPage.body.includes("PLACEHOLDER"),
    "Initial page should contain PLACEHOLDER",
  );
  assert.ok(
    !initialPage.body.includes("Hello world!!"),
    "Initial page should NOT contain Hello world!!",
  );

  // Trigger HMR using string replacement approach
  console.log("Triggering HMR with string replacement...");

  // Read the compiled _document.js file
  const serverDocPath = path.join(
    __dirname,
    "..",
    ".next",
    "server",
    "pages",
    "_document.js",
  );
  originalDocumentContent = await fs.readFile(serverDocPath, "utf8");
  console.log(
    `Read compiled _document.js: ${originalDocumentContent.length} bytes`,
  );

  // Replace PLACEHOLDER with "Hello world!!"
  const updatedContent = originalDocumentContent.replace(
    "PLACEHOLDER",
    "Hello world!!",
  );
  if (updatedContent === originalDocumentContent) {
    console.error("PLACEHOLDER not found in compiled file");
    assert.fail("PLACEHOLDER not found in compiled _document.js");
  }

  // Write the updated content back
  await fs.writeFile(serverDocPath, updatedContent, "utf8");
  console.log("Updated _document.js with string replacement");

  // Try to trigger cache invalidation via the Server HMR API
  try {
    const hmrResponse = await makeRequest("/api/server-hmr", "POST", {
      action: "clear-module-cache",
      modulePath: serverDocPath,
    });
    console.log("Module cache cleared:", hmrResponse.body);

    // Also clear all pages for good measure
    const clearAll = await makeRequest("/api/server-hmr", "POST", {
      action: "clear-all-pages",
    });
    console.log("All pages cleared:", clearAll.body);
  } catch (error) {
    console.log("Server HMR API error:", error.message);
  }

  // Wait for the update to take effect
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Visit the page again to force reload
  console.log("Visiting page again to force reload...");
  const firstReload = await makeRequest("/");
  console.log(`First reload status: ${firstReload.status}`);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Check for the change
  const updatedPage = await makeRequest("/");
  assert.strictEqual(updatedPage.status, 200, "Updated page should return 200");
  assert.ok(
    updatedPage.body.includes("Hello world!!"),
    "Page should contain Hello world!! after string replacement",
  );
});
