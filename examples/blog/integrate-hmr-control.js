/**
 * Integration Example: HMR Control with Next.js Dev Server
 * 
 * This example demonstrates how to integrate the HMR Control Service
 * with a real Next.js development server to gain programmatic control
 * over Hot Module Replacement events.
 */

const { HMRControlService } = require('./hmr-control-service');
const path = require('path');
const fs = require('fs');

/**
 * NextJS HMR Integration
 * 
 * This class provides an integration layer between Next.js dev server
 * and our HMR Control Service, allowing for advanced HMR management.
 */
class NextJSHMRIntegration {
  constructor(options = {}) {
    this.options = {
      autoReload: true,
      watchFiles: true,
      enableAPI: false,
      apiPort: 3001,
      ...options
    };
    
    this.hmrService = null;
    this.fileWatchers = new Map();
    this.isInitialized = false;
  }
  
  /**
   * Initialize the HMR integration
   */
  async initialize() {
    try {
      // Create and initialize HMR service
      this.hmrService = new HMRControlService({
        enableLogging: true,
        enableMetrics: true
      });
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Initialize with mock compilers (in real app, these would come from Next.js)
      await this.hmrService.initialize();
      
      // Set up file watching if enabled
      if (this.options.watchFiles) {
        this.setupFileWatching();
      }
      
      // Set up API server if enabled
      if (this.options.enableAPI) {
        this.setupAPIServer();
      }
      
      this.isInitialized = true;
      console.log('✅ NextJS HMR Integration initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize NextJS HMR Integration:', error);
      return false;
    }
  }
  
  /**
   * Set up event handlers for HMR service
   */
  setupEventHandlers() {
    this.hmrService.on('clientConnected', (connectionId) => {
      console.log(`🔌 New HMR client connected: ${connectionId}`);
      
      // Send welcome message to new client
      setTimeout(() => {
        this.hmrService.sendCustomEvent('welcome', {
          message: 'Connected to HMR Control Service',
          features: ['file-watching', 'custom-events', 'metrics'],
          timestamp: new Date().toISOString()
        });
      }, 100);
    });
    
    this.hmrService.on('clientDisconnected', (connectionId) => {
      console.log(`🔌 HMR client disconnected: ${connectionId}`);
    });
    
    this.hmrService.on('eventPublished', (payload) => {
      // Log important events
      if (['built', 'sync', 'reloadPage'].includes(payload.action)) {
        console.log(`📡 Published ${payload.action} event to ${this.hmrService.getConnectedClients().length} clients`);
      }
    });
  }
  
  /**
   * Set up file system watching for automatic HMR triggers
   */
  setupFileWatching() {
    const watchPaths = [
      path.join(__dirname, 'pages'),
      path.join(__dirname, 'components'),
      path.join(__dirname, 'lib'),
      path.join(__dirname, 'styles')
    ];
    
    console.log('👀 Setting up file watching for HMR...');
    
    watchPaths.forEach(watchPath => {
      if (fs.existsSync(watchPath)) {
        try {
          const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
            if (filename && this.shouldTriggerHMR(filename)) {
              this.handleFileChange(eventType, path.join(watchPath, filename));
            }
          });
          
          this.fileWatchers.set(watchPath, watcher);
          console.log(`   📁 Watching: ${watchPath}`);
        } catch (error) {
          console.log(`   ❌ Failed to watch: ${watchPath} - ${error.message}`);
        }
      }
    });
  }
  
  /**
   * Determine if file change should trigger HMR
   */
  shouldTriggerHMR(filename) {
    const hmrExtensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.md', '.mdx'];
    const fileExt = path.extname(filename).toLowerCase();
    
    // Skip certain files
    const skipPatterns = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      '.log'
    ];
    
    if (skipPatterns.some(pattern => filename.includes(pattern))) {
      return false;
    }
    
    return hmrExtensions.includes(fileExt);
  }
  
  /**
   * Handle file system changes
   */
  handleFileChange(eventType, filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    const fileExt = path.extname(filePath);
    
    console.log(`📝 File ${eventType}: ${relativePath}`);
    
    // Notify building
    this.hmrService.notifyBuilding();
    
    // Simulate build process
    setTimeout(() => {
      const buildHash = this.generateBuildHash();
      
      // Determine if it's a page file (should trigger reload)
      const isPageFile = relativePath.startsWith('pages/') || 
                        relativePath.startsWith('app/') ||
                        relativePath.includes('_app.') ||
                        relativePath.includes('_document.');
      
      if (isPageFile) {
        // Page files often require full reload
        this.hmrService.reloadPage(relativePath);
        console.log(`🔄 Triggered page reload for: ${relativePath}`);
      } else {
        // Other files can use hot update
        this.hmrService.notifyBuilt(buildHash, [], []);
        console.log(`🔥 Triggered hot update for: ${relativePath}`);
      }
      
      // Send custom event with file info
      this.hmrService.sendCustomEvent('file-changed', {
        file: relativePath,
        type: eventType,
        extension: fileExt,
        timestamp: new Date().toISOString(),
        buildHash
      });
      
    }, 500); // Simulate build time
  }
  
  /**
   * Generate a mock build hash
   */
  generateBuildHash() {
    return `build_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
  
  /**
   * Set up HTTP API for HMR control
   */
  setupAPIServer() {
    const express = require('express');
    const app = express();
    
    app.use(express.json());
    
    // CORS middleware
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });
    
    // Health check endpoint
    app.get('/hmr/health', (req, res) => {
      res.json(this.hmrService.healthCheck());
    });
    
    // Metrics endpoint
    app.get('/hmr/metrics', (req, res) => {
      res.json(this.hmrService.getMetrics());
    });
    
    // Trigger custom events
    app.post('/hmr/events', (req, res) => {
      const { action, payload } = req.body;
      
      if (!action) {
        return res.status(400).json({ error: 'Action is required' });
      }
      
      const success = this.hmrService.publishEvent(action, payload);
      res.json({ success, action, timestamp: new Date().toISOString() });
    });
    
    // Trigger specific HMR actions
    app.post('/hmr/reload/:page?', (req, res) => {
      const page = req.params.page || '/';
      const success = this.hmrService.reloadPage(page);
      res.json({ success, page, action: 'reload' });
    });
    
    app.post('/hmr/build', (req, res) => {
      const { hash, warnings = [], errors = [] } = req.body;
      const buildHash = hash || this.generateBuildHash();
      
      const success = this.hmrService.notifyBuilt(buildHash, warnings, errors);
      res.json({ success, hash: buildHash, action: 'built' });
    });
    
    // Get connected clients
    app.get('/hmr/clients', (req, res) => {
      res.json({
        clients: this.hmrService.getConnectedClients(),
        count: this.hmrService.getConnectedClients().length
      });
    });
    
    // Disconnect client
    app.delete('/hmr/clients/:connectionId', (req, res) => {
      const { connectionId } = req.params;
      const success = this.hmrService.disconnectClient(connectionId);
      res.json({ success, connectionId, action: 'disconnect' });
    });
    
    app.listen(this.options.apiPort, () => {
      console.log(`🌐 HMR Control API running on http://localhost:${this.options.apiPort}`);
      console.log('   Available endpoints:');
      console.log('   GET  /hmr/health     - Health check');
      console.log('   GET  /hmr/metrics    - Service metrics');
      console.log('   GET  /hmr/clients    - Connected clients');
      console.log('   POST /hmr/events     - Trigger custom events');
      console.log('   POST /hmr/reload     - Trigger page reload');
      console.log('   POST /hmr/build      - Trigger build event');
    });
  }
  
  /**
   * Manually trigger HMR events
   */
  triggerBuilding() {
    return this.hmrService?.notifyBuilding();
  }
  
  triggerBuilt(hash, warnings = [], errors = []) {
    return this.hmrService?.notifyBuilt(hash, warnings, errors);
  }
  
  triggerReload(page = '/') {
    return this.hmrService?.reloadPage(page);
  }
  
  triggerSync(hash, warnings = [], errors = []) {
    return this.hmrService?.notifySync(hash, warnings, errors);
  }
  
  triggerError(error) {
    return this.hmrService?.notifyServerError(error);
  }
  
  /**
   * Get WebSocket handler for integration with Next.js dev server
   */
  getWebSocketHandler() {
    return this.hmrService?.createWebSocketHandler();
  }
  
  /**
   * Get Express middleware for integration
   */
  getMiddleware() {
    return this.hmrService?.createMiddleware();
  }
  
  /**
   * Close the integration
   */
  async close() {
    // Close file watchers
    for (const [path, watcher] of this.fileWatchers) {
      watcher.close();
      console.log(`👁️  Stopped watching: ${path}`);
    }
    this.fileWatchers.clear();
    
    // Close HMR service
    if (this.hmrService) {
      await this.hmrService.close();
    }
    
    console.log('✅ NextJS HMR Integration closed');
  }
}

// Export for use in other modules
module.exports = { NextJSHMRIntegration };

// Demo functionality when run directly
if (require.main === module) {
  console.log('🚀 Starting NextJS HMR Integration Demo...\n');
  
  async function runDemo() {
    const integration = new NextJSHMRIntegration({
      watchFiles: true,
      enableAPI: true,
      apiPort: 3001
    });
    
    // Initialize
    const success = await integration.initialize();
    
    if (!success) {
      console.log('❌ Failed to initialize integration');
      return;
    }
    
    // Create mock WebSocket clients
    class MockWebSocket {
      constructor(id) {
        this.id = id;
        this.messages = [];
      }
      
      send(data) {
        const parsed = JSON.parse(data);
        this.messages.push(parsed);
        console.log(`   📱 ${this.id}: ${parsed.action} event`);
      }
      
      addEventListener(event, callback) {
        this[`_${event}Callback`] = callback;
      }
      
      close() {
        if (this._closeCallback) this._closeCallback();
      }
    }
    
    // Connect mock clients
    console.log('🔌 Connecting mock HMR clients...');
    const wsHandler = integration.getWebSocketHandler();
    const clients = [
      new MockWebSocket('Browser'),
      new MockWebSocket('DevTools')
    ];
    
    clients.forEach(client => wsHandler(client));
    
    // Demonstrate programmatic HMR control
    console.log('\n🎮 Demonstrating programmatic HMR control...');
    
    setTimeout(() => {
      console.log('📦 Simulating build start...');
      integration.triggerBuilding();
    }, 2000);
    
    setTimeout(() => {
      console.log('✅ Simulating successful build...');
      integration.triggerBuilt('demo-hash-123', [], []);
    }, 3000);
    
    setTimeout(() => {
      console.log('🔄 Simulating page reload...');
      integration.triggerReload('/demo-page');
    }, 4000);
    
    setTimeout(() => {
      console.log('❌ Simulating build error...');
      integration.triggerError(new Error('Mock build error for demo'));
    }, 5000);
    
    // Show final metrics
    setTimeout(() => {
      console.log('\\n📊 Final Integration Metrics:');
      if (integration.hmrService) {
        console.log(JSON.stringify(integration.hmrService.getMetrics(), null, 2));
      }
    }, 6000);
    
    // Cleanup
    setTimeout(async () => {
      console.log('\\n🧹 Cleaning up integration...');
      await integration.close();
      console.log('✅ Demo completed!');
      process.exit(0);
    }, 8000);
  }
  
  runDemo().catch(console.error);
}