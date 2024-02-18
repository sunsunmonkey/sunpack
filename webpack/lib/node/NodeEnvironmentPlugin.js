const fs = require("fs");

class NodeEnvironmentPlugin {
  constructor(options) {
    this.options = options || {};
  }
  apply(compiler) {
    compiler.inputFileSystem = fs; //读取文件使用的模块
    compiler.outputFileSystem = fs; //写文件使用的模块
  }
}

module.exports = NodeEnvironmentPlugin;