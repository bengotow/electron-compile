'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _mimeTypes = require('@paulcbetts/mime-types');

var _mimeTypes2 = _interopRequireDefault(_mimeTypes);

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
    return ExtensionsToMimeTypes[ext.slice(1)] || _mimeTypes2.default.lookup(filepath) || false;
  }

  extension(mimeType) {
    return this.extensions(mimeType)[0];
  }

  extensions(mimeType) {
    if (MimeTypesToExtensions[mimeType]) {
      return MimeTypesToExtensions[mimeType];
    }
    const official = _mimeTypes2.default.extension(mimeType);
    return official ? [official] : [];
  }

}
exports.default = new MimeTypes();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9taW1lLXR5cGVzLmpzIl0sIm5hbWVzIjpbIk1pbWVUeXBlc1RvRXh0ZW5zaW9ucyIsIkV4dGVuc2lvbnNUb01pbWVUeXBlcyIsIm1pbWV0eXBlIiwiT2JqZWN0Iiwia2V5cyIsImV4dCIsIk1pbWVUeXBlcyIsImxvb2t1cCIsImZpbGVwYXRoIiwiZXh0bmFtZSIsInNsaWNlIiwiZXh0ZW5zaW9uIiwibWltZVR5cGUiLCJleHRlbnNpb25zIiwib2ZmaWNpYWwiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7OztBQUVBLE1BQU1BLHdCQUF3QjtBQUM1Qiw0QkFBMEIsQ0FBQyxJQUFELEVBQU8sS0FBUCxDQURFO0FBRTVCLGVBQWEsQ0FBQyxNQUFELENBRmU7QUFHNUIsaUJBQWUsQ0FBQyxRQUFELENBSGE7QUFJNUIsY0FBWSxDQUFDLEtBQUQsQ0FKZ0I7QUFLNUIsZUFBYSxDQUFDLE1BQUQsQ0FMZTtBQU01Qix1QkFBcUIsQ0FBQyxRQUFELEVBQVcsV0FBWCxDQU5PO0FBTzVCLHFCQUFtQixDQUFDLElBQUQsQ0FQUztBQVE1QixjQUFZLENBQUMsS0FBRCxDQVJnQjtBQVM1QixlQUFhLENBQUMsTUFBRCxDQVRlO0FBVTVCLGVBQWEsQ0FBQyxNQUFELEVBQVMsS0FBVCxDQVZlO0FBVzVCLGVBQWEsQ0FBQyxNQUFELENBWGU7QUFZNUIsZ0JBQWMsQ0FBQyxLQUFELENBWmM7QUFhNUIsbUJBQWlCLENBQUMsS0FBRDtBQWJXLENBQTlCOztBQWdCQSxNQUFNQyx3QkFBd0IsRUFBOUI7QUFDQSxLQUFLLE1BQU1DLFFBQVgsSUFBdUJDLE9BQU9DLElBQVAsQ0FBWUoscUJBQVosQ0FBdkIsRUFBMkQ7QUFDekQsT0FBSyxNQUFNSyxHQUFYLElBQWtCTCxzQkFBc0JFLFFBQXRCLENBQWxCLEVBQW1EO0FBQ2pERCwwQkFBc0JJLEdBQXRCLElBQTZCSCxRQUE3QjtBQUNEO0FBQ0Y7O0FBRUQsTUFBTUksU0FBTixDQUFnQjtBQUNkQyxTQUFPQyxRQUFQLEVBQWlCO0FBQ2YsVUFBTUgsTUFBTSxlQUFLSSxPQUFMLENBQWFELFFBQWIsQ0FBWjtBQUNBLFdBQU9QLHNCQUFzQkksSUFBSUssS0FBSixDQUFVLENBQVYsQ0FBdEIsS0FBdUMsb0JBQVVILE1BQVYsQ0FBaUJDLFFBQWpCLENBQXZDLElBQXFFLEtBQTVFO0FBQ0Q7O0FBRURHLFlBQVVDLFFBQVYsRUFBb0I7QUFDbEIsV0FBTyxLQUFLQyxVQUFMLENBQWdCRCxRQUFoQixFQUEwQixDQUExQixDQUFQO0FBQ0Q7O0FBRURDLGFBQVdELFFBQVgsRUFBcUI7QUFDbkIsUUFBSVosc0JBQXNCWSxRQUF0QixDQUFKLEVBQXFDO0FBQ25DLGFBQU9aLHNCQUFzQlksUUFBdEIsQ0FBUDtBQUNEO0FBQ0QsVUFBTUUsV0FBVyxvQkFBVUgsU0FBVixDQUFvQkMsUUFBcEIsQ0FBakI7QUFDQSxXQUFPRSxXQUFXLENBQUNBLFFBQUQsQ0FBWCxHQUF3QixFQUEvQjtBQUNEOztBQWhCYTtrQkFtQkQsSUFBSVIsU0FBSixFIiwiZmlsZSI6Im1pbWUtdHlwZXMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBtaW1lVHlwZXMgZnJvbSAnQHBhdWxjYmV0dHMvbWltZS10eXBlcyc7XG5cbmNvbnN0IE1pbWVUeXBlc1RvRXh0ZW5zaW9ucyA9IHtcbiAgJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnOiBbJ2pzJywgJ2VzNiddLFxuICAndGV4dC9sZXNzJzogWydsZXNzJ10sXG4gICd0ZXh0L3N0eWx1cyc6IFsnc3R5bHVzJ10sXG4gICd0ZXh0L2pzeCc6IFsnanN4J10sXG4gICd0ZXh0L2Nqc3gnOiBbJ2Nqc3gnXSxcbiAgJ3RleHQvY29mZmVlc2NyaXB0JzogWydjb2ZmZWUnLCAnbGl0Y29mZmVlJ10sXG4gICd0ZXh0L3R5cGVzY3JpcHQnOiBbJ3RzJ10sXG4gICd0ZXh0L3RzeCc6IFsndHN4J10sXG4gICd0ZXh0L2Nzb24nOiBbJ2Nzb24nXSxcbiAgJ3RleHQvaHRtbCc6IFsnaHRtbCcsICdodG0nXSxcbiAgJ3RleHQvamFkZSc6IFsnamFkZSddLFxuICAndGV4dC9wbGFpbic6IFsndHh0J10sXG4gICdpbWFnZS9zdmcreG1sJzogWydzdmcnXSxcbn07XG5cbmNvbnN0IEV4dGVuc2lvbnNUb01pbWVUeXBlcyA9IHt9O1xuZm9yIChjb25zdCBtaW1ldHlwZSBvZiBPYmplY3Qua2V5cyhNaW1lVHlwZXNUb0V4dGVuc2lvbnMpKSB7XG4gIGZvciAoY29uc3QgZXh0IG9mIE1pbWVUeXBlc1RvRXh0ZW5zaW9uc1ttaW1ldHlwZV0pIHtcbiAgICBFeHRlbnNpb25zVG9NaW1lVHlwZXNbZXh0XSA9IG1pbWV0eXBlO1xuICB9XG59XG5cbmNsYXNzIE1pbWVUeXBlcyB7XG4gIGxvb2t1cChmaWxlcGF0aCkge1xuICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShmaWxlcGF0aCk7XG4gICAgcmV0dXJuIEV4dGVuc2lvbnNUb01pbWVUeXBlc1tleHQuc2xpY2UoMSldIHx8IG1pbWVUeXBlcy5sb29rdXAoZmlsZXBhdGgpIHx8IGZhbHNlO1xuICB9XG5cbiAgZXh0ZW5zaW9uKG1pbWVUeXBlKSB7XG4gICAgcmV0dXJuIHRoaXMuZXh0ZW5zaW9ucyhtaW1lVHlwZSlbMF07XG4gIH1cblxuICBleHRlbnNpb25zKG1pbWVUeXBlKSB7XG4gICAgaWYgKE1pbWVUeXBlc1RvRXh0ZW5zaW9uc1ttaW1lVHlwZV0pIHtcbiAgICAgIHJldHVybiBNaW1lVHlwZXNUb0V4dGVuc2lvbnNbbWltZVR5cGVdO1xuICAgIH1cbiAgICBjb25zdCBvZmZpY2lhbCA9IG1pbWVUeXBlcy5leHRlbnNpb24obWltZVR5cGUpO1xuICAgIHJldHVybiBvZmZpY2lhbCA/IFtvZmZpY2lhbF0gOiBbXTtcbiAgfVxuXG59XG5leHBvcnQgZGVmYXVsdCBuZXcgTWltZVR5cGVzKCk7XG4iXX0=