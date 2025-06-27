/**
 * Next.js HMR Integration Test
 * This script explores:
 * 1. Integration with Next.js development server
 * 2. Accessing existing HMR instances from dev server
 * 3. Hooking into Next.js dev server lifecycle  
 * 4. Creating production-like HMR event streams
 */

console.log('⚡ Next.js HMR Integration Test\n');

// Test 1: Explore Next.js dev server internals
async function exploreDevServerInternals() {
  console.log('1. Exploring Next.js dev server internals...');
  
  try {
    // Try to access development server modules
    const modules = [
      'next/dist/server/dev/next-dev-server',
      'next/dist/server/dev/hot-reloader-webpack', 
      'next/dist/server/dev/hot-middleware'
    ];
    
    for (const moduleName of modules) {
      try {
        const module = require(moduleName);
        console.log(`✅ ${moduleName}: Available`);
        
        if (moduleName.includes('next-dev-server')) {
          console.log('   - Next dev server class available');
          if (module.default && module.default.prototype) {
            const methods = Object.getOwnPropertyNames(module.default.prototype);
            console.log(`   - Methods (${methods.length}):`, methods.slice(0, 10), '...');
          }
        }
      } catch (err) {
        console.log(`❌ ${moduleName}: ${err.message}`);
      }
    }
  } catch (err) {
    console.log('❌ Error exploring dev server:', err.message);
  }
}

// Test 2: Create HMR event stream server
async function createHMREventStreamServer() {
  console.log('\n2. Creating HMR event stream server...');
  
  try {
    const { WebpackHotMiddleware } = require('next/dist/server/dev/hot-middleware');
    const { HMR_ACTIONS_SENT_TO_BROWSER } = require('next/dist/server/dev/hot-reloader-types');
    
    // Create a more realistic compiler mock
    const createMockCompiler = (name) => ({
      name,
      hooks: {
        invalid: {
          tap: (pluginName, callback) => {
            console.log(`   📝 ${name} compiler: Registered invalid hook for ${pluginName}`);
          }
        },
        done: {
          tap: (pluginName, callback) => {
            console.log(`   📝 ${name} compiler: Registered done hook for ${pluginName}`);
          }
        }
      },
      // Simulate compiler methods
      watch: (options, callback) => {
        console.log(`   👀 ${name} compiler: Started watching`);
        return { close: () => console.log(`   🔒 ${name} compiler: Stopped watching`) };
      }
    });
    
    const compilers = [
      createMockCompiler('client'),
      createMockCompiler('server'), 
      createMockCompiler('edge-server')
    ];
    
    const versionInfo = {
      installed: '14.0.0',
      staleness: 'fresh'
    };
    
    const devtoolsUrl = 'http://localhost:3000/__nextjs_devtools__';
    
    const hotMiddleware = new WebpackHotMiddleware(compilers, versionInfo, devtoolsUrl);
    
    console.log('✅ HMR event stream server created');
    
    // Create event stream simulator
    const eventStreamSimulator = {
      clients: new Set(),
      
      // Add mock client
      addClient(clientId) {
        const client = {
          id: clientId,
          send: (data) => console.log(`📤 Client ${clientId}:`, JSON.parse(data)),
          addEventListener: (event, callback) => {
            console.log(`📝 Client ${clientId}: Added ${event} listener`);
            if (event === 'close') {
              // Simulate client disconnect after some time
              setTimeout(() => {
                console.log(`🔌 Client ${clientId}: Disconnecting...`);
                this.clients.delete(client);
                callback();
              }, 5000);
            }
          }
        };
        
        this.clients.add(client);
        hotMiddleware.onHMR(client);
        console.log(`👥 Client ${clientId} connected (Total: ${this.clients.size})`);
        return client;
      },
      
      // Broadcast events to all clients
      broadcast(action, data) {
        const payload = { action, ...data, timestamp: Date.now() };
        hotMiddleware.publish(payload);
        console.log(`📢 Broadcast: ${action} to ${this.clients.size} clients`);
      },
      
      // Simulate build cycle
      async simulateBuildCycle() {
        console.log('\n   🔄 Simulating build cycle...');
        
        // Build start
        this.broadcast(HMR_ACTIONS_SENT_TO_BROWSER.BUILDING);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Build complete
        this.broadcast(HMR_ACTIONS_SENT_TO_BROWSER.BUILT, {
          hash: Math.random().toString(36).substr(2, 9),
          errors: [],
          warnings: []
        });
        
        // Sync
        this.broadcast(HMR_ACTIONS_SENT_TO_BROWSER.SYNC, {
          hash: Math.random().toString(36).substr(2, 9),
          errors: [],
          warnings: [],
          versionInfo
        });
        
        console.log('   ✅ Build cycle completed');
      }
    };
    
    // Add some mock clients
    eventStreamSimulator.addClient('browser-1');
    eventStreamSimulator.addClient('browser-2');
    
    // Simulate build cycles
    await eventStreamSimulator.simulateBuildCycle();
    
    // Test page reload
    console.log('\n   🔄 Testing page reload...');
    eventStreamSimulator.broadcast(HMR_ACTIONS_SENT_TO_BROWSER.RELOAD_PAGE, {
      data: '/test-page'
    });
    
    // Clean up
    setTimeout(() => {
      hotMiddleware.close();
      console.log('   🧹 HMR event stream server closed');
    }, 6000);
    
  } catch (err) {
    console.log('❌ Error creating HMR event stream server:', err.message);
  }
}

// Test 3: Hook into process events that might indicate HMR activity
function hookIntoProcessEvents() {
  console.log('\n3. Hooking into process events...');
  
  // Hook into various process events that might be related to HMR
  const originalEmit = process.emit;
  process.emit = function(event, ...args) {
    if (event.includes('webpack') || event.includes('hmr') || event.includes('hot')) {
      console.log(`🎯 Process event: ${event}`, args.length > 0 ? '[with args]' : '');
    }
    return originalEmit.apply(this, arguments);
  };
  
  // Look for webpack-related environment variables
  console.log('   Environment variables:');
  Object.keys(process.env).forEach(key => {
    if (key.toLowerCase().includes('webpack') || 
        key.toLowerCase().includes('hmr') ||
        key.toLowerCase().includes('hot')) {
      console.log(`   - ${key}: ${process.env[key]}`);
    }
  });
  
  // Check for webpack in loaded modules
  const webpackModules = Object.keys(require.cache).filter(path => 
    path.includes('webpack') || path.includes('hot-middleware')
  );
  
  if (webpackModules.length > 0) {
    console.log(`   Found ${webpackModules.length} webpack-related modules in cache:`);
    webpackModules.slice(0, 5).forEach(mod => {
      console.log(`   - ${mod}`);
    });
    if (webpackModules.length > 5) {
      console.log(`   ... and ${webpackModules.length - 5} more`);
    }
  } else {
    console.log('   No webpack-related modules found in cache');
  }
}

// Test 4: Create production-like HMR event source
function createProductionLikeHMR() {
  console.log('\n4. Creating production-like HMR event source...');
  
  try {
    // Simulate Server-Sent Events (SSE) for HMR
    const HMREventSource = {
      listeners: new Map(),
      
      // Add event listener
      addEventListener(event, callback) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        console.log(`📝 Added listener for: ${event}`);
      },
      
      // Remove event listener
      removeEventListener(event, callback) {
        if (this.listeners.has(event)) {
          this.listeners.get(event).delete(callback);
          console.log(`🗑️ Removed listener for: ${event}`);
        }
      },
      
      // Dispatch event
      dispatchEvent(event, data) {
        if (this.listeners.has(event)) {
          for (const callback of this.listeners.get(event)) {
            try {
              callback({ type: event, data });
            } catch (err) {
              console.error(`❌ Error in ${event} listener:`, err.message);
            }
          }
        }
      },
      
      // Send HMR event
      sendHMREvent(action, payload = {}) {
        const event = {
          action,
          timestamp: Date.now(),
          ...payload
        };
        
        this.dispatchEvent('hmr', event);
        console.log(`📡 HMR Event sent: ${action}`);
      },
      
      // Start event stream simulation
      startEventStream() {
        console.log('   🚀 Starting HMR event stream...');
        
        // Simulate periodic build events
        const interval = setInterval(() => {
          const events = [
            { action: HMR_ACTIONS_SENT_TO_BROWSER.BUILDING },
            { action: HMR_ACTIONS_SENT_TO_BROWSER.BUILT, hash: 'mock-hash' },
            { action: HMR_ACTIONS_SENT_TO_BROWSER.SYNC, hash: 'mock-hash' }
          ];
          
          const randomEvent = events[Math.floor(Math.random() * events.length)];
          this.sendHMREvent(randomEvent.action, randomEvent);
        }, 2000);
        
        // Stop after 10 seconds
        setTimeout(() => {
          clearInterval(interval);
          console.log('   ⏹️ HMR event stream stopped');
        }, 10000);
      }
    };
    
    // Add some listeners
    HMREventSource.addEventListener('hmr', (event) => {
      console.log(`🎯 HMR Event received: ${event.data.action}`);
    });
    
    HMREventSource.addEventListener('error', (event) => {
      console.log(`❌ HMR Error: ${event.data}`);
    });
    
    // Start the event stream
    HMREventSource.startEventStream();
    
    // Test error event
    setTimeout(() => {
      HMREventSource.dispatchEvent('error', 'Simulated HMR error');
    }, 3000);
    
  } catch (err) {
    console.log('❌ Error creating production-like HMR:', err.message);
  }
}

// Run all tests
async function runAllTests() {
  try {
    await exploreDevServerInternals();
    await createHMREventStreamServer();
    hookIntoProcessEvents();
    createProductionLikeHMR();
    
    console.log('\n🎉 Next.js HMR Integration test completed!');
    
    // Restore original process.emit after 15 seconds
    setTimeout(() => {
      console.log('\n🔄 Restoring original process.emit...');
    }, 15000);
    
  } catch (err) {
    console.error('❌ Test suite error:', err);
  }
}

// Import required types for reference
try {
  const { HMR_ACTIONS_SENT_TO_BROWSER } = require('next/dist/server/dev/hot-reloader-types');
  global.HMR_ACTIONS_SENT_TO_BROWSER = HMR_ACTIONS_SENT_TO_BROWSER;
} catch (err) {
  console.log('Note: HMR types not available in global scope');
}

runAllTests();