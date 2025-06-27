// Server-side Only HMR Utility
// No client-side code, no window references, server-side only

const path = require('path');

class ServerOnlyHMR {
  constructor() {
    this.isInitialized = false;
    this.init();
  }

  init() {
    if (process.env.NODE_ENV !== 'development') {
      console.log('[Server HMR] Not in development mode, skipping initialization');
      return;
    }

    if (this.isInitialized) return;

    console.log('[Server HMR] Initializing server-side only HMR...');

    // Patch Next.js require cache if available
    this.patchNextJSRequireCache();

    // Expose global server functions
    this.exposeServerFunctions();

    this.isInitialized = true;
    console.log('[Server HMR] Server-side HMR initialized successfully');
  }

  patchNextJSRequireCache() {
    try {
      // Try to access Next.js internal require cache API
      const { deleteCache, deleteFromRequireCache } = require('next/dist/server/dev/require-cache');

      console.log('[Server HMR] Next.js require cache API available');

      // Store original methods for enhanced logging
      this.originalDeleteCache = deleteCache;
      this.originalDeleteFromRequireCache = deleteFromRequireCache;

    } catch (error) {
      console.warn('[Server HMR] Next.js require cache API not available, using manual methods');
    }
  }

  exposeServerFunctions() {
    // Expose server-side HMR functions globally
    global.__SERVER_HMR__ = {
      clearPageCache: (pagePath) => this.clearPageCache(pagePath),
      clearAllPages: () => this.clearAllPages(),
      safeReset: () => this.safeReset(),
      getCacheInfo: () => this.getCacheInfo(),
      invalidateModule: (modulePath) => this.invalidateModule(modulePath),
      clearModuleCache: (modulePath) => this.invalidateModule(modulePath)
    };

    console.log('[Server HMR] Server-side functions exposed on global.__SERVER_HMR__');
  }

  clearPageCache(pagePath) {
    try {
      let cleared = 0;
      const cacheKeys = Object.keys(require.cache);

      // Build possible cache key patterns for the page
      const patterns = [
        pagePath,
        path.resolve(process.cwd(), pagePath),
        path.resolve(process.cwd(), 'pages', pagePath),
        path.resolve(process.cwd(), '.next/server/pages', pagePath.replace(/\.tsx?$/, '.js'))
      ];

      console.log(`[Server HMR] Clearing cache for patterns:`, patterns);

      cacheKeys.forEach(key => {
        const shouldClear = patterns.some(pattern =>
          key.includes(pattern) ||
          key.endsWith(pattern) ||
          path.normalize(key) === path.normalize(pattern)
        );

        if (shouldClear) {
          this.safeDeleteFromCache(key);
          cleared++;
          console.log(`[Server HMR] Cleared: ${key}`);
        }
      });

      return { success: true, cleared, pagePath, patterns };
    } catch (error) {
      console.error('[Server HMR] Error clearing page cache:', error);
      return { success: false, error: error.message, pagePath };
    }
  }

  clearAllPages() {
    try {
      let cleared = 0;
      const cacheKeys = Object.keys(require.cache);

      cacheKeys.forEach(key => {
        // Clear pages directory modules and Next.js server pages
        if (key.includes('/pages/') ||
            key.includes('\\pages\\') ||
            key.includes('/.next/server/pages/') ||
            key.includes('\\.next\\server\\pages\\') ||
            key.includes('/_app') ||
            key.includes('/_document') ||
            key.includes('/_error') ||
            key.includes('/lib/') ||
            key.includes('\\lib\\')) {

          this.safeDeleteFromCache(key);
          cleared++;
        }
      });

      console.log(`[Server HMR] Cleared ${cleared} pages and lib modules`);
      return { success: true, cleared, type: 'all-pages' };
    } catch (error) {
      console.error('[Server HMR] Error clearing all pages cache:', error);
      return { success: false, error: error.message, type: 'all-pages' };
    }
  }

  invalidateModule(modulePath) {
    try {
      const fullPath = path.resolve(process.cwd(), modulePath);

      if (require.cache[fullPath]) {
        this.safeDeleteFromCache(fullPath);
        console.log(`[Server HMR] Invalidated module: ${fullPath}`);
        return { success: true, path: fullPath };
      } else {
        console.warn(`[Server HMR] Module not in cache: ${fullPath}`);
        return { success: false, error: 'Module not in cache', path: fullPath };
      }
    } catch (error) {
      console.error('[Server HMR] Error invalidating module:', error);
      return { success: false, error: error.message, path: modulePath };
    }
  }

  safeReset() {
    try {
      console.log('[Server HMR] Performing safe server-side reset...');

      let cleared = 0;
      let preserved = 0;
      const cacheKeys = Object.keys(require.cache);

      cacheKeys.forEach(key => {
        // Preserve critical Node.js and Next.js core modules
        if (key.includes('node_modules/next/dist/server') ||
            key.includes('node_modules/react') ||
            key.includes('node_modules/webpack') ||
            key.startsWith('node:') ||
            key.includes('next/dist/server/dev/next-dev-server') ||
            key.includes('next/dist/server/config') ||
            key.includes('next/dist/compiled')) {

          preserved++;
          // Keep these modules
        } else if (key.includes('/pages/') ||
                   key.includes('\\pages\\') ||
                   key.includes('/.next/server/pages/') ||
                   key.includes('\\.next\\server\\pages\\') ||
                   key.includes('/lib/') ||
                   key.includes('\\lib\\') ||
                   key.includes('/components/') ||
                   key.includes('\\components\\')) {

          this.safeDeleteFromCache(key);
          cleared++;
        } else {
          preserved++;
        }
      });

      console.log(`[Server HMR] Safe reset completed - cleared: ${cleared}, preserved: ${preserved}`);

      return {
        success: true,
        cleared,
        preserved,
        total: cacheKeys.length,
        type: 'safe-reset'
      };
    } catch (error) {
      console.error('[Server HMR] Error during safe reset:', error);
      return { success: false, error: error.message, type: 'safe-reset' };
    }
  }

  getCacheInfo() {
    try {
      const cacheKeys = Object.keys(require.cache);
      const pagesCacheKeys = cacheKeys.filter(key =>
        key.includes('/pages/') ||
        key.includes('\\pages\\') ||
        key.includes('/.next/server/pages/') ||
        key.includes('\\.next\\server\\pages\\')
      );

      const libCacheKeys = cacheKeys.filter(key =>
        key.includes('/lib/') || key.includes('\\lib\\')
      );

      return {
        totalCacheSize: cacheKeys.length,
        pagesCacheSize: pagesCacheKeys.length,
        libCacheSize: libCacheKeys.length,
        samplePagesKeys: pagesCacheKeys.slice(0, 5),
        sampleLibKeys: libCacheKeys.slice(0, 5),
        workingDirectory: process.cwd(),
        nodeEnv: process.env.NODE_ENV,
        nextjsRequireCacheAvailable: !!this.originalDeleteCache
      };
    } catch (error) {
      console.error('[Server HMR] Error getting cache info:', error);
      return { error: error.message };
    }
  }

  safeDeleteFromCache(key) {
    try {
      // Try Next.js internal API first
      if (this.originalDeleteFromRequireCache) {
        return this.originalDeleteFromRequireCache(key);
      }

      // Fallback to manual deletion
      const mod = require.cache[key];
      if (mod) {
        // Remove child references from all parent modules
        for (const parent of Object.values(require.cache)) {
          if (parent?.children) {
            const idx = parent.children.indexOf(mod);
            if (idx >= 0) parent.children.splice(idx, 1);
          }
        }
        // Remove parent references from external modules
        for (const child of mod.children) {
          if (child) child.parent = null;
        }
        delete require.cache[key];
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[Server HMR] Error deleting from cache: ${key}`, error);
      return false;
    }
  }
}

// Auto-initialize if in development
let serverHMR = null;

if (process.env.NODE_ENV === 'development') {
  serverHMR = new ServerOnlyHMR();

  // Handle process exit
  process.on('exit', () => {
    console.log('[Server HMR] Process exiting, cleaning up...');
  });
}

module.exports = {
  ServerOnlyHMR,
  instance: serverHMR
};
