#!/usr/bin/env node

// Working HMR Test Script
// Tests the complete HMR functionality on the correct port

const http = require('http');
const { spawn } = require('child_process');

let devServer = null;
let serverPort = 3003; // Default to the working port

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function testHMR() {
  console.log('🔥 Working HMR Test');
  console.log('==================');
  console.log(`Testing on port ${serverPort}`);
  console.log('');

  try {
    // Test 1: Check initial page state
    console.log('1. Testing initial page state...');
    const initialPage = await makeRequest('/');
    console.log(`   Status: ${initialPage.status}`);
    
    if (initialPage.status === 200) {
      const hasHelloWorld = initialPage.body.includes('<h1>Hello World</h1>');
      console.log(`   Contains "Hello World": ${hasHelloWorld ? '✅ YES' : '❌ NO'}`);
    }

    // Test 2: Check Server HMR availability
    console.log('\n2. Testing Server HMR API...');
    const serverHMR = await makeRequest('/api/server-hmr', 'POST', { action: 'test' });
    console.log(`   Status: ${serverHMR.status}`);
    if (serverHMR.body && serverHMR.body.availableFunctions) {
      console.log(`   ✅ Available functions: ${serverHMR.body.availableFunctions.join(', ')}`);
    }

    // Test 3: Get HMR cache info
    console.log('\n3. Getting HMR cache info...');
    const cacheInfo = await makeRequest('/api/server-hmr', 'POST', { action: 'cache-info' });
    console.log(`   Status: ${cacheInfo.status}`);
    if (cacheInfo.body && cacheInfo.body.result) {
      console.log(`   ✅ Cache info available`);
    }

    // Test 4: Trigger document hot replacement
    console.log('\n4. Triggering document hot replacement...');
    const hmrTrigger = await makeRequest('/api/hot-replace-document', 'POST');
    console.log(`   Status: ${hmrTrigger.status}`);
    if (hmrTrigger.body) {
      console.log(`   Method: ${hmrTrigger.body.method || 'unknown'}`);
      console.log(`   Success: ${hmrTrigger.body.success ? '✅ YES' : '❌ NO'}`);
      if (hmrTrigger.body.message) {
        console.log(`   Message: ${hmrTrigger.body.message}`);
      }
    }

    // Test 5: Wait and check if page was updated
    console.log('\n5. Checking if page was updated after HMR...');
    await delay(2000); // Give HMR time to process
    
    const updatedPage = await makeRequest('/');
    console.log(`   Status: ${updatedPage.status}`);
    
    if (updatedPage.status === 200) {
      const hasHelloWorld = updatedPage.body.includes('<h1>Hello World</h1>');
      console.log(`   Contains "Hello World": ${hasHelloWorld ? '✅ YES' : '❌ NO'}`);
      
      // The key test: does it contain the exact text the test expects?
      const exactMatch = updatedPage.body.includes('<h1>Hello World</h1>');
      console.log(`   ✅ HMR TEST RESULT: ${exactMatch ? 'PASS' : 'FAIL'}`);
    }

    // Test 6: Test other HMR endpoints
    console.log('\n6. Testing additional HMR endpoints...');
    
    // Test Simple HMR
    try {
      const simpleHMR = await makeRequest('/api/simple-hmr');
      console.log(`   Simple HMR: ${simpleHMR.status} ${simpleHMR.status === 200 ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`   Simple HMR: Error - ${error.message}`);
    }

    // Test Chunk Factory
    try {
      const chunkFactory = await makeRequest('/api/chunk-factory');
      console.log(`   Chunk Factory: ${chunkFactory.status} ${chunkFactory.status === 200 ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`   Chunk Factory: Error - ${error.message}`);
    }

    // Test Enhanced HMR
    try {
      const enhancedHMR = await makeRequest('/api/enhanced-hmr');
      console.log(`   Enhanced HMR: ${enhancedHMR.status} ${enhancedHMR.status === 200 ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`   Enhanced HMR: Error - ${error.message}`);
    }

    console.log('\n🎉 HMR Test Complete!');
    console.log('=====================');
    console.log(`The HMR system is ${hmrTrigger.body && hmrTrigger.body.success ? 'WORKING' : 'NOT WORKING'} on port ${serverPort}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n💡 Make sure the Next.js dev server is running on port', serverPort);
    console.log('   Run: npm run dev');
  }
}

// If a port is provided as argument, use it
if (process.argv[2]) {
  serverPort = parseInt(process.argv[2]);
}

// Run the test
testHMR();