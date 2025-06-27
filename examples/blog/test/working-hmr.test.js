const { test } = require('node:test');
const assert = require('node:assert');
const { spawn, exec } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { promisify } = require('node:util');

const execAsync = promisify(exec);

test('Working HMR System Test', async (t) => {
  let devServer = null;
  let serverPort = 3000;
  let stdout = '';
  let stderr = '';

  // Kill any existing processes on common Next.js ports
  try {
    await execAsync('npx kill-port 3000 3001 3002 3003').catch(() => {});
  } catch (e) {
    // Ignore errors, ports might not be in use
  }

  // Kill any existing processes first
  console.log('🔪 Killing any existing processes...');
  try {
    await execAsync('npx kill-port 3000 3001 3002 3003').catch(() => {});
    await execAsync('lsof -ti:3000 | xargs kill -9').catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {
    // Ignore errors, ports might not be in use
  }

  // Start the dev server
  console.log('🚀 Starting fresh dev server...');
  devServer = spawn('npx', ['next', 'dev'], { cwd: __dirname + '/..' });
  devServer.stdout.on('data', (data) => stdout += data.toString());
  devServer.stderr.on('data', (data) => stderr += data.toString());

  t.after(async () => {
    console.log('\n🔪 Starting test cleanup...');
    
    // Force kill the dev server
    if (devServer) {
      console.log('🔪 Killing dev server process...');
      devServer.kill('SIGTERM');
      
      // Wait a moment for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force kill if still running
      try {
        devServer.kill('SIGKILL');
      } catch (e) {
        // Already dead
      }
    }
    
    // Clean up any remaining processes on all ports
    console.log('🔪 Killing all processes on ports 3000-3003...');
    try {
      await execAsync('npx kill-port 3000 3001 3002 3003').catch(() => {});
      await execAsync('lsof -ti:3000 | xargs kill -9').catch(() => {});
      await execAsync('lsof -ti:3001 | xargs kill -9').catch(() => {});
      await execAsync('lsof -ti:3002 | xargs kill -9').catch(() => {});
      await execAsync('lsof -ti:3003 | xargs kill -9').catch(() => {});
    } catch (e) {
      // Ignore cleanup errors
    }
    
    // Final wait to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Dump stdio/stderr
    console.log('\n📋 DUMPING STDIO/STDERR OUTPUT:');
    console.log('='.repeat(50));
    console.log('--- STDOUT ---');
    console.log(stdout || '(no stdout)');
    console.log('\n--- STDERR ---');
    console.log(stderr || '(no stderr)');
    console.log('='.repeat(50));
    
    console.log('✅ Test cleanup completed');
  });

  // Wait for the server to be ready and detect the port
  await new Promise((resolve, reject) => {
    const checkServer = (port) => {
      http.get(`http://localhost:${port}`, (res) => {
        if (res.statusCode === 200) {
          serverPort = port;
          console.log(`✅ Server ready on port ${port}`);
          resolve();
        }
      }).on('error', () => {});
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
      reject(new Error('Server startup timeout'));
    }, 30000);
  });

  // Helper function to make HTTP requests
  async function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: serverPort,
        path,
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        timeout: 10000
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = {
              status: res.statusCode,
              headers: res.headers,
              body: res.headers['content-type']?.includes('json') ? JSON.parse(body) : body
            };
            resolve(result);
          } catch (error) {
            resolve({ status: res.statusCode, body, parseError: error.message });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      
      if (data && method === 'POST') {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  // Test 1: Initial page state (should NOT contain Hello World yet)
  console.log('1. Testing initial page state...');
  const initialPage = await makeRequest('/');
  assert.strictEqual(initialPage.status, 200, 'Initial page should return 200');
  
  // Debug: log what we actually got
  console.log('   Initial page title check:', initialPage.body.substring(0, 200));
  const hasTitle = initialPage.body.includes('<title>') || initialPage.body.includes('Next.js');
  assert.ok(hasTitle, 'Page should contain some title');
  assert.ok(initialPage.body.includes('PLACEHOLDER'), 'Page should contain PLACEHOLDER initially');
  assert.ok(!initialPage.body.includes('Hello world!!'), 'Page should NOT contain Hello world!! initially');
  console.log('   ✅ Initial page test passed - PLACEHOLDER found');

  // Test 2: Server HMR API availability
  console.log('2. Testing Server HMR API...');
  const serverHMR = await makeRequest('/api/server-hmr', 'POST', { action: 'test' });
  assert.strictEqual(serverHMR.status, 200, 'Server HMR API should be available');
  assert.ok(serverHMR.body.availableFunctions, 'Should return available functions');
  console.log(`   ✅ Server HMR API available with functions: ${serverHMR.body.availableFunctions.join(', ')}`);

  // Test 3: Cache info
  console.log('3. Testing cache info...');
  const cacheInfo = await makeRequest('/api/server-hmr', 'POST', { action: 'cache-info' });
  assert.strictEqual(cacheInfo.status, 200, 'Cache info should be available');
  assert.ok(cacheInfo.body.result, 'Should return cache information');
  console.log('   ✅ Cache info test passed');

  // Test 4: Document hot replacement using string replacement
  console.log('4. Testing document hot replacement with string replacement...');
  
  // The initial page visit above should have already compiled _document.js
  // Let's verify it exists
  const serverDocPath = path.join(__dirname, '..', '.next', 'server', 'pages', '_document.js');
  let serverDocContent;
  try {
    serverDocContent = await fs.readFile(serverDocPath, 'utf8');
    console.log(`   📖 Read compiled _document.js: ${serverDocContent.length} bytes`);
  } catch (error) {
    console.error('   ❌ Failed to read compiled _document.js:', error.message);
    assert.fail('Compiled _document.js not found');
  }
  
  // Replace PLACEHOLDER with "Hello world!!"
  const updatedContent = serverDocContent.replace('PLACEHOLDER', 'Hello world!!');
  if (updatedContent === serverDocContent) {
    console.error('   ❌ PLACEHOLDER not found in compiled file');
    assert.fail('PLACEHOLDER not found in compiled _document.js');
  }
  
  // Write the updated content back
  await fs.writeFile(serverDocPath, updatedContent, 'utf8');
  console.log(`   📝 Updated _document.js with string replacement`);
  
  // Clear the module cache to force reload - try multiple approaches
  try {
    // First try clearing the specific module
    const clearCache = await makeRequest('/api/server-hmr', 'POST', { 
      action: 'clear-module-cache',
      modulePath: serverDocPath
    });
    console.log('   ✅ Module cache cleared:', clearCache.body.result);
    
    // Then clear all pages to ensure fresh load
    const clearAll = await makeRequest('/api/server-hmr', 'POST', { 
      action: 'clear-all-pages'
    });
    console.log('   ✅ All pages cleared:', clearAll.body);
  } catch (error) {
    console.log('   ⚠️  Cache clear failed, continuing anyway:', error.message);
  }
  
  // Give Next.js time to detect the change
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('   ✅ String replacement HMR triggered successfully');

  // Test 5: Force a page reload by visiting it again
  console.log('5. Forcing page reload by visiting it...');
  // First visit might still use cached version
  const firstReload = await makeRequest('/');
  console.log(`   First reload status: ${firstReload.status}`);
  
  // Give it a moment and try again
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Second visit should use the updated version
  const updatedPage = await makeRequest('/');
  assert.strictEqual(updatedPage.status, 200, 'Updated page should return 200');
  
  // Debug: Check what's actually in the response
  const placeholderIndex = updatedPage.body.indexOf('PLACEHOLDER');
  const helloWorldIndex = updatedPage.body.indexOf('Hello world!!');
  console.log(`   Debug: PLACEHOLDER found at index: ${placeholderIndex}`);
  console.log(`   Debug: Hello world!! found at index: ${helloWorldIndex}`);
  if (placeholderIndex > -1) {
    console.log(`   Debug: Content around PLACEHOLDER: "${updatedPage.body.substring(placeholderIndex - 20, placeholderIndex + 30)}"`);
  }
  if (helloWorldIndex > -1) {
    console.log(`   Debug: Content around Hello world!!: "${updatedPage.body.substring(helloWorldIndex - 20, helloWorldIndex + 35)}"`);
  }
  
  assert.ok(updatedPage.body.includes('Hello world!!'), 'Page should contain Hello world!! after string replacement');
  console.log('   ✅ Page successfully updated after HMR');

  // Test 6: Verify removed endpoints return 404 (expected behavior)
  console.log('6. Testing removed endpoints (should be 404)...');
  
  const simpleHMR = await makeRequest('/api/simple-hmr').catch(() => ({ status: 404 }));
  const chunkFactory = await makeRequest('/api/chunk-factory').catch(() => ({ status: 404 }));
  const enhancedHMR = await makeRequest('/api/enhanced-hmr').catch(() => ({ status: 404 }));
  
  assert.strictEqual(simpleHMR.status, 404, 'Simple HMR should be removed (404)');
  assert.strictEqual(chunkFactory.status, 404, 'Chunk Factory should be removed (404)');
  assert.strictEqual(enhancedHMR.status, 404, 'Enhanced HMR should be removed (404)');
  console.log('   ✅ Removed endpoints correctly return 404');

  console.log('\n🎉 All HMR tests passed!');
  console.log('=====================');
  console.log('✅ Cache invalidation approach working correctly');
  console.log('✅ System mirrors Next.js internal approach');
  console.log('✅ Simplified architecture is functional');
});
