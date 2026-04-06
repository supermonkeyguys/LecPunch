const path = require('path');

module.exports = (options) => {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      alias: {
        '@lecpunch/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts')
      },
      extensions: ['.ts', '.js', '.json']
    }
  };
};
