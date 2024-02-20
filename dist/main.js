(function (modules) {
        var installedModules = {};
        function __webpack_require__(moduleId) {
          if (installedModules[moduleId]) {
            return installedModules[moduleId].exports;
          }
          var module = installedModules[moduleId] = {
            i: moduleId,
            l: false,
            exports: {}
          };
          modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
          module.l = true;
          return module.exports;
        }
        return __webpack_require__("./src/index.js");
      })
        ({
          
                "./src/index.js":
                (function (module, exports, __webpack_require__) {
                  let title = __webpack_require__("./src/title.js");
console.log(title);
                }),
            
                "./src/title.js":
                (function (module, exports, __webpack_require__) {
                  module.exports = "title";
                }),
             
        });