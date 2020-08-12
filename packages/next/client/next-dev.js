// Temporary workaround for the issue described here:
// https://github.com/vercel/next.js/issues/3775#issuecomment-407438123
// The runtimeChunk doesn't have dynamic import handling code when there hasn't been a dynamic import
// The runtimeChunk can't hot reload itself currently to correct it when adding pages using on-demand-entries
// eslint-disable-next-line no-unused-expressions
// no longer required because we are adding an async import.
// __REPLACE_NOOP_IMPORT__

// async()=>{
//   if(!__webpack_share_scopes__.default) {
//     await __webpack_init_sharing__("default")
//   }
__webpack_init_sharing__("default")
Promise.all([import('react'),import('react-dom')]).then(()=>{
  // import('./bootstrap');
  console.log('react ready')
})
// })

