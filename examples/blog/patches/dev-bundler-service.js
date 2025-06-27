/* eslint-disable @typescript-eslint/no-use-before-define */
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DevBundlerService", {
    enumerable: true,
    get: function() {
        return DevBundlerService;
    }
});
const _lrucache = require("./lru-cache");
const _mockrequest = require("./mock-request");
const _hotreloadertypes = require("../dev/hot-reloader-types");
class DevBundlerService {
    constructor(bundler, handler){
        this.bundler = bundler;
        this.handler = handler;
        
        // Enhanced ensurePage with comprehensive API exposure and hooks
        const originalEnsurePage = async (definition) => {
            return await this.bundler.hotReloader.ensurePage(definition);
        };
        
        this.ensurePage = async (definition) => {
            // Initialize global API if not already done
            if (!global.__NEXT_ENSURE_PAGE_API__) {
                global.__NEXT_ENSURE_PAGE_API__ = {
                    calls: [],
                    hooks: {
                        pre: [],
                        post: []
                    },
                    originalEnsurePage,
                    bundler: this.bundler,
                    handler: this.handler,
                    
                    // API methods
                    addPreHook: (hook) => global.__NEXT_ENSURE_PAGE_API__.hooks.pre.push(hook),
                    addPostHook: (hook) => global.__NEXT_ENSURE_PAGE_API__.hooks.post.push(hook),
                    clearHooks: () => {
                        global.__NEXT_ENSURE_PAGE_API__.hooks.pre = [];
                        global.__NEXT_ENSURE_PAGE_API__.hooks.post = [];
                    },
                    getStats: () => ({
                        totalCalls: global.__NEXT_ENSURE_PAGE_API__.calls.length,
                        successfulCalls: global.__NEXT_ENSURE_PAGE_API__.calls.filter(c => c.success).length,
                        failedCalls: global.__NEXT_ENSURE_PAGE_API__.calls.filter(c => c.success === false).length,
                        averageDuration: global.__NEXT_ENSURE_PAGE_API__.calls.length > 0
                            ? global.__NEXT_ENSURE_PAGE_API__.calls.reduce((sum, c) => sum + (c.duration || 0), 0) / global.__NEXT_ENSURE_PAGE_API__.calls.length
                            : 0,
                        recentCalls: global.__NEXT_ENSURE_PAGE_API__.calls.slice(-10),
                        pageStats: global.__NEXT_ENSURE_PAGE_API__.calls.reduce((stats, call) => {
                            const page = call.page || 'unknown';
                            if (!stats[page]) {
                                stats[page] = { count: 0, totalDuration: 0, failures: 0 };
                            }
                            stats[page].count++;
                            stats[page].totalDuration += call.duration || 0;
                            if (call.success === false) stats[page].failures++;
                            return stats;
                        }, {})
                    }),
                    clearStats: () => { global.__NEXT_ENSURE_PAGE_API__.calls = []; }
                };
                
                // Expose hot reloader and bundler for advanced access
                global.__NEXT_DEV_HOT_RELOADER__ = this.bundler.hotReloader;
                global.__NEXT_DEV_BUNDLER__ = this.bundler;
                global.__NEXT_DEV_BUNDLER_SERVICE__ = this;
                
                console.log("[Dev Bundler Service Patch] Enhanced ensurePage API exposed globally");
                console.log("[Dev Bundler Service Patch] Available globals:");
                console.log("  - global.__NEXT_ENSURE_PAGE_API__ (ensurePage hooks and stats)");
                console.log("  - global.__NEXT_DEV_HOT_RELOADER__ (hot reloader access)");
                console.log("  - global.__NEXT_DEV_BUNDLER__ (bundler access)");
                console.log("  - global.__NEXT_DEV_BUNDLER_SERVICE__ (bundler service access)");
            }
            
            const startTime = Date.now();
            const callId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Create call info
            const callInfo = {
                callId,
                timestamp: startTime,
                page: definition.page,
                definition: { ...definition },
                success: null,
                duration: null,
                error: null
            };
            
            global.__NEXT_ENSURE_PAGE_API__.calls.push(callInfo);
            
            console.log(`[EnsurePage] Starting: ${definition.page} (${callId})`);
            
            try {
                // Execute pre-hooks
                for (const preHook of global.__NEXT_ENSURE_PAGE_API__.hooks.pre) {
                    try {
                        await preHook(definition, callInfo);
                    } catch (hookError) {
                        console.error(`[EnsurePage] Pre-hook error:`, hookError);
                    }
                }
                
                // Built-in pre-processing logic
                if (definition.page === "/posts/markdown") {
                    console.log("[EnsurePage] Markdown page compilation detected - applying custom logic");
                }
                if (definition.page === "/_document") {
                    console.log("[EnsurePage] Document page compilation detected - preparing custom handling");
                }
                if (definition.page?.startsWith("/api/")) {
                    console.log("[EnsurePage] API route compilation detected");
                }
                
                // Call original ensurePage implementation
                const result = await originalEnsurePage(definition);
                
                // Calculate duration
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // Update call info
                callInfo.success = true;
                callInfo.duration = duration;
                callInfo.completed = endTime;
                
                console.log(`[EnsurePage] Completed: ${definition.page} (${duration}ms)`);
                
                // Execute post-hooks
                for (const postHook of global.__NEXT_ENSURE_PAGE_API__.hooks.post) {
                    try {
                        await postHook(definition, result, callInfo);
                    } catch (hookError) {
                        console.error(`[EnsurePage] Post-hook error:`, hookError);
                    }
                }
                
                // Built-in post-processing logic
                // Send custom HMR message if hot reloader is available
                if (this.bundler.hotReloader && this.bundler.hotReloader.send) {
                    try {
                        this.bundler.hotReloader.send({
                            action: "custom-ensure-complete",
                            page: definition.page,
                            duration: duration,
                            timestamp: endTime,
                            callId: callId
                        });
                    } catch (hmrError) {
                        // Ignore HMR send errors
                    }
                }
                
                return result;
                
            } catch (error) {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // Update call info
                callInfo.success = false;
                callInfo.duration = duration;
                callInfo.completed = endTime;
                callInfo.error = error.message;
                
                console.error(`[EnsurePage] Error: ${definition.page} (${duration}ms)`, error);
                
                throw error;
            }
        };
        this.logErrorWithOriginalStack = this.bundler.logErrorWithOriginalStack.bind(this.bundler);
        this.appIsrManifestInner = new _lrucache.LRUCache(8000, function length() {
            return 16;
        });
    }
    async getFallbackErrorComponents(url) {
        await this.bundler.hotReloader.buildFallbackError();
        // Build the error page to ensure the fallback is built too.
        // TODO: See if this can be moved into hotReloader or removed.
        await this.bundler.hotReloader.ensurePage({
            page: '/_error',
            clientOnly: false,
            definition: undefined,
            url
        });
    }
    async getCompilationError(page) {
        const errors = await this.bundler.hotReloader.getCompilationErrors(page);
        if (!errors) return;
        // Return the very first error we found.
        return errors[0];
    }
    async revalidate({ urlPath, revalidateHeaders, opts: revalidateOpts }) {
        const mocked = (0, _mockrequest.createRequestResponseMocks)({
            url: urlPath,
            headers: revalidateHeaders
        });
        await this.handler(mocked.req, mocked.res);
        await mocked.res.hasStreamed;
        if (mocked.res.getHeader('x-nextjs-cache') !== 'REVALIDATED' && mocked.res.statusCode !== 200 && !(mocked.res.statusCode === 404 && revalidateOpts.unstable_onlyGenerated)) {
            throw Object.defineProperty(new Error(`Invalid response ${mocked.res.statusCode}`), "__NEXT_ERROR_CODE", {
                value: "E175",
                enumerable: false,
                configurable: true
            });
        }
        return {};
    }
    get appIsrManifest() {
        const serializableManifest = {};
        for (const key of this.appIsrManifestInner.keys()){
            serializableManifest[key] = this.appIsrManifestInner.get(key);
        }
        return serializableManifest;
    }
    setIsrStatus(key, value) {
        var _this_bundler_hotReloader, _this_bundler;
        if (value === null) {
            this.appIsrManifestInner.remove(key);
        } else {
            this.appIsrManifestInner.set(key, value);
        }
        (_this_bundler = this.bundler) == null ? void 0 : (_this_bundler_hotReloader = _this_bundler.hotReloader) == null ? void 0 : _this_bundler_hotReloader.send({
            action: _hotreloadertypes.HMR_ACTIONS_SENT_TO_BROWSER.ISR_MANIFEST,
            data: this.appIsrManifest
        });
    }
    close() {
        this.bundler.hotReloader.close();
    }
}

//# sourceMappingURL=dev-bundler-service.js.map