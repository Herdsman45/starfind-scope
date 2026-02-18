const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const baseConfig = require('./webpack.config.js');

/**
 * @type {import("webpack").Configuration}
 */
module.exports = {
    ...baseConfig,
    mode: 'production',
    output: {
        ...baseConfig.output,
        publicPath: '/starfind-scope/',
        clean: true,
    },
};
