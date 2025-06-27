// Server-side only HMR API endpoint
// Leverages Next.js's built-in HMR infrastructure

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.NODE_ENV !== 'development') {
    return res.status(400).json({ error: 'HMR API only available in development' });
  }

  const { action, targetPath, virtualChunkPath, modulePath } = req.body;

  // Check if server HMR is available
  if (!global.__SERVER_HMR__) {
    return res.status(500).json({ 
      error: 'Server HMR not initialized',
      suggestion: 'Make sure next.config.js is loading server-hmr-only.js'
    });
  }

  try {
    console.log(`[Server HMR API] Processing action: ${action}`);

    switch (action) {
      case 'test':
        return res.json({
          success: true,
          message: 'Server HMR API is working',
          availableFunctions: Object.keys(global.__SERVER_HMR__),
          timestamp: new Date().toISOString()
        });

      case 'cache-info':
        const cacheInfo = global.__SERVER_HMR__.getCacheInfo();
        return res.json({
          success: true,
          result: cacheInfo
        });

      case 'hot-swap-module':
        if (!targetPath || !virtualChunkPath) {
          return res.status(400).json({
            error: 'targetPath and virtualChunkPath are required for hot-swap-module'
          });
        }
        
        const swapResult = global.__SERVER_HMR__.hotSwapModule(targetPath, virtualChunkPath);
        return res.json({
          success: swapResult.success,
          result: swapResult
        });

      case 'clear-module-cache':
        if (!modulePath) {
          return res.status(400).json({
            error: 'modulePath is required for clear-module-cache'
          });
        }
        
        const clearResult = global.__SERVER_HMR__.clearModuleCache(modulePath);
        return res.json({
          success: clearResult.success,
          result: clearResult
        });

      case 'clear-all-pages':
        const clearAllResult = global.__SERVER_HMR__.clearAllPages();
        return res.json({
          success: clearAllResult.success,
          result: clearAllResult
        });

      case 'safe-reset':
        const resetResult = global.__SERVER_HMR__.safeReset();
        return res.json({
          success: resetResult.success,
          result: resetResult
        });

      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`,
          availableActions: [
            'test',
            'cache-info', 
            'hot-swap-module',
            'clear-module-cache',
            'clear-all-pages',
            'safe-reset'
          ]
        });
    }
  } catch (error) {
    console.error('[Server HMR API] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
} 