const {
  AsyncSeriesHook,
  SyncBailHook,
  AsyncParallelHook,
  SyncHook,
} = require("tapable");
const Compilation = require('./node/Compilation');

class Compiler {
  constructor(context) {
    this.context = context;
    this.hooks = {
      entryOption: new SyncBailHook(["context", "entry"]),
      beforeRun: new AsyncSeriesHook(["compiler"]), //运行前
      run: new AsyncSeriesHook(["compiler"]), //运行
      done: new AsyncSeriesHook(["stats"]), //编译完成后
      beforeCompile: new AsyncSeriesHook(["params"]), //编译前
      compile: new SyncHook(["params"]), //编译
      make: new AsyncParallelHook(["compilation"]), //make构建
      thisCompilation: new SyncHook(["compilation", "params"]), //开始一次新的编译
      compilation: new SyncHook(["compilation", "params"]), //创建完成一个新的compilation
      afterCompile: new AsyncSeriesHook(["compilation"]), //编译完成
    };
  }

  run(callback) {
    console.log("run");
    //最终回调
    const finalCallback = (err, stats) => {
      callback(err, stats);
    };

    const onCompiled = (err, compilation) => {
      console.log("onCompiled");
      finalCallback(err, {
        entries: [],
        chunks: [],
        module: [],
        assets: [],
      });
    };

    this.hooks.beforeRun.callAsync(this, (err) => {
      this.hooks.run.callAsync(this, (err) => {
        this.compile(onCompiled);
      });
    });
  }

  compile(onCompiled) {
    const params = this.newCompilationParams();
    this.hooks.beforeCompile.callAsync(params, (err) => {
      this.hooks.compile.call(params);
      const compilation = this.newCompilationParams(params);
      this.hooks.make.callAsync(compilation, (err) => {
        console.log("make完成");
        onCompiled();
      });
    });
  }

  newCompilationParams() {
    const params = {
      //创建compilation之前已经创建了一个普通模块工厂
      normalModuleFactory: new NormalModuleFactory(),
    };
    return params;
  }
  createCompilation() {
    return new Compilation(this);
  }
  newCompilationParams(params) {
    const compilation = this.createCompilation();
    this.hooks.thisCompilation.call(compilation, params);
    this.hooks.compilation.call(compilation, params);
    return compilation;
  }
}

module.exports = Compiler;
