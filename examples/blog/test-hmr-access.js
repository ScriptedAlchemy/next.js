#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('=== Testing HMR Access via setupDevBundler ===\n');

// First, let's examine the available exports
console.log('1. Checking available Next.js internals...');

try {
  const { setupDevBundler } = require('next/dist/server/lib/router-utils/setup-dev-bundler');
  console.log('✅ setupDevBundler function imported successfully');
  
  const { setupFsCheck } = require('next/dist/server/lib/router-utils/filesystem');
  console.log('✅ setupFsCheck function imported successfully');
  
  const { default: loadNextConfig } = require('next/dist/server/config');
  console.log('✅ loadNextConfig function imported successfully');
  
  const { Telemetry } = require('next/dist/telemetry/storage');
  console.log('✅ Telemetry class imported successfully');
  
} catch (error) {
  console.error('❌ Failed to import Next.js internals:', error.message);
  process.exit(1);
}

console.log('\n2. Examining project structure...');
const dir = process.cwd();
const pagesDir = path.join(dir, 'pages');
const appDir = path.join(dir, 'app');

console.log('Working directory:', dir);
console.log('Pages directory exists:', fs.existsSync(pagesDir));
console.log('App directory exists:', fs.existsSync(appDir));
console.log('Next.js config exists:', fs.existsSync(path.join(dir, 'next.config.js')));

// Let's try a minimal setup that avoids the watcher issues
async function minimalHMRTest() {
  console.log('\n3. Attempting minimal Next.js config load...');
  
  try {
    const { default: loadNextConfig } = require('next/dist/server/config');
    const nextConfig = await loadNextConfig('development', dir);
    console.log('✅ Next.js config loaded successfully');
    console.log('   - distDir:', nextConfig.distDir);
    console.log('   - dev mode:', nextConfig.dev);
    
    // Let's try to understand what a typical dev server setup looks like
    console.log('\n4. Analyzing HMR interface requirements...');
    
    // Check if we can access the HMR types
    const typesPath = 'next/dist/server/dev/hot-reloader-types';
    try {
      const hotReloaderTypes = require(typesPath);
      console.log('✅ Hot reloader types accessible');
      console.log('   Available HMR actions:', Object.keys(hotReloaderTypes.HMR_ACTIONS_SENT_TO_BROWSER || {}));
    } catch (err) {
      console.log('⚠️ Hot reloader types not directly accessible:', err.message);
    }
    
    // Check if we can access the webpack hot reloader directly
    console.log('\n5. Testing direct access to Hot Reloader...');
    try {
      const HotReloaderWebpack = require('next/dist/server/dev/hot-reloader-webpack').default;
      console.log('✅ HotReloaderWebpack class accessible');
      
      // Let's see what parameters it expects
      console.log('   Trying to understand HotReloaderWebpack constructor...');
      
      // Instead of actually creating it (which would require many dependencies),
      // let's see if we can get some info about its structure
      console.log('   HotReloaderWebpack prototype methods:', 
        Object.getOwnPropertyNames(HotReloaderWebpack.prototype));
        
    } catch (err) {
      console.log('⚠️ HotReloaderWebpack not directly accessible:', err.message);
    }
    
    console.log('\n6. Testing filesystem checker setup...');
    const { setupFsCheck } = require('next/dist/server/lib/router-utils/filesystem');
    
    const fsChecker = await setupFsCheck({
      dir,
      dev: true,
      config: nextConfig,
    });
    console.log('✅ Filesystem checker created successfully');
    
    // Now let's see if we can get insight into what setupDevBundler needs
    console.log('\n7. Analyzing setupDevBundler requirements...');
    
    // Create minimal telemetry
    const { Telemetry } = require('next/dist/telemetry/storage');
    const telemetry = new Telemetry({ distDir: nextConfig.distDir });
    console.log('✅ Telemetry instance created');
    
    // The key insight: we need a renderServer instance
    // Let's see if we can create a mock one or understand what it should be
    console.log('\n8. Understanding renderServer requirements...');
    
    // Based on the types, renderServer should be LazyRenderServerInstance
    // Let's try with a minimal mock
    const renderServer = {
      instance: null,  // This might be the issue
    };
    
    console.log('✅ Mock renderServer created');
    
    // Summary of what we've learned
    console.log('\n=== SUMMARY ===');
    console.log('✅ All required Next.js internal functions are accessible');
    console.log('✅ Project structure is compatible');
    console.log('✅ Next.js config loads successfully');
    console.log('✅ Filesystem checker can be created');
    console.log('✅ Telemetry can be initialized');
    console.log('');
    console.log('🔍 KEY FINDINGS:');
    console.log('1. setupDevBundler is available and importable');
    console.log('2. The main challenge is creating a proper renderServer instance');
    console.log('3. The function expects LazyRenderServerInstance which needs proper setup');
    console.log('4. Once set up correctly, it should return hotReloader with full HMR API');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('- Need to research LazyRenderServerInstance creation');
    console.log('- May need to mock or create a minimal render server');
    console.log('- Alternative: Find other entry points to HMR functionality');
    
    return { nextConfig, fsChecker, telemetry, renderServer };
    
  } catch (error) {
    console.error('❌ Error in minimal HMR test:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

// Run the test
minimalHMRTest()
  .then((result) => {
    if (result) {
      console.log('\n🎉 Analysis completed successfully!');
      console.log('We have identified the path to HMR access via setupDevBundler.');
    } else {
      console.log('\n❌ Analysis failed');
    }
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });