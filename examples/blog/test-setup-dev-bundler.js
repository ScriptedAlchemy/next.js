#!/usr/bin/env node

const path = require('path');
const { setupDevBundler } = require('next/dist/server/lib/router-utils/setup-dev-bundler');
const { setupFsCheck } = require('next/dist/server/lib/router-utils/filesystem');
const { default: loadNextConfig } = require('next/dist/server/config');
const { Telemetry } = require('next/dist/telemetry/storage');

async function testSetupDevBundler() {
  console.log('Testing setupDevBundler function...');
  
  try {
    const dir = process.cwd();
    console.log('Working directory:', dir);
    
    // Load Next.js config
    console.log('Loading Next.js config...');
    const nextConfig = await loadNextConfig('development', dir);
    console.log('Next.js config loaded');
    
    // Setup filesystem checker
    console.log('Setting up filesystem checker...');
    const fsChecker = await setupFsCheck({
      dir,
      dev: true,
      config: nextConfig,
    });
    console.log('Filesystem checker setup complete');
    
    // Create telemetry instance
    const telemetry = new Telemetry({ distDir: nextConfig.distDir });
    
    // Try to create a minimal render server instance
    const renderServer = {
      instance: null
    };
    
    // Check if directories exist
    const fs = require('fs');
    const pagesDir = path.join(dir, 'pages');
    const appDir = path.join(dir, 'app');
    
    console.log('Checking directories...');
    console.log('Pages dir exists:', fs.existsSync(pagesDir));
    console.log('App dir exists:', fs.existsSync(appDir));
    
    // Setup options for setupDevBundler
    const setupOpts = {
      renderServer,
      dir,
      turbo: false, // Use webpack instead of turbopack
      appDir: fs.existsSync(appDir) ? appDir : undefined,
      pagesDir: fs.existsSync(pagesDir) ? pagesDir : undefined,
      telemetry,
      isCustomServer: false,
      fsChecker,
      nextConfig,
      port: 3000,
      onDevServerCleanup: (callback) => {
        console.log('Dev server cleanup registered');
      },
      resetFetch: () => {
        console.log('Reset fetch called');
      }
    };
    
    console.log('Calling setupDevBundler...');
    const devBundler = await setupDevBundler(setupOpts);
    
    console.log('setupDevBundler successful!');
    console.log('Available properties:', Object.keys(devBundler));
    
    // Test hotReloader access
    if (devBundler.hotReloader) {
      console.log('✅ hotReloader is available!');
      console.log('hotReloader methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(devBundler.hotReloader)));
      
      // Try to access some HMR functionality
      if (typeof devBundler.hotReloader.invalidate === 'function') {
        console.log('✅ hotReloader.invalidate method is available');
      }
      
      if (typeof devBundler.hotReloader.ensurePage === 'function') {
        console.log('✅ hotReloader.ensurePage method is available');
      }
      
      // Test invalidating a page (this should be safe)
      try {
        console.log('Testing page invalidation...');
        await devBundler.hotReloader.invalidate({
          client: true,
          server: true
        });
        console.log('✅ Page invalidation successful');
      } catch (err) {
        console.log('⚠️ Page invalidation failed:', err.message);
      }
      
    } else {
      console.log('❌ hotReloader is not available');
    }
    
    // Test serverFields
    if (devBundler.serverFields) {
      console.log('✅ serverFields is available');
      console.log('serverFields keys:', Object.keys(devBundler.serverFields));
    }
    
    return devBundler;
    
  } catch (error) {
    console.error('Error in setupDevBundler test:', error);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

// Run the test
testSetupDevBundler()
  .then((result) => {
    if (result) {
      console.log('\n🎉 Test completed successfully!');
      console.log('You now have access to the Next.js dev bundler and hotReloader!');
    } else {
      console.log('\n❌ Test failed');
    }
    process.exit(result ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });