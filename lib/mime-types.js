'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MimeTypesToExtensions = {
  'application/javascript': ['js', 'es6'],
  'text/less': ['less'],
  'text/stylus': ['stylus'],
  'text/jsx': ['jsx'],
  'text/cjsx': ['cjsx'],
  'text/coffeescript': ['coffee', 'litcoffee'],
  'text/typescript': ['ts'],
  'text/tsx': ['tsx'],
  'text/cson': ['cson'],
  'text/html': ['html', 'htm'],
  'text/jade': ['jade'],
  'text/plain': ['txt'],
  'image/svg+xml': ['svg']
};

const ExtensionsToMimeTypes = {};
for (const mimetype of Object.keys(MimeTypesToExtensions)) {
  for (const ext of MimeTypesToExtensions[mimetype]) {
    ExtensionsToMimeTypes[ext] = mimetype;
  }
}

class MimeTypes {
  lookup(filepath) {
    const ext = _path2.default.extname(filepath);
    return ExtensionsToMimeTypes[ext.slice(1)] || false;
  }

  extension(mimeType) {
    return this.extensions(mimeType)[0];
  }

  extensions(mimeType) {
    return MimeTypesToExtensions[mimeType] || [];
  }

}
exports.default = new MimeTypes();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9taW1lLXR5cGVzLmpzIl0sIm5hbWVzIjpbIk1pbWVUeXBlc1RvRXh0ZW5zaW9ucyIsIkV4dGVuc2lvbnNUb01pbWVUeXBlcyIsIm1pbWV0eXBlIiwiT2JqZWN0Iiwia2V5cyIsImV4dCIsIk1pbWVUeXBlcyIsImxvb2t1cCIsImZpbGVwYXRoIiwiZXh0bmFtZSIsInNsaWNlIiwiZXh0ZW5zaW9uIiwibWltZVR5cGUiLCJleHRlbnNpb25zIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7Ozs7O0FBRUEsTUFBTUEsd0JBQXdCO0FBQzVCLDRCQUEwQixDQUFDLElBQUQsRUFBTyxLQUFQLENBREU7QUFFNUIsZUFBYSxDQUFDLE1BQUQsQ0FGZTtBQUc1QixpQkFBZSxDQUFDLFFBQUQsQ0FIYTtBQUk1QixjQUFZLENBQUMsS0FBRCxDQUpnQjtBQUs1QixlQUFhLENBQUMsTUFBRCxDQUxlO0FBTTVCLHVCQUFxQixDQUFDLFFBQUQsRUFBVyxXQUFYLENBTk87QUFPNUIscUJBQW1CLENBQUMsSUFBRCxDQVBTO0FBUTVCLGNBQVksQ0FBQyxLQUFELENBUmdCO0FBUzVCLGVBQWEsQ0FBQyxNQUFELENBVGU7QUFVNUIsZUFBYSxDQUFDLE1BQUQsRUFBUyxLQUFULENBVmU7QUFXNUIsZUFBYSxDQUFDLE1BQUQsQ0FYZTtBQVk1QixnQkFBYyxDQUFDLEtBQUQsQ0FaYztBQWE1QixtQkFBaUIsQ0FBQyxLQUFEO0FBYlcsQ0FBOUI7O0FBZ0JBLE1BQU1DLHdCQUF3QixFQUE5QjtBQUNBLEtBQUssTUFBTUMsUUFBWCxJQUF1QkMsT0FBT0MsSUFBUCxDQUFZSixxQkFBWixDQUF2QixFQUEyRDtBQUN6RCxPQUFLLE1BQU1LLEdBQVgsSUFBa0JMLHNCQUFzQkUsUUFBdEIsQ0FBbEIsRUFBbUQ7QUFDakRELDBCQUFzQkksR0FBdEIsSUFBNkJILFFBQTdCO0FBQ0Q7QUFDRjs7QUFFRCxNQUFNSSxTQUFOLENBQWdCO0FBQ2RDLFNBQU9DLFFBQVAsRUFBaUI7QUFDZixVQUFNSCxNQUFNLGVBQUtJLE9BQUwsQ0FBYUQsUUFBYixDQUFaO0FBQ0EsV0FBT1Asc0JBQXNCSSxJQUFJSyxLQUFKLENBQVUsQ0FBVixDQUF0QixLQUF1QyxLQUE5QztBQUNEOztBQUVEQyxZQUFVQyxRQUFWLEVBQW9CO0FBQ2xCLFdBQU8sS0FBS0MsVUFBTCxDQUFnQkQsUUFBaEIsRUFBMEIsQ0FBMUIsQ0FBUDtBQUNEOztBQUVEQyxhQUFXRCxRQUFYLEVBQXFCO0FBQ25CLFdBQU9aLHNCQUFzQlksUUFBdEIsS0FBbUMsRUFBMUM7QUFDRDs7QUFaYTtrQkFlRCxJQUFJTixTQUFKLEUiLCJmaWxlIjoibWltZS10eXBlcy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5jb25zdCBNaW1lVHlwZXNUb0V4dGVuc2lvbnMgPSB7XG4gICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JzogWydqcycsICdlczYnXSxcbiAgJ3RleHQvbGVzcyc6IFsnbGVzcyddLFxuICAndGV4dC9zdHlsdXMnOiBbJ3N0eWx1cyddLFxuICAndGV4dC9qc3gnOiBbJ2pzeCddLFxuICAndGV4dC9janN4JzogWydjanN4J10sXG4gICd0ZXh0L2NvZmZlZXNjcmlwdCc6IFsnY29mZmVlJywgJ2xpdGNvZmZlZSddLFxuICAndGV4dC90eXBlc2NyaXB0JzogWyd0cyddLFxuICAndGV4dC90c3gnOiBbJ3RzeCddLFxuICAndGV4dC9jc29uJzogWydjc29uJ10sXG4gICd0ZXh0L2h0bWwnOiBbJ2h0bWwnLCAnaHRtJ10sXG4gICd0ZXh0L2phZGUnOiBbJ2phZGUnXSxcbiAgJ3RleHQvcGxhaW4nOiBbJ3R4dCddLFxuICAnaW1hZ2Uvc3ZnK3htbCc6IFsnc3ZnJ10sXG59O1xuXG5jb25zdCBFeHRlbnNpb25zVG9NaW1lVHlwZXMgPSB7fTtcbmZvciAoY29uc3QgbWltZXR5cGUgb2YgT2JqZWN0LmtleXMoTWltZVR5cGVzVG9FeHRlbnNpb25zKSkge1xuICBmb3IgKGNvbnN0IGV4dCBvZiBNaW1lVHlwZXNUb0V4dGVuc2lvbnNbbWltZXR5cGVdKSB7XG4gICAgRXh0ZW5zaW9uc1RvTWltZVR5cGVzW2V4dF0gPSBtaW1ldHlwZTtcbiAgfVxufVxuXG5jbGFzcyBNaW1lVHlwZXMge1xuICBsb29rdXAoZmlsZXBhdGgpIHtcbiAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUoZmlsZXBhdGgpO1xuICAgIHJldHVybiBFeHRlbnNpb25zVG9NaW1lVHlwZXNbZXh0LnNsaWNlKDEpXSB8fCBmYWxzZTtcbiAgfVxuXG4gIGV4dGVuc2lvbihtaW1lVHlwZSkge1xuICAgIHJldHVybiB0aGlzLmV4dGVuc2lvbnMobWltZVR5cGUpWzBdO1xuICB9XG5cbiAgZXh0ZW5zaW9ucyhtaW1lVHlwZSkge1xuICAgIHJldHVybiBNaW1lVHlwZXNUb0V4dGVuc2lvbnNbbWltZVR5cGVdIHx8IFtdO1xuICB9XG5cbn1cbmV4cG9ydCBkZWZhdWx0IG5ldyBNaW1lVHlwZXMoKTtcbiJdfQ==