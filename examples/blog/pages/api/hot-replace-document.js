// Hot Replace Document API endpoint - follows same pattern as other HMR tests
// Modifies compiled files in .next/server/pages/ instead of source files

const path = require("path");
const fs = require("fs").promises;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.NODE_ENV !== "development") {
    return res
      .status(400)
      .json({ error: "Hot replace document only available in development" });
  }

  const { action, searchString, replaceString } = req.body;

  try {
    console.log(`[Hot Replace Document API] Processing action: ${action}`);

    switch (action) {
      case "test":
        return res.json({
          success: true,
          message: "Hot Replace Document API is working",
          method: "compiled-file-string-replacement",
          availableActions: ["test", "status", "trigger-replace"],
          timestamp: new Date().toISOString(),
        });

      case "status":
        const serverDocPath = path.join(
          process.cwd(),
          ".next",
          "server",
          "pages",
          "_document.js",
        );

        let serverDocExists = false;
        let serverDocSize = 0;
        let hasPlaceholder = false;

        try {
          const serverStats = await fs.stat(serverDocPath);
          serverDocExists = true;
          serverDocSize = serverStats.size;

          // Check if document contains PLACEHOLDER
          const content = await fs.readFile(serverDocPath, "utf8");
          hasPlaceholder = content.includes("PLACEHOLDER");
        } catch (error) {
          // Server doc doesn't exist
        }

        return res.json({
          success: true,
          status: {
            serverDocPath,
            serverDocExists,
            serverDocSize,
            hasPlaceholder,
            approach: "string-replacement-in-compiled-file",
            note: "Modifies .next/server/pages/_document.js directly",
          },
        });

      case "trigger-replace":
        return await triggerHotReplaceDocument(searchString || "PLACEHOLDER", replaceString || "HOT REPLACE SUCCESS!!", res);

      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`,
          availableActions: ["test", "status", "trigger-replace"],
        });
    }
  } catch (error) {
    console.error("[Hot Replace Document API] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      method: "hot-replace-document",
    });
  }
}

async function triggerHotReplaceDocument(searchString, replaceString, res) {
  try {
    console.log(`[Hot Replace Document] Triggering hot replace: "${searchString}" → "${replaceString}"`);

    // Step 1: Read the existing compiled document
    const serverDocPath = path.join(
      process.cwd(),
      ".next",
      "server",
      "pages",
      "_document.js",
    );
    let originalContent;

    try {
      originalContent = await fs.readFile(serverDocPath, "utf8");
      console.log(
        `[Hot Replace Document] Read compiled document: ${originalContent.length} bytes`,
      );
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: "Compiled document not found",
        serverDocPath,
        message: "Visit the page first to trigger compilation, then try hot replace",
      });
    }

    // Step 2: Perform string replacement
    const updatedContent = originalContent.replace(
      new RegExp(searchString, 'g'),
      replaceString,
    );

    if (updatedContent === originalContent) {
      return res.status(400).json({
        success: false,
        error: `Search string "${searchString}" not found in compiled document`,
        message: "The compiled document may not contain the expected content",
      });
    }

    // Step 3: Write the updated content back
    await fs.writeFile(serverDocPath, updatedContent, "utf8");
    console.log(`[Hot Replace Document] Updated document with string replacement`);

    // Step 4: Clear module cache
    let cacheCleared = false;
    try {
      if (global.__SERVER_HMR__ && global.__SERVER_HMR__.clearModuleCache) {
        const clearResult = global.__SERVER_HMR__.clearModuleCache(serverDocPath);
        cacheCleared = clearResult.success;
        console.log("[Hot Replace Document] Triggered cache invalidation via Server HMR API");
      } else {
        // Fallback: Clear the require cache manually
        if (require.cache[serverDocPath]) {
          delete require.cache[serverDocPath];
          cacheCleared = true;
          console.log("[Hot Replace Document] Cleared require cache manually");
        }
      }
    } catch (error) {
      console.log("[Hot Replace Document] Cache clearing failed:", error.message);
    }

    // Step 5: Clear all pages cache for good measure
    try {
      if (global.__SERVER_HMR__ && global.__SERVER_HMR__.clearAllPages) {
        global.__SERVER_HMR__.clearAllPages();
        console.log("[Hot Replace Document] Cleared all pages cache");
      }
    } catch (error) {
      console.log("[Hot Replace Document] Clear all pages failed:", error.message);
    }

    return res.json({
      success: true,
      method: "hot-replace-document",
      details: {
        approach: "string-replacement-in-compiled-file",
        searchString,
        replaceString,
        originalSize: originalContent.length,
        updatedSize: updatedContent.length,
        serverDocPath,
        cacheCleared,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`[Hot Replace Document] Error triggering hot replace:`, error);
    return res.status(500).json({
      success: false,
      error: "Hot replace trigger failed",
      message: error.message,
      searchString,
      replaceString,
    });
  }
}
