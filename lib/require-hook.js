'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = registerRequireExtension;

var _mimeTypes = require('./mime-types');

var _mimeTypes2 = _interopRequireDefault(_mimeTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const requirableMimeTypes = ['application/javascript', 'application/json'];

/**
 * Initializes the node.js hook that allows us to intercept files loaded by
 * node.js and rewrite them. This method along with {@link initializeProtocolHook}
 * are the top-level methods that electron-compile actually uses to intercept
 * code that Electron loads.
 *
 * @param  {CompilerHost} compilerHost  The compiler host to use for compilation.
 */
function registerRequireExtension(compilerHost) {
  Object.keys(compilerHost.compilersByMimeType).forEach(inputMimeType => {
    const compiler = compilerHost.compilersByMimeType[inputMimeType];
    const outputMimeType = compiler.constructor.getOutputMimeType();

    // Only expose extensions to NodeJS if the output of the compiler is
    // supported by NodeJS. This prevents module.resolve from returning
    // `index.less`, for example, and trying to load LESS as JavaScript.
    if (!outputMimeType || !(requirableMimeTypes.indexOf(outputMimeType) !== -1)) {
      return;
    }

    _mimeTypes2.default.extensions(inputMimeType).forEach(ext => {
      require.extensions[`.${ ext }`] = (module, filename) => {
        var _compilerHost$compile = compilerHost.compileSync(filename);

        let code = _compilerHost$compile.code;

        module._compile(code, filename);
      };
    });
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9yZXF1aXJlLWhvb2suanMiXSwibmFtZXMiOlsicmVnaXN0ZXJSZXF1aXJlRXh0ZW5zaW9uIiwicmVxdWlyYWJsZU1pbWVUeXBlcyIsImNvbXBpbGVySG9zdCIsIk9iamVjdCIsImtleXMiLCJjb21waWxlcnNCeU1pbWVUeXBlIiwiZm9yRWFjaCIsImlucHV0TWltZVR5cGUiLCJjb21waWxlciIsIm91dHB1dE1pbWVUeXBlIiwiY29uc3RydWN0b3IiLCJnZXRPdXRwdXRNaW1lVHlwZSIsImluY2x1ZGVzIiwiZXh0ZW5zaW9ucyIsImV4dCIsInJlcXVpcmUiLCJtb2R1bGUiLCJmaWxlbmFtZSIsImNvbXBpbGVTeW5jIiwiY29kZSIsIl9jb21waWxlIl0sIm1hcHBpbmdzIjoiOzs7OztrQkFld0JBLHdCOztBQWZ4Qjs7Ozs7O0FBRUEsTUFBTUMsc0JBQXNCLENBQzFCLHdCQUQwQixFQUUxQixrQkFGMEIsQ0FBNUI7O0FBS0E7Ozs7Ozs7O0FBUWUsU0FBU0Qsd0JBQVQsQ0FBa0NFLFlBQWxDLEVBQWdEO0FBQzdEQyxTQUFPQyxJQUFQLENBQVlGLGFBQWFHLG1CQUF6QixFQUE4Q0MsT0FBOUMsQ0FBdURDLGFBQUQsSUFBbUI7QUFDdkUsVUFBTUMsV0FBV04sYUFBYUcsbUJBQWIsQ0FBaUNFLGFBQWpDLENBQWpCO0FBQ0EsVUFBTUUsaUJBQWlCRCxTQUFTRSxXQUFULENBQXFCQyxpQkFBckIsRUFBdkI7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsUUFBSSxDQUFDRixjQUFELElBQW1CLEVBQUNSLG9CQUFvQlcsT0FBcEIsQ0FBNkJILGNBQTdCLENBQUQsUUFBdkIsRUFBc0U7QUFDcEU7QUFDRDs7QUFFRCx3QkFBVUksVUFBVixDQUFxQk4sYUFBckIsRUFBb0NELE9BQXBDLENBQTZDUSxHQUFELElBQVM7QUFDbkRDLGNBQVFGLFVBQVIsQ0FBb0IsS0FBR0MsR0FBSSxHQUEzQixJQUFnQyxDQUFDRSxNQUFELEVBQVNDLFFBQVQsS0FBc0I7QUFBQSxvQ0FDdkNmLGFBQWFnQixXQUFiLENBQXlCRCxRQUF6QixDQUR1Qzs7QUFBQSxZQUMvQ0UsSUFEK0MseUJBQy9DQSxJQUQrQzs7QUFFcERILGVBQU9JLFFBQVAsQ0FBZ0JELElBQWhCLEVBQXNCRixRQUF0QjtBQUNELE9BSEQ7QUFJRCxLQUxEO0FBTUQsR0FqQkQ7QUFrQkQiLCJmaWxlIjoicmVxdWlyZS1ob29rLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IG1pbWVUeXBlcyBmcm9tICcuL21pbWUtdHlwZXMnO1xuXG5jb25zdCByZXF1aXJhYmxlTWltZVR5cGVzID0gW1xuICAnYXBwbGljYXRpb24vamF2YXNjcmlwdCcsXG4gICdhcHBsaWNhdGlvbi9qc29uJyxcbl07XG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdGhlIG5vZGUuanMgaG9vayB0aGF0IGFsbG93cyB1cyB0byBpbnRlcmNlcHQgZmlsZXMgbG9hZGVkIGJ5XG4gKiBub2RlLmpzIGFuZCByZXdyaXRlIHRoZW0uIFRoaXMgbWV0aG9kIGFsb25nIHdpdGgge0BsaW5rIGluaXRpYWxpemVQcm90b2NvbEhvb2t9XG4gKiBhcmUgdGhlIHRvcC1sZXZlbCBtZXRob2RzIHRoYXQgZWxlY3Ryb24tY29tcGlsZSBhY3R1YWxseSB1c2VzIHRvIGludGVyY2VwdFxuICogY29kZSB0aGF0IEVsZWN0cm9uIGxvYWRzLlxuICpcbiAqIEBwYXJhbSAge0NvbXBpbGVySG9zdH0gY29tcGlsZXJIb3N0ICBUaGUgY29tcGlsZXIgaG9zdCB0byB1c2UgZm9yIGNvbXBpbGF0aW9uLlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZWdpc3RlclJlcXVpcmVFeHRlbnNpb24oY29tcGlsZXJIb3N0KSB7XG4gIE9iamVjdC5rZXlzKGNvbXBpbGVySG9zdC5jb21waWxlcnNCeU1pbWVUeXBlKS5mb3JFYWNoKChpbnB1dE1pbWVUeXBlKSA9PiB7XG4gICAgY29uc3QgY29tcGlsZXIgPSBjb21waWxlckhvc3QuY29tcGlsZXJzQnlNaW1lVHlwZVtpbnB1dE1pbWVUeXBlXTtcbiAgICBjb25zdCBvdXRwdXRNaW1lVHlwZSA9IGNvbXBpbGVyLmNvbnN0cnVjdG9yLmdldE91dHB1dE1pbWVUeXBlKCk7XG5cbiAgICAvLyBPbmx5IGV4cG9zZSBleHRlbnNpb25zIHRvIE5vZGVKUyBpZiB0aGUgb3V0cHV0IG9mIHRoZSBjb21waWxlciBpc1xuICAgIC8vIHN1cHBvcnRlZCBieSBOb2RlSlMuIFRoaXMgcHJldmVudHMgbW9kdWxlLnJlc29sdmUgZnJvbSByZXR1cm5pbmdcbiAgICAvLyBgaW5kZXgubGVzc2AsIGZvciBleGFtcGxlLCBhbmQgdHJ5aW5nIHRvIGxvYWQgTEVTUyBhcyBKYXZhU2NyaXB0LlxuICAgIGlmICghb3V0cHV0TWltZVR5cGUgfHwgIXJlcXVpcmFibGVNaW1lVHlwZXMuaW5jbHVkZXMob3V0cHV0TWltZVR5cGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbWltZVR5cGVzLmV4dGVuc2lvbnMoaW5wdXRNaW1lVHlwZSkuZm9yRWFjaCgoZXh0KSA9PiB7XG4gICAgICByZXF1aXJlLmV4dGVuc2lvbnNbYC4ke2V4dH1gXSA9IChtb2R1bGUsIGZpbGVuYW1lKSA9PiB7XG4gICAgICAgIGxldCB7Y29kZX0gPSBjb21waWxlckhvc3QuY29tcGlsZVN5bmMoZmlsZW5hbWUpO1xuICAgICAgICBtb2R1bGUuX2NvbXBpbGUoY29kZSwgZmlsZW5hbWUpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfSk7XG59XG4iXX0=