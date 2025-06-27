#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

async function runTest(testFile) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Running: ${testFile}`);
    console.log(`${'='.repeat(60)}`);
    
    const testProcess = spawn("node", ["--test", testFile], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit"
    });

    testProcess.on("close", (code) => {
      console.log(`\n📊 Test ${testFile} finished with exit code: ${code}`);
      resolve(code);
    });

    testProcess.on("error", (error) => {
      console.error(`❌ Error running test ${testFile}:`, error);
      resolve(1);
    });
  });
}

async function killExistingProcesses() {
  return new Promise((resolve) => {
    console.log("🧹 Killing any existing processes on ports 3000-3001...");
    
    // Kill processes on multiple ports
    const killPort3000 = spawn("npx", ["kill-port", "3000"], { stdio: "ignore" });
    const killPort3001 = spawn("npx", ["kill-port", "3001"], { stdio: "ignore" });
    
    let processesKilled = 0;
    const totalProcesses = 2;
    
    const checkComplete = () => {
      processesKilled++;
      if (processesKilled >= totalProcesses) {
        // Also kill any remaining Next.js processes
        const killNext = spawn("pkill", ["-f", "next"], { stdio: "ignore" });
        killNext.on("close", () => {
          setTimeout(resolve, 4000); // Increased wait time for cleanup
        });
        killNext.on("error", () => {
          setTimeout(resolve, 4000); // Wait even if pkill fails
        });
      }
    };
    
    killPort3000.on("close", checkComplete);
    killPort3000.on("error", checkComplete);
    killPort3001.on("close", checkComplete);
    killPort3001.on("error", checkComplete);
  });
}

async function main() {
  console.log("🚀 HMR Method Test Runner");
  console.log("========================");
  
  const tests = [
    "test/method1-file-based.test.js",
    "test/method2-efficient-hmr.test.js", 
    "test/method3-direct-fs.test.js"
  ];

  let allPassed = true;

  for (const test of tests) {
    await killExistingProcesses();
    const exitCode = await runTest(test);
    if (exitCode !== 0) {
      allPassed = false;
    }
    
    // Wait between tests to ensure cleanup
    console.log("⏳ Waiting for cleanup...");
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log("📋 Final Results:");
  console.log(`${'='.repeat(60)}`);
  
  if (allPassed) {
    console.log("✅ All HMR method tests passed!");
    process.exit(0);
  } else {
    console.log("❌ Some tests failed.");
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runTest, killExistingProcesses };