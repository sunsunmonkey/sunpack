const path = require('path');

module.exports = {
    context:process.cwd(),
    devtool:false,
    mode:'development',
    output:{
        path:path.resolve(__dirname,'dist'),
        filename:'main.js'
    }
}