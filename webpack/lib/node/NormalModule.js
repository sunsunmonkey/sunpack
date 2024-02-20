const path = require("path");
const types = require("babel-types");
const generate = require("babel-generator").default;
const traverse = require("babel-traverse").default;
const async = require("neo-async");
class NormalModule {
  constructor({
    name,
    context,
    rawRequest,
    resource,
    parser,
    moduleId,
    async,
  }) {
    this.name = name;
    this.context = context;
    this.rawRequest = rawRequest;
    this.resource = resource;
    this.parser = parser;
    this.moduleId = moduleId || "./" + path.posix.relative(context, resource);
    this._source; //此模块对应源码
    this._ast; //ast
    this.dependencies = [];
    //异步代码块
    this.blocks = [];
    //表示当前代码块是异步的还是同步的
    this.async = async;
  }

  build(compilation, callback) {
    this.doBuild(compilation, (err) => {
      //得到语法树
      this._ast = this.parser.parse(this._source);
      //遍历语法树
      traverse(this._ast, {
        CallExpression: (nodePath) => {
          const node = nodePath.node;
          if (node.callee.name === "require") {
            node.callee.name = "__webpack_require__";
            const moduleName = node.arguments[0].value; //模块名
            const extName =
              moduleName.split(path.posix.sep).pop().indexOf(".") === -1
                ? ".js"
                : "";

            const depResource = path.posix.join(
              path.posix.dirname(this.resource),
              moduleName + extName
            );
            //依赖的模块Id
            const depModuleId = `./${path.posix.relative(
              this.context,
              depResource
            )}`;
            node.arguments = [types.stringLiteral(depModuleId)];
            this.dependencies.push({
              name: this.name,
              context: this.context,
              rawRequest: moduleName,
              moduleId: depModuleId,
              resource: depResource,
            });
            //判断是不是import 动态
          } else if (types.isImport(node.callee)) {
            const moduleName = node.arguments[0].value;
            const extName =
              moduleName.split(path.posix.sep).pop().indexOf(".") === -1
                ? ".js"
                : "";

            const depResource = path.posix.join(
              path.posix.dirname(this.resource),
              moduleName + extName
            );

            const depModuleId = `./${path.posix.relative(
              this.context,
              depResource
            )}`;
            let chunkName = "0";
            if (
              Array.isArray(node.arguments[0].leadingComments) &&
              node.arguments[0].leadingComments.length > 0
            ) {
              const leadingComments =
                node.arguments[0].leadingComments[0].value;
              const regexp = /webpackChunkName:\s*['"]([^'"]+)['"]/;
              chunkName = leadingComments.match(regexp)[1];
            }
            nodePath.replaceWithSourceString(
              `__webpack_require__.e("${chunkName}").then(__webpack_require__.bind(null,"${depModuleId}",7))`
            );
            this.blocks.push({
              context: this.context,
              entry: depModuleId,
              name: chunkName,
              async: true,
            });
          }
        },
      });
      let { code } = generate(this._ast);
      this._source = code;
      async.forEach(
        this.blocks,
        (block, done) => {
          const { context, entry, name, async } = block;
          compilation._addModuleChain(context, entry, name, async, done);
        },
        callback
      );
    });
  }

  doBuild(compilation, callback) {
    this.getSource(compilation, (err, source) => {
      this._source = source;
      callback();
    });
  }

  getSource(compilation, callback) {
    compilation.inputFileSystem.readFile(this.resource, "utf8", callback);
  }
}

module.exports = NormalModule;
