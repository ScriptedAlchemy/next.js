const init = async () => {
  await __webpack_init_sharing__('default')
  const Module = await import('./index')
  window.next = Module
  Module.default().catch(console.error)
}
init()
