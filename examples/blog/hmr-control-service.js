/**
 * HMR Control Service
 * 
 * A comprehensive service for controlling Next.js HMR (Hot Module Replacement) events.
 * This demonstrates advanced patterns for:
 * - Creating custom HMR event publishers
 * - Managing WebSocket connections
 * - Implementing middleware hooks
 * - Building a centralized HMR control system
 */

const { WebpackHotMiddleware } = require('next/dist/server/dev/hot-middleware');
const { HMR_ACTIONS_SENT_TO_BROWSER } = require('next/dist/server/dev/hot-reloader-types');
const EventEmitter = require('events');

/**
 * HMRControlService - Advanced HMR control and monitoring
 */
class HMRControlService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableLogging: true,
      enableMetrics: true,
      connectionTimeout: 30000,
      maxConnections: 100,
      ...options
    };
    
    this.hotMiddleware = null;
    this.compilers = [];
    this.connections = new Map();
    this.metrics = {
      eventsPublished: 0,
      connectionsTotal: 0,
      connectionsActive: 0,
      errorsCount: 0,
      lastEventTime: null
    };
    
    this.log('HMRControlService initialized');
  }
  
  /**
   * Initialize the service with webpack compilers
   */
  async initialize(compilers, versionInfo = null, devtoolsFrontendUrl = null) {
    try {
      this.compilers = compilers || this.createMockCompilers();
      
      const defaultVersionInfo = {
        installed: '14.0.0',
        staleness: 'fresh'
      };
      
      this.hotMiddleware = new WebpackHotMiddleware(
        this.compilers,
        versionInfo || defaultVersionInfo,
        devtoolsFrontendUrl
      );
      
      // Hook into the original publish method to track events
      const originalPublish = this.hotMiddleware.publish.bind(this.hotMiddleware);
      this.hotMiddleware.publish = (payload) => {
        this.trackEvent(payload);
        return originalPublish(payload);
      };
      
      // Hook into the original onHMR method to track connections
      const originalOnHMR = this.hotMiddleware.onHMR.bind(this.hotMiddleware);
      this.hotMiddleware.onHMR = (client) => {
        this.trackConnection(client);
        return originalOnHMR(client);
      };
      
      this.log('HMRControlService initialized with hot middleware');
      this.emit('initialized');
      
      return true;
    } catch (error) {
      this.log('Failed to initialize HMRControlService:', error.message);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Create mock webpack compilers for testing
   */
  createMockCompilers() {
    const createCompiler = (name) => ({
      name,
      hooks: {
        invalid: { tap: (pluginName, callback) => {} },
        done: { tap: (pluginName, callback) => {} }
      }
    });
    
    return [
      createCompiler('client'),
      createCompiler('server'),
      createCompiler('edge-server')
    ];
  }
  
  /**
   * Track HMR events for metrics and debugging
   */
  trackEvent(payload) {
    this.metrics.eventsPublished++;
    this.metrics.lastEventTime = new Date();
    
    this.log(`Published HMR event: ${payload.action}`);
    this.emit('eventPublished', payload);
  }
  
  /**
   * Track WebSocket connections
   */
  trackConnection(client) {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.connections.set(connectionId, {
      client,
      connectedAt: new Date(),
      messagesReceived: 0
    });
    
    this.metrics.connectionsTotal++;
    this.metrics.connectionsActive = this.connections.size;
    
    // Hook into client events
    const originalSend = client.send?.bind(client) || (() => {});
    if (client.send) {
      client.send = (data) => {
        const conn = this.connections.get(connectionId);
        if (conn) {
          conn.messagesReceived++;
        }
        return originalSend(data);
      };
    }
    
    // Handle client disconnect
    const handleDisconnect = () => {
      this.connections.delete(connectionId);
      this.metrics.connectionsActive = this.connections.size;
      this.log(`Client disconnected: ${connectionId}`);
      this.emit('clientDisconnected', connectionId);
    };
    
    if (client.addEventListener) {
      client.addEventListener('close', handleDisconnect);
    }
    
    this.log(`Client connected: ${connectionId}`);
    this.emit('clientConnected', connectionId);
  }
  
  /**
   * Publish custom HMR events
   */
  publishEvent(action, payload = {}) {
    if (!this.hotMiddleware) {
      throw new Error('HMRControlService not initialized');
    }
    
    const event = {
      action,
      ...payload,
      timestamp: Date.now()
    };
    
    try {
      this.hotMiddleware.publish(event);
      return true;
    } catch (error) {
      this.metrics.errorsCount++;
      this.log(`Failed to publish event ${action}:`, error.message);
      this.emit('publishError', error);
      return false;
    }
  }
  
  /**
   * Send building notification
   */
  notifyBuilding() {
    return this.publishEvent(HMR_ACTIONS_SENT_TO_BROWSER.BUILDING);
  }
  
  /**
   * Send build complete notification
   */
  notifyBuilt(hash, warnings = [], errors = []) {
    return this.publishEvent(HMR_ACTIONS_SENT_TO_BROWSER.BUILT, {
      hash,
      warnings,
      errors
    });
  }
  
  /**
   * Send sync notification
   */
  notifySync(hash, warnings = [], errors = [], versionInfo = null) {
    return this.publishEvent(HMR_ACTIONS_SENT_TO_BROWSER.SYNC, {
      hash,
      warnings,
      errors,
      versionInfo: versionInfo || { installed: '14.0.0', staleness: 'fresh' },
      devIndicator: { disabledUntil: 0 }
    });
  }
  
  /**
   * Send page reload notification
   */
  reloadPage(page) {
    return this.publishEvent(HMR_ACTIONS_SENT_TO_BROWSER.RELOAD_PAGE, {
      data: page
    });
  }
  
  /**
   * Send server error notification
   */
  notifyServerError(error) {
    return this.publishEvent(HMR_ACTIONS_SENT_TO_BROWSER.SERVER_ERROR, {
      errorJSON: JSON.stringify({
        message: error.message,
        stack: error.stack,
        name: error.name
      })
    });
  }
  
  /**
   * Send custom notification
   */
  sendCustomEvent(type, data) {
    return this.publishEvent(type, data);
  }
  
  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      connections: {
        active: this.connections.size,
        total: this.metrics.connectionsTotal,
        details: Array.from(this.connections.entries()).map(([id, conn]) => ({
          id,
          connectedAt: conn.connectedAt,
          messagesReceived: conn.messagesReceived
        }))
      }
    };
  }
  
  /**
   * Get connected clients
   */
  getConnectedClients() {
    return Array.from(this.connections.keys());
  }
  
  /**
   * Disconnect specific client
   */
  disconnectClient(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.client) {
      if (connection.client.close) {
        connection.client.close();
      } else if (connection.client.terminate) {
        connection.client.terminate();
      }
      return true;
    }
    return false;
  }
  
  /**
   * Disconnect all clients
   */
  disconnectAllClients() {
    let disconnected = 0;
    for (const connectionId of this.connections.keys()) {
      if (this.disconnectClient(connectionId)) {
        disconnected++;
      }
    }
    return disconnected;
  }
  
  /**
   * Health check
   */
  healthCheck() {
    return {
      status: this.hotMiddleware ? 'healthy' : 'unhealthy',
      initialized: !!this.hotMiddleware,
      activeConnections: this.connections.size,
      totalEvents: this.metrics.eventsPublished,
      errors: this.metrics.errorsCount,
      lastEventTime: this.metrics.lastEventTime,
      uptime: process.uptime()
    };
  }
  
  /**
   * Create middleware for Express/Connect
   */
  createMiddleware() {
    return (req, res, next) => {
      // Add HMR control headers
      res.setHeader('X-HMR-Control-Service', 'active');
      res.setHeader('X-HMR-Connections', this.connections.size);
      res.setHeader('X-HMR-Events', this.metrics.eventsPublished);
      
      // Log request
      this.log(`HMR middleware: ${req.method} ${req.url}`);
      
      // Continue to next middleware
      next();
    };
  }
  
  /**
   * Create WebSocket upgrade handler
   */
  createWebSocketHandler() {
    return (client) => {
      if (this.hotMiddleware) {
        this.hotMiddleware.onHMR(client);
      }
    };
  }
  
  /**
   * Close the service
   */
  async close() {
    try {
      // Disconnect all clients
      const disconnected = this.disconnectAllClients();
      this.log(`Disconnected ${disconnected} clients`);
      
      // Close hot middleware
      if (this.hotMiddleware) {
        this.hotMiddleware.close();
        this.hotMiddleware = null;
      }
      
      // Clear connections
      this.connections.clear();
      
      this.log('HMRControlService closed');
      this.emit('closed');
      
      return true;
    } catch (error) {
      this.log('Error closing HMRControlService:', error.message);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Logging helper
   */
  log(...args) {
    if (this.options.enableLogging) {
      console.log(`[HMRControl ${new Date().toISOString()}]`, ...args);
    }
  }
}

// Export for use in other modules
module.exports = { HMRControlService, HMR_ACTIONS_SENT_TO_BROWSER };

// Demo/Test functionality when run directly
if (require.main === module) {
  console.log('🚀 Starting HMR Control Service Demo...\n');
  
  async function runDemo() {
    const hmrService = new HMRControlService({
      enableLogging: true,
      enableMetrics: true
    });
    
    // Set up event listeners
    hmrService.on('initialized', () => {
      console.log('✅ Service initialized');
    });
    
    hmrService.on('clientConnected', (connectionId) => {
      console.log(`🔌 Client connected: ${connectionId}`);
    });
    
    hmrService.on('clientDisconnected', (connectionId) => {
      console.log(`🔌 Client disconnected: ${connectionId}`);
    });
    
    hmrService.on('eventPublished', (payload) => {
      console.log(`📡 Event published: ${payload.action}`);
    });
    
    // Initialize the service
    const initialized = await hmrService.initialize();
    
    if (!initialized) {
      console.log('❌ Failed to initialize service');
      return;
    }
    
    // Create mock WebSocket clients
    class MockWebSocket {
      constructor(id) {
        this.id = id;
        this.messages = [];
        this.closed = false;
      }
      
      send(data) {
        if (!this.closed) {
          this.messages.push(JSON.parse(data));
          console.log(`   📨 ${this.id} received: ${JSON.parse(data).action}`);
        }
      }
      
      addEventListener(event, callback) {
        this[`_${event}Callback`] = callback;
      }
      
      close() {
        this.closed = true;
        if (this._closeCallback) this._closeCallback();
      }
    }
    
    // Connect mock clients
    const clients = [
      new MockWebSocket('Browser-1'),
      new MockWebSocket('Browser-2'),
      new MockWebSocket('DevTools')
    ];
    
    console.log('\n🔌 Connecting mock clients...');
    const wsHandler = hmrService.createWebSocketHandler();
    clients.forEach(client => {
      wsHandler(client);
    });
    
    // Demonstrate HMR events
    console.log('\n📡 Publishing HMR events...');
    
    setTimeout(() => {
      hmrService.notifyBuilding();
    }, 1000);
    
    setTimeout(() => {
      hmrService.notifyBuilt('build-hash-123', [], []);
    }, 2000);
    
    setTimeout(() => {
      hmrService.notifySync('sync-hash-456', [], []);
    }, 3000);
    
    setTimeout(() => {
      hmrService.reloadPage('/test-page');
    }, 4000);
    
    setTimeout(() => {
      hmrService.sendCustomEvent('custom-event', { 
        message: 'This is a custom HMR event',
        data: { foo: 'bar' }
      });
    }, 5000);
    
    // Show metrics after events
    setTimeout(() => {
      console.log('\n📊 Service Metrics:');
      console.log(JSON.stringify(hmrService.getMetrics(), null, 2));
      
      console.log('\n🏥 Health Check:');
      console.log(JSON.stringify(hmrService.healthCheck(), null, 2));
    }, 6000);
    
    // Cleanup
    setTimeout(async () => {
      console.log('\n🧹 Cleaning up...');
      await hmrService.close();
      console.log('✅ Demo completed!');
    }, 7000);
  }
  
  runDemo().catch(console.error);
}