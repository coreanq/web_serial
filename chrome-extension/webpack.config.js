const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDevelopment = !isProduction;
  
  return {
    // Multiple entry points for Chrome extension
    entry: {
      popup: path.resolve(__dirname, '../src/popup.ts'),
      background: path.resolve(__dirname, '../src/background.ts'),
      options: path.resolve(__dirname, '../src/options.ts'),
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, '../src'),
      },
    },
    
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'postcss-loader',
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'icons/[name][ext]'
          }
        },
      ],
    },
    
    plugins: [
      // HTML plugins for each page
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'templates/popup.html'),
        filename: 'popup.html',
        chunks: ['popup'],
        minify: isProduction,
      }),
      
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'templates/options.html'), 
        filename: 'options.html',
        chunks: ['options'],
        minify: isProduction,
      }),
      
      // CSS extraction for production
      ...(isProduction ? [new MiniCssExtractPlugin({
        filename: '[name].css',
      })] : []),
      
      // Copy static files
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'manifest.json'),
            to: path.resolve(__dirname, 'dist/manifest.json'),
          },
          {
            from: path.resolve(__dirname, 'icons'),
            to: path.resolve(__dirname, 'dist/icons'),
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    
    // Chrome extension specific optimizations
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    },
    
    devtool: isDevelopment ? 'cheap-module-source-map' : false,
    
    // Watch mode for development
    watch: isDevelopment,
    watchOptions: {
      ignored: /node_modules/,
      poll: 1000,
    },
  };
};