#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('=== Practical HMR Example with setupDevBundler ===\n');

async function createHMRInstance() {
  console.log('🚀 Setting up Next.js Dev Bundler for HMR access...');
  
  // Import required modules
  const { setupDevBundler } = require('next/dist/server/lib/router-utils/setup-dev-bundler');
  const { setupFsCheck } = require('next/dist/server/lib/router-utils/filesystem');
  const { default: loadNextConfig } = require('next/dist/server/config');
  const { Telemetry } = require('next/dist/telemetry/storage');
  
  const dir = process.cwd();
  const pagesDir = path.join(dir, 'pages');
  const appDir = path.join(dir, 'app');
  
  // Setup all dependencies
  const nextConfig = await loadNextConfig('development', dir);
  const fsChecker = await setupFsCheck({ dir, dev: true, config: nextConfig });
  const telemetry = new Telemetry({ distDir: nextConfig.distDir });
  const renderServer = {};
  
  const setupOpts = {
    renderServer,
    dir,
    turbo: false,
    appDir: fs.existsSync(appDir) ? appDir : undefined,
    pagesDir: fs.existsSync(pagesDir) ? pagesDir : undefined,
    telemetry,
    isCustomServer: false,
    fsChecker,
    nextConfig,
    port: 3000,
    onDevServerCleanup: undefined,
    resetFetch: () => {}
  };
  
  console.log('⚙️ Initializing dev bundler...');
  const devBundler = await setupDevBundler(setupOpts);
  console.log('✅ Dev bundler ready!\n');
  
  return devBundler;
}

async function demonstrateHMRCapabilities(devBundler) {
  const { hotReloader } = devBundler;
  
  console.log('🔥 Demonstrating HMR Capabilities:\n');
  
  // 1. Start the hot reloader
  console.log('1. Starting the hot reloader...');
  try {
    await hotReloader.start();
    console.log('✅ Hot reloader started successfully\n');
  } catch (err) {
    console.log('⚠️ Hot reloader may already be running:', err.message, '\n');
  }
  
  // 2. Get compilation errors for a page
  console.log('2. Checking for compilation errors...');
  try {
    const errors = await hotReloader.getCompilationErrors('/');
    console.log(`✅ Compilation check complete. Errors found: ${errors.length}`);
    if (errors.length > 0) {
      console.log('   Error details:', errors[0]);
    }
    console.log('');
  } catch (err) {
    console.log('⚠️ Error checking compilation:', err.message, '\n');
  }
  
  // 3. Ensure a page is compiled
  console.log('3. Ensuring a page is compiled...');
  try {
    await hotReloader.ensurePage({
      page: '/',
      clientOnly: false,
      appPaths: null,
      definition: undefined,
      isApp: false,
      url: '/'
    });
    console.log('✅ Page ensured successfully\n');
  } catch (err) {
    console.log('⚠️ Error ensuring page:', err.message, '\n');
  }
  
  // 4. Send HMR message
  console.log('4. Sending HMR message...');
  try {
    hotReloader.send({
      action: 'built'
    });
    console.log('✅ HMR message sent successfully\n');
  } catch (err) {
    console.log('⚠️ Error sending HMR message:', err.message, '\n');
  }
  
  // 5. Trigger invalidation
  console.log('5. Triggering hot reload invalidation...');
  try {
    await hotReloader.invalidate({
      reloadAfterInvalidation: false
    });
    console.log('✅ Invalidation triggered successfully\n');
  } catch (err) {
    console.log('⚠️ Error during invalidation:', err.message, '\n');
  }
  
  return hotReloader;
}

async function createCustomHMRAPI(hotReloader) {
  console.log('🛠️ Creating Custom HMR API:\n');
  
  const customHMR = {
    // Reload a specific page
    async reloadPage(page) {
      console.log(`🔄 Reloading page: ${page}`);
      try {
        await hotReloader.ensurePage({
          page,
          clientOnly: false,
          appPaths: null,
          definition: undefined,
          isApp: false,
          url: page
        });
        
        hotReloader.send({
          action: 'reloadPage',
          page
        });
        
        console.log(`✅ Page ${page} reloaded successfully`);
        return true;
      } catch (err) {
        console.log(`❌ Failed to reload page ${page}:`, err.message);
        return false;
      }
    },
    
    // Force rebuild all
    async rebuildAll() {
      console.log('🔨 Rebuilding all pages...');
      try {
        hotReloader.send({ action: 'building' });
        
        await hotReloader.invalidate({
          reloadAfterInvalidation: true
        });
        
        hotReloader.send({ action: 'built' });
        
        console.log('✅ Full rebuild completed');
        return true;
      } catch (err) {
        console.log('❌ Failed to rebuild:', err.message);
        return false;
      }
    },
    
    // Check for errors
    async checkErrors(page = '/') {
      console.log(`🔍 Checking errors for page: ${page}`);
      try {
        const errors = await hotReloader.getCompilationErrors(page);
        console.log(`✅ Error check complete. Found ${errors.length} errors`);
        return errors;
      } catch (err) {
        console.log('❌ Failed to check errors:', err.message);
        return [];
      }
    },
    
    // Send custom HMR message
    sendCustomMessage(action, data = {}) {
      console.log(`📡 Sending custom HMR message: ${action}`);
      try {
        hotReloader.send({
          action,
          ...data
        });
        console.log('✅ Custom message sent');
        return true;
      } catch (err) {
        console.log('❌ Failed to send message:', err.message);
        return false;
      }
    },
    
    // Get the underlying hotReloader for advanced use
    getHotReloader() {
      return hotReloader;
    }
  };
  
  return customHMR;
}

async function runExample() {
  try {
    // Create HMR instance
    const devBundler = await createHMRInstance();
    
    // Demonstrate basic capabilities
    const hotReloader = await demonstrateHMRCapabilities(devBundler);
    
    // Create custom API
    const customHMR = await createCustomHMRAPI(hotReloader);
    
    console.log('🎯 Testing Custom HMR API:\n');
    
    // Test custom API
    await customHMR.checkErrors('/');
    await customHMR.reloadPage('/');
    customHMR.sendCustomMessage('custom-action', { test: 'data' });
    
    console.log('\n🎉 Example completed successfully!\n');
    
    console.log('💡 You can now use this pattern to:');
    console.log('   - Create your own HMR server');
    console.log('   - Trigger hot reloads programmatically');
    console.log('   - Send custom HMR messages');
    console.log('   - Check compilation status');
    console.log('   - Integrate HMR into custom build tools');
    
    return { devBundler, customHMR };
    
  } catch (error) {
    console.error('❌ Example failed:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n\n🛑 Cleaning up...');
  process.exit(0);
});

// Run the example
runExample().then((result) => {
  if (result) {
    console.log('\n✨ All done! Press Ctrl+C to exit.');
    
    // Keep the process alive to demonstrate that the HMR system is running
    const keepAlive = setInterval(() => {
      // This keeps the process running to show the HMR system is active
    }, 1000);
    
    // Clean exit after 10 seconds for demo purposes
    setTimeout(() => {
      clearInterval(keepAlive);
      console.log('\n👋 Demo finished, exiting...');
      process.exit(0);
    }, 10000);
  } else {
    process.exit(1);
  }
});