const { test } = require("node:test");
const assert = require("node:assert");
const { spawn, exec } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { promisify } = require("node:util");

const execAsync = promisify(exec);

test("HMR Test - Document and Markdown Pages", async (t) => {
  // ====================
  // SETUP PHASE
  // ====================
  
  // Declare test result tracking variables at the top
  let documentPageUpdated = false;
  let markdownPageUpdated = false;
  
  // Kill any existing processes on common Next.js ports
  try {
    await execAsync("npx kill-port 3000 3001 3002 3003").catch(() => {});
  } catch (e) {
    // Ignore errors, ports might not be in use
  }

  // Start the development server
  const devServer = spawn("pnpm", ["next", "dev"], { cwd: path.join(__dirname, "..") });
  let stdout = "";
  let stderr = "";
  devServer.stdout.on("data", (data) => (stdout += data.toString()));
  devServer.stderr.on("data", (data) => (stderr += data.toString()));

  // Variables to store original content for restoration
  let originalDocumentContent = null;
  let originalMarkdownContent = null;

  // ====================
  // CLEANUP PHASE
  // ====================
  t.after(async () => {
    console.log("\n====================");
    console.log("CLEANUP PHASE");
    console.log("====================");
    
    // Log server output for debugging
    if (process.env.DEBUG) {
      console.log("\n--- Server stdout ---");
      console.log(stdout);
      console.log("\n--- Server stderr ---");
      console.log(stderr);
    }

    // Restore original files
    try {
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
        console.log("✓ Restored original server _document.js");
      }
    } catch (error) {
      console.error("✗ Failed to restore _document.js:", error.message);
    }

    try {
      if (originalMarkdownContent) {
        const markdownServerPath = path.join(
          __dirname,
          "..",
          ".next",
          "server",
          "pages",
          "posts",
          "markdown.js",
        );
        await fs.writeFile(markdownServerPath, originalMarkdownContent, "utf8");
        console.log("✓ Restored original server markdown.js");
      }
    } catch (error) {
      console.error("✗ Failed to restore markdown.js:", error.message);
    }

    // Terminate dev server
    devServer.kill();
    console.log("✓ Dev server terminated");
    
    // Clean up any remaining processes
    try {
      await execAsync("npx kill-port 3000 3001 3002 3003").catch(() => {});
      console.log("✓ Cleaned up ports");
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // ====================
  // SERVER STARTUP
  // ====================
  console.log("Starting Next.js development server...");
  
  let serverPort = 3000;
  try {
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
            console.log(`✓ Detected server running on port ${serverPort}`);
          }
        }

        checkServer(serverPort);
      }, 1000);

      // Clear interval on timeout
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error("Server startup timeout after 30 seconds"));
      }, 30000);
    });
    
    console.log(`✓ Server is ready on port ${serverPort}`);
  } catch (error) {
    assert.fail(`Server startup failed: ${error.message}`);
  }

  // Helper function to make HTTP requests
  async function makeRequest(path, method = "GET", data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "localhost",
        port: serverPort,
        path,
        method,
        headers: method === "POST" ? { 
          "Content-Type": "application/json" 
        } : {
          // Add cache-busting headers to prevent browser/server cache
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
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

  // ====================
  // TEST DOCUMENT HMR
  // ====================
  console.log("\n====================");
  console.log("TEST DOCUMENT HMR");
  console.log("====================");
  
  try {
    // Step 1: Initial page load
    console.log("1. Loading initial document page...");
    const initialPage = await makeRequest("/");
    assert.strictEqual(initialPage.status, 200, "Initial page should return 200");
    
    // Step 2: Verify initial content
    console.log("2. Verifying initial content...");
    assert.ok(
      initialPage.body.includes("PLACEHOLDER"),
      "Initial page should contain PLACEHOLDER",
    );
    assert.ok(
      !initialPage.body.includes("Hello world!!"),
      "Initial page should NOT contain Hello world!!",
    );
    console.log("✓ Initial content verified");

    // Step 3: Read and modify compiled document
    console.log("3. Reading compiled _document.js...");
    const serverDocPath = path.join(
      __dirname,
      "..",
      ".next",
      "server",
      "pages",
      "_document.js",
    );
    originalDocumentContent = await fs.readFile(serverDocPath, "utf8");
    assert.ok(originalDocumentContent.length > 0, "Compiled document should not be empty");
    console.log(`✓ Read compiled _document.js: ${originalDocumentContent.length} bytes`);

    // Step 4: Replace content
    console.log("4. Modifying document content...");
    const updatedContent = originalDocumentContent.replace(
      "PLACEHOLDER",
      "Hello world!!",
    );
    assert.notStrictEqual(
      updatedContent,
      originalDocumentContent,
      "PLACEHOLDER not found in compiled _document.js"
    );
    
    await fs.writeFile(serverDocPath, updatedContent, "utf8");
    console.log("✓ Document content modified");

    // Step 5: Trigger cache invalidation
    console.log("5. Triggering cache invalidation...");
    try {
      const hmrResponse = await makeRequest("/api/server-hmr", "POST", {
        action: "clear-module-cache",
        modulePath: serverDocPath,
      });
      assert.ok(hmrResponse.status < 500, "HMR API should not return server error");
      
      const clearAll = await makeRequest("/api/server-hmr", "POST", {
        action: "clear-all-pages",
      });
      assert.ok(clearAll.status < 500, "Clear pages API should not return server error");
      console.log("✓ Cache invalidation triggered");
    } catch (error) {
      console.warn("⚠ Server HMR API not available, continuing...");
    }

    // Step 6: Wait and verify update
    console.log("6. Waiting for HMR update...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    let updatedPage;
    const maxAttempts = 5;
    for (let i = 0; i < maxAttempts; i++) {
      updatedPage = await makeRequest("/");
      if (updatedPage.body.includes("Hello world!!")) {
        console.log(`✓ Document updated after ${i + 1} attempts`);
        documentPageUpdated = true;
        break;
      }
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    
    // Step 7: Assert update success
    assert.strictEqual(updatedPage.status, 200, "Updated document page should return 200");
    assert.ok(
      documentPageUpdated,
      "Document HMR failed - content did not update after 5 attempts"
    );
    console.log("✓ Document HMR test completed successfully");
    
  } catch (error) {
    console.error("✗ Document HMR test failed:", error.message);
    throw error;
  }

  // ====================
  // TEST MARKDOWN HMR
  // ====================
  console.log("\n====================");
  console.log("TEST MARKDOWN HMR");
  console.log("====================");
  
  try {
    // Step 1: Initial markdown page load
    console.log("1. Loading initial markdown page...");
    const initialMarkdownPage = await makeRequest("/posts/markdown");
    assert.strictEqual(initialMarkdownPage.status, 200, "Initial markdown page should return 200");
    
    // Step 2: Verify initial content
    console.log("2. Verifying initial markdown content...");
    assert.ok(
      initialMarkdownPage.body.includes("PAGE_HMR_AREA"),
      "Initial markdown page should contain PAGE_HMR_AREA",
    );
    assert.ok(
      !initialMarkdownPage.body.includes("HMR SUCCESS ON MARKDOWN PAGE!"),
      "Initial markdown page should NOT contain HMR SUCCESS ON MARKDOWN PAGE!",
    );
    console.log("✓ Initial markdown content verified");

    // Step 3: Ensure markdown page is compiled by visiting it
    console.log("3. Visiting markdown page to ensure compilation...");
    const markdownPageVisit = await makeRequest("/posts/markdown");
    assert.strictEqual(markdownPageVisit.status, 200, "Markdown page should be accessible");
    console.log("✓ Markdown page visited and should be compiled");
    
    // Step 3b: Wait for compilation to complete
    console.log("3b. Waiting for markdown compilation to complete...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 4: Read and modify compiled markdown (dist code only)
    console.log("4. Reading compiled markdown.js...");
    const markdownServerPath = path.join(
      __dirname,
      "..",
      ".next",
      "server",
      "pages",
      "posts",
      "markdown.js",
    );
    
    // Wait for file to exist and have content
    let fileReady = false;
    for (let i = 0; i < 10; i++) {
      try {
        const stats = await fs.stat(markdownServerPath);
        if (stats.size > 5000) { // Ensure substantial content
          fileReady = true;
          break;
        }
      } catch (error) {
        // File doesn't exist yet
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    
    if (!fileReady) {
      assert.fail("Compiled markdown.js file not ready after 10 seconds");
    }
    
    originalMarkdownContent = await fs.readFile(markdownServerPath, "utf8");
    assert.ok(originalMarkdownContent.length > 0, "Compiled markdown should not be empty");
    console.log(`✓ Read compiled markdown.js: ${originalMarkdownContent.length} bytes`);

    // Step 5: Replace content in compiled file (dist code only)
    console.log("5. Modifying compiled markdown content...");
    
    // Replace content within the eval string
    let updatedMarkdownContent = originalMarkdownContent.replace(
      "PAGE_HMR_AREA",
      "HMR SUCCESS ON MARKDOWN PAGE!",
    );
    
    // Also replace in the base64 encoded source map to maintain consistency
    if (updatedMarkdownContent.includes("PAGE_HMR_AREA")) {
      // If the first replacement didn't work, let's try to replace all occurrences
      updatedMarkdownContent = originalMarkdownContent.replace(
        /PAGE_HMR_AREA/g,
        "HMR SUCCESS ON MARKDOWN PAGE!",
      );
    }
    
    assert.notStrictEqual(
      updatedMarkdownContent,
      originalMarkdownContent,
      "PAGE_HMR_AREA not found in compiled markdown.js"
    );
    
    // Verify the replacement actually happened
    const replacementCount = (originalMarkdownContent.match(/PAGE_HMR_AREA/g) || []).length;
    const newCount = (updatedMarkdownContent.match(/HMR SUCCESS ON MARKDOWN PAGE!/g) || []).length;
    console.log(`   Found ${replacementCount} instances of PAGE_HMR_AREA, replaced with ${newCount} instances`);
    
    // Modify file directly without cache clearing to avoid recompilation
    await fs.writeFile(markdownServerPath, updatedMarkdownContent, "utf8");
    console.log("✓ Compiled markdown content modified");

    // Step 6: Force Node.js to recognize file changes by updating timestamps
    console.log("6. Updating file timestamp to trigger recognition...");
    try {
      const now = new Date();
      await fs.utimes(markdownServerPath, now, now);
      console.log("✓ File timestamp updated");
      
      // Wait a moment for filesystem to register the change
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Use the working approach from manual test
      try {
        const clearAll = await makeRequest("/api/server-hmr", "POST", {
          action: "clear-all-pages",
        });
        console.log("✓ All pages cache cleared via API");
      } catch (apiError) {
        console.log("ℹ️ API not available, continuing without cache clear");
      }
    } catch (error) {
      console.warn("⚠ File timestamp update failed:", error.message);
    }

    // Step 7: Verify our file modification persists
    console.log("7. Verifying file modification persists...");
    try {
      const currentContent = await fs.readFile(markdownServerPath, "utf8");
      const stillModified = currentContent.includes("HMR SUCCESS ON MARKDOWN PAGE!");
      const wasReverted = currentContent.includes("PAGE_HMR_AREA");
      console.log(`   Still modified: ${stillModified}, Was reverted: ${wasReverted}`);
      
      if (wasReverted && !stillModified) {
        console.log("⚠️ File was recompiled from source - this is the core issue");
        // Let's try modifying the file again after recompilation
        const reUpdatedContent = currentContent.replace(
          "PAGE_HMR_AREA",
          "HMR SUCCESS ON MARKDOWN PAGE! (retry)",
        );
        await fs.writeFile(markdownServerPath, reUpdatedContent, "utf8");
        console.log("✓ Re-applied modification after recompilation");
      }
    } catch (error) {
      console.warn("⚠ Could not verify file state:", error.message);
    }

    // Step 8: Wait and verify update (using the proven working approach)
    console.log("8. Waiting for markdown HMR update...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Test with the approach that worked in manual testing
    const updatedMarkdownPage = await makeRequest("/posts/markdown?" + Date.now());
    const hasSuccess = updatedMarkdownPage.body.includes("HMR SUCCESS ON MARKDOWN PAGE!");
    const hasRetrySuccess = updatedMarkdownPage.body.includes("HMR SUCCESS ON MARKDOWN PAGE! (retry)");
    const hasOriginal = updatedMarkdownPage.body.includes("PAGE_HMR_AREA");
    
    console.log(`   First request: Success=${hasSuccess}, RetrySuccess=${hasRetrySuccess}, Original=${hasOriginal}`);
    
    if (hasSuccess || hasRetrySuccess) {
      console.log(`✓ Markdown updated successfully!`);
      markdownPageUpdated = true;
    } else {
      // If first request didn't work, try a few more attempts
      console.log("   First request didn't show changes, trying additional attempts...");
      
      for (let i = 1; i <= 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        const retryPage = await makeRequest("/posts/markdown?" + (Date.now() + i));
        const retryHasSuccess = retryPage.body.includes("HMR SUCCESS ON MARKDOWN PAGE!");
        const retryHasRetrySuccess = retryPage.body.includes("HMR SUCCESS ON MARKDOWN PAGE! (retry)");
        const retryHasOriginal = retryPage.body.includes("PAGE_HMR_AREA");
        
        console.log(`   Attempt ${i + 1}: Success=${retryHasSuccess}, RetrySuccess=${retryHasRetrySuccess}, Original=${retryHasOriginal}`);
        
        if (retryHasSuccess || retryHasRetrySuccess) {
          console.log(`✓ Markdown updated after ${i + 1} attempts!`);
          markdownPageUpdated = true;
          break;
        }
      }
    }
    
    // Step 8: Assert update success
    assert.ok(
      markdownPageUpdated,
      "Markdown HMR failed - content did not update after 8 attempts"
    );
    console.log("✓ Markdown HMR test completed successfully");
    
  } catch (error) {
    console.error("✗ Markdown HMR test failed:", error.message);
    throw error;
  }

  // ====================
  // TEST SUMMARY
  // ====================
  console.log("\n====================");
  console.log("TEST SUMMARY");
  console.log("====================");
  
  const testResults = [
    { name: "Document HMR", passed: documentPageUpdated },
    { name: "Markdown HMR", passed: markdownPageUpdated }
  ];
  
  testResults.forEach(result => {
    console.log(`${result.passed ? "✓" : "✗"} ${result.name}: ${result.passed ? "PASSED" : "FAILED"}`);
  });
  
  const failedTests = testResults.filter(r => !r.passed);
  if (failedTests.length > 0) {
    const failureMessage = `HMR test failed: ${failedTests.map(t => t.name).join(", ")}`;
    console.error(`\n✗ ${failureMessage}`);
    assert.fail(failureMessage);
  } else {
    console.log("\n✓ All HMR tests passed successfully!");
  }
});
