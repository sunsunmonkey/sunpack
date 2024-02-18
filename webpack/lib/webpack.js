const Compiler = require("./Compiler");
const NodeEnvironmentPlugin = require("./node/NodeEnvironmentPlugin");
const webpackOptionsApply = require("./node/webpackOptionsApply");

const webpack = (options) => {
  let compiler = new Compiler(options.context);
  compiler.options = options;
  new NodeEnvironmentPlugin(options).apply(compiler);

  //挂载plugins
  if (options.plugins && Array.isArray(options.plugins)) {
    for (const plugin of options.plugins) {
      plugin.apply(compiler);
    }
  }
  new webpackOptionsApply().process(options, compiler);
  
  return compiler;
};

exports = module.exports = webpack;
