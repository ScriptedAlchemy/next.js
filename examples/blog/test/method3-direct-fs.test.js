const { test } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");

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
  FINAL_CLEANUP_WAIT: 1000,
  COMPILATION_WAIT_TIME: 3000,
  PATCH_INITIALIZATION_WAIT: 5000
};

// Expected content markers
const CONTENT_MARKERS = {
  PLACEHOLDER: "PLACEHOLDER",
  UPDATED_DOCUMENT: "Direct FS HMR SUCCESS ON DOCUMENT!",
  MARKDOWN_ORIGINAL: "PAGE_HMR_AREA",
  MARKDOWN_UPDATED: "Direct FS HMR SUCCESS ON MARKDOWN!"
};

test("Method 3: Direct File System HMR", async (t) => {
  // Test state variables
  let devServer = null;
  let serverPort = TEST_CONFIG.SERVER_PORT;
  let originalDocumentContent = null;

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

  // ========================================
  // CLEANUP: Test Teardown
  // ========================================
  t.after(async () => {
    console.log("\n🔪 Starting Method 3 cleanup...");
    
    // Cleanup original document content
    if (originalDocumentContent) {
      try {
        const serverDocPath = path.join(__dirname, "..", ".next", "server", "pages", "_document.js");
        await fs.writeFile(serverDocPath, originalDocumentContent, "utf8");
        console.log("🧹 Restored original server _document.js");
      } catch (error) {
        console.log("⚠️  Could not restore original document:", error.message);
      }
    }

    // Force kill dev server with aggressive cleanup
    if (devServer && !devServer.killed) {
      console.log("🔪 Killing dev server...");
      
      let serverKilled = false;
      
      const killPromise = new Promise((resolve) => {
        const forceKillTimeout = setTimeout(() => {
          if (!serverKilled) {
            console.log("🔪 Force killing dev server (timeout)");
            try {
              devServer.kill("SIGKILL");
            } catch (e) {}
            serverKilled = true;
            resolve();
          }
        }, TEST_CONFIG.FORCE_KILL_TIMEOUT);
        
        devServer.on("exit", () => {
          if (!serverKilled) {
            clearTimeout(forceKillTimeout);
            serverKilled = true;
            console.log("✅ Dev server exited gracefully");
            resolve();
          }
        });
        
        try {
          devServer.kill("SIGTERM");
        } catch (error) {
          try {
            devServer.kill("SIGKILL");
          } catch (e) {}
        }
      });
      
      await killPromise;
    }
    
    // Final port cleanup
    console.log("🔪 Final port cleanup...");
    try {
      const killPromises = [];
      
      ["3000", "3001"].forEach(port => {
        const killPromise = new Promise((resolve) => {
          const killProcess = spawn("npx", ["kill-port", port], { stdio: "ignore" });
          
          const timeout = setTimeout(() => {
            try {
              killProcess.kill("SIGKILL");
            } catch (e) {}
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
        });
        
        killPromises.push(killPromise);
      });
      
      await Promise.all(killPromises);
      console.log("✅ Port cleanup completed");
      
      await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.FINAL_CLEANUP_WAIT));
      
    } catch (error) {
      console.log("⚠️  Port cleanup failed:", error.message);
    }
    
    console.log("🧹 Method 3 cleanup completed - exiting test");
  });

  // ========================================
  // TEST EXECUTION: Main Test Logic
  // ========================================
  
  try {
    console.log("🧪 Testing Method 3: Direct File System HMR");
    console.log("===========================================");

    // Aggressive cleanup of existing processes (similar to Method 2)
    console.log("🧹 Aggressive cleanup of existing processes...");
    try {
      // First round: kill-port with timeout
      const killPromises = [];
      
      ["3000", "3001"].forEach(port => {
        const killPromise = new Promise((resolve) => {
          const killProcess = spawn("npx", ["kill-port", port], { stdio: "ignore" });
          
          const timeout = setTimeout(() => {
            try {
              killProcess.kill("SIGKILL");
            } catch (e) {}
            resolve();
          }, 2000);
          
          killProcess.on("close", () => {
            clearTimeout(timeout);
            resolve();
          });
          
          killProcess.on("error", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        
        killPromises.push(killPromise);
      });
      
      await Promise.all(killPromises);
      
      // Second round: kill any Next.js processes
      const killNext = spawn("pkill", ["-f", "next"], { stdio: "ignore" });
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 3000);
        killNext.on("close", () => {
          clearTimeout(timeout);
          resolve();
        });
        killNext.on("error", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      console.log("✅ Aggressive cleanup completed");
    } catch (error) {
      console.log("⚠️  Could not kill existing processes, continuing...");
    }

    // Start Next.js dev server
    console.log("🚀 Starting Next.js dev server...");
    devServer = spawn("npm", ["run", "dev"], {
      cwd: path.join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Wait for server to be ready
    let serverReady = false;
    const serverPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Server startup timeout")), TEST_CONFIG.SERVER_STARTUP_TIMEOUT);
      let outputBuffer = "";

      const checkServerReady = (data) => {
        const output = data.toString();
        outputBuffer += output;
        
        // Look for various server ready indicators
        if (
          output.includes("Ready on") || 
          output.includes("ready on") ||
          output.includes("Local:") ||
          output.includes("Ready in") ||
          outputBuffer.includes("✓ Ready")
        ) {
          clearTimeout(timeout);
          serverReady = true;
          console.log("✅ Server ready detected");
          resolve();
        }
      };

      devServer.stdout.on("data", checkServerReady);
      devServer.stderr.on("data", checkServerReady); // Also check stderr

      devServer.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      devServer.on("exit", (code) => {
        if (!serverReady) {
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${code} before becoming ready`));
        }
      });
    });

    await serverPromise;
    console.log("✅ Server ready on port 3000");
    
    // Wait for patches to initialize
    await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.PATCH_INITIALIZATION_WAIT));

    // Store original document content for restoration
    const serverDocPath = path.join(__dirname, "..", ".next", "server", "pages", "_document.js");
    try {
      originalDocumentContent = await fs.readFile(serverDocPath, "utf8");
      console.log("📋 Stored original server document for restoration");
    } catch (error) {
      // No compiled document found - this is normal on first run
    }

    // Clear existing caches
    if (global.__SERVER_HMR__) {
      global.__SERVER_HMR__.clearAllPages();
      console.log("🔄 Cleared existing caches");
    }

    // Test 3A: Document Page Direct File System HMR
    console.log("\n3A. Testing Document Page Direct File System HMR...");
    
    // Visit document page to ensure compilation
    console.log("   Visiting document page to ensure compilation...");
    let docPageInitial;
    try {
      docPageInitial = await makeRequest("/");
    } catch (requestError) {
      assert.fail(`Failed to visit document page: ${requestError.message}`);
    }
    
    assert.strictEqual(docPageInitial.status, 200, "Document page should be accessible");
    assert.ok(docPageInitial.body.includes(CONTENT_MARKERS.PLACEHOLDER), "Document page should contain PLACEHOLDER initially");
    console.log("   ✅ Document page visited and compiled");
    
    // Wait for compilation to complete
    await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.COMPILATION_WAIT_TIME));
    
    try {
      console.log(`📂 Checking document path: ${serverDocPath}`);
      const originalDocContent = await fs.readFile(serverDocPath, "utf8");
      console.log(`📖 Read compiled _document.js: ${originalDocContent.length} bytes`);
      
      const hasPlaceholder = originalDocContent.includes(CONTENT_MARKERS.PLACEHOLDER);
      assert.ok(hasPlaceholder, "Compiled document should contain PLACEHOLDER");
      console.log(`🔍 PLACEHOLDER found: ${hasPlaceholder}`);
      
      // Replace PLACEHOLDER with test message
      const updatedDocContent = originalDocContent.replace(
        CONTENT_MARKERS.PLACEHOLDER,
        CONTENT_MARKERS.UPDATED_DOCUMENT,
      );
        
        await fs.writeFile(serverDocPath, updatedDocContent, "utf8");
        console.log("📝 Updated compiled document with direct file replacement");

        // Clear caches using multiple methods
        try {
          // Try using the Server HMR API first
          const clearCacheResponse = await makeRequest("/api/server-hmr", "POST", {
            action: "clear-module-cache",
            modulePath: serverDocPath,
          });
          console.log("✅ Server HMR API cache clear:", clearCacheResponse.body);
          
          const clearAllResponse = await makeRequest("/api/server-hmr", "POST", {
            action: "clear-all-pages",
          });
          console.log("✅ Server HMR API clear all pages:", clearAllResponse.body);
        } catch (error) {
          console.log("⚠️  API cache clear failed, using global fallback");
        }
        
        // Always try global fallback as well
        if (global.__SERVER_HMR__) {
          global.__SERVER_HMR__.clearAllPages();
          console.log("✅ Global cache cleared");
        }

        // Wait and test with retry logic (like working tests)
        await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.HMR_WAIT_TIME));
        
        console.log("   Forcing document page reload to check update...");
        let updatedDocPage;
        let documentUpdated = false;
        for (let i = 0; i < TEST_CONFIG.RETRY_ATTEMPTS; i++) {
          try {
            updatedDocPage = await makeRequest("/");
          } catch (requestError) {
            assert.fail(`Failed to verify document page update on attempt ${i + 1}: ${requestError.message}`);
          }
          
          if (updatedDocPage.body.includes(CONTENT_MARKERS.UPDATED_DOCUMENT)) {
            console.log(`   ✅ Document page updated after ${i + 1} attempts`);
            documentUpdated = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.RETRY_DELAY));
        }

        assert.ok(documentUpdated, `Document HMR failed - content not updated after ${TEST_CONFIG.RETRY_ATTEMPTS} attempts`);
        console.log("✅ Direct FS HMR: Document page successfully updated");
        
        // Restore original document content
        await fs.writeFile(serverDocPath, originalDocContent, "utf8");
        console.log("✅ Restored original document content");
    } catch (error) {
      assert.fail(`Could not access compiled document: ${error.message}`);
    }

    // Test 3B: Markdown Page Direct File System HMR  
    console.log("\n3B. Testing Markdown Page Direct File System HMR...");
    
    // First, visit the markdown page to trigger compilation
    console.log("   Visiting markdown page to ensure compilation...");
    let markdownPageInitial;
    try {
      markdownPageInitial = await makeRequest("/posts/markdown");
    } catch (requestError) {
      assert.fail(`Failed to visit markdown page: ${requestError.message}`);
    }
    
    assert.strictEqual(markdownPageInitial.status, 200, "Markdown page should be accessible");
    assert.ok(markdownPageInitial.body.includes(CONTENT_MARKERS.MARKDOWN_ORIGINAL), "Markdown page should contain PAGE_HMR_AREA initially");
    console.log("   ✅ Markdown page visited and compiled");

    // Wait for compilation to complete
    await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.COMPILATION_WAIT_TIME));

    try {
      // PURE DIRECT FS: Only modify compiled files (no source file editing)
      const serverMarkdownPath = path.join(__dirname, "..", ".next", "server", "pages", "posts", "markdown.js");

      // Update server-side compiled file directly
      const originalServerContent = await fs.readFile(serverMarkdownPath, "utf8");
      console.log(`📖 Read server markdown.js: ${originalServerContent.length} bytes`);

      const updatedServerContent = originalServerContent.replace(
        CONTENT_MARKERS.MARKDOWN_ORIGINAL,
        CONTENT_MARKERS.MARKDOWN_UPDATED
      );

      assert.notStrictEqual(updatedServerContent, originalServerContent, "PAGE_HMR_AREA should be found and replaced in server markdown file");
      
      await fs.writeFile(serverMarkdownPath, updatedServerContent, "utf8");
      console.log("📝 Updated server-side compiled markdown with string replacement");

      // Comprehensive cache clearing 
      try {
        // Clear server-side module cache
        const clearServerCacheResponse = await makeRequest("/api/server-hmr", "POST", {
          action: "clear-module-cache",
          modulePath: serverMarkdownPath,
        });
        console.log("✅ Server markdown cache clear:", clearServerCacheResponse.body);
        
        // Clear all pages for comprehensive invalidation
        const clearAllPagesResponse = await makeRequest("/api/server-hmr", "POST", {
          action: "clear-all-pages",
        });
        console.log("✅ All pages cache clear:", clearAllPagesResponse.body);
      } catch (error) {
        console.log("⚠️  API cache clear failed, using global fallback");
      }
      
      // Always try global fallback for complete invalidation
      if (global.__SERVER_HMR__) {
        global.__SERVER_HMR__.clearAllPages();
        console.log("✅ Global cache cleared (required for Next.js multi-layer system)");
      }

      // CRITICAL: Trigger HMR using the Efficient HMR API (same as Method 2)
      try {
        console.log("🔥 Triggering HMR via Efficient HMR API...");
        const hmrResponse = await makeRequest("/api/efficient-hmr", "POST", {
          action: "trigger-hmr",
          pagePath: "/posts/markdown",
          forceReload: true,
        });
        
        if (hmrResponse.status === 200 && hmrResponse.body.success) {
          console.log("✅ Efficient HMR triggered successfully for markdown");
        } else {
          console.log("⚠️  Efficient HMR trigger failed:", hmrResponse.body);
        }
      } catch (error) {
        console.log("⚠️  Efficient HMR API failed:", error.message);
      }

      // Wait and test multiple times to ensure cache invalidation
      await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.HMR_WAIT_TIME));
      
      let firstMarkdownReload;
      try {
        firstMarkdownReload = await makeRequest("/posts/markdown");
      } catch (requestError) {
        assert.fail(`Failed to reload markdown page (first attempt): ${requestError.message}`);
      }
      
      assert.strictEqual(firstMarkdownReload.status, 200, "First markdown reload should return 200 status");
      console.log(`First markdown reload status: ${firstMarkdownReload.status}`);
      
      await new Promise((resolve) => setTimeout(resolve, TEST_CONFIG.RETRY_DELAY));
      
      let secondMarkdownReload;
      try {
        secondMarkdownReload = await makeRequest("/posts/markdown");
      } catch (requestError) {
        assert.fail(`Failed to reload markdown page (second attempt): ${requestError.message}`);
      }
      
      assert.strictEqual(secondMarkdownReload.status, 200, "Second markdown reload should return 200 status");
      console.log(`Second markdown reload status: ${secondMarkdownReload.status}`);

      assert.ok(secondMarkdownReload.body.includes(CONTENT_MARKERS.MARKDOWN_UPDATED), 
        "Markdown page should contain updated content after HMR");
      console.log("✅ Direct FS HMR: Markdown page successfully updated");

      // Restore original compiled content 
      await fs.writeFile(serverMarkdownPath, originalServerContent, "utf8");
      console.log("✅ Restored original server-side markdown content");

    } catch (error) {
      assert.fail(`Markdown HMR failed: ${error.message}`);
    }

    console.log("\n🎉 Method 3: Direct File System HMR Test Complete!");
    
  } catch (testError) {
    // If any part of the test fails, ensure we fail the test properly
    assert.fail(`Method 3 test failed: ${testError.message}`);
  }
});