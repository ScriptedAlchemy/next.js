// Temporary workaround for the issue described here:
// https://github.com/vercel/next.js/issues/3775#issuecomment-407438123
// The runtimeChunk doesn't have dynamic import handling code when there hasn't been a dynamic import
// The runtimeChunk can't hot reload itself currently to correct it when adding pages using on-demand-entries
// eslint-disable-next-line no-unused-expressions
// no longer required because we are adding an async import.
__REPLACE_NOOP_IMPORT__
__webpack_require__.e('node_modules_react_index_js').then(()=>{
  // console.log(module, __unused_webpack_exports, __webpack_require__)
  console.log(__webpack_modules__)
  console.log(__webpack_modules__['./node_modules/react/index.js'](module, __unused_webpack_exports, __webpack_require__))
  __webpack_modules__['webpack/sharing/consume/default/react/react'] = __webpack_modules__['./node_modules/react/index.js']
  __webpack_modules__['webpack/sharing/consume/default/react-dom/react-dom'] = __webpack_modules__['./node_modules/react-dom/index.js']
  import('./bootstrap').catch(()=>{
    console.log('caught bootstrap error')
    import('./bootstrap')
  })
})
// async()=>{
//   if(!__webpack_share_scopes__.default) {
//     await __webpack_init_sharing__("default")
//   }
// __webpack_init_sharing__("default")
// console.log(import('react'))
// import('./bootstrap')
// console.log(__webpack_require__('./node_modules/react/index.js'))
