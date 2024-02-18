const EntryOptionPlugin = require("./EntryOptionPlugin");
// 挂载插件
class webpackOptionsApply {
  process(options, compiler) {
    //注册插件
    new EntryOptionPlugin().apply(compiler);
    //触发entryOption钩子 context就是根目录 entry入口
    compiler.hooks.entryOption.call(options.context, options.entry);
  }
}

module.exports = webpackOptionsApply;
