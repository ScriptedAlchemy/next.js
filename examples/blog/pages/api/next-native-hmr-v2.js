// Pure Next.js Native HMR API v2 - Uses ONLY vanilla Next.js internal APIs
const path = require("path");
const fs = require("fs").promises;

// Import ONLY pure Next.js internal APIs
let deleteCache, deleteFromRequireCache;
try {
  const requireCacheModule = require("next/dist/server/dev/require-cache");
  deleteCache = requireCacheModule.deleteCache;
  deleteFromRequireCache = requireCacheModule.deleteFromRequireCache;
} catch (error) {
  console.warn("[Pure Next.js Native HMR] Require cache API not available");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.NODE_ENV !== "development") {
    return res.status(400).json({ 
      error: "Next.js Native HMR only available in development" 
    });
  }

  const { action, pagePath, searchString, replaceString, forceReload } = req.body;

  try {
    console.log(`[Next Native HMR API v2] Processing action: ${action}`);

    switch (action) {
      case "test":
        return res.json({
          success: true,
          message: "Pure Next.js Native HMR API v2 is working",
          method: "pure-next-js-internals",
          availableAPIs: {
            deleteCache: !!deleteCache,
            deleteFromRequireCache: !!deleteFromRequireCache,
            requireCache: !!require.cache,
            filesystem: true,
          },
          availableActions: ["test", "status", "comprehensive-hmr"],
          timestamp: new Date().toISOString(),
        });

      case "status":
        return res.json({
          success: true,
          status: {
            pureNextJS: {
              available: true,
              cacheAPIs: {
                deleteCache: !!deleteCache,
                deleteFromRequireCache: !!deleteFromRequireCache,
                requireCache: !!require.cache,
              },
              filesystem: {
                available: true,
                canReadFiles: true,
                canWriteFiles: true,
              },
              nodeJS: {
                version: process.version,
                platform: process.platform,
              },
            },
          },
        });

      case "comprehensive-hmr":
        if (!pagePath) {
          return res.status(400).json({
            error: "pagePath is required for comprehensive-hmr action",
          });
        }

        const results = {
          pagePath,
          searchString: searchString || (pagePath === "/_document" ? "PLACEHOLDER" : "PAGE_HMR_AREA"),
          replaceString: replaceString || "COMPREHENSIVE HMR SUCCESS!!",
          forceReload: !!forceReload,
          steps: [],
        };

        // Step 1: File modification
        try {
          const serverFilePath = resolveServerFilePath(pagePath);
          const originalContent = await fs.readFile(serverFilePath, "utf8");
          const updatedContent = originalContent.replace(
            new RegExp(results.searchString, 'g'), 
            results.replaceString
          );
          
          if (updatedContent !== originalContent) {
            await fs.writeFile(serverFilePath, updatedContent, "utf8");
            results.steps.push({ 
              step: "file-modification", 
              success: true, 
              serverFilePath,
              replacements: (originalContent.match(new RegExp(results.searchString, 'g')) || []).length
            });
          } else {
            results.steps.push({ 
              step: "file-modification", 
              success: false, 
              error: `Search string "${results.searchString}" not found` 
            });
          }
        } catch (error) {
          results.steps.push({ 
            step: "file-modification", 
            success: false, 
            error: error.message 
          });
        }

        // Step 2: Cache invalidation
        try {
          const serverFilePath = resolveServerFilePath(pagePath);
          const cacheResults = [];

          if (deleteCache) {
            try {
              deleteCache(serverFilePath);
              cacheResults.push({ api: "deleteCache", success: true });
            } catch (error) {
              cacheResults.push({ api: "deleteCache", success: false, error: error.message });
            }
          }

          if (deleteFromRequireCache) {
            try {
              deleteFromRequireCache(serverFilePath);
              cacheResults.push({ api: "deleteFromRequireCache", success: true });
            } catch (error) {
              cacheResults.push({ api: "deleteFromRequireCache", success: false, error: error.message });
            }
          }

          results.steps.push({ 
            step: "cache-invalidation", 
            success: cacheResults.some(r => r.success), 
            details: cacheResults 
          });
        } catch (error) {
          results.steps.push({ 
            step: "cache-invalidation", 
            success: false, 
            error: error.message 
          });
        }

        // Step 3: Pure Next.js cache operations (no hot reloader globals needed)
        try {
          // Manual cache invalidation using pure Next.js APIs
          const possiblePaths = [
            path.resolve(process.cwd(), "pages", `${pagePath}.js`),
            path.resolve(process.cwd(), "pages", `${pagePath}.jsx`),
            path.resolve(process.cwd(), "pages", `${pagePath}.ts`),
            path.resolve(process.cwd(), "pages", `${pagePath}.tsx`),
            serverFilePath,
          ];

          let cleared = 0;
          for (const possiblePath of possiblePaths) {
            if (require.cache[possiblePath]) {
              delete require.cache[possiblePath];
              cleared++;
            }
          }

          results.steps.push({ 
            step: "pure-nextjs-cache-operations", 
            success: true,
            clearedModules: cleared 
          });
        } catch (error) {
          results.steps.push({ 
            step: "pure-nextjs-cache-operations", 
            success: false, 
            error: error.message 
          });
        }

        return res.json({
          success: results.steps.some(step => step.success),
          method: "pure-next-js-hmr-v2",
          results,
          timestamp: new Date().toISOString(),
        });

      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`,
          availableActions: ["test", "status", "comprehensive-hmr"],
        });
    }
  } catch (error) {
    console.error("[Pure Next.js Native HMR API v2] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      method: "pure-next-js-hmr-v2",
    });
  }
}

function resolveServerFilePath(pagePath) {
  if (pagePath === "/_document") {
    return path.resolve(process.cwd(), ".next", "server", "pages", "_document.js");
  } else if (pagePath === "/posts/markdown") {
    return path.resolve(process.cwd(), ".next", "server", "pages", "posts", "markdown.js");
  } else {
    const cleanPath = pagePath.startsWith('/') ? pagePath.slice(1) : pagePath;
    return path.resolve(process.cwd(), ".next", "server", "pages", `${cleanPath}.js`);
  }
}