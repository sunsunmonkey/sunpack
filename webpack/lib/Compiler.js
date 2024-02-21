const {
  AsyncSeriesHook,
  SyncBailHook,
  AsyncParallelHook,
  SyncHook,
} = require("tapable");
const Compilation = require("./node/Compilation");
const Stats = require("./node/Stats");

const { mkdirp } = require("mkdirp");
const path = require("path");

class Compiler {
  constructor(context) {
    this.context = context;
    this.hooks = {
      entryOption: new SyncBailHook(["context", "entry"]),
      beforeRun: new AsyncSeriesHook(["compiler"]), //运行前
      run: new AsyncSeriesHook(["compiler"]), //运行
      beforeCompile: new AsyncSeriesHook(["params"]), //编译前
      compile: new SyncHook(["params"]), //编译
      make: new AsyncParallelHook(["compilation"]), //make构建
      thisCompilation: new SyncHook(["compilation", "params"]), //开始一次新的编译
      compilation: new SyncHook(["compilation", "params"]), //创建完成一个新的compilation
      afterCompile: new AsyncSeriesHook(["compilation"]), //编译完成
      emit: new AsyncSeriesHook(["compilation"]),
      done: new AsyncSeriesHook(["stats"]), //编译完成后
    };
  }

  emitAssets(compilation, callback) {
    const emitFiles = () => {
      const assets = compilation.assets;
      const outputPath = compilation.options.output.path;
      for (let file in assets) {
        const source = assets[file];
        const targetPath = path.posix.join(outputPath, file);
        this.outputFileSystem.writeFileSync(targetPath, source, "utf8");
      }
      callback();
    };
    //触发emit
    this.hooks.emit.callAsync(compilation, () => {
      mkdirp(this.options.output.path)
        .then(emitFiles)
        .catch((err) => console.log(err));
    });
    // finalCallback(err, new Stats(compilation));
  }

  run(callback) {
    const onCompiled = (err, compilation) => {
      this.emitAssets(compilation, (err) => {
        const stats = new Stats(compilation);
        //在触发done
        this.hooks.done.callAsync(stats, (err) => {
          callback(err, stats);
        });
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
        compilation.seal((err) => {
          this.hooks.afterCompile.callAsync(compilation, (err) => {
            onCompiled(null, compilation);
          });
        });
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
