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
  path.join(__dirname, "templates", "deferMain.ejs"),
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
    this._modules = {}; //key是模块id，值是模块对象
    this.chunks = []; //所有代码块
    this.files = []; //本次编译所有产出的文件名
    this.assets = {}; //生成资源 key为文件名
    this.vendors = []; //所有第三方模块isarray
    this.commons = []; // 这里放着同时被多个代码块加载的模块 title.js
    this.commonsCountMap = {}; //每个模块被代码块引用次数,如果大于等于2就分离到commons里
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
    // if (!this._modules[module.moduleId]) {
    this.modules.push(module);
    this._modules[module.moduleId] = module;
    // }

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

    for (const module of this.modules) {
      //第三方模块
      if (/node_modules/.test(module.moduleId)) {
        module.name = "vendors";
        if (this.vendors.indexOf(module) === -1) {
          this.vendors.push(module);
        }
      } else {
        if (this.commonsCountMap[module.moduleId]) {
          this.commonsCountMap[module.moduleId].count++;
        } else {
          //如果是第一次加载该模块，就在commonsCountMap中设置初始值
          this.commonsCountMap[module.moduleId] = { count: 1, module };
        }
      }
    }
    for (const moduleId in this.commonsCountMap) {
      const { module, count } = this.commonsCountMap[moduleId];
      if (count >= 2) {
        module.name = "commons";
        this.commons.push(module);
      }
    }

    const deferredModules = [...this.vendors, ...this.commons].map(
      (module) => module.moduleId
    );

    this.modules = this.modules.filter(
      (module) => !deferredModules.includes(module.moduleId)
    );

    //一般一个入口一个代码块
    for (const entryModule of this.entries) {
      const chunk = new Chunk(entryModule);
      this.chunks.push(chunk);
      chunk.modules = this.modules.filter(
        (module) => module.name === chunk.name
      );
    }

    if (this.vendors.length > 0) {
      const chunk = new Chunk(this.vendors[0]);
      chunk.async = true;
      this.chunks.push(chunk);
      chunk.modules = this.vendors;
    }

    if (this.commons.length > 0) {
      const chunk = new Chunk(this.commons[0]);
      chunk.async = true;

      this.chunks.push(chunk);
      chunk.modules = this.commons;
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
        const deferredChunks = [];
        if (this.vendors.length > 0) deferredChunks.push("vendors");
        if (this.commons.length > 0) deferredChunks.push("commons");

        source = mainRender({
          entryModuleId: chunk.entryModule.moduleId,
          deferredChunks,
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
