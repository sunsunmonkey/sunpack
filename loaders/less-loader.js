const less = require("less");

module.exports = function (source) {
  let css;
  less.render(source, (err, output) => {
    css = output.css;
  });
  return css;
};
