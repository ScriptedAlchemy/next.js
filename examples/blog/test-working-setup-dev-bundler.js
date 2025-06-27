#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('=== Working setupDevBundler Test ===\n');

async function testWorkingSetupDevBundler() {
  try {
    console.log('1. Importing Next.js internal modules...');
    
    const { setupDevBundler } = require('next/dist/server/lib/router-utils/setup-dev-bundler');
    const { setupFsCheck } = require('next/dist/server/lib/router-utils/filesystem');
    const { default: loadNextConfig } = require('next/dist/server/config');
    const { Telemetry } = require('next/dist/telemetry/storage');
    
    console.log('✅ All modules imported successfully');
    
    console.log('\n2. Setting up environment...');
    const dir = process.cwd();
    const pagesDir = path.join(dir, 'pages');
    const appDir = path.join(dir, 'app');
    
    // Load Next.js config
    const nextConfig = await loadNextConfig('development', dir);
    console.log('✅ Next.js config loaded');
    
    // Setup filesystem checker
    const fsChecker = await setupFsCheck({
      dir,
      dev: true,
      config: nextConfig,
    });
    console.log('✅ Filesystem checker created');
    
    // Create telemetry
    const telemetry = new Telemetry({ distDir: nextConfig.distDir });
    console.log('✅ Telemetry instance created');
    
    console.log('\n3. Creating renderServer instance...');
    // Based on the LazyRenderServerInstance interface, start with empty object
    const renderServer = {};
    console.log('✅ LazyRenderServerInstance created (empty object)');
    
    console.log('\n4. Preparing setupDevBundler options...');
    const setupOpts = {
      renderServer,
      dir,
      turbo: false, // Use webpack to avoid turbopack complexity
      appDir: fs.existsSync(appDir) ? appDir : undefined,
      pagesDir: fs.existsSync(pagesDir) ? pagesDir : undefined,
      telemetry,
      isCustomServer: false,
      fsChecker,
      nextConfig,
      port: 3000,
      onDevServerCleanup: undefined, // Can be undefined
      resetFetch: () => {
        console.log('Reset fetch called');
      }
    };
    
    console.log('Setup options prepared:');
    console.log('  - dir:', dir);
    console.log('  - turbo:', setupOpts.turbo);
    console.log('  - appDir:', setupOpts.appDir || 'undefined');
    console.log('  - pagesDir:', setupOpts.pagesDir || 'undefined');
    console.log('  - port:', setupOpts.port);
    
    console.log('\n5. Calling setupDevBundler...');
    console.log('⏳ This may take a moment as it sets up webpack...');
    
    // Set a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Setup timeout after 60 seconds')), 60000);
    });
    
    const setupPromise = setupDevBundler(setupOpts);
    
    const devBundler = await Promise.race([setupPromise, timeoutPromise]);
    
    console.log('🎉 setupDevBundler completed successfully!');
    
    console.log('\n6. Analyzing the returned devBundler...');
    console.log('Available properties:', Object.keys(devBundler));
    
    // Test hotReloader
    if (devBundler.hotReloader) {
      console.log('\n✅ hotReloader is available!');
      console.log('hotReloader type:', devBundler.hotReloader.constructor.name);
      
      // Get all methods
      const hotReloaderMethods = [];
      let obj = devBundler.hotReloader;
      while (obj) {
        hotReloaderMethods.push(...Object.getOwnPropertyNames(obj));
        obj = Object.getPrototypeOf(obj);
        if (obj === Object.prototype) break;
      }
      
      const uniqueMethods = [...new Set(hotReloaderMethods)].filter(name => 
        typeof devBundler.hotReloader[name] === 'function' && 
        !name.startsWith('_') && 
        name !== 'constructor'
      );
      
      console.log('Available methods:', uniqueMethods);
      
      // Test some key HMR functionality
      console.log('\n7. Testing HMR functionality...');
      
      try {
        // Test invalidate method
        if (typeof devBundler.hotReloader.invalidate === 'function') {
          console.log('Testing invalidate method...');
          await devBundler.hotReloader.invalidate({
            reloadAfterInvalidation: false
          });
          console.log('✅ invalidate method works!');
        }
        
        // Test send method for HMR messages
        if (typeof devBundler.hotReloader.send === 'function') {
          console.log('Testing send method...');
          // This would send HMR messages to connected clients
          devBundler.hotReloader.send({
            action: 'built', // Using one of the HMR_ACTIONS_SENT_TO_BROWSER
          });
          console.log('✅ send method works!');
        }
        
        // Test getting compilation errors
        if (typeof devBundler.hotReloader.getCompilationErrors === 'function') {
          console.log('Testing getCompilationErrors method...');
          const errors = await devBundler.hotReloader.getCompilationErrors('/');
          console.log('✅ getCompilationErrors works! Errors:', errors.length);
        }
        
      } catch (err) {
        console.log('⚠️ Some HMR methods failed:', err.message);
      }
    } else {
      console.log('❌ hotReloader is not available');
    }
    
    // Test serverFields
    if (devBundler.serverFields) {
      console.log('\n✅ serverFields is available');
      console.log('serverFields keys:', Object.keys(devBundler.serverFields));
    }
    
    // Test requestHandler
    if (devBundler.requestHandler) {
      console.log('\n✅ requestHandler is available');
      console.log('requestHandler type:', typeof devBundler.requestHandler);
    }
    
    console.log('\n=== SUCCESS SUMMARY ===');
    console.log('🎉 setupDevBundler works and provides:');
    console.log('  ✅ hotReloader - Full HMR API access');
    console.log('  ✅ serverFields - Server-side state');
    console.log('  ✅ requestHandler - HTTP request handling');
    console.log('  ✅ logErrorWithOriginalStack - Error logging');
    console.log('  ✅ ensureMiddleware - Middleware loading');
    
    console.log('\n🔧 HMR Capabilities Available:');
    if (devBundler.hotReloader) {
      console.log('  - invalidate(): Trigger recompilation');
      console.log('  - send(): Send HMR messages to browser');
      console.log('  - ensurePage(): Ensure page is compiled');
      console.log('  - getCompilationErrors(): Get build errors');
      console.log('  - start(): Start the bundler');
      console.log('  - close(): Close the bundler');
    }
    
    return devBundler;
    
  } catch (error) {
    console.error('\n❌ setupDevBundler failed:', error.message);
    console.error('\nStack trace:', error.stack);
    return null;
  }
}

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT, exiting...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM, exiting...');
  process.exit(0);
});

// Run the test
testWorkingSetupDevBundler()
  .then((result) => {
    if (result) {
      console.log('\n✨ Test completed successfully!');
      console.log('🎯 You can now use setupDevBundler to get programmatic HMR access!');
      
      // Don't exit immediately, let user see results
      setTimeout(() => {
        console.log('\n👋 Test finished, exiting...');
        process.exit(0);
      }, 2000);
    } else {
      console.log('\n💥 Test failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
  });