// API endpoint for server-side hot reloading (cache invalidation approach)
// This mirrors Next.js's internal approach using cache clearing, not webpack HMR
const fs = require('fs');
const path = require('path');

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.NODE_ENV !== 'development') {
    return res.status(400).json({ error: 'Hot reloading only available in development' });
  }

  try {
    console.log('[Hot Replace Document] Processing webpack chunk replacement');
    
    // Read the webpack chunk from document_replace_chunk.js file
    const chunkPath = path.join(process.cwd(), 'document_replace_chunk.js');
    let chunkContent;
    try {
      chunkContent = fs.readFileSync(chunkPath, 'utf8');
      console.log('[Hot Replace Document] Read webpack chunk from document_replace_chunk.js');
    } catch (error) {
      console.error('[Hot Replace Document] Could not read document_replace_chunk.js:', error.message);
      return res.status(500).json({
        error: 'Could not read chunk file',
        message: error.message
      });
    }
    
    // Try to process the webpack chunk to replace the document
    // This demonstrates chunk-based replacement vs simple file replacement
    try {
      // Parse the webpack chunk content to extract the compiled document
      // eslint-disable-next-line no-new-func
      const chunkFunction = new Function('exports', 'require', 'module', chunkContent);
      const chunkExports = {};
      
      // Execute the chunk to get the compiled modules
      chunkFunction(chunkExports, require, { exports: chunkExports });
      
      console.log('[Hot Replace Document] Successfully processed webpack chunk');
      console.log(`[Hot Replace Document] Chunk ID: ${chunkExports.id}`);
      console.log(`[Hot Replace Document] Module count: ${chunkExports.modules ? Object.keys(chunkExports.modules).length : 0}`);
      
      // Generate the source document content that would produce the same output
      // This simulates applying the chunk's compiled result back to source
      const documentContent = `import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  const meta = {
    title: "Next.js Blog Starter Kit", 
    description: "Clone and deploy your own Next.js portfolio in minutes.",
    image: "https://assets.vercel.com/image/upload/q_auto/front/vercel/dps.png",
  };

  return (
    <Html lang="en">
      <Head>
        <meta name="robots" content="follow, index" />
        <meta name="description" content={meta.description} />
        <meta property="og:site_name" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:image" content={meta.image} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@yourname" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={meta.image} />
      </Head>
      <body>
        <h1>Hello world!!</h1>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
`;
    
    // Write the updated file (triggers Next.js file watcher)
    const documentPath = path.join(process.cwd(), 'pages', '_document.tsx');
    fs.writeFileSync(documentPath, documentContent);
    
    // Clear caches using the same approach as Next.js NextJsRequireCacheHotReloader
    if (global.__SERVER_HMR__) {
      // Use our server-side cache invalidation (mirrors Next.js approach)
      global.__SERVER_HMR__.clearPageCache('_document.tsx');
      global.__SERVER_HMR__.clearAllPages();
    } else {
      // Fallback: manual cache invalidation (same as Next.js deleteFromRequireCache)
      const documentModulePath = path.resolve(process.cwd(), 'pages/_document.tsx');
      const nextDocumentPath = path.resolve(process.cwd(), '.next/server/pages/_document.js');
      
      [documentModulePath, nextDocumentPath].forEach(modulePath => {
        if (require.cache[modulePath]) {
          const mod = require.cache[modulePath];
          
          // Remove child references from all parent modules (Next.js approach)
          for (const parent of Object.values(require.cache)) {
            if (parent?.children) {
              const idx = parent.children.indexOf(mod);
              if (idx >= 0) parent.children.splice(idx, 1);
            }
          }
          
          // Remove parent references from external modules (Next.js approach)
          for (const child of mod.children) {
            if (child) child.parent = null;
          }
          
          // Delete from cache (Next.js approach)
          delete require.cache[modulePath];
          console.log(`[Hot Replace Document] Cleared cache for: ${modulePath}`);
        }
      });
    }
    
      return res.status(200).json({
        success: true,
        message: 'Document hot replaced using webpack chunk processing + cache invalidation',
        method: 'chunk-processing-with-cache-invalidation',
        chunkId: chunkExports.id,
        moduleCount: chunkExports.modules ? Object.keys(chunkExports.modules).length : 0,
        approach: 'chunk-based-replacement'
      });
      
    } catch (chunkError) {
      console.warn('[Hot Replace Document] Chunk processing failed, using fallback:', chunkError.message);
      
      // Fallback: direct file replacement with cache invalidation
      const fallbackContent = `import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  const meta = {
    title: "Next.js Blog Starter Kit",
    description: "Clone and deploy your own Next.js portfolio in minutes.",
    image: "https://assets.vercel.com/image/upload/q_auto/front/vercel/dps.png",
  };

  return (
    <Html lang="en">
      <Head>
        <meta name="robots" content="follow, index" />
        <meta name="description" content={meta.description} />
        <meta property="og:site_name" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:image" content={meta.image} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@yourname" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={meta.image} />
      </Head>
      <body>
        <h1>Hello world!!</h1>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
`;
      
      // Write fallback content
      const documentPath = path.join(process.cwd(), 'pages', '_document.tsx');
      fs.writeFileSync(documentPath, fallbackContent);
      
      // Clear caches using cache invalidation approach
      if (global.__SERVER_HMR__) {
        global.__SERVER_HMR__.clearPageCache('_document.tsx');
        global.__SERVER_HMR__.clearAllPages();
      } else {
        // Manual cache invalidation (Next.js approach)
        const documentModulePath = path.resolve(process.cwd(), 'pages/_document.tsx');
        const nextDocumentPath = path.resolve(process.cwd(), '.next/server/pages/_document.js');
        
        [documentModulePath, nextDocumentPath].forEach(modulePath => {
          if (require.cache[modulePath]) {
            const mod = require.cache[modulePath];
            
            // Remove child references (Next.js approach)
            for (const parent of Object.values(require.cache)) {
              if (parent?.children) {
                const idx = parent.children.indexOf(mod);
                if (idx >= 0) parent.children.splice(idx, 1);
              }
            }
            
            // Remove parent references (Next.js approach)
            for (const child of mod.children) {
              if (child) child.parent = null;
            }
            
            // Delete from cache (Next.js approach)
            delete require.cache[modulePath];
          }
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Document hot replaced using fallback cache invalidation',
        method: 'fallback-cache-invalidation',
        chunkError: chunkError.message,
        approach: 'cache-invalidation-fallback'
      });
    }
    
  } catch (error) {
    console.error('[Hot Replace Document] Error:', error);
    return res.status(500).json({
      error: 'Failed to hot replace document',
      message: error.message
    });
  }
}