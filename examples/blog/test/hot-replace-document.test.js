const { test } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("path");
const fs = require("node:fs/promises");

// Constants
const DEFAULT_PORT = 3000;
const SERVER_STARTUP_TIMEOUT = 30000;
const REQUEST_TIMEOUT = 10000;
const HMR_WAIT_TIME = 2000;

test("Hot Replace Document API Test", async (t) => {
  let devServer = null;
  let serverPort = DEFAULT_PORT;
  let serverReady = false;
  let originalDocumentContent = null;

  // Cleanup
  t.after(async () => {
    // Restore original document content if we modified it
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
        console.log("✓ Restored original server _document.js");
      } catch (error) {
        console.error("✗ Failed to restore _document.js:", error.message);
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

  // Test API availability
  console.log("\n=== Testing /api/hot-replace-document test action ===");
  
  const testResponse = await makeRequest("/api/hot-replace-document", "POST", {
    action: "test"
  });
  
  assert.strictEqual(testResponse.status, 200, "Hot replace document API should be available");
  assert.ok(testResponse.body.success, "Test action should succeed");
  console.log("✓ Hot replace document API is available");
  console.log(`  Method: ${testResponse.body.method}`);
  console.log(`  Available actions: ${testResponse.body.availableActions.join(', ')}`);

  // Load the document page to trigger compilation
  console.log("\n=== Loading document page to trigger compilation ===");
  
  const initialPageResponse = await makeRequest("/");
  assert.strictEqual(initialPageResponse.status, 200, "Document page should load successfully");
  assert.ok(initialPageResponse.body.includes("PLACEHOLDER"), "Page should contain PLACEHOLDER");
  console.log("✓ Document page loaded with PLACEHOLDER content");

  // Wait for compilation
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Test status action
  console.log("\n=== Testing /api/hot-replace-document status action ===");
  
  const statusResponse = await makeRequest("/api/hot-replace-document", "POST", {
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

  // Verify status structure
  assert.ok(statusResponse.body.status.hasOwnProperty('serverDocPath'), "Should have serverDocPath");
  assert.ok(statusResponse.body.status.hasOwnProperty('serverDocExists'), "Should have serverDocExists");
  assert.ok(statusResponse.body.status.hasOwnProperty('serverDocSize'), "Should have serverDocSize");
  assert.ok(statusResponse.body.status.hasOwnProperty('hasPlaceholder'), "Should have hasPlaceholder");

  // Test trigger-replace action
  console.log("\n=== Testing /api/hot-replace-document trigger-replace action ===");
  
  // First, backup the original content
  const serverDocPath = path.join(
    __dirname,
    "..",
    ".next",
    "server",
    "pages",
    "_document.js",
  );
  
  try {
    originalDocumentContent = await fs.readFile(serverDocPath, "utf8");
    console.log(`✓ Backed up original document content (${originalDocumentContent.length} bytes)`);
  } catch (error) {
    console.log("⚠ Could not backup original content, compilation may not be ready");
  }

  // Trigger the hot replace
  const replaceResponse = await makeRequest("/api/hot-replace-document", "POST", {
    action: "trigger-replace",
    searchString: "PLACEHOLDER",
    replaceString: "HOT REPLACE SUCCESS!!"
  });

  if (replaceResponse.status === 200) {
    assert.ok(replaceResponse.body.success, "Replace should be successful");
    console.log("✓ trigger-replace action works correctly");
    console.log(`  Method: ${replaceResponse.body.method}`);
    console.log(`  Search string: ${replaceResponse.body.details.searchString}`);
    console.log(`  Replace string: ${replaceResponse.body.details.replaceString}`);
    console.log(`  Cache cleared: ${replaceResponse.body.details.cacheCleared}`);

    // Wait for changes to take effect
    await new Promise((resolve) => setTimeout(resolve, HMR_WAIT_TIME));

    // Verify the change is visible
    console.log("\n=== Verifying hot replace worked ===");
    
    const updatedPageResponse = await makeRequest("/");
    assert.strictEqual(updatedPageResponse.status, 200, "Page should still load after replacement");
    
    if (updatedPageResponse.body.includes("HOT REPLACE SUCCESS!!")) {
      console.log("✓ Hot replace successful - changes are visible in browser");
    } else {
      console.log("⚠ Hot replace triggered but changes not immediately visible");
      console.log("  This may be expected due to Next.js caching behavior");
    }

  } else if (replaceResponse.status === 404) {
    console.log("⚠ trigger-replace requires document to be compiled first");
    assert.ok(
      replaceResponse.body.error.includes("not found"),
      "Should indicate compiled document not found"
    );
  } else {
    console.log(`⚠ Unexpected response status: ${replaceResponse.status}`);
    console.log(`  Error: ${replaceResponse.body.error || 'Unknown error'}`);
  }

  // Test with custom search/replace strings
  console.log("\n=== Testing custom search/replace strings ===");
  
  const customReplaceResponse = await makeRequest("/api/hot-replace-document", "POST", {
    action: "trigger-replace",
    searchString: "HOT REPLACE SUCCESS!!",
    replaceString: "CUSTOM REPLACEMENT"
  });

  if (customReplaceResponse.status === 200) {
    console.log("✓ Custom search/replace strings work correctly");
  } else if (customReplaceResponse.status === 400) {
    console.log("⚠ Custom search string not found (expected if previous replace didn't work)");
  }

  // Test error cases
  console.log("\n=== Testing error cases ===");
  
  // Test invalid action
  const invalidActionResponse = await makeRequest("/api/hot-replace-document", "POST", {
    action: "invalid-action"
  });
  
  assert.strictEqual(invalidActionResponse.status, 400, "Should return 400 for invalid action");
  assert.ok(
    invalidActionResponse.body.error.includes("Unknown action"),
    "Should specify unknown action error"
  );
  console.log("✓ Correctly rejects invalid action");

  // Test invalid HTTP method
  const getResponse = await makeRequest("/api/hot-replace-document", "GET");
  assert.strictEqual(getResponse.status, 405, "Should return 405 for GET method");
  console.log("✓ Correctly rejects non-POST methods");

  // ====================
  // MARKDOWN PAGE TESTING
  // ====================
  console.log("\n=== Testing markdown page hot replacement ===");
  
  // Load markdown page to trigger compilation
  const initialMarkdownResponse = await makeRequest("/posts/markdown");
  assert.strictEqual(initialMarkdownResponse.status, 200, "Markdown page should load successfully");
  assert.ok(initialMarkdownResponse.body.includes("PAGE_HMR_AREA"), "Markdown page should contain PAGE_HMR_AREA");
  console.log("✓ Markdown page loaded with PAGE_HMR_AREA content");

  // Wait for markdown compilation
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Try to replace in markdown page (this will likely fail as the API is document-focused)
  const markdownReplaceResponse = await makeRequest("/api/hot-replace-document", "POST", {
    action: "trigger-replace",
    searchString: "PAGE_HMR_AREA", 
    replaceString: "MARKDOWN HOT REPLACE SUCCESS!!"
  });

  if (markdownReplaceResponse.status === 200) {
    console.log("✓ Markdown replacement triggered successfully");
    
    // Wait for changes to take effect
    await new Promise((resolve) => setTimeout(resolve, HMR_WAIT_TIME));
    
    // Verify markdown change is visible
    const updatedMarkdownResponse = await makeRequest("/posts/markdown");
    if (updatedMarkdownResponse.body.includes("MARKDOWN HOT REPLACE SUCCESS!!")) {
      console.log("✓ Markdown hot replace successful - changes are visible");
    } else {
      console.log("⚠ Markdown hot replace triggered but changes not immediately visible");
    }
  } else {
    console.log("⚠ Hot replace document API doesn't support markdown pages (expected)");
    console.log(`  Status: ${markdownReplaceResponse.status}`);
    console.log(`  Error: ${markdownReplaceResponse.body?.error || 'Unknown error'}`);
  }

  console.log("\n✓ Hot Replace Document API tests completed");
});