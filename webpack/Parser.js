const babylon = require("babylon");

class Parser {
  parse(source) {
    return babylon.parse(source, {
      sourceType: "module", //源代码是一个模块
      plugins: ["dynamicImport"], //额外支持一个插件,动态导入import('./title.js')
    });
  }
}

module.exports = Parser;
