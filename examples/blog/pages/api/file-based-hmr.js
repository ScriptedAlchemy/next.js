// File-based HMR API endpoint (Method 1)
// Handles chunk replacement without editing source files

const path = require("path");
const fs = require("fs").promises;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.NODE_ENV !== "development") {
    return res
      .status(400)
      .json({ error: "File-based HMR API only available in development" });
  }

  const { action, pagePath } = req.body;

  try {
    console.log(`[File-based HMR API] Processing action: ${action}`);

    switch (action) {
      case "test":
        return res.json({
          success: true,
          message: "File-based HMR API is working",
          method: "file-system-simulation",
          availableActions: ["test", "trigger-hmr", "status"],
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
            note: "No chunk file needed - we modify the existing compiled document",
          },
        });

      case "trigger-hmr":
        if (!pagePath) {
          return res.status(400).json({
            error: "pagePath is required for trigger-hmr action",
          });
        }

        return await triggerFileBasedHMR(pagePath, res);

      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`,
          availableActions: ["test", "trigger-hmr", "status"],
        });
    }
  } catch (error) {
    console.error("[File-based HMR API] Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      method: "file-based-hmr",
    });
  }
}

async function triggerFileBasedHMR(pagePath, res) {
  try {
    console.log(`[File-based HMR] Triggering HMR for: ${pagePath}`);

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
        `[File-based HMR] Read compiled document: ${originalContent.length} bytes`,
      );
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: "Compiled document not found",
        serverDocPath,
        message: "Visit the page first to trigger compilation, then try HMR",
      });
    }

    // Step 2: Perform string replacement (PLACEHOLDER -> Hello world!!)
    const updatedContent = originalContent.replace(
      "PLACEHOLDER",
      "Hello world!!",
    );

    if (updatedContent === originalContent) {
      return res.status(400).json({
        success: false,
        error: "PLACEHOLDER not found in compiled document",
        message: "The compiled document may have already been updated",
      });
    }

    // Step 3: Write the updated content back
    await fs.writeFile(serverDocPath, updatedContent, "utf8");
    console.log(`[File-based HMR] Updated document with string replacement`);

    // Step 5: Try to trigger cache invalidation
    let cacheCleared = false;
    try {
      if (global.__SERVER_HMR__ && global.__SERVER_HMR__.clearModuleCache) {
        const clearResult =
          global.__SERVER_HMR__.clearModuleCache(serverDocPath);
        cacheCleared = clearResult.success;
        console.log(
          "[File-based HMR] Triggered cache invalidation via Server HMR API",
        );
      } else {
        // Fallback: Clear the require cache manually
        if (require.cache[serverDocPath]) {
          delete require.cache[serverDocPath];
          cacheCleared = true;
          console.log("[File-based HMR] Cleared require cache manually");
        }
      }
    } catch (error) {
      console.log("[File-based HMR] Cache clearing failed:", error.message);
    }

    return res.json({
      success: true,
      method: "file-based-hmr",
      pagePath,
      details: {
        approach: "string-replacement",
        originalSize: originalContent.length,
        updatedSize: updatedContent.length,
        serverDocPath,
        cacheCleared,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      `[File-based HMR] Error triggering HMR for ${pagePath}:`,
      error,
    );
    return res.status(500).json({
      success: false,
      error: "HMR trigger failed",
      message: error.message,
      pagePath,
    });
  }
}
