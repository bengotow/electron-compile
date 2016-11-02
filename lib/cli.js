#!/usr/bin/env node
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.main = undefined;

let main = exports.main = (() => {
  var _ref = _asyncToGenerator(function* (appDir, sourceDirs, cacheDir) {
    let compilerHost = null;
    if (!cacheDir || cacheDir.length < 1) {
      cacheDir = '.cache';
    }

    let rootCacheDir = _path2.default.join(appDir, cacheDir);
    _mkdirp2.default.sync(rootCacheDir);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Using NODE_ENV = ${ process.env.NODE_ENV || 'development' }`);
    }

    d(`main: ${ appDir }, ${ JSON.stringify(sourceDirs) }`);
    try {
      compilerHost = yield (0, _configParser.createCompilerHostFromProjectRoot)(appDir, rootCacheDir);
    } catch (e) {
      console.error(`Couldn't set up compilers: ${ e.message }`);
      d(e.stack);

      throw e;
    }

    yield Promise.all(sourceDirs.map(function (dir) {
      return (0, _forAllFiles.forAllFiles)(dir, (() => {
        var _ref2 = _asyncToGenerator(function* (f) {
          try {
            d(`Starting compilation for ${ f }`);
            yield compilerHost.compile(f);
          } catch (e) {
            console.error(`Failed to compile file: ${ f }`);
            console.error(e.message);

            d(e.stack);
          }
        });

        return function (_x4) {
          return _ref2.apply(this, arguments);
        };
      })());
    }));

    d('Saving out configuration');
    yield compilerHost.saveConfiguration();
  });

  return function main(_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
})();

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _configParser = require('./config-parser');

var _forAllFiles = require('./for-all-files');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

process.on('unhandledRejection', e => {
  d(e.message || e);
  d(e.stack || '');
});

process.on('uncaughtException', e => {
  d(e.message || e);
  d(e.stack || '');
});

const d = require('debug-electron')('electron-compile');

const yargs = require('yargs').usage('Usage: electron-compile --appdir [root-app-dir] paths...').alias('a', 'appdir').describe('a', 'The top-level application directory (i.e. where your package.json is)').default('a', process.cwd()).alias('c', 'cachedir').describe('c', 'The directory to put the cache').default('c', '.cache').help('h').alias('h', 'help').epilog('Copyright 2015');

if (process.mainModule === module) {
  const argv = yargs.argv;

  if (!argv._ || argv._.length < 1) {
    yargs.showHelp();
    process.exit(-1);
  }

  const sourceDirs = argv._;
  const appDir = argv.a;
  const cacheDir = argv.c;

  main(appDir, sourceDirs, cacheDir).then(() => process.exit(0)).catch(e => {
    console.error(e.message || e);
    d(e.stack);

    console.error("Compilation failed!\nFor extra information, set the DEBUG environment variable to '*'");
    process.exit(-1);
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGkuanMiXSwibmFtZXMiOlsiYXBwRGlyIiwic291cmNlRGlycyIsImNhY2hlRGlyIiwiY29tcGlsZXJIb3N0IiwibGVuZ3RoIiwicm9vdENhY2hlRGlyIiwiam9pbiIsInN5bmMiLCJwcm9jZXNzIiwiZW52IiwiTk9ERV9FTlYiLCJjb25zb2xlIiwibG9nIiwiZCIsIkpTT04iLCJzdHJpbmdpZnkiLCJlIiwiZXJyb3IiLCJtZXNzYWdlIiwic3RhY2siLCJQcm9taXNlIiwiYWxsIiwibWFwIiwiZGlyIiwiZiIsImNvbXBpbGUiLCJzYXZlQ29uZmlndXJhdGlvbiIsIm1haW4iLCJvbiIsInJlcXVpcmUiLCJ5YXJncyIsInVzYWdlIiwiYWxpYXMiLCJkZXNjcmliZSIsImRlZmF1bHQiLCJjd2QiLCJoZWxwIiwiZXBpbG9nIiwibWFpbk1vZHVsZSIsIm1vZHVsZSIsImFyZ3YiLCJfIiwic2hvd0hlbHAiLCJleGl0IiwiYSIsImMiLCJ0aGVuIiwiY2F0Y2giXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OytCQWtCTyxXQUFvQkEsTUFBcEIsRUFBNEJDLFVBQTVCLEVBQXdDQyxRQUF4QyxFQUFrRDtBQUN2RCxRQUFJQyxlQUFlLElBQW5CO0FBQ0EsUUFBSSxDQUFDRCxRQUFELElBQWFBLFNBQVNFLE1BQVQsR0FBa0IsQ0FBbkMsRUFBc0M7QUFDcENGLGlCQUFXLFFBQVg7QUFDRDs7QUFFRCxRQUFJRyxlQUFlLGVBQUtDLElBQUwsQ0FBVU4sTUFBVixFQUFrQkUsUUFBbEIsQ0FBbkI7QUFDQSxxQkFBT0ssSUFBUCxDQUFZRixZQUFaOztBQUVBLFFBQUlHLFFBQVFDLEdBQVIsQ0FBWUMsUUFBWixLQUF5QixZQUE3QixFQUEyQztBQUN6Q0MsY0FBUUMsR0FBUixDQUFhLHFCQUFtQkosUUFBUUMsR0FBUixDQUFZQyxRQUFaLElBQXdCLGFBQWMsR0FBdEU7QUFDRDs7QUFFREcsTUFBRyxVQUFRYixNQUFPLE9BQUljLEtBQUtDLFNBQUwsQ0FBZWQsVUFBZixDQUEy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S0FBSjs7QUFFQVIsWUFBUU0sS0FBUixDQUFjLHVGQUFkO0FBQ0FULFlBQVFtQyxJQUFSLENBQWEsQ0FBQyxDQUFkO0FBQ0QsR0FSSDtBQVNEIiwiZmlsZSI6ImNsaS5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxuXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBta2RpcnAgZnJvbSAnbWtkaXJwJztcblxuaW1wb3J0IHtjcmVhdGVDb21waWxlckhvc3RGcm9tUHJvamVjdFJvb3R9IGZyb20gJy4vY29uZmlnLXBhcnNlcic7XG5pbXBvcnQge2ZvckFsbEZpbGVzfSBmcm9tICcuL2Zvci1hbGwtZmlsZXMnO1xuXG5wcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCAoZSkgPT4ge1xuICBkKGUubWVzc2FnZSB8fCBlKTtcbiAgZChlLnN0YWNrIHx8ICcnKTtcbn0pO1xuXG5wcm9jZXNzLm9uKCd1bmNhdWdodEV4Y2VwdGlvbicsIChlKSA9PiB7XG4gIGQoZS5tZXNzYWdlIHx8IGUpO1xuICBkKGUuc3RhY2sgfHwgJycpO1xufSk7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtYWluKGFwcERpciwgc291cmNlRGlycywgY2FjaGVEaXIpIHtcbiAgbGV0IGNvbXBpbGVySG9zdCA9IG51bGw7XG4gIGlmICghY2FjaGVEaXIgfHwgY2FjaGVEaXIubGVuZ3RoIDwgMSkge1xuICAgIGNhY2hlRGlyID0gJy5jYWNoZSc7XG4gIH1cblxuICBsZXQgcm9vdENhY2hlRGlyID0gcGF0aC5qb2luKGFwcERpciwgY2FjaGVEaXIpO1xuICBta2RpcnAuc3luYyhyb290Q2FjaGVEaXIpO1xuXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgY29uc29sZS5sb2coYFVzaW5nIE5PREVfRU5WID0gJHtwcm9jZXNzLmVudi5OT0RFX0VOViB8fCAnZGV2ZWxvcG1lbnQnfWApO1xuICB9XG5cbiAgZChgbWFpbjogJHthcHBEaXJ9LCAke0pTT04uc3RyaW5naWZ5KHNvdXJjZURpcnMpfWApO1xuICB0cnkge1xuICAgIGNvbXBpbGVySG9zdCA9IGF3YWl0IGNyZWF0ZUNvbXBpbGVySG9zdEZyb21Qcm9qZWN0Um9vdChhcHBEaXIsIHJvb3RDYWNoZURpcik7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLmVycm9yKGBDb3VsZG4ndCBzZXQgdXAgY29tcGlsZXJzOiAke2UubWVzc2FnZX1gKTtcbiAgICBkKGUuc3RhY2spO1xuXG4gICAgdGhyb3cgZTtcbiAgfVxuXG4gIGF3YWl0IFByb21pc2UuYWxsKHNvdXJjZURpcnMubWFwKChkaXIpID0+IGZvckFsbEZpbGVzKGRpciwgYXN5bmMgKGYpID0+IHtcbiAgICB0cnkge1xuICAgICAgZChgU3RhcnRpbmcgY29tcGlsYXRpb24gZm9yICR7Zn1gKTtcbiAgICAgIGF3YWl0IGNvbXBpbGVySG9zdC5jb21waWxlKGYpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBjb21waWxlIGZpbGU6ICR7Zn1gKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZS5tZXNzYWdlKTtcblxuICAgICAgZChlLnN0YWNrKTtcbiAgICB9XG4gIH0pKSk7XG5cbiAgZCgnU2F2aW5nIG91dCBjb25maWd1cmF0aW9uJyk7XG4gIGF3YWl0IGNvbXBpbGVySG9zdC5zYXZlQ29uZmlndXJhdGlvbigpO1xufVxuXG5jb25zdCBkID0gcmVxdWlyZSgnZGVidWctZWxlY3Ryb24nKSgnZWxlY3Ryb24tY29tcGlsZScpO1xuXG5jb25zdCB5YXJncyA9IHJlcXVpcmUoJ3lhcmdzJylcbiAgLnVzYWdlKCdVc2FnZTogZWxlY3Ryb24tY29tcGlsZSAtLWFwcGRpciBbcm9vdC1hcHAtZGlyXSBwYXRocy4uLicpXG4gIC5hbGlhcygnYScsICdhcHBkaXInKVxuICAuZGVzY3JpYmUoJ2EnLCAnVGhlIHRvcC1sZXZlbCBhcHBsaWNhdGlvbiBkaXJlY3RvcnkgKGkuZS4gd2hlcmUgeW91ciBwYWNrYWdlLmpzb24gaXMpJylcbiAgLmRlZmF1bHQoJ2EnLCBwcm9jZXNzLmN3ZCgpKVxuICAuYWxpYXMoJ2MnLCAnY2FjaGVkaXInKVxuICAuZGVzY3JpYmUoJ2MnLCAnVGhlIGRpcmVjdG9yeSB0byBwdXQgdGhlIGNhY2hlJylcbiAgLmRlZmF1bHQoJ2MnLCAnLmNhY2hlJylcbiAgLmhlbHAoJ2gnKVxuICAuYWxpYXMoJ2gnLCAnaGVscCcpXG4gIC5lcGlsb2coJ0NvcHlyaWdodCAyMDE1Jyk7XG5cbmlmIChwcm9jZXNzLm1haW5Nb2R1bGUgPT09IG1vZHVsZSkge1xuICBjb25zdCBhcmd2ID0geWFyZ3MuYXJndjtcblxuICBpZiAoIWFyZ3YuXyB8fCBhcmd2Ll8ubGVuZ3RoIDwgMSkge1xuICAgIHlhcmdzLnNob3dIZWxwKCk7XG4gICAgcHJvY2Vzcy5leGl0KC0xKTtcbiAgfVxuXG4gIGNvbnN0IHNvdXJjZURpcnMgPSBhcmd2Ll87XG4gIGNvbnN0IGFwcERpciA9IGFyZ3YuYTtcbiAgY29uc3QgY2FjaGVEaXIgPSBhcmd2LmM7XG5cbiAgbWFpbihhcHBEaXIsIHNvdXJjZURpcnMsIGNhY2hlRGlyKVxuICAgIC50aGVuKCgpID0+IHByb2Nlc3MuZXhpdCgwKSlcbiAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZS5tZXNzYWdlIHx8IGUpO1xuICAgICAgZChlLnN0YWNrKTtcblxuICAgICAgY29uc29sZS5lcnJvcihcIkNvbXBpbGF0aW9uIGZhaWxlZCFcXG5Gb3IgZXh0cmEgaW5mb3JtYXRpb24sIHNldCB0aGUgREVCVUcgZW52aXJvbm1lbnQgdmFyaWFibGUgdG8gJyonXCIpO1xuICAgICAgcHJvY2Vzcy5leGl0KC0xKTtcbiAgICB9KTtcbn1cbiJdfQ==