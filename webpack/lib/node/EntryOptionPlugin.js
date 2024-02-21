const SingleEntryPlugin = require("./SingleEntryPlugin");

const itemToPlugin = (context, item, name) => {
  //单入口插件
  return new SingleEntryPlugin(context, item, name);
};

class EntryOptionPlugin {
  apply(compiler) {
    compiler.hooks.entryOption.tap("EntryOPtionPlugin", (context, entry) => {
      if (typeof entry === "string") {
        itemToPlugin(context, entry, "main").apply(compiler);
      } else {
        for (const entryName in entry) {
          itemToPlugin(context, entry[entryName], entryName).apply(compiler);
        }
      }
    });
  }
}

module.exports = EntryOptionPlugin;
