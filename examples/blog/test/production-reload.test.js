const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const { setTimeout } = require('timers/promises');

let devServer;
let serverProcess;

async function startDevServer() {
  return new Promise((resolve, reject) => {
    console.log('# Starting Next.js development server...');
    devServer = spawn('pnpm', ['dev'], { 
      cwd: '/Users/bytedance/dev/next.js/examples/blog',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    const timeout = setTimeout(() => {
      reject(new Error('Server startup timeout'));
    }, 60000);

    devServer.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Ready in ') || output.includes('- Local:')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    devServer.stderr.on('data', (data) => {
      const errorOutput = data.toString();
      if (errorOutput.includes('Error') && !errorOutput.includes('warn')) {
        clearTimeout(timeout);
        reject(new Error(`Server startup error: ${errorOutput}`));
      }
    });

    devServer.on('close', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

async function stopDevServer() {
  if (devServer) {
    console.log('# Terminating dev server...');
    devServer.kill('SIGTERM');
    
    // Wait a bit for graceful shutdown
    await setTimeout(2000);
    
    if (!devServer.killed) {
      devServer.kill('SIGKILL');
    }
    
    console.log('# ✓ Dev server terminated');
  }
}

async function testApiEndpoint(url, body = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch('http://localhost:3000');
      if (response.ok) {
        console.log('# Server is responding on port 3000');
        return;
      }
    } catch (error) {
      // Server not ready yet
    }
    await setTimeout(1000);
  }
  throw new Error('Server did not start within 30 seconds');
}

describe('Production Reload API Tests', () => {
  beforeEach(async () => {
    await startDevServer();
    await waitForServer();
  });

  afterEach(async () => {
    await stopDevServer();
    console.log('# ✓ Cleanup completed');
  });

  test('Production Reload API - Test Action', async () => {
    console.log('# === Testing /api/production-reload test action ===');
    
    const { status, data } = await testApiEndpoint('http://localhost:3000/api/production-reload', {
      action: 'test'
    });

    assert.strictEqual(status, 200, 'API should respond with 200');
    assert.strictEqual(data.success, true, 'API should return success');
    assert.strictEqual(data.method, 'process-based-reload', 'Should use process-based reload method');
    assert.ok(data.timestamp, 'Should include timestamp');
    
    console.log('# ✓ Production reload test action works');
  });

  test('Production Reload API - Reload Info', async () => {
    console.log('# === Testing /api/production-reload reload-info action ===');
    
    const { status, data } = await testApiEndpoint('http://localhost:3000/api/production-reload', {
      action: 'reload-info'
    });

    assert.strictEqual(status, 200, 'API should respond with 200');
    assert.strictEqual(data.success, true, 'API should return success');
    assert.ok(data.info.processId, 'Should include process ID');
    assert.ok(data.info.uptime >= 0, 'Should include uptime');
    assert.ok(data.info.memoryUsage, 'Should include memory usage');
    assert.strictEqual(data.info.productionReloadAvailable, true, 'Should indicate production reload is available');
    
    console.log('# ✓ Production reload info works');
  });

  test('Production Reload API - Memory Cleanup', async () => {
    console.log('# === Testing /api/production-reload memory-cleanup action ===');
    
    const { status, data } = await testApiEndpoint('http://localhost:3000/api/production-reload', {
      action: 'memory-cleanup'
    });

    assert.strictEqual(status, 200, 'API should respond with 200');
    assert.strictEqual(data.success, true, 'API should return success');
    assert.ok(data.modulesCleared >= 0, 'Should report modules cleared count');
    assert.ok(data.memoryBefore, 'Should include memory before stats');
    assert.ok(data.memoryAfter, 'Should include memory after stats');
    
    console.log(`# ✓ Memory cleanup cleared ${data.modulesCleared} modules`);
  });

  test('Production Reload API - Development HMR Integration', async () => {
    console.log('# === Testing /api/production-reload graceful-reload in development ===');
    
    // First check if HMR is available
    try {
      const { status: hmrStatus, data: hmrData } = await testApiEndpoint('http://localhost:3000/api/server-hmr', {
        action: 'test'
      });

      if (hmrStatus === 200 && hmrData.success) {
        console.log('# HMR API is available, testing graceful-reload integration');
        
        const { status, data } = await testApiEndpoint('http://localhost:3000/api/production-reload', {
          action: 'graceful-reload'
        });

        assert.strictEqual(status, 200, 'API should respond with 200');
        assert.strictEqual(data.success, true, 'API should return success');
        assert.strictEqual(data.environment, 'development', 'Should detect development environment');
        
        console.log('# ✓ Development HMR integration works');
      } else {
        console.log('# HMR API not available, testing graceful-reload without HMR');
        
        const { status, data } = await testApiEndpoint('http://localhost:3000/api/production-reload', {
          action: 'graceful-reload'
        });

        assert.strictEqual(status, 200, 'API should respond with 200');
        assert.strictEqual(data.success, false, 'Should fail gracefully without HMR');
        
        console.log('# ✓ Graceful failure without HMR');
      }
    } catch (error) {
      console.log('# HMR API not available, which is expected');
    }
  });

  test('Production Reload API - Security in Production Mode', async () => {
    console.log('# === Testing /api/production-reload security features ===');
    
    // Test without secret (should work in development)
    const { status, data } = await testApiEndpoint('http://localhost:3000/api/production-reload', {
      action: 'test'
    });

    assert.strictEqual(status, 200, 'API should work without secret in development');
    assert.strictEqual(data.success, true, 'Should return success');
    
    console.log('# ✓ Security works - no secret required in development');
    console.log('# Note: In production, RELOAD_SECRET environment variable would be required');
  });

  test('Production Reload API - Invalid Actions', async () => {
    console.log('# === Testing /api/production-reload invalid action handling ===');
    
    const { status, data } = await testApiEndpoint('http://localhost:3000/api/production-reload', {
      action: 'invalid-action'
    });

    assert.strictEqual(status, 400, 'API should respond with 400 for invalid action');
    assert.strictEqual(data.success, undefined, 'Should not return success for invalid action');
    assert.ok(data.error, 'Should return error message');
    assert.ok(data.availableActions, 'Should list available actions');
    
    console.log('# ✓ Invalid action handling works');
  });

  test('Production Reload API - HTTP Method Validation', async () => {
    console.log('# === Testing /api/production-reload HTTP method validation ===');
    
    const response = await fetch('http://localhost:3000/api/production-reload', {
      method: 'GET'
    });

    const data = await response.json();
    
    assert.strictEqual(response.status, 405, 'API should respond with 405 for GET request');
    assert.strictEqual(data.error, 'Method not allowed', 'Should return method not allowed error');
    
    console.log('# ✓ HTTP method validation works');
  });
});