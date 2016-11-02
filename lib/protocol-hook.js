'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.rigHtmlDocumentToInitializeElectronCompile = rigHtmlDocumentToInitializeElectronCompile;
exports.initializeProtocolHook = initializeProtocolHook;

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _mimeTypes = require('./mime-types');

var _mimeTypes2 = _interopRequireDefault(_mimeTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const magicWords = "__magic__file__to__help__electron__compile.js";

// NB: These are duped in initialize-renderer so we can save startup time, make
// sure to run both!
const magicGlobalForRootCacheDir = '__electron_compile_root_cache_dir';
const magicGlobalForAppRootDir = '__electron_compile_app_root_dir';

const d = require('debug-electron')('electron-compile:protocol-hook');

let protocol = null;

/**
 * Adds our script header to the top of all HTML files
 *
 * @private
 */
function rigHtmlDocumentToInitializeElectronCompile(doc) {
  let lines = doc.split("\n");
  let replacement = `<head><script src="${ magicWords }"></script>`;
  let replacedHead = false;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].match(/<head>/i)) continue;

    lines[i] = lines[i].replace(/<head>/i, replacement);
    replacedHead = true;
    break;
  }

  if (!replacedHead) {
    replacement = `<html$1><head><script src="${ magicWords }"></script></head>`;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].match(/<html/i)) continue;

      lines[i] = lines[i].replace(/<html([^>]+)>/i, replacement);
      break;
    }
  }

  return lines.join("\n");
}

function requestFileJob(filePath, finish) {
  _fs2.default.readFile(filePath, (err, buf) => {
    if (err) {
      if (err.errno === 34) {
        finish(-6); // net::ERR_FILE_NOT_FOUND
        return;
      } else {
        finish(-2); // net::FAILED
        return;
      }
    }

    finish({
      data: buf,
      mimeType: _mimeTypes2.default.lookup(filePath) || 'text/plain'
    });
  });
}

/**
 * Initializes the protocol hook on file: that allows us to intercept files
 * loaded by Chromium and rewrite them. This method along with
 * {@link registerRequireExtension} are the top-level methods that electron-compile
 * actually uses to intercept code that Electron loads.
 *
 * @param  {CompilerHost} compilerHost  The compiler host to use for compilation.
 */
function initializeProtocolHook(compilerHost) {
  protocol = protocol || require('electron').protocol;

  global[magicGlobalForRootCacheDir] = compilerHost.rootCacheDir;
  global[magicGlobalForAppRootDir] = compilerHost.appRoot;

  const electronCompileSetupCode = `if (window.require) require('electron-compile/lib/initialize-renderer').initializeRendererProcess(${ compilerHost.readOnlyMode });`;

  protocol.interceptBufferProtocol('file', (() => {
    var _ref = _asyncToGenerator(function* (request, finish) {
      let uri = _url2.default.parse(request.url);

      d(`Intercepting url ${ request.url }`);
      if (request.url.indexOf(magicWords) > -1) {
        finish({
          mimeType: 'application/javascript',
          data: new Buffer(electronCompileSetupCode, 'utf8')
        });

        return;
      }

      // This is a protocol-relative URL that has gone pear-shaped in Electron,
      // let's rewrite it
      if (uri.host && uri.host.length > 1) {
        //let newUri = request.url.replace(/^file:/, "https:");
        // TODO: Jump off this bridge later
        d(`TODO: Found bogus protocol-relative URL, can't fix it up!!`);
        finish(-2);
        return;
      }

      let filePath = decodeURIComponent(uri.pathname);

      // NB: pathname has a leading '/' on Win32 for some reason
      if (process.platform === 'win32') {
        filePath = filePath.slice(1);
      }

      // NB: Special-case files coming from atom.asar or node_modules
      if (filePath.match(/[\/\\](atom|electron).asar/) || filePath.match(/[\/\\](node_modules|bower_components)/)) {
        // NBs on NBs: If we're loading an HTML file from node_modules, we still have
        // to do the HTML document rigging
        if (filePath.match(/\.html?$/i)) {
          let riggedContents = null;
          _fs2.default.readFile(filePath, 'utf8', function (err, contents) {
            if (err) {
              if (err.errno === 34) {
                finish(-6); // net::ERR_FILE_NOT_FOUND
                return;
              } else {
                finish(-2); // net::FAILED
                return;
              }
            }

            riggedContents = rigHtmlDocumentToInitializeElectronCompile(contents);
            finish({ data: new Buffer(riggedContents), mimeType: 'text/html' });
            return;
          });

          return;
        }

        requestFileJob(filePath, finish);
        return;
      }

      try {
        let result = yield compilerHost.compile(filePath);

        if (result.mimeType === 'text/html') {
          result.code = rigHtmlDocumentToInitializeElectronCompile(result.code);
        }

        if (result.binaryData || result.code instanceof Buffer) {
          finish({ data: result.binaryData || result.code, mimeType: result.mimeType });
          return;
        } else {
          finish({ data: new Buffer(result.code), mimeType: result.mimeType });
          return;
        }
      } catch (e) {
        let err = `Failed to compile ${ filePath }: ${ e.message }\n${ e.stack }`;
        d(err);

        if (e.errno === 34 /*ENOENT*/) {
            finish(-6); // net::ERR_FILE_NOT_FOUND
            return;
          }

        finish({ mimeType: 'text/plain', data: new Buffer(err) });
        return;
      }
    });

    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  })());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wcm90b2NvbC1ob29rLmpzIl0sIm5hbWVzIjpbInJpZ0h0bWxEb2N1bWVudFRvSW5pdGlhbGl6ZUVsZWN0cm9uQ29tcGlsZSIsImluaXRpYWxpemVQcm90b2NvbEhvb2siLCJtYWdpY1dvcmRzIiwibWFnaWNHbG9iYWxGb3JSb290Q2FjaGVEaXIiLCJtYWdpY0dsb2JhbEZvckFwcFJvb3REaXIiLCJkIiwicmVxdWlyZSIsInByb3RvY29sIiwiZG9jIiwibGluZXMiLCJzcGxpdCIsInJlcGxhY2VtZW50IiwicmVwbGFjZWRIZWFkIiwiaSIsImxlbmd0aCIsIm1hdGNoIiwicmVwbGFjZSIsImpvaW4iLCJyZXF1ZXN0RmlsZUpvYiIsImZpbGVQYXRoIiwiZmluaXNoIiwicmVhZEZpbGUiLCJlcnIiLCJidWYiLCJlcnJubyIsImRhdGEiLCJtaW1lVHlwZSIsImxvb2t1cCIsImNvbXBpbGVySG9zdCIsImdsb2JhbCIsInJvb3RDYWNoZURpciIsImFwcFJvb3QiLCJlbGVjdHJvbkNvbXBpbGVTZXR1cENvZGUiLCJyZWFkT25seU1vZGUiLCJpbnRlcmNlcHRCdWZmZXJQcm90b2NvbCIsInJlcXVlc3QiLCJ1cmkiLCJwYXJzZSIsInVybCIsImluZGV4T2YiLCJCdWZmZXIiLCJob3N0IiwiZGVjb2RlVVJJQ29tcG9uZW50IiwicGF0aG5hbWUiLCJwcm9jZXNzIiwicGxhdGZvcm0iLCJzbGljZSIsInJpZ2dlZENvbnRlbnRzIiwiY29udGVudHMiLCJyZXN1bHQiLCJjb21waWxlIiwiY29kZSIsImJpbmFyeURhdGEiLCJlIiwibWVzc2FnZSIsInN0YWNrIl0sIm1hcHBpbmdzIjoiOzs7OztRQW9CZ0JBLDBDLEdBQUFBLDBDO1FBcURBQyxzQixHQUFBQSxzQjs7QUF6RWhCOzs7O0FBQ0E7Ozs7QUFDQTs7Ozs7Ozs7QUFFQSxNQUFNQyxhQUFhLCtDQUFuQjs7QUFFQTtBQUNBO0FBQ0EsTUFBTUMsNkJBQTZCLG1DQUFuQztBQUNBLE1BQU1DLDJCQUEyQixpQ0FB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QUFjbkQsMkNBQTJDaUQsT0FBT0UsSUFBbEQsQ0FBZDtBQUNEOztBQUVELFlBQUlGLE9BQU9HLFVBQVAsSUFBcUJILE9BQU9FLElBQVAsWUFBdUJYLE1BQWhELEVBQXdEO0FBQ3REcEIsaUJBQU8sRUFBRUssTUFBTXdCLE9BQU9HLFVBQVAsSUFBcUJILE9BQU9FLElBQXBDLEVBQTBDekIsVUFBVXVCLE9BQU92QixRQUEzRCxFQUFQO0FBQ0E7QUFDRCxTQUhELE1BR087QUFDTE4saUJBQU8sRUFBRUssTUFBTSxJQUFJZSxNQUFKLENBQVdTLE9BQU9FLElBQWxCLENBQVIsRUFBaUN6QixVQUFVdUIsT0FBT3ZCLFFBQWxELEVBQVA7QUFDQTtBQUNEO0FBQ0YsT0FkRCxDQWNFLE9BQU8yQixDQUFQLEVBQVU7QUFDVixZQUFJL0IsTUFBTyxzQkFBb0JILFFBQVMsT0FBSWtDLEVBQUVDLE9BQVEsT0FBSUQsRUFBRUUsS0FBTSxHQUFsRTtBQUNBbEQsVUFBRWlCLEdBQUY7O0FBRUEsWUFBSStCLEVBQUU3QixLQUFGLEtBQVksRUFBaEIsQ0FBbUIsVUFBbkIsRUFBK0I7QUFDN0JKLG1CQUFPLENBQUMsQ0FBUixFQUQ2QixDQUNqQjtBQUNaO0FBQ0Q7O0FBRURBLGVBQU8sRUFBRU0sVUFBVSxZQUFaLEVBQTBCRCxNQUFNLElBQUllLE1BQUosQ0FBV2xCLEdBQVgsQ0FBaEMsRUFBUDtBQUNBO0FBQ0Q7QUFDRixLQXJGRDs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQXNGRCIsImZpbGUiOiJwcm90b2NvbC1ob29rLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBtaW1lIGZyb20gJy4vbWltZS10eXBlcyc7XG5cbmNvbnN0IG1hZ2ljV29yZHMgPSBcIl9fbWFnaWNfX2ZpbGVfX3RvX19oZWxwX19lbGVjdHJvbl9fY29tcGlsZS5qc1wiO1xuXG4vLyBOQjogVGhlc2UgYXJlIGR1cGVkIGluIGluaXRpYWxpemUtcmVuZGVyZXIgc28gd2UgY2FuIHNhdmUgc3RhcnR1cCB0aW1lLCBtYWtlXG4vLyBzdXJlIHRvIHJ1biBib3RoIVxuY29uc3QgbWFnaWNHbG9iYWxGb3JSb290Q2FjaGVEaXIgPSAnX19lbGVjdHJvbl9jb21waWxlX3Jvb3RfY2FjaGVfZGlyJztcbmNvbnN0IG1hZ2ljR2xvYmFsRm9yQXBwUm9vdERpciA9ICdfX2VsZWN0cm9uX2NvbXBpbGVfYXBwX3Jvb3RfZGlyJztcblxuY29uc3QgZCA9IHJlcXVpcmUoJ2RlYnVnLWVsZWN0cm9uJykoJ2VsZWN0cm9uLWNvbXBpbGU6cHJvdG9jb2wtaG9vaycpO1xuXG5sZXQgcHJvdG9jb2wgPSBudWxsO1xuXG4vKipcbiAqIEFkZHMgb3VyIHNjcmlwdCBoZWFkZXIgdG8gdGhlIHRvcCBvZiBhbGwgSFRNTCBmaWxlc1xuICpcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByaWdIdG1sRG9jdW1lbnRUb0luaXRpYWxpemVFbGVjdHJvbkNvbXBpbGUoZG9jKSB7XG4gIGxldCBsaW5lcyA9IGRvYy5zcGxpdChcIlxcblwiKTtcbiAgbGV0IHJlcGxhY2VtZW50ID0gYDxoZWFkPjxzY3JpcHQgc3JjPVwiJHttYWdpY1dvcmRzfVwiPjwvc2NyaXB0PmA7XG4gIGxldCByZXBsYWNlZEhlYWQgPSBmYWxzZTtcblxuICBmb3IgKGxldCBpPTA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgIGlmICghbGluZXNbaV0ubWF0Y2goLzxoZWFkPi9pKSkgY29udGludWU7XG5cbiAgICBsaW5lc1tpXSA9IChsaW5lc1tpXSkucmVwbGFjZSgvPGhlYWQ+L2ksIHJlcGxhY2VtZW50KTtcbiAgICByZXBsYWNlZEhlYWQgPSB0cnVlO1xuICAgIGJyZWFrO1xuICB9XG5cbiAgaWYgKCFyZXBsYWNlZEhlYWQpIHtcbiAgICByZXBsYWNlbWVudCA9IGA8aHRtbCQxPjxoZWFkPjxzY3JpcHQgc3JjPVwiJHttYWdpY1dvcmRzfVwiPjwvc2NyaXB0PjwvaGVhZD5gO1xuICAgIGZvciAobGV0IGk9MDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWxpbmVzW2ldLm1hdGNoKC88aHRtbC9pKSkgY29udGludWU7XG5cbiAgICAgIGxpbmVzW2ldID0gKGxpbmVzW2ldKS5yZXBsYWNlKC88aHRtbChbXj5dKyk+L2ksIHJlcGxhY2VtZW50KTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiByZXF1ZXN0RmlsZUpvYihmaWxlUGF0aCwgZmluaXNoKSB7XG4gIGZzLnJlYWRGaWxlKGZpbGVQYXRoLCAoZXJyLCBidWYpID0+IHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICBpZiAoZXJyLmVycm5vID09PSAzNCkge1xuICAgICAgICBmaW5pc2goLTYpOyAvLyBuZXQ6OkVSUl9GSUxFX05PVF9GT1VORFxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmaW5pc2goLTIpOyAvLyBuZXQ6OkZBSUxFRFxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgZmluaXNoKHtcbiAgICAgIGRhdGE6IGJ1ZixcbiAgICAgIG1pbWVUeXBlOiBtaW1lLmxvb2t1cChmaWxlUGF0aCkgfHwgJ3RleHQvcGxhaW4nXG4gICAgfSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSBwcm90b2NvbCBob29rIG9uIGZpbGU6IHRoYXQgYWxsb3dzIHVzIHRvIGludGVyY2VwdCBmaWxlc1xuICogbG9hZGVkIGJ5IENocm9taXVtIGFuZCByZXdyaXRlIHRoZW0uIFRoaXMgbWV0aG9kIGFsb25nIHdpdGhcbiAqIHtAbGluayByZWdpc3RlclJlcXVpcmVFeHRlbnNpb259IGFyZSB0aGUgdG9wLWxldmVsIG1ldGhvZHMgdGhhdCBlbGVjdHJvbi1jb21waWxlXG4gKiBhY3R1YWxseSB1c2VzIHRvIGludGVyY2VwdCBjb2RlIHRoYXQgRWxlY3Ryb24gbG9hZHMuXG4gKlxuICogQHBhcmFtICB7Q29tcGlsZXJIb3N0fSBjb21waWxlckhvc3QgIFRoZSBjb21waWxlciBob3N0IHRvIHVzZSBmb3IgY29tcGlsYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbml0aWFsaXplUHJvdG9jb2xIb29rKGNvbXBpbGVySG9zdCkge1xuICBwcm90b2NvbCA9IHByb3RvY29sIHx8IHJlcXVpcmUoJ2VsZWN0cm9uJykucHJvdG9jb2w7XG5cbiAgZ2xvYmFsW21hZ2ljR2xvYmFsRm9yUm9vdENhY2hlRGlyXSA9IGNvbXBpbGVySG9zdC5yb290Q2FjaGVEaXI7XG4gIGdsb2JhbFttYWdpY0dsb2JhbEZvckFwcFJvb3REaXJdID0gY29tcGlsZXJIb3N0LmFwcFJvb3Q7XG5cbiAgY29uc3QgZWxlY3Ryb25Db21waWxlU2V0dXBDb2RlID0gYGlmICh3aW5kb3cucmVxdWlyZSkgcmVxdWlyZSgnZWxlY3Ryb24tY29tcGlsZS9saWIvaW5pdGlhbGl6ZS1yZW5kZXJlcicpLmluaXRpYWxpemVSZW5kZXJlclByb2Nlc3MoJHtjb21waWxlckhvc3QucmVhZE9ubHlNb2RlfSk7YDtcblxuICBwcm90b2NvbC5pbnRlcmNlcHRCdWZmZXJQcm90b2NvbCgnZmlsZScsIGFzeW5jIGZ1bmN0aW9uKHJlcXVlc3QsIGZpbmlzaCkge1xuICAgIGxldCB1cmkgPSB1cmwucGFyc2UocmVxdWVzdC51cmwpO1xuXG4gICAgZChgSW50ZXJjZXB0aW5nIHVybCAke3JlcXVlc3QudXJsfWApO1xuICAgIGlmIChyZXF1ZXN0LnVybC5pbmRleE9mKG1hZ2ljV29yZHMpID4gLTEpIHtcbiAgICAgIGZpbmlzaCh7XG4gICAgICAgIG1pbWVUeXBlOiAnYXBwbGljYXRpb24vamF2YXNjcmlwdCcsXG4gICAgICAgIGRhdGE6IG5ldyBCdWZmZXIoZWxlY3Ryb25Db21waWxlU2V0dXBDb2RlLCAndXRmOCcpXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaXMgYSBwcm90b2NvbC1yZWxhdGl2ZSBVUkwgdGhhdCBoYXMgZ29uZSBwZWFyLXNoYXBlZCBpbiBFbGVjdHJvbixcbiAgICAvLyBsZXQncyByZXdyaXRlIGl0XG4gICAgaWYgKHVyaS5ob3N0ICYmIHVyaS5ob3N0Lmxlbmd0aCA+IDEpIHtcbiAgICAgIC8vbGV0IG5ld1VyaSA9IHJlcXVlc3QudXJsLnJlcGxhY2UoL15maWxlOi8sIFwiaHR0cHM6XCIpO1xuICAgICAgLy8gVE9ETzogSnVtcCBvZmYgdGhpcyBicmlkZ2UgbGF0ZXJcbiAgICAgIGQoYFRPRE86IEZvdW5kIGJvZ3VzIHByb3RvY29sLXJlbGF0aXZlIFVSTCwgY2FuJ3QgZml4IGl0IHVwISFgKTtcbiAgICAgIGZpbmlzaCgtMik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IGZpbGVQYXRoID0gZGVjb2RlVVJJQ29tcG9uZW50KHVyaS5wYXRobmFtZSk7XG5cbiAgICAvLyBOQjogcGF0aG5hbWUgaGFzIGEgbGVhZGluZyAnLycgb24gV2luMzIgZm9yIHNvbWUgcmVhc29uXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgIGZpbGVQYXRoID0gZmlsZVBhdGguc2xpY2UoMSk7XG4gICAgfVxuXG4gICAgLy8gTkI6IFNwZWNpYWwtY2FzZSBmaWxlcyBjb21pbmcgZnJvbSBhdG9tLmFzYXIgb3Igbm9kZV9tb2R1bGVzXG4gICAgaWYgKGZpbGVQYXRoLm1hdGNoKC9bXFwvXFxcXF0oYXRvbXxlbGVjdHJvbikuYXNhci8pIHx8IGZpbGVQYXRoLm1hdGNoKC9bXFwvXFxcXF0obm9kZV9tb2R1bGVzfGJvd2VyX2NvbXBvbmVudHMpLykpIHtcbiAgICAgIC8vIE5CcyBvbiBOQnM6IElmIHdlJ3JlIGxvYWRpbmcgYW4gSFRNTCBmaWxlIGZyb20gbm9kZV9tb2R1bGVzLCB3ZSBzdGlsbCBoYXZlXG4gICAgICAvLyB0byBkbyB0aGUgSFRNTCBkb2N1bWVudCByaWdnaW5nXG4gICAgICBpZiAoZmlsZVBhdGgubWF0Y2goL1xcLmh0bWw/JC9pKSkge1xuICAgICAgICBsZXQgcmlnZ2VkQ29udGVudHMgPSBudWxsO1xuICAgICAgICBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0ZjgnLCAoZXJyLCBjb250ZW50cykgPT4ge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIuZXJybm8gPT09IDM0KSB7XG4gICAgICAgICAgICAgIGZpbmlzaCgtNik7IC8vIG5ldDo6RVJSX0ZJTEVfTk9UX0ZPVU5EXG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZpbmlzaCgtMik7IC8vIG5ldDo6RkFJTEVEXG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICByaWdnZWRDb250ZW50cyA9IHJpZ0h0bWxEb2N1bWVudFRvSW5pdGlhbGl6ZUVsZWN0cm9uQ29tcGlsZShjb250ZW50cyk7XG4gICAgICAgICAgZmluaXNoKHsgZGF0YTogbmV3IEJ1ZmZlcihyaWdnZWRDb250ZW50cyksIG1pbWVUeXBlOiAndGV4dC9odG1sJyB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgcmVxdWVzdEZpbGVKb2IoZmlsZVBhdGgsIGZpbmlzaCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBjb21waWxlckhvc3QuY29tcGlsZShmaWxlUGF0aCk7XG5cbiAgICAgIGlmIChyZXN1bHQubWltZVR5cGUgPT09ICd0ZXh0L2h0bWwnKSB7XG4gICAgICAgIHJlc3VsdC5jb2RlID0gcmlnSHRtbERvY3VtZW50VG9Jbml0aWFsaXplRWxlY3Ryb25Db21waWxlKHJlc3VsdC5jb2RlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3VsdC5iaW5hcnlEYXRhIHx8IHJlc3VsdC5jb2RlIGluc3RhbmNlb2YgQnVmZmVyKSB7XG4gICAgICAgIGZpbmlzaCh7IGRhdGE6IHJlc3VsdC5iaW5hcnlEYXRhIHx8IHJlc3VsdC5jb2RlLCBtaW1lVHlwZTogcmVzdWx0Lm1pbWVUeXBlIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmaW5pc2goeyBkYXRhOiBuZXcgQnVmZmVyKHJlc3VsdC5jb2RlKSwgbWltZVR5cGU6IHJlc3VsdC5taW1lVHlwZSB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxldCBlcnIgPSBgRmFpbGVkIHRvIGNvbXBpbGUgJHtmaWxlUGF0aH06ICR7ZS5tZXNzYWdlfVxcbiR7ZS5zdGFja31gO1xuICAgICAgZChlcnIpO1xuXG4gICAgICBpZiAoZS5lcnJubyA9PT0gMzQgLypFTk9FTlQqLykge1xuICAgICAgICBmaW5pc2goLTYpOyAvLyBuZXQ6OkVSUl9GSUxFX05PVF9GT1VORFxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGZpbmlzaCh7IG1pbWVUeXBlOiAndGV4dC9wbGFpbicsIGRhdGE6IG5ldyBCdWZmZXIoZXJyKSB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH0pO1xufVxuIl19