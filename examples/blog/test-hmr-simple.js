#!/usr/bin/env node

// Simple HMR test script
const http = require("http");
const { spawn } = require("child_process");

let devServer = null;
let serverPort = 3000;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(port, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          resolve();
        });
        req.on("error", reject);
        req.setTimeout(1000);
      });
      return true;
    } catch (error) {
      console.log(
        `Waiting for server on port ${port}... (${i + 1}/${maxRetries})`,
      );
      await delay(2000);
    }
  }
  return false;
}

async function testAPI(endpoint, method = "GET", data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: serverPort,
      path: endpoint,
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : {},
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
          resolve({ status: res.statusCode, body, error: error.message });
        }
      });
    });

    req.on("error", reject);

    if (data && method === "POST") {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runHMRTests() {
  console.log("🔥 Starting HMR Test Suite");
  console.log("=========================");

  try {
    // Start dev server
    console.log("1. Starting Next.js dev server...");
    devServer = spawn("npm", ["run", "dev"], {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let serverOutput = "";
    devServer.stdout.on("data", (data) => {
      const output = data.toString();
      serverOutput += output;

      // Detect port from output
      const portMatch = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
      if (portMatch) {
        serverPort = parseInt(portMatch[1]);
        console.log(`   Server detected on port ${serverPort}`);
      }
    });

    devServer.stderr.on("data", (data) => {
      const output = data.toString();
      serverOutput += output;

      // Also check stderr for port info
      const portMatch = output.match(/using available port (\d+) instead/);
      if (portMatch) {
        serverPort = parseInt(portMatch[1]);
        console.log(`   Port changed to ${serverPort}`);
      }
    });

    // Wait for server to be ready
    console.log("2. Waiting for server to be ready...");
    const serverReady = await waitForServer(serverPort);

    if (!serverReady) {
      throw new Error(`Server failed to start on port ${serverPort}`);
    }

    console.log(`   ✅ Server ready on port ${serverPort}`);

    // Test 1: Check home page
    console.log("3. Testing home page...");
    const homeResponse = await testAPI("/");
    console.log(`   Status: ${homeResponse.status}`);

    if (homeResponse.status === 200) {
      const hasHelloWorld = homeResponse.body.includes("<h1>Hello World</h1>");
      console.log(`   Contains "Hello World": ${hasHelloWorld ? "✅" : "❌"}`);
    }

    // Test 2: Test HMR API endpoint
    console.log("4. Testing HMR API endpoint...");
    const hmrResponse = await testAPI("/api/hot-replace-document", "POST");
    console.log(`   Status: ${hmrResponse.status}`);
    console.log(`   Response:`, hmrResponse.body);

    // Test 3: Check if HMR worked
    console.log("5. Checking if HMR updated the page...");
    await delay(1000); // Give HMR time to process

    const updatedResponse = await testAPI("/");
    console.log(`   Status: ${updatedResponse.status}`);

    if (updatedResponse.status === 200) {
      const hasHelloWorld = updatedResponse.body.includes(
        "<h1>Hello World</h1>",
      );
      console.log(
        `   Still contains "Hello World": ${hasHelloWorld ? "✅" : "❌"}`,
      );
    }

    // Test 4: Test server HMR status
    console.log("6. Testing server HMR status...");
    try {
      const serverHMRResponse = await testAPI("/api/server-hmr", "POST", {
        action: "test",
      });
      console.log(`   Server HMR Status: ${serverHMRResponse.status}`);
      if (serverHMRResponse.body) {
        console.log(
          `   Available functions:`,
          serverHMRResponse.body.availableFunctions || "N/A",
        );
      }
    } catch (error) {
      console.log(`   Server HMR test failed: ${error.message}`);
    }

    // Test 5: Test simple HMR API
    console.log("7. Testing simple HMR API...");
    try {
      const simpleHMRResponse = await testAPI("/api/simple-hmr");
      console.log(`   Simple HMR Status: ${simpleHMRResponse.status}`);
      if (simpleHMRResponse.body) {
        console.log(
          `   Capabilities:`,
          simpleHMRResponse.body.capabilities || "N/A",
        );
      }
    } catch (error) {
      console.log(`   Simple HMR test failed: ${error.message}`);
    }

    console.log("\n🎉 HMR Test Suite Complete!");
    console.log("============================");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    // Clean up
    if (devServer) {
      console.log("\n🧹 Cleaning up...");
      devServer.kill("SIGTERM");

      // Force kill after 5 seconds
      setTimeout(() => {
        if (devServer && !devServer.killed) {
          devServer.kill("SIGKILL");
        }
      }, 5000);
    }
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⏹️  Test interrupted");
  if (devServer) {
    devServer.kill("SIGTERM");
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (devServer) {
    devServer.kill("SIGTERM");
  }
  process.exit(0);
});

// Run the tests
runHMRTests();
