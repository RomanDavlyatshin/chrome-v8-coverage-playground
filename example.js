function sample() {
  return {
    set() {
      console.log('set');
    },
    get() {
      console.log('get');
    }
  }
}
