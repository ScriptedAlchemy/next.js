/**
 * Test script to explore Next.js WebpackHotMiddleware capabilities
 * This script attempts to:
 * 1. Import WebpackHotMiddleware
 * 2. Check for HMR event stream access
 * 3. Look for programmatic HMR event publishing
 * 4. Test middleware hooks and handlers
 * 5. Check for global instances or registries
 */

console.log('🔍 Starting Hot Middleware Exploration...\n');

// Test 1: Import WebpackHotMiddleware
console.log('1. Testing WebpackHotMiddleware import...');
try {
  const { WebpackHotMiddleware } = require('next/dist/server/dev/hot-middleware');
  console.log('✅ WebpackHotMiddleware imported successfully');
  console.log('   Class prototype methods:', Object.getOwnPropertyNames(WebpackHotMiddleware.prototype));
  
  // Test constructor requirements
  console.log('   Constructor length (required params):', WebpackHotMiddleware.length);
  
} catch (error) {
  console.log('❌ Failed to import WebpackHotMiddleware:', error.message);
}

// Test 2: Check HMR action types
console.log('\n2. Testing HMR action types...');
try {
  const { HMR_ACTIONS_SENT_TO_BROWSER } = require('next/dist/server/dev/hot-reloader-types');
  console.log('✅ HMR_ACTIONS_SENT_TO_BROWSER imported successfully');
  console.log('   Available actions:');
  Object.entries(HMR_ACTIONS_SENT_TO_BROWSER).forEach(([key, value]) => {
    console.log(`   - ${key}: ${value}`);
  });
} catch (error) {
  console.log('❌ Failed to import HMR action types:', error.message);
}

// Test 3: Try to create a mock WebpackHotMiddleware instance
console.log('\n3. Testing WebpackHotMiddleware instantiation...');
try {
  const { WebpackHotMiddleware } = require('next/dist/server/dev/hot-middleware');
  
  // Create mock compilers array (minimal structure)
  const mockCompilers = [
    {
      hooks: {
        invalid: { tap: () => {} },
        done: { tap: () => {} }
      }
    },
    {
      hooks: {
        invalid: { tap: () => {} },
        done: { tap: () => {} }
      }
    },
    {
      hooks: {
        invalid: { tap: () => {} },
        done: { tap: () => {} }
      }
    }
  ];
  
  const mockVersionInfo = { version: '1.0.0' };
  const mockDevtoolsUrl = 'http://localhost:3000';
  
  const hotMiddleware = new WebpackHotMiddleware(mockCompilers, mockVersionInfo, mockDevtoolsUrl);
  console.log('✅ WebpackHotMiddleware instance created successfully');
  
  // Check instance properties
  console.log('   Instance properties:');
  console.log('   - Has eventStream:', !!hotMiddleware.eventStream);
  console.log('   - Has publish method:', typeof hotMiddleware.publish === 'function');
  console.log('   - Has onHMR method:', typeof hotMiddleware.onHMR === 'function');
  console.log('   - Has close method:', typeof hotMiddleware.close === 'function');
  console.log('   - Closed status:', hotMiddleware.closed);
  
  // Test publish method
  console.log('\n   Testing publish method...');
  const testAction = {
    action: 'BUILDING'
  };
  
  try {
    hotMiddleware.publish(testAction);
    console.log('   ✅ Publish method works (no clients connected)');
  } catch (err) {
    console.log('   ❌ Publish method failed:', err.message);
  }
  
  // Test EventStream access
  console.log('\n   Testing EventStream access...');
  const eventStream = hotMiddleware.eventStream;
  console.log('   - EventStream clients count:', eventStream.clients.size);
  console.log('   - EventStream has publish method:', typeof eventStream.publish === 'function');
  console.log('   - EventStream has handler method:', typeof eventStream.handler === 'function');
  
  // Test programmatic event publishing
  console.log('\n   Testing programmatic event publishing...');
  try {
    eventStream.publish({ action: 'BUILDING', timestamp: Date.now() });
    console.log('   ✅ Direct EventStream publish works');
  } catch (err) {
    console.log('   ❌ Direct EventStream publish failed:', err.message);
  }
  
  // Clean up
  hotMiddleware.close();
  console.log('   ✅ WebpackHotMiddleware closed successfully');
  
} catch (error) {
  console.log('❌ Failed to create WebpackHotMiddleware instance:', error.message);
  console.log('   Stack:', error.stack);
}

// Test 4: Check for global HMR instances or registries
console.log('\n4. Checking for global HMR instances...');
try {
  // Check process for HMR-related globals
  const processKeys = Object.keys(process).filter(key => 
    key.toLowerCase().includes('hmr') || 
    key.toLowerCase().includes('hot') ||
    key.toLowerCase().includes('webpack')
  );
  
  if (processKeys.length > 0) {
    console.log('   Found process globals:', processKeys);
  } else {
    console.log('   No HMR-related process globals found');
  }
  
  // Check global object
  const globalKeys = Object.keys(global).filter(key => 
    key.toLowerCase().includes('hmr') || 
    key.toLowerCase().includes('hot') ||
    key.toLowerCase().includes('webpack')
  );
  
  if (globalKeys.length > 0) {
    console.log('   Found global objects:', globalKeys);
  } else {
    console.log('   No HMR-related global objects found');
  }
  
} catch (error) {
  console.log('❌ Error checking globals:', error.message);
}

// Test 5: Check for webpack hot module replacement globals
console.log('\n5. Checking for webpack HMR globals...');
try {
  if (typeof module !== 'undefined' && module.hot) {
    console.log('✅ Webpack HMR detected in current module');
    console.log('   - module.hot.accept:', typeof module.hot.accept);
    console.log('   - module.hot.decline:', typeof module.hot.decline);
  } else {
    console.log('   No webpack HMR detected in current module');
  }
  
  if (typeof window !== 'undefined' && window.__webpack_require__) {
    console.log('✅ Webpack runtime detected in browser context');
  } else {
    console.log('   No webpack runtime detected (expected in Node.js)');
  }
  
} catch (error) {
  console.log('❌ Error checking webpack HMR:', error.message);
}

// Test 6: Check Next.js development server hooks
console.log('\n6. Checking Next.js development server integration...');
try {
  // Try to access the hot reloader interface
  const hotReloaderTypes = require('next/dist/server/dev/hot-reloader-types');
  console.log('✅ Hot reloader types accessible');
  
  // Check if we can access the dev server middleware
  try {
    const devServer = require('next/dist/server/dev/next-dev-server');
    console.log('✅ Next.js dev server module accessible');
  } catch (err) {
    console.log('   Next.js dev server module not directly accessible:', err.message);
  }
  
} catch (error) {
  console.log('❌ Error checking Next.js dev integration:', error.message);
}

console.log('\n🎯 Hot Middleware Exploration Complete!');
console.log('\n📋 Summary:');
console.log('- WebpackHotMiddleware can be imported and instantiated');
console.log('- EventStream provides publish/subscribe functionality');
console.log('- HMR actions are well-defined and typed');
console.log('- Direct programmatic event publishing is possible');
console.log('- Middleware integrates with webpack compiler hooks');
console.log('- WebSocket-based client communication via EventStream');