const path = require("path");

const { SyncHook } = require("tapable");

const NormalModuleFactory = require("./NormalModuleFactory");
const Parser = require("../../Parser");

const parser = new Parser();
const normalModuleFactory = new NormalModuleFactory();

class Compilation {
  constructor(compiler) {
    this.compiler = compiler;
    this.options = compiler.options;
    this.context = compiler.context;
    this.inputFileSystem = compiler.inputFileSystem;
    this.outputFileSystem = compiler.outputFileSystem;
    this.entries = []; //入口模块数组，放着所有的入口模块
    this.modules = []; //模块数组，放着所有模块
    this.hooks = {
      succeedModule: new SyncHook(["module"]),
    };
  }

  //开始编译一个新入口
  addEntry(context, entry, name, finalCallback) {
    this._addModuleChain(context, entry, name, (err, module) => {
      finalCallback(err, module);
    });
  }

  _addModuleChain(context, rawRequest, name, callback) {
    const entryModule = normalModuleFactory.create({
      name, //main
      context, //cwd
      rawRequest, //./src/index.js
      resource: path.posix.join(context, rawRequest), //入口绝对路径
      parser,
    });
    this.entries.push(entryModule);
    this.modules.push(entryModule);

    const afterBuild = (err) => {
      return callback(null, entryModule);
    };

    this.buildModule(entryModule, afterBuild);
  }

  buildModule(module, afterBuild) {
    module.build(this, (err) => {
      //模块编译成功
      this.hooks.succeedModule.call(module);
      afterBuild(err);
    });
  }
}

module.exports = Compilation;
