const path = require("path");
const types = require("babel-types");
const generate = require("babel-generator").default;
const traverse = require("babel-traverse").default;
const async = require("neo-async");
const { runLoaders } = require("./loader-runner");

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

      //依赖的绝对路径
      let depResource;

      traverse(this._ast, {
        CallExpression: (nodePath) => {
          const node = nodePath.node;
          if (node.callee.name === "require") {
            node.callee.name = "__webpack_require__";
            const moduleName = node.arguments[0].value; //模块名

            if (moduleName.startsWith(".")) {
              const extName =
                moduleName.split(path.posix.sep).pop().indexOf(".") === -1
                  ? ".js"
                  : "";

              depResource = path.posix.join(
                path.posix.dirname(this.resource),
                moduleName + extName
              );
            } else {
              depResource = require.resolve(
                path.posix.join(this.context, "node_modules", moduleName)
              );
              depResource = depResource.replace(/\\/g, "/");
            }
            const depModuleId = `.${depResource.slice(this.context.length)}`;
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
      //在这里读取硬盘，进行转换
      let {
        module: { rules },
      } = compilation.options;
      let loaders = [];
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.test.test(this.resource)) {
          loaders.push(...rule.use);
        }
      }
      const resolveLoader = (loader) =>
        require.resolve(path.posix.join(this.context, "loaders", loader));
      loaders = loaders.map(resolveLoader);
      runLoaders(
        {
          resource: this.resource,
          loaders,
        },
        (err, { result }) => {
          this._source = result.toString();
          callback();
        }
      );
    });
  }

  getSource(compilation, callback) {
    compilation.inputFileSystem.readFile(this.resource, "utf8", callback);
  }
}

module.exports = NormalModule;
