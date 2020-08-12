export default new Promise(async(resolve)=>{
  console.log('innit');
  if(!__webpack_share_scopes__.default) {
    await __webpack_init_sharing__("default")
  }
  resolve(import('./index-bootstrap'))
})
