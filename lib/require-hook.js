'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = registerRequireExtension;

var _mimeTypes = require('./mime-types');

var _mimeTypes2 = _interopRequireDefault(_mimeTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Initializes the node.js hook that allows us to intercept files loaded by
 * node.js and rewrite them. This method along with {@link initializeProtocolHook}
 * are the top-level methods that electron-compile actually uses to intercept
 * code that Electron loads.
 *
 * @param  {CompilerHost} compilerHost  The compiler host to use for compilation.
 */
function registerRequireExtension(compilerHost) {
  Object.keys(compilerHost.compilersByMimeType).forEach(mimeType => {
    _mimeTypes2.default.extensions(mimeType).forEach(ext => {
      require.extensions[`.${ ext }`] = (module, filename) => {
        var _compilerHost$compile = compilerHost.compileSync(filename);

        let code = _compilerHost$compile.code;

        module._compile(code, filename);
      };
    });
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9yZXF1aXJlLWhvb2suanMiXSwibmFtZXMiOlsicmVnaXN0ZXJSZXF1aXJlRXh0ZW5zaW9uIiwiY29tcGlsZXJIb3N0IiwiT2JqZWN0Iiwia2V5cyIsImNvbXBpbGVyc0J5TWltZVR5cGUiLCJmb3JFYWNoIiwibWltZVR5cGUiLCJleHRlbnNpb25zIiwiZXh0IiwicmVxdWlyZSIsIm1vZHVsZSIsImZpbGVuYW1lIiwiY29tcGlsZVN5bmMiLCJjb2RlIiwiX2NvbXBpbGUiXSwibWFwcGluZ3MiOiI7Ozs7O2tCQVV3QkEsd0I7O0FBVnhCOzs7Ozs7QUFFQTs7Ozs7Ozs7QUFRZSxTQUFTQSx3QkFBVCxDQUFrQ0MsWUFBbEMsRUFBZ0Q7QUFDN0RDLFNBQU9DLElBQVAsQ0FBWUYsYUFBYUcsbUJBQXpCLEVBQThDQyxPQUE5QyxDQUF1REMsUUFBRCxJQUFjO0FBQ2xFLHdCQUFVQyxVQUFWLENBQXFCRCxRQUFyQixFQUErQkQsT0FBL0IsQ0FBd0NHLEdBQUQsSUFBUztBQUM5Q0MsY0FBUUYsVUFBUixDQUFvQixLQUFHQyxHQUFJLEdBQTNCLElBQWdDLENBQUNFLE1BQUQsRUFBU0MsUUFBVCxLQUFzQjtBQUFBLG9DQUN2Q1YsYUFBYVcsV0FBYixDQUF5QkQsUUFBekIsQ0FEdUM7O0FBQUEsWUFDL0NFLElBRCtDLHlCQUMvQ0EsSUFEK0M7O0FBRXBESCxlQUFPSSxRQUFQLENBQWdCRCxJQUFoQixFQUFzQkYsUUFBdEI7QUFDRCxPQUhEO0FBSUQsS0FMRDtBQU1ELEdBUEQ7QUFRRCIsImZpbGUiOiJyZXF1aXJlLWhvb2suanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbWltZVR5cGVzIGZyb20gJy4vbWltZS10eXBlcyc7XG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdGhlIG5vZGUuanMgaG9vayB0aGF0IGFsbG93cyB1cyB0byBpbnRlcmNlcHQgZmlsZXMgbG9hZGVkIGJ5XG4gKiBub2RlLmpzIGFuZCByZXdyaXRlIHRoZW0uIFRoaXMgbWV0aG9kIGFsb25nIHdpdGgge0BsaW5rIGluaXRpYWxpemVQcm90b2NvbEhvb2t9XG4gKiBhcmUgdGhlIHRvcC1sZXZlbCBtZXRob2RzIHRoYXQgZWxlY3Ryb24tY29tcGlsZSBhY3R1YWxseSB1c2VzIHRvIGludGVyY2VwdFxuICogY29kZSB0aGF0IEVsZWN0cm9uIGxvYWRzLlxuICpcbiAqIEBwYXJhbSAge0NvbXBpbGVySG9zdH0gY29tcGlsZXJIb3N0ICBUaGUgY29tcGlsZXIgaG9zdCB0byB1c2UgZm9yIGNvbXBpbGF0aW9uLlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZWdpc3RlclJlcXVpcmVFeHRlbnNpb24oY29tcGlsZXJIb3N0KSB7XG4gIE9iamVjdC5rZXlzKGNvbXBpbGVySG9zdC5jb21waWxlcnNCeU1pbWVUeXBlKS5mb3JFYWNoKChtaW1lVHlwZSkgPT4ge1xuICAgIG1pbWVUeXBlcy5leHRlbnNpb25zKG1pbWVUeXBlKS5mb3JFYWNoKChleHQpID0+IHtcbiAgICAgIHJlcXVpcmUuZXh0ZW5zaW9uc1tgLiR7ZXh0fWBdID0gKG1vZHVsZSwgZmlsZW5hbWUpID0+IHtcbiAgICAgICAgbGV0IHtjb2RlfSA9IGNvbXBpbGVySG9zdC5jb21waWxlU3luYyhmaWxlbmFtZSk7XG4gICAgICAgIG1vZHVsZS5fY29tcGlsZShjb2RlLCBmaWxlbmFtZSk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9KTtcbn1cbiJdfQ==