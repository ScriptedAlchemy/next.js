const { test, describe } = require('node:test');
const assert = require('node:assert');

// Import the handler directly
const handler = require('../pages/api/production-reload.js');

describe('Production Reload API Unit Tests', () => {
  test('Test Action - Development Mode', async () => {
    process.env.NODE_ENV = 'development';
    
    const req = {
      method: 'POST',
      body: { action: 'test' }
    };

    let response;
    const res = {
      status: (code) => ({ 
        json: (data) => { response = { status: code, data }; } 
      }),
      json: (data) => { response = { status: 200, data }; }
    };

    await handler(req, res);

    assert.strictEqual(response.status, 200, 'Should return 200 status');
    assert.strictEqual(response.data.success, true, 'Should return success');
    assert.strictEqual(response.data.method, 'process-based-reload', 'Should use process-based-reload method');
    assert.strictEqual(response.data.environment, 'development', 'Should detect development environment');
    assert.ok(response.data.timestamp, 'Should include timestamp');
    
    console.log('✓ Development mode test action works');
  });

  test('Reload Info Action', async () => {
    process.env.NODE_ENV = 'development';
    
    const req = {
      method: 'POST',
      body: { action: 'reload-info' }
    };

    let response;
    const res = {
      status: (code) => ({ 
        json: (data) => { response = { status: code, data }; } 
      }),
      json: (data) => { response = { status: 200, data }; }
    };

    await handler(req, res);

    assert.strictEqual(response.status, 200, 'Should return 200 status');
    assert.strictEqual(response.data.success, true, 'Should return success');
    assert.ok(response.data.info.processId, 'Should include process ID');
    assert.ok(response.data.info.uptime >= 0, 'Should include uptime');
    assert.ok(response.data.info.memoryUsage, 'Should include memory usage');
    assert.strictEqual(response.data.info.productionReloadAvailable, true, 'Should indicate production reload is available');
    
    console.log('✓ Reload info action works');
  });

  test('Memory Cleanup Action', async () => {
    process.env.NODE_ENV = 'development';
    
    const req = {
      method: 'POST',
      body: { action: 'memory-cleanup' }
    };

    let response;
    const res = {
      status: (code) => ({ 
        json: (data) => { response = { status: code, data }; } 
      }),
      json: (data) => { response = { status: 200, data }; }
    };

    await handler(req, res);

    assert.strictEqual(response.status, 200, 'Should return 200 status');
    assert.strictEqual(response.data.success, true, 'Should return success');
    assert.ok(response.data.modulesCleared >= 0, 'Should report modules cleared count');
    assert.ok(response.data.memoryBefore, 'Should include memory before stats');
    assert.ok(response.data.memoryAfter, 'Should include memory after stats');
    
    console.log(`✓ Memory cleanup cleared ${response.data.modulesCleared} modules`);
  });

  test('Production Mode Security', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RELOAD_SECRET;
    
    const req = {
      method: 'POST',
      body: { action: 'test' }
    };

    let response;
    const res = {
      status: (code) => ({ 
        json: (data) => { response = { status: code, data }; } 
      }),
      json: (data) => { response = { status: 200, data }; }
    };

    await handler(req, res);

    assert.strictEqual(response.status, 401, 'Should return 401 without secret in production');
    assert.strictEqual(response.data.error, 'Unauthorized', 'Should return unauthorized error');
    
    console.log('✓ Production security works - unauthorized without secret');
  });

  test('Production Mode with Valid Secret', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RELOAD_SECRET = 'test-secret-123';
    
    const req = {
      method: 'POST',
      body: { action: 'test', secret: 'test-secret-123' }
    };

    let response;
    const res = {
      status: (code) => ({ 
        json: (data) => { response = { status: code, data }; } 
      }),
      json: (data) => { response = { status: 200, data }; }
    };

    await handler(req, res);

    assert.strictEqual(response.status, 200, 'Should return 200 with valid secret in production');
    assert.strictEqual(response.data.success, true, 'Should return success');
    assert.strictEqual(response.data.environment, 'production', 'Should detect production environment');
    
    console.log('✓ Production security works - authorized with valid secret');
  });

  test('Invalid Action Handling', async () => {
    process.env.NODE_ENV = 'development';
    
    const req = {
      method: 'POST',
      body: { action: 'invalid-action' }
    };

    let response;
    const res = {
      status: (code) => ({ 
        json: (data) => { response = { status: code, data }; } 
      }),
      json: (data) => { response = { status: 200, data }; }
    };

    await handler(req, res);

    assert.strictEqual(response.status, 400, 'Should return 400 for invalid action');
    assert.ok(response.data.error, 'Should return error message');
    assert.ok(response.data.availableActions, 'Should list available actions');
    
    console.log('✓ Invalid action handling works');
  });

  test('HTTP Method Validation', async () => {
    process.env.NODE_ENV = 'development';
    
    const req = {
      method: 'GET',
      body: { action: 'test' }
    };

    let response;
    const res = {
      status: (code) => ({ 
        json: (data) => { response = { status: code, data }; } 
      }),
      json: (data) => { response = { status: 200, data }; }
    };

    await handler(req, res);

    assert.strictEqual(response.status, 405, 'Should return 405 for GET request');
    assert.strictEqual(response.data.error, 'Method not allowed', 'Should return method not allowed error');
    
    console.log('✓ HTTP method validation works');
  });

  test('Production Graceful Reload - HMR Disabled Check', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RELOAD_SECRET = 'test-secret';
    
    const req = {
      method: 'POST',
      body: { action: 'graceful-reload', secret: 'test-secret' }
    };

    let response;
    const res = {
      status: (code) => ({ 
        json: (data) => { response = { status: code, data }; } 
      }),
      json: (data) => { 
        response = { status: 200, data }; 
        // Prevent actual process exit in test
      }
    };

    // Mock setTimeout to prevent actual process exit
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (fn, delay) => {
      // Don't actually execute the exit function in tests
      console.log(`✓ Would schedule process exit in ${delay}ms`);
    };

    try {
      await handler(req, res);

      assert.strictEqual(response.status, 200, 'Should return 200 for graceful reload');
      assert.strictEqual(response.data.success, true, 'Should return success');
      assert.strictEqual(response.data.method, 'process-exit-restart', 'Should use process-exit-restart method');
      assert.ok(response.data.processId, 'Should include process ID');
      
      console.log('✓ Production graceful reload works (process exit scheduled)');
    } finally {
      global.setTimeout = originalSetTimeout;
    }
  });
});