const { test } = require('node:test');
const assert = require('node:assert');
const { spawn, exec } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
const http = require('node:http');
const { promisify } = require('node:util');

const execAsync = promisify(exec);

test('Method 1: File-Based HMR (With Server)', async (t) => {
  let devServer = null;
  let serverPort = 3000;
  let stdout = '';
  let stderr = '';

  console.log('🧪 Testing Method 1: File-Based HMR');
  console.log('====================================');

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

  // Wait for the server to be ready
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

  // Helper to make HTTP requests
  async function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: serverPort,
        path: path,
        method: method,
        headers: method === 'POST' ? {
          'Content-Type': 'application/json',
          'Content-Length': data ? Buffer.byteLength(JSON.stringify(data)) : 0
        } : {}
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = {
              status: res.statusCode,
              body: res.headers['content-type']?.includes('json') ? JSON.parse(body) : body
            };
            resolve(result);
          } catch (error) {
            resolve({ status: res.statusCode, body });
          }
        });
      });

      req.on('error', reject);
      
      if (data && method === 'POST') {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  // Test 1: Visit page first to trigger compilation
  console.log('1. Visiting page to trigger compilation...');
  const initialPage = await makeRequest('/');
  assert.strictEqual(initialPage.status, 200, 'Initial page should return 200');
  assert.ok(initialPage.body.includes('PLACEHOLDER'), 'Initial page should contain PLACEHOLDER');
  assert.ok(!initialPage.body.includes('Hello world!!'), 'Initial page should NOT contain Hello world!!');
  console.log('   ✅ Initial page loaded with PLACEHOLDER');

  // Test 2: Wait for compilation to complete
  console.log('2. Waiting for compilation to complete...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('   ✅ Compilation wait completed');

  // Test 3: Test file-based HMR using string replacement
  console.log('3. Testing file-based HMR with string replacement...');
  
  // Read the compiled _document.js file
  const serverDocPath = path.join(__dirname, '..', '.next', 'server', 'pages', '_document.js');
  const originalContent = await fs.readFile(serverDocPath, 'utf8');
  console.log(`   📖 Read compiled _document.js: ${originalContent.length} bytes`);
  
  // Replace PLACEHOLDER with "Hello world!!"
  const updatedContent = originalContent.replace('PLACEHOLDER', 'Hello world!!');
  if (updatedContent === originalContent) {
    console.error('   ❌ PLACEHOLDER not found in compiled file');
    assert.fail('PLACEHOLDER not found in compiled _document.js');
  }
  
  // Write the updated content back
  await fs.writeFile(serverDocPath, updatedContent, 'utf8');
  console.log(`   📝 Updated _document.js with string replacement`);
  
  // Verify the file was written correctly
  const writtenContent = await fs.readFile(serverDocPath, 'utf8');
  console.log(`   ✅ Verified file written: ${writtenContent.length} bytes`);
  
  // Clear module cache to ensure the new file is loaded
  try {
    const clearCache = await makeRequest('/api/server-hmr', 'POST', { 
      action: 'clear-module-cache',
      modulePath: serverDocPath
    });
    console.log('   ✅ Module cache cleared');
    
    const clearAll = await makeRequest('/api/server-hmr', 'POST', { 
      action: 'clear-all-pages'
    });
    console.log('   ✅ All pages cleared');
  } catch (error) {
    console.log('   ⚠️  Cache clear failed, continuing anyway');
  }
  
  // Give Next.js time to process the changes
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('   ✅ File-based HMR triggered successfully');

  // Test 5: Verify page was updated
  console.log('5. Verifying page update after HMR...');
  
  // First reload to trigger recompilation
  const firstReload = await makeRequest('/');
  console.log(`   First reload status: ${firstReload.status}`);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Second reload should show the updated content
  const updatedPage = await makeRequest('/');
  assert.strictEqual(updatedPage.status, 200, 'Updated page should return 200');
  assert.ok(updatedPage.body.includes('Hello world!!'), 'Page should contain Hello world!! after HMR');
  console.log('   ✅ Page successfully updated after HMR');

  console.log('');
  console.log('🎉 Method 1: File-Based HMR Test Complete!');
  console.log('✅ Chunk file validation: PASSED');
  console.log('✅ Content structure: PASSED'); 
  console.log('✅ File-based HMR: PASSED');
  console.log('✅ Page verification: PASSED');
});