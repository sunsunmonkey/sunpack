class Chunk {
  constructor(entryModule) {
    this.entryModule = entryModule;
    this.async = entryModule.async;
    this.name = entryModule.name;
    this.files = [];
    this.modules = []; //这个代码块里面包含那些模块
  }
}

module.exports = Chunk;
