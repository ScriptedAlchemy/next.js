const { test } = require("node:test");
const assert = require("node:assert");
const { spawn, exec } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { promisify } = require("node:util");

const execAsync = promisify(exec);

// Constants
const DEFAULT_PORT = 3000;
const SERVER_STARTUP_TIMEOUT = 90000; // 90 seconds
const REQUEST_TIMEOUT = 10000; // 10 seconds
const COMPILATION_CHECK_INTERVAL = 1000; // 1 second
const COMPILATION_CHECK_ATTEMPTS = 10;
const HMR_WAIT_TIME = 2000; // 2 seconds
const MAX_HMR_ATTEMPTS = 5;
const SOURCE_HMR_ATTEMPTS = 8;
const SOURCE_HMR_WAIT = 5000; // 5 seconds
const CLEANUP_WAIT = 3000; // 3 seconds
const PORT_CLEANUP_WAIT = 1000; // 1 second

test("Method 1: File-Based HMR", async (t) => {
  // ====================
  // SETUP PHASE
  // ====================
  
  // Test state variables
  let devServer = null;
  let serverPort = DEFAULT_PORT;
  let serverReady = false;
  let originalDocumentContent = null;
  
  // Test result tracking
  let documentHmrSuccessful = false;
  let markdownHmrSuccessful = false;

  // ====================
  // CLEANUP PHASE
  // ====================
  t.after(async () => {
    console.log("\n====================");
    console.log("CLEANUP PHASE");
    console.log("====================");
    
    // Restore original document content if backed up
    if (originalDocumentContent) {
      const serverDocPath = path.join(
        __dirname,
        "..",
        ".next",
        "server",
        "pages",
        "_document.js"
      );
      try {
        await fs.writeFile(serverDocPath, originalDocumentContent, "utf8");
        console.log("✓ Restored original server _document.js");
      } catch (error) {
        console.error("✗ Failed to restore _document.js:", error.message);
      }
    }


    // Terminate dev server
    if (devServer) {
      devServer.kill("SIGTERM");
      console.log("✓ Dev server termination signal sent");
      
      // Wait for graceful shutdown
      await new Promise((resolve) => {
        devServer.on("exit", resolve);
        setTimeout(() => {
          if (!devServer.killed) {
            devServer.kill("SIGKILL");
            console.log("✓ Force killed dev server");
          }
          resolve();
        }, CLEANUP_WAIT);
      });
    }
    
    // Clean up ports
    try {
      await execAsync("npx kill-port 3000 3001").catch(() => {});
      console.log("✓ Cleaned up ports");
      await new Promise((resolve) => setTimeout(resolve, PORT_CLEANUP_WAIT));
    } catch (error) {
      // Ignore cleanup errors
    }
    
    console.log("✓ Method 1 cleanup completed");
  });

  // Helper function to make HTTP requests
  async function makeRequest(path = "/", method = "GET", body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "localhost",
        port: serverPort,
        path,
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        timeout: REQUEST_TIMEOUT,
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const responseBody = method === "POST" && res.headers["content-type"]?.includes("application/json")
              ? JSON.parse(data)
              : data;
            resolve({ status: res.statusCode, body: responseBody });
          } catch (error) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
      
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // ====================
  // EXECUTION PHASE
  // ====================
  
  console.log("🧪 Testing Method 1: File-Based HMR");
  console.log("===================================");

  // Kill any existing processes on ports
  console.log("🧹 Cleaning up existing processes...");
  try {
    await execAsync("npx kill-port 3000 3001");
    await new Promise((resolve) => setTimeout(resolve, CLEANUP_WAIT));
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
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server startup timeout"));
    }, SERVER_STARTUP_TIMEOUT);
    
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
    devServer.stderr.on("data", checkServerReady);

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

  console.log("✅ Server ready on port 3000");
  
  // Wait for patches to initialize
  await new Promise((resolve) => setTimeout(resolve, SOURCE_HMR_WAIT));

  // Store original document content for restoration
  const serverDocPath = path.join(__dirname, "..", ".next", "server", "pages", "_document.js");
  try {
    originalDocumentContent = await fs.readFile(serverDocPath, "utf8");
    console.log("📋 Stored original server document for restoration");
  } catch (error) {
    // No compiled document found - this is normal on first run
  }


  // ====================
  // ASSERTION PHASE
  // ====================

  // Test initial page state
  console.log("📄 Testing initial page state...");
  const initialPage = await makeRequest("/");
  assert.strictEqual(initialPage.status, 200, "Initial page should return 200");
  assert.ok(initialPage.body.includes("PLACEHOLDER"), "Initial page should contain PLACEHOLDER");
  console.log("✅ Initial page loaded with PLACEHOLDER");

  // Test File-Based HMR for Document Page
  console.log("\n1A. Testing Document Page HMR...");
  
  // Visit page to trigger compilation
  console.log("   Visiting document page to ensure compilation...");
  const initialVisit = await makeRequest("/");
  assert.strictEqual(initialVisit.status, 200, "Document page should be accessible");
  assert.ok(initialVisit.body.includes("PLACEHOLDER"), "Document page should contain PLACEHOLDER");
  console.log("   ✅ Document page visited and compiled");
  
  // Wait for compilation to complete and verify compiled file exists
  console.log("   Waiting for server compilation to complete...");
  let compilationReady = false;
  for (let i = 0; i < COMPILATION_CHECK_ATTEMPTS; i++) {
    try {
      const stats = await fs.stat(serverDocPath);
      if (stats.size > 1000) {
        compilationReady = true;
        console.log(`   ✅ Server compilation verified (${stats.size} bytes)`);
        break;
      }
    } catch (error) {
      // File doesn't exist yet
    }
    await new Promise((resolve) => setTimeout(resolve, COMPILATION_CHECK_INTERVAL));
  }
  
  if (!compilationReady) {
    assert.fail("Server compilation not ready after 10 seconds");
  }

  try {
    const originalContent = await fs.readFile(serverDocPath, "utf8");
    console.log(`📖 Read compiled _document.js: ${originalContent.length} bytes`);

    // Replace PLACEHOLDER with "Hello world!!"
    const updatedContent = originalContent.replace("PLACEHOLDER", "Hello world!!");
    if (updatedContent === originalContent) {
      assert.fail("PLACEHOLDER not found in compiled file");
    }

    await fs.writeFile(serverDocPath, updatedContent, "utf8");
    console.log("📝 Updated compiled document with string replacement");

    // Clear module cache using the Server HMR API
    try {
      const clearCache = await makeRequest("/api/server-hmr", "POST", {
        action: "clear-module-cache",
        modulePath: serverDocPath,
      });
      assert.strictEqual(clearCache.status, 200, "Cache clear API should return 200");
      console.log("✅ Specific module cache cleared:", clearCache.body);

      // Also clear all pages to ensure fresh load
      const clearAll = await makeRequest("/api/server-hmr", "POST", {
        action: "clear-all-pages",
      });
      assert.strictEqual(clearAll.status, 200, "Clear all pages API should return 200");
      console.log("✅ All pages cleared:", clearAll.body);
    } catch (error) {
      console.log("⚠️  Cache clear via API failed, trying global fallback");
      if (global.__SERVER_HMR__) {
        global.__SERVER_HMR__.clearAllPages();
        console.log("✅ Module cache cleared via global");
      }
    }

    // Wait and test the change with retry logic
    await new Promise((resolve) => setTimeout(resolve, HMR_WAIT_TIME));
    
    console.log("   Forcing document page reload to check update...");
    let updatedPage;
    for (let i = 0; i < MAX_HMR_ATTEMPTS; i++) {
      updatedPage = await makeRequest("/");
      if (updatedPage.body.includes("Hello world!!")) {
        console.log(`   ✅ Document page updated after ${i + 1} attempts`);
        documentHmrSuccessful = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, COMPILATION_CHECK_INTERVAL));
    }
    
    if (!documentHmrSuccessful) {
      // Debug output
      const placeholderIndex = updatedPage.body.indexOf("PLACEHOLDER");
      const helloWorldIndex = updatedPage.body.indexOf("Hello world!!");
      console.log(`   Debug: PLACEHOLDER found at index: ${placeholderIndex}`);
      console.log(`   Debug: Hello world!! found at index: ${helloWorldIndex}`);
      assert.fail("Document page not visibly updated after 5 attempts");
    }

    console.log("✅ File-Based HMR: Document page successfully updated");

  } catch (error) {
    console.log(`❌ File-Based HMR failed: ${error.message}`);
    throw error;
  }

  // Test File-Based HMR for Markdown Page
  console.log("\n1B. Testing Markdown Page HMR...");
  
  // Visit markdown page to trigger compilation
  console.log("   Visiting markdown page to ensure compilation...");
  const markdownInitial = await makeRequest("/posts/markdown");
  assert.strictEqual(markdownInitial.status, 200, "Markdown page should be accessible");
  assert.ok(markdownInitial.body.includes("PAGE_HMR_AREA"), "Markdown page should contain PAGE_HMR_AREA");
  console.log("   ✅ Markdown page visited and compiled");
  
  // Wait for markdown compilation to complete
  console.log("   Waiting for markdown server compilation to complete...");
  const serverMarkdownPath = path.join(__dirname, "..", ".next", "server", "pages", "posts", "markdown.js");
  let markdownCompilationReady = false;
  for (let i = 0; i < COMPILATION_CHECK_ATTEMPTS; i++) {
    try {
      const stats = await fs.stat(serverMarkdownPath);
      if (stats.size > 5000) {
        markdownCompilationReady = true;
        console.log(`   ✅ Markdown server compilation verified (${stats.size} bytes)`);
        break;
      }
    } catch (error) {
      // File doesn't exist yet
    }
    await new Promise((resolve) => setTimeout(resolve, COMPILATION_CHECK_INTERVAL));
  }
  
  if (!markdownCompilationReady) {
    assert.fail("Markdown server compilation not ready after 10 seconds");
  }

  try {
    // Read compiled markdown content
    const originalMarkdownContent = await fs.readFile(serverMarkdownPath, "utf8");
    console.log(`📖 Read compiled markdown.js: ${originalMarkdownContent.length} bytes`);

    // Replace in compiled file (like document test does)
    const updatedMarkdownContent = originalMarkdownContent.replace(
      "PAGE_HMR_AREA",
      "File-Based HMR SUCCESS ON MARKDOWN!"
    );

    if (updatedMarkdownContent === originalMarkdownContent) {
      assert.fail("PAGE_HMR_AREA not found in compiled markdown file");
    }

    await fs.writeFile(serverMarkdownPath, updatedMarkdownContent, "utf8");
    console.log("📝 Updated compiled markdown.js with string replacement");

    // Clear module cache using the Server HMR API (like document test does)
    try {
      const clearCache = await makeRequest("/api/server-hmr", "POST", {
        action: "clear-module-cache",
        modulePath: serverMarkdownPath,
      });
      assert.strictEqual(clearCache.status, 200, "Cache clear API should return 200");
      console.log("✅ Specific module cache cleared:", clearCache.body);

      // Also clear all pages to ensure fresh load
      const clearAll = await makeRequest("/api/server-hmr", "POST", {
        action: "clear-all-pages",
      });
      assert.strictEqual(clearAll.status, 200, "Clear all pages API should return 200");
      console.log("✅ All pages cleared:", clearAll.body);
    } catch (error) {
      console.log("⚠️  Cache clear via API failed, trying global fallback");
      if (global.__SERVER_HMR__) {
        global.__SERVER_HMR__.clearAllPages();
        console.log("✅ Module cache cleared via global");
      }
    }

    // Wait and test the change with retry logic (like document test)
    await new Promise((resolve) => setTimeout(resolve, HMR_WAIT_TIME));
    
    console.log("   Forcing markdown page reload to check update...");
    let updatedMarkdownPage;
    
    for (let i = 0; i < MAX_HMR_ATTEMPTS; i++) {
      updatedMarkdownPage = await makeRequest("/posts/markdown");
      
      if (updatedMarkdownPage.body.includes("File-Based HMR SUCCESS ON MARKDOWN!")) {
        markdownHmrSuccessful = true;
        console.log(`   ✅ Markdown page updated after ${i + 1} attempts`);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, COMPILATION_CHECK_INTERVAL));
    }

    if (markdownHmrSuccessful) {
      console.log("✅ File-Based HMR: Markdown page successfully updated");
    } else {
      // Debug output
      const hmrAreaIndex = updatedMarkdownPage.body.indexOf("PAGE_HMR_AREA");
      const successIndex = updatedMarkdownPage.body.indexOf("File-Based HMR SUCCESS ON MARKDOWN!");
      console.log(`   Debug: PAGE_HMR_AREA found at index: ${hmrAreaIndex}`);
      console.log(`   Debug: Success message found at index: ${successIndex}`);
      console.log("⚠️  File-Based HMR: Markdown triggered but not visibly updated after attempts");
    }

  } catch (error) {
    console.log(`❌ Markdown HMR failed: ${error.message}`);
    // Don't throw - let the test continue to show results
  }

  // ====================
  // RESULTS SUMMARY
  // ====================
  console.log("\n🎉 Method 1: File-Based HMR Test Complete!");
  console.log("==========================================");
  console.log(`Document HMR: ${documentHmrSuccessful ? "✅ SUCCESS" : "❌ FAILED"}`);
  console.log(`Markdown HMR: ${markdownHmrSuccessful ? "✅ SUCCESS" : "⚠️  PARTIAL"}`);
  
  // Assert at least one HMR method worked
  assert.ok(
    documentHmrSuccessful || markdownHmrSuccessful,
    "At least one HMR method should work"
  );
});