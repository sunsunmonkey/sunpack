const path = require("path");

const { SyncHook } = require("tapable");
const async = require("neo-async");

const NormalModuleFactory = require("./NormalModuleFactory");
const Chunk = require("./Chunk");
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
    this.chunks = [];
    this.hooks = {
      succeedModule: new SyncHook(["module"]),
      seal: new SyncHook(),
      beforeChunks: new SyncHook(),
      afterChunks: new SyncHook(),
    };
  }

  //开始编译一个新入口
  addEntry(context, entry, name, finalCallback) {
    this._addModuleChain(context, entry, name, (err, module) => {
      finalCallback(err, module);
    });
  }

  _addModuleChain(context, rawRequest, name, callback) {
    this.createModule(
      {
        name,
        context,
        rawRequest,
        resource: path.posix.join(context, rawRequest),
        parser,
      },
      (entryModule) => this.entries.push(entryModule),
      callback
    );
  }
  createModule(data, addEntry, callback) {
    const module = normalModuleFactory.create(data);

    addEntry && addEntry(module);
    this.modules.push(module);

    const afterBuild = (err, module) => {
      if (module.dependencies.length > 0) {
        this.processModuleDependencies(module, (err) => {
          callback(err);
        });
      } else {
        return callback(err, module);
      }
    };

    this.buildModule(module, afterBuild);
  }

  processModuleDependencies(module, callback) {
    const dependencies = module.dependencies;
    async.forEach(
      dependencies,
      (dependency, done) => {
        const { name, context, rawRequest, resource, moduleId } = dependency;
        this.createModule(
          {
            name,
            context,
            rawRequest,
            resource,
            parser,
            moduleId,
          },
          null,
          done
        );
      },
      callback
    );
  }
  buildModule(module, afterBuild) {
    module.build(this, (err) => {
      //模块编译成功
      this.hooks.succeedModule.call(module);
      afterBuild(err, module);
    });
  }

  //封装
  seal(callback) {
    this.hooks.seal.call();
    this.hooks.beforeChunks.call();

    //一般一个入口一个代码块
    for (const entryModule of this.entries) {
      const chunk = new Chunk(entryModule);
      this.chunks.push(chunk);
      chunk.modules = this.modules.filter(
        (module) => module.name === chunk.name
      );
    }

    this.hooks.afterChunks.call(this.chunks);
    callback();
  }
}

module.exports = Compilation;
