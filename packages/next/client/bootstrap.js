/* globals __REPLACE_NOOP_IMPORT__ */
import initNextPromise from  './'
import EventSourcePolyfill from './dev/event-source-polyfill'
import initOnDemandEntries from './dev/on-demand-entries-client'
import initWebpackHMR from './dev/webpack-hot-middleware-client'
import initializeBuildWatcher from './dev/dev-build-watcher'
import initializePrerenderIndicator from './dev/prerender-indicator'
import { displayContent } from './dev/fouc'

// Support EventSource on Internet Explorer 11
if (!window.EventSource) {
  window.EventSource = EventSourcePolyfill
}

const {
  __NEXT_DATA__: { assetPrefix },
} = window

const prefix = assetPrefix || ''
const webpackHMR = initWebpackHMR({ assetPrefix: prefix })

export default initNextPromise.then((next)=>{
  window.next = next
  //initNext
  console.log('next',next);

  next.default({ webpackHMR })
    .then(({ renderCtx, render }) => {
      console.log('ready to render')
      initOnDemandEntries({ assetPrefix: prefix })
      if (process.env.__NEXT_BUILD_INDICATOR) initializeBuildWatcher()
      if (
        process.env.__NEXT_PRERENDER_INDICATOR &&
        // disable by default in electron
        !(typeof process !== 'undefined' && 'electron' in process.versions)
      ) {
        initializePrerenderIndicator()
      }

      // delay rendering until after styles have been applied in development
      displayContent(() => {
        render(renderCtx)
      })
    })
    .catch((err) => {
      console.error('Error was not caught', err)
    })

})
