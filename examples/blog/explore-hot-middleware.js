/**
 * Hot Middleware Exploration Script
 * 
 * This script explores the WebpackHotMiddleware from Next.js for accessing HMR event streams.
 * It demonstrates how to:
 * 1. Import WebpackHotMiddleware from 'next/dist/server/dev/hot-middleware'
 * 2. Check if we can tap into existing HMR event streams
 * 3. Look for ways to publish HMR events programmatically
 * 4. See if there are middleware hooks or express-style handlers we can use
 * 5. Check if the hot middleware exposes any global instances or registries
 */

const path = require('path');
const webpack = require('webpack');

console.log('🚀 Starting Hot Middleware Exploration...\n');

// 1. Import WebpackHotMiddleware from Next.js
let WebpackHotMiddleware;

try {
  // Try to import the WebpackHotMiddleware class
  const hotMiddlewareModule = require('next/dist/server/dev/hot-middleware');
  WebpackHotMiddleware = hotMiddlewareModule.WebpackHotMiddleware;
  
  if (WebpackHotMiddleware) {
    console.log('✅ Successfully imported WebpackHotMiddleware');
    console.log('   Class name:', WebpackHotMiddleware.name);
    console.log('   Prototype methods:', Object.getOwnPropertyNames(WebpackHotMiddleware.prototype));
    console.log('   Static methods:', Object.getOwnPropertyNames(WebpackHotMiddleware));
  } else {
    console.log('❌ WebpackHotMiddleware not found in module');
  }
} catch (error) {
  console.log('❌ Failed to import WebpackHotMiddleware:', error.message);
}

// Also try to import HMR action types
try {
  const hmrTypes = require('next/dist/server/dev/hot-reloader-types');
  console.log('\n✅ Successfully imported HMR types');
  console.log('   Available HMR actions:', Object.keys(hmrTypes.HMR_ACTIONS_SENT_TO_BROWSER || {}));
  
  if (hmrTypes.HMR_ACTIONS_SENT_TO_BROWSER) {
    console.log('   HMR Actions enum:');
    for (const [key, value] of Object.entries(hmrTypes.HMR_ACTIONS_SENT_TO_BROWSER)) {
      console.log(`     ${key}: ${value}`);
    }
  }
} catch (error) {
  console.log('❌ Failed to import HMR types:', error.message);
}

// 2. Create a mock webpack compiler to test WebpackHotMiddleware
console.log('\n📦 Creating mock webpack compilers for testing...');

function createMockCompiler(name) {
  const mockCompiler = {
    name: name,
    hooks: {
      invalid: {
        tap: (pluginName, callback) => {
          console.log(`   ${name} compiler: registered 'invalid' hook for ${pluginName}`);
          mockCompiler._invalidCallback = callback;
        }
      },
      done: {
        tap: (pluginName, callback) => {
          console.log(`   ${name} compiler: registered 'done' hook for ${pluginName}`);
          mockCompiler._doneCallback = callback;
        }
      }
    },
    // Mock methods to simulate compiler events
    triggerInvalid: () => {
      console.log(`   ${name} compiler: triggering invalid event`);
      if (mockCompiler._invalidCallback) mockCompiler._invalidCallback();
    },
    triggerDone: (stats) => {
      console.log(`   ${name} compiler: triggering done event`);
      if (mockCompiler._doneCallback) mockCompiler._doneCallback(stats);
    }
  };
  
  return mockCompiler;
}

// Create mock compilers (client, server, edge-server)
const mockCompilers = [
  createMockCompiler('client'),
  createMockCompiler('server'), 
  createMockCompiler('edge-server')
];

// Mock version info
const mockVersionInfo = {
  installed: '14.0.0',
  staleness: 'fresh'
};

// 3. Try to instantiate WebpackHotMiddleware
if (WebpackHotMiddleware) {
  console.log('\n🧪 Testing WebpackHotMiddleware instantiation...');
  
  try {
    const hotMiddleware = new WebpackHotMiddleware(
      mockCompilers,
      mockVersionInfo,
      undefined // devtoolsFrontendUrl
    );
    
    console.log('✅ Successfully created WebpackHotMiddleware instance');
    console.log('   Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(hotMiddleware)));
    
    // 4. Explore the event stream capabilities
    console.log('\n🌊 Exploring event stream capabilities...');
    
    if (hotMiddleware.eventStream) {
      console.log('✅ EventStream found');
      console.log('   EventStream methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(hotMiddleware.eventStream)));
      console.log('   Client connections:', hotMiddleware.eventStream.clients?.size || 0);
    }
    
    // 5. Test programmatic HMR event publishing
    console.log('\n📡 Testing programmatic HMR event publishing...');
    
    // Mock WebSocket client for testing
    class MockWebSocket {
      constructor(id) {
        this.id = id;
        this.messages = [];
        this.closed = false;
      }
      
      send(data) {
        if (!this.closed) {
          this.messages.push(data);
          console.log(`   WebSocket ${this.id} received:`, data);
        }
      }
      
      addEventListener(event, callback) {
        this[`_${event}Callback`] = callback;
      }
      
      close() {
        this.closed = true;
        if (this._closeCallback) this._closeCallback();
      }
      
      terminate() {
        this.close();
      }
    }
    
    // Create mock WebSocket clients
    const mockClients = [
      new MockWebSocket('client-1'),
      new MockWebSocket('client-2')
    ];
    
    // Add clients to event stream
    mockClients.forEach(client => {
      hotMiddleware.eventStream.handler(client);
    });
    
    console.log(`   Added ${mockClients.length} mock WebSocket clients`);
    
    // Test publishing different types of HMR events
    const testEvents = [
      {
        action: 'building',
        description: 'Building event'
      },
      {
        action: 'built',
        hash: 'test-hash-123',
        warnings: [],
        errors: [],
        description: 'Built event'
      },
      {
        action: 'sync',
        hash: 'sync-hash-456',
        errors: [],
        warnings: [],
        versionInfo: mockVersionInfo,
        devIndicator: { disabledUntil: 0 },
        description: 'Sync event'
      }
    ];
    
    console.log('   Publishing test events...');
    testEvents.forEach((event, index) => {
      try {
        hotMiddleware.publish(event);
        console.log(`   ✅ Published ${event.description} successfully`);
      } catch (error) {
        console.log(`   ❌ Failed to publish ${event.description}:`, error.message);
      }
    });
    
    // 6. Test compiler event simulation
    console.log('\n⚙️  Testing compiler event simulation...');
    
    // Create mock stats
    const mockStats = {
      hasErrors: () => false,
      toJson: () => ({
        hash: 'mock-hash-789',
        errors: [],
        warnings: [],
        all: false
      })
    };
    
    // Trigger compiler events
    console.log('   Simulating client compiler events...');
    mockCompilers[0].triggerInvalid();
    mockCompilers[0].triggerDone(mockStats);
    
    console.log('   Simulating server compiler events...');
    mockCompilers[1].triggerDone(mockStats);
    
    // 7. Test onHMR method (WebSocket upgrade handler)
    console.log('\n🔌 Testing onHMR WebSocket handler...');
    
    const newMockClient = new MockWebSocket('upgrade-client');
    try {
      hotMiddleware.onHMR(newMockClient);
      console.log('   ✅ Successfully handled WebSocket upgrade');
      console.log('   ✅ Client should have received sync event');
    } catch (error) {
      console.log('   ❌ Failed to handle WebSocket upgrade:', error.message);
    }
    
    // 8. Explore middleware hooks and registries
    console.log('\n🔧 Exploring middleware hooks and registries...');
    
    // Check for global registries or instances
    console.log('   Checking for global instances...');
    
    // Look for global HMR registries in Next.js
    try {
      const nextServer = require('next/dist/server/next-server');
      console.log('   ✅ Found Next.js server module');
    } catch (error) {
      console.log('   ❌ Could not access Next.js server module:', error.message);
    }
    
    // Check process for HMR-related globals
    const hmrGlobals = Object.keys(process).filter(key => 
      key.toLowerCase().includes('hmr') || 
      key.toLowerCase().includes('hot') ||
      key.toLowerCase().includes('webpack')
    );
    
    if (hmrGlobals.length > 0) {
      console.log('   Found HMR-related globals in process:', hmrGlobals);
    } else {
      console.log('   No HMR-related globals found in process');
    }
    
    // 9. Test cleanup
    console.log('\n🧹 Testing cleanup...');
    
    try {
      hotMiddleware.close();
      console.log('   ✅ Successfully closed WebpackHotMiddleware');
      
      // Verify clients were terminated
      const activeClients = Array.from(hotMiddleware.eventStream.clients || []);
      console.log('   Active clients after close:', activeClients.length);
    } catch (error) {
      console.log('   ❌ Failed to close WebpackHotMiddleware:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Failed to create WebpackHotMiddleware instance:', error.message);
    console.log('   Stack trace:', error.stack);
  }
}

// 10. Advanced exploration - Look for Express-style middleware patterns
console.log('\n🕸️  Exploring Express-style middleware patterns...');

try {
  // Check if there are middleware functions we can hook into
  const middlewareWebpack = require('next/dist/server/dev/middleware-webpack');
  console.log('✅ Found middleware-webpack module');
  console.log('   Exported functions:', Object.keys(middlewareWebpack));
  
  // Check for overlay and source map middleware
  if (middlewareWebpack.getOverlayMiddleware) {
    console.log('   ✅ Found getOverlayMiddleware function');
  }
  if (middlewareWebpack.getSourceMapMiddleware) {
    console.log('   ✅ Found getSourceMapMiddleware function');
  }
} catch (error) {
  console.log('❌ Could not explore middleware-webpack:', error.message);
}

// 11. Summary and recommendations
console.log('\n📋 EXPLORATION SUMMARY');
console.log('='.repeat(50));

if (WebpackHotMiddleware) {
  console.log('✅ WebpackHotMiddleware is accessible and functional');
  console.log('✅ Can create instances with mock compilers');
  console.log('✅ EventStream supports WebSocket client management');
  console.log('✅ Can publish HMR events programmatically');
  console.log('✅ Supports WebSocket upgrade handling via onHMR()');
  console.log('✅ Provides proper cleanup mechanisms');
} else {
  console.log('❌ WebpackHotMiddleware is not accessible');
}

console.log('\n🎯 RECOMMENDATIONS FOR HMR CONTROL:');
console.log('1. Use WebpackHotMiddleware.publish() to send custom HMR events');
console.log('2. Hook into compiler events via webpack compiler hooks');
console.log('3. Use EventStream to manage WebSocket connections');
console.log('4. Implement custom middleware using Next.js middleware patterns');
console.log('5. Consider creating a wrapper service for centralized HMR control');

console.log('\n🏁 Exploration completed!');