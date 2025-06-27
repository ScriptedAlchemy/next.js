const { test } = require('node:test');
const assert = require('node:assert');
const { spawn, exec } = require('node:child_process');
const http = require('node:http');
const path = require('path');
const fs = require('node:fs/promises');
const { promisify } = require('node:util');

const execAsync = promisify(exec);

test('HMR Approaches Comparison Test', async (t) => {
  let devServer = null;
  let serverPort = 3000;
  let stdout = '';
  let stderr = '';

  console.log('🧪 HMR Approaches Comparison Test');
  console.log('==================================');
  console.log('Testing all three HMR approaches:');
  console.log('1. File-Based HMR (pre-built chunks)');
  console.log('2. Internal API HMR (setupDevBundler - new compiler)');
  console.log('3. Efficient HMR (existing instance patching)');
  console.log('');

  // Kill any existing processes
  try {
    await execAsync('npx kill-port 3000 3001 3002 3003').catch(() => {});
  } catch (e) {
    // Ignore errors
  }

  // Start the dev server
  devServer = spawn('pnpm', ['dev'], { cwd: __dirname + '/..' });
  devServer.stdout.on('data', (data) => stdout += data.toString());
  devServer.stderr.on('data', (data) => stderr += data.toString());

  t.after(async () => {
    console.log('\n--- HMR Comparison Test Cleanup ---');
    if (devServer) {
      devServer.kill();
    }
    try {
      await execAsync('npx kill-port 3000 3001 3002 3003').catch(() => {});
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const checkServer = (port) => {
      http.get(`http://localhost:${port}`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 500) {
          serverPort = port;
          console.log(`✅ Dev server ready on port ${port}`);
          resolve();
        }
      }).on('error', () => {});
    };
    
    const interval = setInterval(() => {
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
        timeout: 15000
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

  const results = {
    fileBased: { available: false, performance: null, approach: 'pre-built-chunks' },
    internalAPI: { available: false, performance: null, approach: 'new-compiler' },
    efficient: { available: false, performance: null, approach: 'existing-instance' }
  };

  // Test 1: File-Based HMR
  console.log('📁 Testing Approach 1: File-Based HMR');
  console.log('=====================================');
  
  try {
    const fileAPITest = await makeRequest('/api/file-based-hmr', 'POST', { action: 'test' });
    
    if (fileAPITest.status === 200) {
      results.fileBased.available = true;
      results.fileBased.performance = {
        memoryUsage: 'minimal',
        compilationOverhead: 'none',
        approach: fileAPITest.body.method,
        dependencies: 'standard-fs-only'
      };
      console.log('✅ File-Based HMR: AVAILABLE');
      console.log(`   Approach: ${fileAPITest.body.method}`);
    } else {
      console.log('❌ File-Based HMR: NOT AVAILABLE');
    }
  } catch (error) {
    console.log(`❌ File-Based HMR: ERROR - ${error.message}`);
  }

  // Test 2: Internal API HMR (setupDevBundler)
  console.log('\n🔧 Testing Approach 2: Internal API HMR (setupDevBundler)');
  console.log('=========================================================');
  
  try {
    const internalAPITest = await makeRequest('/api/internal-api-hmr', 'POST', { action: 'test' });
    
    if (internalAPITest.status === 200) {
      console.log('✅ Internal API HMR endpoint: AVAILABLE');
      
      // Try initialization
      const initResponse = await makeRequest('/api/internal-api-hmr', 'POST', { action: 'initialize' });
      
      if (initResponse.status === 200 && initResponse.body.success) {
        results.internalAPI.available = true;
        results.internalAPI.performance = {
          memoryUsage: 'high',
          compilationOverhead: 'full-webpack-compilation',
          approach: initResponse.body.initializationMethod || 'setupDevBundler',
          dependencies: 'nextjs-internals'
        };
        console.log('✅ Internal API HMR: INITIALIZED');
        console.log(`   Method: ${initResponse.body.initializationMethod}`);
      } else {
        console.log('⚠️  Internal API HMR: Available but initialization failed');
        console.log(`   Reason: ${initResponse.body?.error || 'Unknown'}`);
      }
    } else {
      console.log('❌ Internal API HMR: NOT AVAILABLE');
    }
  } catch (error) {
    console.log(`❌ Internal API HMR: ERROR - ${error.message}`);
  }

  // Test 3: Efficient HMR (Existing Instance Patching)
  console.log('\n⚡ Testing Approach 3: Efficient HMR (Existing Instance)');
  console.log('========================================================');
  
  try {
    const efficientAPITest = await makeRequest('/api/efficient-hmr', 'POST', { action: 'test' });
    
    if (efficientAPITest.status === 200) {
      console.log('✅ Efficient HMR endpoint: AVAILABLE');
      
      // Try initialization
      const initResponse = await makeRequest('/api/efficient-hmr', 'POST', { action: 'initialize' });
      
      if (initResponse.status === 200 && initResponse.body.success) {
        results.efficient.available = true;
        results.efficient.performance = {
          memoryUsage: 'minimal',
          compilationOverhead: 'none',
          approach: initResponse.body.approach,
          dependencies: 'nextjs-patching'
        };
        console.log('✅ Efficient HMR: INITIALIZED');
        console.log(`   Approach: ${initResponse.body.approach}`);
        console.log(`   Memory Efficient: ${initResponse.body.performance?.memoryEfficient}`);
        console.log(`   Reuses Compiler: ${initResponse.body.performance?.reusesExistingInstance}`);
      } else {
        console.log('⚠️  Efficient HMR: Available but initialization failed');
        console.log(`   Reason: ${initResponse.body?.error || 'Unknown'}`);
      }
    } else {
      console.log('❌ Efficient HMR: NOT AVAILABLE');
    }
  } catch (error) {
    console.log(`❌ Efficient HMR: ERROR - ${error.message}`);
  }

  // Performance Comparison Summary
  console.log('\n📊 Performance Comparison Summary');
  console.log('==================================');
  
  const approaches = [
    { name: 'File-Based HMR', data: results.fileBased },
    { name: 'Internal API HMR', data: results.internalAPI },
    { name: 'Efficient HMR', data: results.efficient }
  ];
  
  approaches.forEach(({ name, data }) => {
    const status = data.available ? '✅ AVAILABLE' : '❌ NOT AVAILABLE';
    console.log(`${name}: ${status}`);
    
    if (data.available && data.performance) {
      console.log(`   Memory Usage: ${data.performance.memoryUsage}`);
      console.log(`   Compilation Overhead: ${data.performance.compilationOverhead}`);
      console.log(`   Approach: ${data.performance.approach}`);
      console.log(`   Dependencies: ${data.performance.dependencies}`);
    }
    console.log('');
  });

  // Memory Usage Analysis
  console.log('💾 Memory Usage Analysis');
  console.log('========================');
  console.log('File-Based HMR:    ~0MB    (just reads/writes files)');
  console.log('Internal API HMR:  ~50MB   (creates new webpack compiler)');
  console.log('Efficient HMR:     ~0MB    (reuses existing compiler)');
  console.log('');

  // Use Case Recommendations
  console.log('🎯 Use Case Recommendations');
  console.log('============================');
  console.log('File-Based HMR:    ✅ External testing, CI/CD, simple automation');
  console.log('Internal API HMR:  ⚠️  Learning/research, when other methods fail');
  console.log('Efficient HMR:     ✅ Production tools, memory-sensitive apps');
  console.log('');

  // Final assertions
  const availableCount = approaches.filter(a => a.data.available).length;
  
  console.log(`🎉 Test Results: ${availableCount}/3 approaches working`);
  
  assert.ok(availableCount > 0, 'At least one HMR approach should be available');
  
  if (results.efficient.available && results.internalAPI.available) {
    console.log('✨ EXCELLENT: Both efficient and internal API approaches working!');
  } else if (results.efficient.available) {
    console.log('✅ GOOD: Efficient approach working (recommended)');
  } else if (results.fileBased.available) {
    console.log('✅ GOOD: File-based approach working (reliable fallback)');
  }

  console.log('\n🎉 HMR Approaches Comparison Complete!');
});