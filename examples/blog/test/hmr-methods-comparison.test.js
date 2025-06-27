const { test } = require('node:test');
const assert = require('node:assert');
const { spawn, exec } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { promisify } = require('node:util');

const execAsync = promisify(exec);

test('HMR Methods Comparison Test', async (t) => {
  let devServer = null;
  let serverPort = 3000;
  let stdout = '';
  let stderr = '';
  let originalDocumentContent = null;

  // Kill any existing processes on common Next.js ports
  try {
    await execAsync('npx kill-port 3000 3001 3002 3003').catch(() => {});
  } catch (e) {
    // Ignore errors, ports might not be in use
  }

  // Start the dev server
  devServer = spawn('pnpm', ['dev'], { cwd: __dirname + '/..' });
  devServer.stdout.on('data', (data) => stdout += data.toString());
  devServer.stderr.on('data', (data) => stderr += data.toString());

  t.after(async () => {
    console.log('--- HMR Comparison Test stdout ---');
    console.log(stdout);
    console.log('--- HMR Comparison Test stderr ---');
    console.log(stderr);
    
    // Restore original server document if we have it
    if (originalDocumentContent) {
      const serverDocPath = path.join(__dirname, '..', '.next', 'server', 'pages', '_document.js');
      try {
        await fs.writeFile(serverDocPath, originalDocumentContent, 'utf8');
        console.log('Restored original server _document.js');
      } catch (error) {
        console.log('Could not restore original document:', error.message);
      }
    }
    
    if (devServer) {
      devServer.kill();
    }
    // Clean up any remaining processes
    try {
      await execAsync('npx kill-port 3000 3001 3002 3003').catch(() => {});
    } catch (e) {
      // Ignore cleanup errors
    }
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

  console.log('🧪 HMR Methods Comparison Test');
  console.log('===============================');

  // Test 1: Initial page state
  console.log('1. Testing initial page state...');
  const initialPage = await makeRequest('/');
  assert.strictEqual(initialPage.status, 200, 'Initial page should return 200');
  assert.ok(initialPage.body.includes('PLACEHOLDER'), 'Initial page should contain PLACEHOLDER');
  assert.ok(!initialPage.body.includes('Hello world!!'), 'Page should NOT contain Hello world!! initially');
  console.log('   ✅ Initial page test passed');

  // Store original document for restoration
  const serverDocPath = path.join(__dirname, '..', '.next', 'server', 'pages', '_document.js');
  try {
    originalDocumentContent = await fs.readFile(serverDocPath, 'utf8');
  } catch (error) {
    console.log('   No existing server document found to backup');
  }

  const results = {
    method1: { available: false, successful: false, error: null },
    method2: { available: false, successful: false, error: null }
  };

  // Test Method 1: File-Based HMR
  console.log('\n📁 Testing Method 1: File-Based HMR');
  console.log('=====================================');
  
  try {
    console.log('2a. Checking file-based HMR API availability...');
    const fileAPITest = await makeRequest('/api/file-based-hmr', 'POST', { action: 'test' });
    
    if (fileAPITest.status === 200) {
      results.method1.available = true;
      console.log('    ✅ File-based HMR API available');
      
      console.log('2b. Triggering file-based HMR...');
      const fileHMRTrigger = await makeRequest('/api/file-based-hmr', 'POST', { 
        action: 'trigger-hmr',
        pagePath: '/_document'
      });
      
      if (fileHMRTrigger.status === 200 && fileHMRTrigger.body.success) {
        console.log('    ✅ File-based HMR triggered successfully');
        
        // Wait and check for page update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // First reload to trigger recompilation
        const firstReload = await makeRequest('/');
        console.log(`    First reload status: ${firstReload.status}`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Second reload should show the updated content
        const updatedPage1 = await makeRequest('/');
        
        if (updatedPage1.body.includes('Hello world!!')) {
          results.method1.successful = true;
          console.log('    ✅ Method 1: Page successfully updated via file-based HMR');
        } else {
          console.log('    ❌ Method 1: Page not updated despite successful trigger');
        }
      } else {
        results.method1.error = fileHMRTrigger.body?.error || 'Trigger failed';
        console.log('    ❌ File-based HMR trigger failed:', results.method1.error);
      }
    } else {
      results.method1.error = 'API not available';
      console.log('    ❌ File-based HMR API not available');
    }
  } catch (error) {
    results.method1.error = error.message;
    console.log('    ❌ Method 1 error:', error.message);
  }

  // Restore original state for Method 2 test
  if (originalDocumentContent) {
    try {
      await fs.writeFile(serverDocPath, originalDocumentContent, 'utf8');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log('    Could not restore original state:', error.message);
    }
  }

  // Test Method 2: Internal API HMR
  console.log('\n🔧 Testing Method 2: Internal API HMR');
  console.log('======================================');
  
  try {
    console.log('3a. Checking internal API HMR availability...');
    const internalAPITest = await makeRequest('/api/internal-api-hmr', 'POST', { action: 'test' });
    
    if (internalAPITest.status === 200) {
      results.method2.available = true;
      console.log('    ✅ Internal API HMR endpoint available');
      
      console.log('3b. Initializing internal API...');
      const initResponse = await makeRequest('/api/internal-api-hmr', 'POST', { action: 'initialize' });
      
      if (initResponse.status === 200 && initResponse.body.success) {
        console.log('    ✅ Internal API initialized successfully');
        
        console.log('3c. Triggering internal API HMR...');
        const internalHMRTrigger = await makeRequest('/api/internal-api-hmr', 'POST', { 
          action: 'trigger-hmr',
          pagePath: '/_document',
          forceReload: true
        });
        
        if (internalHMRTrigger.status === 200 && internalHMRTrigger.body.success) {
          console.log('    ✅ Internal API HMR triggered successfully');
          
          // Wait and check for page update
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // First reload to trigger recompilation
          const firstReload2 = await makeRequest('/');
          console.log(`    First reload status: ${firstReload2.status}`);
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Second reload should show the updated content
          const updatedPage2 = await makeRequest('/');
          
          if (updatedPage2.body.includes('Hello world!!')) {
            results.method2.successful = true;
            console.log('    ✅ Method 2: Page successfully updated via internal API HMR');
          } else {
            console.log('    ❌ Method 2: Page not updated despite successful trigger');
          }
        } else {
          results.method2.error = internalHMRTrigger.body?.error || 'Trigger failed';
          console.log('    ❌ Internal API HMR trigger failed:', results.method2.error);
        }
      } else {
        results.method2.error = initResponse.body?.error || 'Initialization failed';
        console.log('    ❌ Internal API initialization failed:', results.method2.error);
      }
    } else {
      results.method2.error = 'API not available';
      console.log('    ❌ Internal API HMR endpoint not available');
    }
  } catch (error) {
    results.method2.error = error.message;
    console.log('    ❌ Method 2 error:', error.message);
  }

  // Final Results Summary
  console.log('\n📊 HMR Methods Comparison Results');
  console.log('==================================');
  console.log(`Method 1 (File-Based):    Available: ${results.method1.available ? '✅' : '❌'}  Successful: ${results.method1.successful ? '✅' : '❌'}`);
  console.log(`Method 2 (Internal API):  Available: ${results.method2.available ? '✅' : '❌'}  Successful: ${results.method2.successful ? '✅' : '❌'}`);
  
  if (results.method1.error) console.log(`Method 1 Error: ${results.method1.error}`);
  if (results.method2.error) console.log(`Method 2 Error: ${results.method2.error}`);

  // Assert at least one method works
  assert.ok(
    results.method1.successful || results.method2.successful, 
    'At least one HMR method should work successfully'
  );

  console.log('\n🎉 HMR Methods Comparison Test Complete!');
});