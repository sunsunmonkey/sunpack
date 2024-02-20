const path = require("path");

const { SyncHook } = require("tapable");
const async = require("neo-async");
const ejs = require("ejs");
const fs = require("fs");

const NormalModuleFactory = require("./NormalModuleFactory");
const Chunk = require("./Chunk");
const Parser = require("../../Parser");

const parser = new Parser();
const normalModuleFactory = new NormalModuleFactory();
const mainTemplate = fs.readFileSync(
  path.join(__dirname, "templates", "asyncMain.ejs"),
  "utf8"
);
const chunkTemplate = fs.readFileSync(
  path.join(__dirname, "templates", "chunk.ejs"),
  "utf8"
);

const mainRender = ejs.compile(mainTemplate);
const chunkRender = ejs.compile(chunkTemplate);

class Compilation {
  constructor(compiler) {
    this.compiler = compiler;
    this.options = compiler.options;
    this.context = compiler.context;
    this.inputFileSystem = compiler.inputFileSystem;
    this.outputFileSystem = compiler.outputFileSystem;
    this.entries = []; //入口模块数组，放着所有的入口模块
    this.modules = []; //模块数组，放着所有模块
    this.chunks = []; //所有代码块
    this.files = []; //本次编译所有产出的文件名
    this.assets = {}; //生成资源 key为文件名

    this.hooks = {
      succeedModule: new SyncHook(["module"]),
      seal: new SyncHook(),
      beforeChunks: new SyncHook(),
      afterChunks: new SyncHook(),
    };
  }

  //开始编译一个新入口
  addEntry(context, entry, name, finalCallback) {
    this._addModuleChain(context, entry, name, false, (err, module) => {
      finalCallback(err, module);
    });
  }

  _addModuleChain(context, rawRequest, name, async, callback) {
    this.createModule(
      {
        name,
        context,
        rawRequest,
        resource: path.posix.join(context, rawRequest),
        async,
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
    this.createChunkAssets();
    callback();
  }
  createChunkAssets() {
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      const file = chunk.name + ".js";
      chunk.files.push(file);
      let source;
      if (chunk.async) {
        source = chunkRender({
          chunkName: chunk.name,
          modules: chunk.modules,
        });
      } else {
        source = mainRender({
          entryModuleId: chunk.entryModule.moduleId,
          modules: chunk.modules,
        });
      }

      this.emitAssets(file, source);
    }
  }

  emitAssets(file, source) {
    this.assets[file] = source;
    this.files.push(file);
  }
}

module.exports = Compilation;
