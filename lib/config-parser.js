'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCompilerHostFromProjectRoot = exports.createCompilerHostFromConfigFile = exports.createCompilerHostFromBabelRc = undefined;

/**
 * Creates a compiler host from a .babelrc file. This method is usually called
 * from {@link createCompilerHostFromProjectRoot} instead of used directly.
 *
 * @param  {string} file  The path to a .babelrc file
 *
 * @param  {string} rootCacheDir (optional)  The directory to use as a cache.
 *
 * @return {Promise<CompilerHost>}  A set-up compiler host
 */
let createCompilerHostFromBabelRc = exports.createCompilerHostFromBabelRc = (() => {
  var _ref = _asyncToGenerator(function* (file) {
    let rootCacheDir = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    let info = JSON.parse((yield _promise.pfs.readFile(file, 'utf8')));

    // package.json
    if ('babel' in info) {
      info = info.babel;
    }

    if ('env' in info) {
      let ourEnv = process.env.BABEL_ENV || process.env.NODE_ENV || 'development';
      info = info.env[ourEnv];
    }

    // Are we still package.json (i.e. is there no babel info whatsoever?)
    if ('name' in info && 'version' in info) {
      return createCompilerHostFromConfiguration({
        appRoot: _path2.default.dirname(file),
        options: getDefaultConfiguration(),
        rootCacheDir
      });
    }

    return createCompilerHostFromConfiguration({
      appRoot: _path2.default.dirname(file),
      options: {
        'application/javascript': info
      },
      rootCacheDir
    });
  });

  return function createCompilerHostFromBabelRc(_x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

/**
 * Creates a compiler host from a .compilerc file. This method is usually called
 * from {@link createCompilerHostFromProjectRoot} instead of used directly.
 *
 * @param  {string} file  The path to a .compilerc file
 *
 * @param  {string} rootCacheDir (optional)  The directory to use as a cache.
 *
 * @return {Promise<CompilerHost>}  A set-up compiler host
 */


let createCompilerHostFromConfigFile = exports.createCompilerHostFromConfigFile = (() => {
  var _ref2 = _asyncToGenerator(function* (file) {
    let rootCacheDir = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    let info = JSON.parse((yield _promise.pfs.readFile(file, 'utf8')));

    if ('env' in info) {
      let ourEnv = process.env.ELECTRON_COMPILE_ENV || process.env.NODE_ENV || 'development';
      info = info.env[ourEnv];
    }

    return createCompilerHostFromConfiguration({
      appRoot: _path2.default.dirname(file),
      options: info,
      rootCacheDir
    });
  });

  return function createCompilerHostFromConfigFile(_x6, _x7) {
    return _ref2.apply(this, arguments);
  };
})();

/**
 * Creates a configured {@link CompilerHost} instance from the project root
 * directory. This method first searches for a .compilerc (or .compilerc.json), then falls back to the
 * default locations for Babel configuration info. If neither are found, defaults
 * to standard settings
 *
 * @param  {string} rootDir  The root application directory (i.e. the directory
 *                           that has the app's package.json)
 *
 * @param  {string} rootCacheDir (optional)  The directory to use as a cache.
 *
 * @return {Promise<CompilerHost>}  A set-up compiler host
 */


let createCompilerHostFromProjectRoot = exports.createCompilerHostFromProjectRoot = (() => {
  var _ref3 = _asyncToGenerator(function* (rootDir) {
    let rootCacheDir = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    let compilerc = _path2.default.join(rootDir, '.compilerc');
    if (statSyncNoException(compilerc)) {
      d(`Found a .compilerc at ${ compilerc }, using it`);
      return yield createCompilerHostFromConfigFile(compilerc, rootCacheDir);
    }
    compilerc += '.json';
    if (statSyncNoException(compilerc)) {
      d(`Found a .compilerc at ${ compilerc }, using it`);
      return yield createCompilerHostFromConfigFile(compilerc, rootCacheDir);
    }

    let babelrc = _path2.default.join(rootDir, '.babelrc');
    if (statSyncNoException(babelrc)) {
      d(`Found a .babelrc at ${ babelrc }, using it`);
      return yield createCompilerHostFromBabelRc(babelrc, rootCacheDir);
    }

    d(`Using package.json or default parameters at ${ rootDir }`);
    return yield createCompilerHostFromBabelRc(_path2.default.join(rootDir, 'package.json'), rootCacheDir);
  });

  return function createCompilerHostFromProjectRoot(_x9, _x10) {
    return _ref3.apply(this, arguments);
  };
})();

exports.initializeGlobalHooks = initializeGlobalHooks;
exports.init = init;
exports.createCompilerHostFromConfiguration = createCompilerHostFromConfiguration;
exports.createCompilerHostFromBabelRcSync = createCompilerHostFromBabelRcSync;
exports.createCompilerHostFromConfigFileSync = createCompilerHostFromConfigFileSync;
exports.createCompilerHostFromProjectRootSync = createCompilerHostFromProjectRootSync;
exports.calculateDefaultCompileCacheDirectory = calculateDefaultCompileCacheDirectory;
exports.getDefaultConfiguration = getDefaultConfiguration;
exports.createCompilers = createCompilers;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _zlib = require('zlib');

var _zlib2 = _interopRequireDefault(_zlib);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _promise = require('./promise');

var _fileChangeCache = require('./file-change-cache');

var _fileChangeCache2 = _interopRequireDefault(_fileChangeCache);

var _compilerHost = require('./compiler-host');

var _compilerHost2 = _interopRequireDefault(_compilerHost);

var _requireHook = require('./require-hook');

var _requireHook2 = _interopRequireDefault(_requireHook);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const d = require('debug-electron')('electron-compile:config-parser');

// NB: We intentionally delay-load this so that in production, you can create
// cache-only versions of these compilers
let allCompilerClasses = null;

function statSyncNoException(fsPath) {
  if ('statSyncNoException' in _fs2.default) {
    return _fs2.default.statSyncNoException(fsPath);
  }

  try {
    return _fs2.default.statSync(fsPath);
  } catch (e) {
    return null;
  }
}

/**
 * Initialize the global hooks (protocol hook for file:, node.js hook)
 * independent of initializing the compiler. This method is usually called by
 * init instead of directly
 *
 * @param {CompilerHost} compilerHost  The compiler host to use.
 *
 */
function initializeGlobalHooks(compilerHost) {
  let globalVar = global || window;
  globalVar.globalCompilerHost = compilerHost;

  (0, _requireHook2.default)(compilerHost);

  if ('type' in process && process.type === 'browser') {
    var _require = require('electron');

    const app = _require.app;

    var _require2 = require('./protocol-hook');

    const initializeProtocolHook = _require2.initializeProtocolHook;


    let protoify = function () {
      initializeProtocolHook(compilerHost);
    };
    if (app.isReady()) {
      protoify();
    } else {
      app.on('ready', protoify);
    }
  }
}

/**
 * Initialize electron-compile and set it up, either for development or
 * production use. This is almost always the only method you need to use in order
 * to use electron-compile.
 *
 * @param  {string} appRoot  The top-level directory for your application (i.e.
 *                           the one which has your package.json).
 *
 * @param  {string} mainModule  The module to require in, relative to the module
 *                              calling init, that will start your app. Write this
 *                              as if you were writing a require call from here.
 *
 * @param  {bool} productionMode   If explicitly True/False, will set read-only
 *                                 mode to be disabled/enabled. If not, we'll
 *                                 guess based on the presence of a production
 *                                 cache.
 *
 * @param  {string} cacheDir  If not passed in, read-only will look in
 *                            `appRoot/.cache` and dev mode will compile to a
 *                            temporary directory. If it is passed in, both modes
 *                            will cache to/from `appRoot/{cacheDir}`
 */
function init(appRoot, mainModule) {
  let productionMode = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  let cacheDir = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

  let compilerHost = null;
  let rootCacheDir = _path2.default.join(appRoot, cacheDir || '.cache');

  if (productionMode === null) {
    productionMode = !!statSyncNoException(rootCacheDir);
  }

  if (productionMode) {
    compilerHost = _compilerHost2.default.createReadonlyFromConfigurationSync(rootCacheDir, appRoot);
  } else {
    // if cacheDir was passed in, pass it along. Otherwise, default to a tempdir.
    if (cacheDir) {
      compilerHost = createCompilerHostFromProjectRootSync(appRoot, rootCacheDir);
    } else {
      compilerHost = createCompilerHostFromProjectRootSync(appRoot);
    }
  }

  initializeGlobalHooks(compilerHost);
  require.main.require(mainModule);
}

/**
 * Creates a {@link CompilerHost} with the given information. This method is
 * usually called by {@link createCompilerHostFromProjectRoot}.
 *
 * @private
 */
function createCompilerHostFromConfiguration(info) {
  let compilers = createCompilers();
  let rootCacheDir = info.rootCacheDir || calculateDefaultCompileCacheDirectory();

  d(`Creating CompilerHost: ${ JSON.stringify(info) }, rootCacheDir = ${ rootCacheDir }`);
  let fileChangeCache = new _fileChangeCache2.default(info.appRoot);

  let compilerInfo = _path2.default.join(rootCacheDir, 'compiler-info.json.gz');
  if (_fs2.default.existsSync(compilerInfo)) {
    let buf = _fs2.default.readFileSync(compilerInfo);
    let json = JSON.parse(_zlib2.default.gunzipSync(buf));
    fileChangeCache = _fileChangeCache2.default.loadFromData(json.fileChangeCache, info.appRoot, false);
  }

  Object.keys(info.options || {}).forEach(x => {
    let opts = info.options[x];
    if (!(x in compilers)) {
      throw new Error(`Found compiler settings for missing compiler: ${ x }`);
    }

    // NB: Let's hope this isn't a valid compiler option...
    if (opts.passthrough) {
      compilers[x] = compilers['text/plain'];
      delete opts.passthrough;
    }

    d(`Setting options for ${ x }: ${ JSON.stringify(opts) }`);
    compilers[x].compilerOptions = opts;
  });

  let ret = new _compilerHost2.default(rootCacheDir, compilers, fileChangeCache, false, compilers['text/plain']);

  // NB: It's super important that we guarantee that the configuration is saved
  // out, because we'll need to re-read it in the renderer process
  d(`Created compiler host with options: ${ JSON.stringify(info) }`);
  ret.saveConfigurationSync();
  return ret;
}function createCompilerHostFromBabelRcSync(file) {
  let rootCacheDir = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  let info = JSON.parse(_fs2.default.readFileSync(file, 'utf8'));

  // package.json
  if ('babel' in info) {
    info = info.babel;
  }

  if ('env' in info) {
    let ourEnv = process.env.BABEL_ENV || process.env.NODE_ENV || 'development';
    info = info.env[ourEnv];
  }

  // Are we still package.json (i.e. is there no babel info whatsoever?)
  if ('name' in info && 'version' in info) {
    return createCompilerHostFromConfiguration({
      appRoot: _path2.default.dirname(file),
      options: getDefaultConfiguration(),
      rootCacheDir
    });
  }

  return createCompilerHostFromConfiguration({
    appRoot: _path2.default.dirname(file),
    options: {
      'application/javascript': info
    },
    rootCacheDir
  });
}

function createCompilerHostFromConfigFileSync(file) {
  let rootCacheDir = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  let info = JSON.parse(_fs2.default.readFileSync(file, 'utf8'));

  if ('env' in info) {
    let ourEnv = process.env.ELECTRON_COMPILE_ENV || process.env.NODE_ENV || 'development';
    info = info.env[ourEnv];
  }

  return createCompilerHostFromConfiguration({
    appRoot: _path2.default.dirname(file),
    options: info,
    rootCacheDir
  });
}

function createCompilerHostFromProjectRootSync(rootDir) {
  let rootCacheDir = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  let compilerc = _path2.default.join(rootDir, '.compilerc');
  if (statSyncNoException(compilerc)) {
    d(`Found a .compilerc at ${ compilerc }, using it`);
    return createCompilerHostFromConfigFileSync(compilerc, rootCacheDir);
  }

  let babelrc = _path2.default.join(rootDir, '.babelrc');
  if (statSyncNoException(babelrc)) {
    d(`Found a .babelrc at ${ babelrc }, using it`);
    return createCompilerHostFromBabelRcSync(babelrc, rootCacheDir);
  }

  d(`Using package.json or default parameters at ${ rootDir }`);
  return createCompilerHostFromBabelRcSync(_path2.default.join(rootDir, 'package.json'), rootCacheDir);
}

/**
 * Returns what electron-compile would use as a default rootCacheDir. Usually only
 * used for debugging purposes
 *
 * @return {string}  A path that may or may not exist where electron-compile would
 *                   set up a development mode cache.
 */
function calculateDefaultCompileCacheDirectory() {
  let tmpDir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  let hash = require('crypto').createHash('md5').update(process.execPath).digest('hex');

  let cacheDir = _path2.default.join(tmpDir, `compileCache_${ hash }`);
  _mkdirp2.default.sync(cacheDir);

  d(`Using default cache directory: ${ cacheDir }`);
  return cacheDir;
}

/**
 * Returns the default .configrc if no configuration information can be found.
 *
 * @return {Object}  A list of default config settings for electron-compiler.
 */
function getDefaultConfiguration() {
  return {
    'application/javascript': {
      "presets": ["es2016-node5", "react"],
      "sourceMaps": "inline"
    }
  };
}

/**
 * Allows you to create new instances of all compilers that are supported by
 * electron-compile and use them directly. Currently supports Babel, CoffeeScript,
 * TypeScript, Less, and Jade.
 *
 * @return {Object}  An Object whose Keys are MIME types, and whose values
 * are instances of @{link CompilerBase}.
 */
function createCompilers() {
  if (!allCompilerClasses) {
    // First we want to see if electron-compilers itself has been installed with
    // devDependencies. If that's not the case, check to see if
    // electron-compilers is installed as a peer dependency (probably as a
    // devDependency of the root project).
    const locations = ['electron-compilers', '../../electron-compilers'];

    for (let location of locations) {
      try {
        allCompilerClasses = require(location);
      } catch (e) {
        // Yolo
      }
    }

    if (!allCompilerClasses) {
      throw new Error("Electron compilers not found but were requested to be loaded");
    }
  }

  // NB: Note that this code is carefully set up so that InlineHtmlCompiler
  // (i.e. classes with `createFromCompilers`) initially get an empty object,
  // but will have a reference to the final result of what we return, which
  // resolves the circular dependency we'd otherwise have here.
  let ret = {};
  let instantiatedClasses = allCompilerClasses.map(Klass => {
    if ('createFromCompilers' in Klass) {
      return Klass.createFromCompilers(ret);
    } else {
      return new Klass();
    }
  });

  instantiatedClasses.reduce((acc, x) => {
    let Klass = Object.getPrototypeOf(x).constructor;

    for (let type of Klass.getInputMimeTypes()) {
      acc[type] = x;
    }
    return acc;
  }, ret);

  return ret;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb25maWctcGFyc2VyLmpzIl0sIm5hbWVzIjpbImZpbGUiLCJyb290Q2FjaGVEaXIiLCJpbmZvIiwiSlNPTiIsInBhcnNlIiwicmVhZEZpbGUiLCJiYWJlbCIsIm91ckVudiIsInByb2Nlc3MiLCJlbnYiLCJCQUJFTF9FTlYiLCJOT0RFX0VOViIsImNyZWF0ZUNvbXBpbGVySG9zdEZyb21Db25maWd1cmF0aW9uIiwiYXBwUm9vdCIsImRpcm5hbWUiLCJvcHRpb25zIiwiZ2V0RGVmYXVsdENvbmZpZ3VyYXRpb24iLCJjcmVhdGVDb21waWxlckhvc3RGcm9tQmFiZWxSYyIsIkVMRUNUUk9OX0NPTVBJTEVfRU5WIiwiY3JlYXRlQ29tcGlsZXJIb3N0RnJvbUNvbmZpZ0ZpbGUiLCJyb290RGlyIiwiY29tcGlsZXJjIiwiam9pbiIsInN0YXRTeW5jTm9FeGNlcHRpb24iLCJkIiwiYmFiZWxyYyIsImNyZWF0ZUNvbXBpbGVySG9zdEZyb21Qcm9qZWN0Um9vdCIsImluaXRpYWxpemVHbG9iYWxIb29rcyIsImluaXQiLCJjcmVhdGVDb21waWxlckhvc3RGcm9tQmFiZWxSY1N5bmMiLCJjcmVhdGVDb21waWxlckhvc3RGcm9tQ29uZmlnRmlsZVN5bmMiLCJjcmVhdGVDb21waWxlckhvc3RGcm9tUHJvamVjdFJvb3RTeW5jIiwiY2FsY3VsYXRlRGVmYXVsdENvbXBpbGVDYWNoZURpcmVjdG9yeSIsImNyZWF0ZUNvbXBpbGVycyIsInJlcXVpcmUiLCJhbGxDb21waWxlckNsYXNzZXMiLCJmc1BhdGgiLCJzdGF0U3luYyIsImUiLCJjb21waWxlckhvc3QiLCJnbG9iYWxWYXIiLCJnbG9iYWwiLCJ3aW5kb3ciLCJnbG9iYWxDb21waWxlckhvc3QiLCJ0eXBlIiwiYXBwIiwiaW5pdGlhbGl6ZVByb3RvY29sSG9vayIsInByb3RvaWZ5IiwiaXNSZWFkeSIsIm9uIiwibWFpbk1vZHVsZSIsInByb2R1Y3Rpb25Nb2RlIiwiY2FjaGVEaXIiLCJjcmVhdGVSZWFkb25seUZyb21Db25maWd1cmF0aW9uU3luYyIsIm1haW4iLCJjb21waWxlcnMiLCJzdHJpbmdpZnkiLCJmaWxlQ2hhbmdlQ2FjaGUiLCJjb21waWxlckluZm8iLCJleGlzdHNTeW5jIiwiYnVmIiwicmVhZEZpbGVTeW5jIiwianNvbiIsImd1bnppcFN5bmMiLCJsb2FkRnJvbURhdGEiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsIngiLCJvcHRzIiwiRXJyb3IiLCJwYXNzdGhyb3VnaCIsImNvbXBpbGVyT3B0aW9ucyIsInJldCIsInNhdmVDb25maWd1cmF0aW9uU3luYyIsInRtcERpciIsIlRFTVAiLCJUTVBESVIiLCJoYXNoIiwiY3JlYXRlSGFzaCIsInVwZGF0ZSIsImV4ZWNQYXRoIiwiZGlnZXN0Iiwic3luYyIsImxvY2F0aW9ucyIsImxvY2F0aW9uIiwiaW5zdGFudGlhdGVkQ2xhc3NlcyIsIm1hcCIsIktsYXNzIiwiY3JlYXRlRnJvbUNvbXBpbGVycyIsInJlZHVjZSIsImFjYyIsImdldFByb3RvdHlwZU9mIiwiY29uc3RydWN0b3IiLCJnZXRJbnB1dE1pbWVUeXBlcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQXFKQTs7Ozs7Ozs7Ozs7K0JBVU8sV0FBNkNBLElBQTdDLEVBQXNFO0FBQUEsUUFBbkJDLFlBQW1CLHVFQUFOLElBQU07O0FBQzNFLFFBQUlDLE9BQU9DLEtBQUtDLEtBQUwsRUFBVyxNQUFNLGFBQUlDLFFBQUosQ0FBYUwsSUFBYixFQUFtQixNQUFuQixDQUFqQixFQUFYOztBQUVBO0FBQ0EsUUFBSSxXQUFXRSxJQUFmLEVBQXFCO0FBQ25CQSxhQUFPQSxLQUFLSSxLQUFaO0FBQ0Q7O0FBRUQsUUFBSSxTQUFTSixJQUFiLEVBQW1CO0FBQ2pCLFVBQUlLLFNBQVNDLFFBQVFDLEdBQVIsQ0FBWUMsU0FBWixJQUF5QkYsUUFBUUMsR0FBUixDQUFZRSxRQUFyQyxJQUFpRCxhQUE5RDtBQUNBVCxhQUFPQSxLQUFLTyxHQUFMLENBQVNGLE1BQVQsQ0FBUDtBQUNEOztBQUVEO0FBQ0EsUUFBSSxV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U0FBT0EsR0FBUDtBQUNEIiwiZmlsZSI6ImNvbmZpZy1wYXJzZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgemxpYiBmcm9tICd6bGliJztcbmltcG9ydCBta2RpcnAgZnJvbSAnbWtkaXJwJztcbmltcG9ydCB7cGZzfSBmcm9tICcuL3Byb21pc2UnO1xuXG5pbXBvcnQgRmlsZUNoYW5nZWRDYWNoZSBmcm9tICcuL2ZpbGUtY2hhbmdlLWNhY2hlJztcbmltcG9ydCBDb21waWxlckhvc3QgZnJvbSAnLi9jb21waWxlci1ob3N0JztcbmltcG9ydCByZWdpc3RlclJlcXVpcmVFeHRlbnNpb24gZnJvbSAnLi9yZXF1aXJlLWhvb2snO1xuXG5jb25zdCBkID0gcmVxdWlyZSgnZGVidWctZWxlY3Ryb24nKSgnZWxlY3Ryb24tY29tcGlsZTpjb25maWctcGFyc2VyJyk7XG5cbi8vIE5COiBXZSBpbnRlbnRpb25hbGx5IGRlbGF5LWxvYWQgdGhpcyBzbyB0aGF0IGluIHByb2R1Y3Rpb24sIHlvdSBjYW4gY3JlYXRlXG4vLyBjYWNoZS1vbmx5IHZlcnNpb25zIG9mIHRoZXNlIGNvbXBpbGVyc1xubGV0IGFsbENvbXBpbGVyQ2xhc3NlcyA9IG51bGw7XG5cbmZ1bmN0aW9uIHN0YXRTeW5jTm9FeGNlcHRpb24oZnNQYXRoKSB7XG4gIGlmICgnc3RhdFN5bmNOb0V4Y2VwdGlvbicgaW4gZnMpIHtcbiAgICByZXR1cm4gZnMuc3RhdFN5bmNOb0V4Y2VwdGlvbihmc1BhdGgpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gZnMuc3RhdFN5bmMoZnNQYXRoKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cblxuLyoqXG4gKiBJbml0aWFsaXplIHRoZSBnbG9iYWwgaG9va3MgKHByb3RvY29sIGhvb2sgZm9yIGZpbGU6LCBub2RlLmpzIGhvb2spXG4gKiBpbmRlcGVuZGVudCBvZiBpbml0aWFsaXppbmcgdGhlIGNvbXBpbGVyLiBUaGlzIG1ldGhvZCBpcyB1c3VhbGx5IGNhbGxlZCBieVxuICogaW5pdCBpbnN0ZWFkIG9mIGRpcmVjdGx5XG4gKlxuICogQHBhcmFtIHtDb21waWxlckhvc3R9IGNvbXBpbGVySG9zdCAgVGhlIGNvbXBpbGVyIGhvc3QgdG8gdXNlLlxuICpcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluaXRpYWxpemVHbG9iYWxIb29rcyhjb21waWxlckhvc3QpIHtcbiAgbGV0IGdsb2JhbFZhciA9IChnbG9iYWwgfHwgd2luZG93KTtcbiAgZ2xvYmFsVmFyLmdsb2JhbENvbXBpbGVySG9zdCA9IGNvbXBpbGVySG9zdDtcblxuICByZWdpc3RlclJlcXVpcmVFeHRlbnNpb24oY29tcGlsZXJIb3N0KTtcblxuICBpZiAoJ3R5cGUnIGluIHByb2Nlc3MgJiYgcHJvY2Vzcy50eXBlID09PSAnYnJvd3NlcicpIHtcbiAgICBjb25zdCB7IGFwcCB9ID0gcmVxdWlyZSgnZWxlY3Ryb24nKTtcbiAgICBjb25zdCB7IGluaXRpYWxpemVQcm90b2NvbEhvb2sgfSA9IHJlcXVpcmUoJy4vcHJvdG9jb2wtaG9vaycpO1xuXG4gICAgbGV0IHByb3RvaWZ5ID0gZnVuY3Rpb24oKSB7IGluaXRpYWxpemVQcm90b2NvbEhvb2soY29tcGlsZXJIb3N0KTsgfTtcbiAgICBpZiAoYXBwLmlzUmVhZHkoKSkge1xuICAgICAgcHJvdG9pZnkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXBwLm9uKCdyZWFkeScsIHByb3RvaWZ5KTtcbiAgICB9XG4gIH1cbn1cblxuXG4vKipcbiAqIEluaXRpYWxpemUgZWxlY3Ryb24tY29tcGlsZSBhbmQgc2V0IGl0IHVwLCBlaXRoZXIgZm9yIGRldmVsb3BtZW50IG9yXG4gKiBwcm9kdWN0aW9uIHVzZS4gVGhpcyBpcyBhbG1vc3QgYWx3YXlzIHRoZSBvbmx5IG1ldGhvZCB5b3UgbmVlZCB0byB1c2UgaW4gb3JkZXJcbiAqIHRvIHVzZSBlbGVjdHJvbi1jb21waWxlLlxuICpcbiAqIEBwYXJhbSAge3N0cmluZ30gYXBwUm9vdCAgVGhlIHRvcC1sZXZlbCBkaXJlY3RvcnkgZm9yIHlvdXIgYXBwbGljYXRpb24gKGkuZS5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlIG9uZSB3aGljaCBoYXMgeW91ciBwYWNrYWdlLmpzb24pLlxuICpcbiAqIEBwYXJhbSAge3N0cmluZ30gbWFpbk1vZHVsZSAgVGhlIG1vZHVsZSB0byByZXF1aXJlIGluLCByZWxhdGl2ZSB0byB0aGUgbW9kdWxlXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxpbmcgaW5pdCwgdGhhdCB3aWxsIHN0YXJ0IHlvdXIgYXBwLiBXcml0ZSB0aGlzXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzIGlmIHlvdSB3ZXJlIHdyaXRpbmcgYSByZXF1aXJlIGNhbGwgZnJvbSBoZXJlLlxuICpcbiAqIEBwYXJhbSAge2Jvb2x9IHByb2R1Y3Rpb25Nb2RlICAgSWYgZXhwbGljaXRseSBUcnVlL0ZhbHNlLCB3aWxsIHNldCByZWFkLW9ubHlcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZSB0byBiZSBkaXNhYmxlZC9lbmFibGVkLiBJZiBub3QsIHdlJ2xsXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGd1ZXNzIGJhc2VkIG9uIHRoZSBwcmVzZW5jZSBvZiBhIHByb2R1Y3Rpb25cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGUuXG4gKlxuICogQHBhcmFtICB7c3RyaW5nfSBjYWNoZURpciAgSWYgbm90IHBhc3NlZCBpbiwgcmVhZC1vbmx5IHdpbGwgbG9vayBpblxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgYGFwcFJvb3QvLmNhY2hlYCBhbmQgZGV2IG1vZGUgd2lsbCBjb21waWxlIHRvIGFcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBvcmFyeSBkaXJlY3RvcnkuIElmIGl0IGlzIHBhc3NlZCBpbiwgYm90aCBtb2Rlc1xuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lsbCBjYWNoZSB0by9mcm9tIGBhcHBSb290L3tjYWNoZURpcn1gXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbml0KGFwcFJvb3QsIG1haW5Nb2R1bGUsIHByb2R1Y3Rpb25Nb2RlID0gbnVsbCwgY2FjaGVEaXIgPSBudWxsKSB7XG4gIGxldCBjb21waWxlckhvc3QgPSBudWxsO1xuICBsZXQgcm9vdENhY2hlRGlyID0gcGF0aC5qb2luKGFwcFJvb3QsIGNhY2hlRGlyIHx8ICcuY2FjaGUnKTtcblxuICBpZiAocHJvZHVjdGlvbk1vZGUgPT09IG51bGwpIHtcbiAgICBwcm9kdWN0aW9uTW9kZSA9ICEhc3RhdFN5bmNOb0V4Y2VwdGlvbihyb290Q2FjaGVEaXIpO1xuICB9XG5cbiAgaWYgKHByb2R1Y3Rpb25Nb2RlKSB7XG4gICAgY29tcGlsZXJIb3N0ID0gQ29tcGlsZXJIb3N0LmNyZWF0ZVJlYWRvbmx5RnJvbUNvbmZpZ3VyYXRpb25TeW5jKHJvb3RDYWNoZURpciwgYXBwUm9vdCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gaWYgY2FjaGVEaXIgd2FzIHBhc3NlZCBpbiwgcGFzcyBpdCBhbG9uZy4gT3RoZXJ3aXNlLCBkZWZhdWx0IHRvIGEgdGVtcGRpci5cbiAgICBpZiAoY2FjaGVEaXIpIHtcbiAgICAgIGNvbXBpbGVySG9zdCA9IGNyZWF0ZUNvbXBpbGVySG9zdEZyb21Qcm9qZWN0Um9vdFN5bmMoYXBwUm9vdCwgcm9vdENhY2hlRGlyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29tcGlsZXJIb3N0ID0gY3JlYXRlQ29tcGlsZXJIb3N0RnJvbVByb2plY3RSb290U3luYyhhcHBSb290KTtcbiAgICB9XG5cbiAgfVxuXG4gIGluaXRpYWxpemVHbG9iYWxIb29rcyhjb21waWxlckhvc3QpO1xuICByZXF1aXJlLm1haW4ucmVxdWlyZShtYWluTW9kdWxlKTtcbn1cblxuXG4vKipcbiAqIENyZWF0ZXMgYSB7QGxpbmsgQ29tcGlsZXJIb3N0fSB3aXRoIHRoZSBnaXZlbiBpbmZvcm1hdGlvbi4gVGhpcyBtZXRob2QgaXNcbiAqIHVzdWFsbHkgY2FsbGVkIGJ5IHtAbGluayBjcmVhdGVDb21waWxlckhvc3RGcm9tUHJvamVjdFJvb3R9LlxuICpcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21waWxlckhvc3RGcm9tQ29uZmlndXJhdGlvbihpbmZvKSB7XG4gIGxldCBjb21waWxlcnMgPSBjcmVhdGVDb21waWxlcnMoKTtcbiAgbGV0IHJvb3RDYWNoZURpciA9IGluZm8ucm9vdENhY2hlRGlyIHx8IGNhbGN1bGF0ZURlZmF1bHRDb21waWxlQ2FjaGVEaXJlY3RvcnkoKTtcblxuICBkKGBDcmVhdGluZyBDb21waWxlckhvc3Q6ICR7SlNPTi5zdHJpbmdpZnkoaW5mbyl9LCByb290Q2FjaGVEaXIgPSAke3Jvb3RDYWNoZURpcn1gKTtcbiAgbGV0IGZpbGVDaGFuZ2VDYWNoZSA9IG5ldyBGaWxlQ2hhbmdlZENhY2hlKGluZm8uYXBwUm9vdCk7XG5cbiAgbGV0IGNvbXBpbGVySW5mbyA9IHBhdGguam9pbihyb290Q2FjaGVEaXIsICdjb21waWxlci1pbmZvLmpzb24uZ3onKTtcbiAgaWYgKGZzLmV4aXN0c1N5bmMoY29tcGlsZXJJbmZvKSkge1xuICAgIGxldCBidWYgPSBmcy5yZWFkRmlsZVN5bmMoY29tcGlsZXJJbmZvKTtcbiAgICBsZXQganNvbiA9IEpTT04ucGFyc2UoemxpYi5ndW56aXBTeW5jKGJ1ZikpO1xuICAgIGZpbGVDaGFuZ2VDYWNoZSA9IEZpbGVDaGFuZ2VkQ2FjaGUubG9hZEZyb21EYXRhKGpzb24uZmlsZUNoYW5nZUNhY2hlLCBpbmZvLmFwcFJvb3QsIGZhbHNlKTtcbiAgfVxuXG4gIE9iamVjdC5rZXlzKGluZm8ub3B0aW9ucyB8fCB7fSkuZm9yRWFjaCgoeCkgPT4ge1xuICAgIGxldCBvcHRzID0gaW5mby5vcHRpb25zW3hdO1xuICAgIGlmICghKHggaW4gY29tcGlsZXJzKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGb3VuZCBjb21waWxlciBzZXR0aW5ncyBmb3IgbWlzc2luZyBjb21waWxlcjogJHt4fWApO1xuICAgIH1cblxuICAgIC8vIE5COiBMZXQncyBob3BlIHRoaXMgaXNuJ3QgYSB2YWxpZCBjb21waWxlciBvcHRpb24uLi5cbiAgICBpZiAob3B0cy5wYXNzdGhyb3VnaCkge1xuICAgICAgY29tcGlsZXJzW3hdID0gY29tcGlsZXJzWyd0ZXh0L3BsYWluJ107XG4gICAgICBkZWxldGUgb3B0cy5wYXNzdGhyb3VnaDtcbiAgICB9XG5cbiAgICBkKGBTZXR0aW5nIG9wdGlvbnMgZm9yICR7eH06ICR7SlNPTi5zdHJpbmdpZnkob3B0cyl9YCk7XG4gICAgY29tcGlsZXJzW3hdLmNvbXBpbGVyT3B0aW9ucyA9IG9wdHM7XG4gIH0pO1xuXG4gIGxldCByZXQgPSBuZXcgQ29tcGlsZXJIb3N0KHJvb3RDYWNoZURpciwgY29tcGlsZXJzLCBmaWxlQ2hhbmdlQ2FjaGUsIGZhbHNlLCBjb21waWxlcnNbJ3RleHQvcGxhaW4nXSk7XG5cbiAgLy8gTkI6IEl0J3Mgc3VwZXIgaW1wb3J0YW50IHRoYXQgd2UgZ3VhcmFudGVlIHRoYXQgdGhlIGNvbmZpZ3VyYXRpb24gaXMgc2F2ZWRcbiAgLy8gb3V0LCBiZWNhdXNlIHdlJ2xsIG5lZWQgdG8gcmUtcmVhZCBpdCBpbiB0aGUgcmVuZGVyZXIgcHJvY2Vzc1xuICBkKGBDcmVhdGVkIGNvbXBpbGVyIGhvc3Qgd2l0aCBvcHRpb25zOiAke0pTT04uc3RyaW5naWZ5KGluZm8pfWApO1xuICByZXQuc2F2ZUNvbmZpZ3VyYXRpb25TeW5jKCk7XG4gIHJldHVybiByZXQ7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGNvbXBpbGVyIGhvc3QgZnJvbSBhIC5iYWJlbHJjIGZpbGUuIFRoaXMgbWV0aG9kIGlzIHVzdWFsbHkgY2FsbGVkXG4gKiBmcm9tIHtAbGluayBjcmVhdGVDb21waWxlckhvc3RGcm9tUHJvamVjdFJvb3R9IGluc3RlYWQgb2YgdXNlZCBkaXJlY3RseS5cbiAqXG4gKiBAcGFyYW0gIHtzdHJpbmd9IGZpbGUgIFRoZSBwYXRoIHRvIGEgLmJhYmVscmMgZmlsZVxuICpcbiAqIEBwYXJhbSAge3N0cmluZ30gcm9vdENhY2hlRGlyIChvcHRpb25hbCkgIFRoZSBkaXJlY3RvcnkgdG8gdXNlIGFzIGEgY2FjaGUuXG4gKlxuICogQHJldHVybiB7UHJvbWlzZTxDb21waWxlckhvc3Q+fSAgQSBzZXQtdXAgY29tcGlsZXIgaG9zdFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJIb3N0RnJvbUJhYmVsUmMoZmlsZSwgcm9vdENhY2hlRGlyPW51bGwpIHtcbiAgbGV0IGluZm8gPSBKU09OLnBhcnNlKGF3YWl0IHBmcy5yZWFkRmlsZShmaWxlLCAndXRmOCcpKTtcblxuICAvLyBwYWNrYWdlLmpzb25cbiAgaWYgKCdiYWJlbCcgaW4gaW5mbykge1xuICAgIGluZm8gPSBpbmZvLmJhYmVsO1xuICB9XG5cbiAgaWYgKCdlbnYnIGluIGluZm8pIHtcbiAgICBsZXQgb3VyRW52ID0gcHJvY2Vzcy5lbnYuQkFCRUxfRU5WIHx8IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCc7XG4gICAgaW5mbyA9IGluZm8uZW52W291ckVudl07XG4gIH1cblxuICAvLyBBcmUgd2Ugc3RpbGwgcGFja2FnZS5qc29uIChpLmUuIGlzIHRoZXJlIG5vIGJhYmVsIGluZm8gd2hhdHNvZXZlcj8pXG4gIGlmICgnbmFtZScgaW4gaW5mbyAmJiAndmVyc2lvbicgaW4gaW5mbykge1xuICAgIHJldHVybiBjcmVhdGVDb21waWxlckhvc3RGcm9tQ29uZmlndXJhdGlvbih7XG4gICAgICBhcHBSb290OiBwYXRoLmRpcm5hbWUoZmlsZSksXG4gICAgICBvcHRpb25zOiBnZXREZWZhdWx0Q29uZmlndXJhdGlvbigpLFxuICAgICAgcm9vdENhY2hlRGlyXG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gY3JlYXRlQ29tcGlsZXJIb3N0RnJvbUNvbmZpZ3VyYXRpb24oe1xuICAgIGFwcFJvb3Q6IHBhdGguZGlybmFtZShmaWxlKSxcbiAgICBvcHRpb25zOiB7XG4gICAgICAnYXBwbGljYXRpb24vamF2YXNjcmlwdCc6IGluZm9cbiAgICB9LFxuICAgIHJvb3RDYWNoZURpclxuICB9KTtcbn1cblxuXG4vKipcbiAqIENyZWF0ZXMgYSBjb21waWxlciBob3N0IGZyb20gYSAuY29tcGlsZXJjIGZpbGUuIFRoaXMgbWV0aG9kIGlzIHVzdWFsbHkgY2FsbGVkXG4gKiBmcm9tIHtAbGluayBjcmVhdGVDb21waWxlckhvc3RGcm9tUHJvamVjdFJvb3R9IGluc3RlYWQgb2YgdXNlZCBkaXJlY3RseS5cbiAqXG4gKiBAcGFyYW0gIHtzdHJpbmd9IGZpbGUgIFRoZSBwYXRoIHRvIGEgLmNvbXBpbGVyYyBmaWxlXG4gKlxuICogQHBhcmFtICB7c3RyaW5nfSByb290Q2FjaGVEaXIgKG9wdGlvbmFsKSAgVGhlIGRpcmVjdG9yeSB0byB1c2UgYXMgYSBjYWNoZS5cbiAqXG4gKiBAcmV0dXJuIHtQcm9taXNlPENvbXBpbGVySG9zdD59ICBBIHNldC11cCBjb21waWxlciBob3N0XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVDb21waWxlckhvc3RGcm9tQ29uZmlnRmlsZShmaWxlLCByb290Q2FjaGVEaXI9bnVsbCkge1xuICBsZXQgaW5mbyA9IEpTT04ucGFyc2UoYXdhaXQgcGZzLnJlYWRGaWxlKGZpbGUsICd1dGY4JykpO1xuXG4gIGlmICgnZW52JyBpbiBpbmZvKSB7XG4gICAgbGV0IG91ckVudiA9IHByb2Nlc3MuZW52LkVMRUNUUk9OX0NPTVBJTEVfRU5WIHx8IHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCc7XG4gICAgaW5mbyA9IGluZm8uZW52W291ckVudl07XG4gIH1cblxuICByZXR1cm4gY3JlYXRlQ29tcGlsZXJIb3N0RnJvbUNvbmZpZ3VyYXRpb24oe1xuICAgIGFwcFJvb3Q6IHBhdGguZGlybmFtZShmaWxlKSxcbiAgICBvcHRpb25zOiBpbmZvLFxuICAgIHJvb3RDYWNoZURpclxuICB9KTtcbn1cblxuXG4vKipcbiAqIENyZWF0ZXMgYSBjb25maWd1cmVkIHtAbGluayBDb21waWxlckhvc3R9IGluc3RhbmNlIGZyb20gdGhlIHByb2plY3Qgcm9vdFxuICogZGlyZWN0b3J5LiBUaGlzIG1ldGhvZCBmaXJzdCBzZWFyY2hlcyBmb3IgYSAuY29tcGlsZXJjIChvciAuY29tcGlsZXJjLmpzb24pLCB0aGVuIGZhbGxzIGJhY2sgdG8gdGhlXG4gKiBkZWZhdWx0IGxvY2F0aW9ucyBmb3IgQmFiZWwgY29uZmlndXJhdGlvbiBpbmZvLiBJZiBuZWl0aGVyIGFyZSBmb3VuZCwgZGVmYXVsdHNcbiAqIHRvIHN0YW5kYXJkIHNldHRpbmdzXG4gKlxuICogQHBhcmFtICB7c3RyaW5nfSByb290RGlyICBUaGUgcm9vdCBhcHBsaWNhdGlvbiBkaXJlY3RvcnkgKGkuZS4gdGhlIGRpcmVjdG9yeVxuICogICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0IGhhcyB0aGUgYXBwJ3MgcGFja2FnZS5qc29uKVxuICpcbiAqIEBwYXJhbSAge3N0cmluZ30gcm9vdENhY2hlRGlyIChvcHRpb25hbCkgIFRoZSBkaXJlY3RvcnkgdG8gdXNlIGFzIGEgY2FjaGUuXG4gKlxuICogQHJldHVybiB7UHJvbWlzZTxDb21waWxlckhvc3Q+fSAgQSBzZXQtdXAgY29tcGlsZXIgaG9zdFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJIb3N0RnJvbVByb2plY3RSb290KHJvb3REaXIsIHJvb3RDYWNoZURpcj1udWxsKSB7XG4gIGxldCBjb21waWxlcmMgPSBwYXRoLmpvaW4ocm9vdERpciwgJy5jb21waWxlcmMnKTtcbiAgaWYgKHN0YXRTeW5jTm9FeGNlcHRpb24oY29tcGlsZXJjKSkge1xuICAgIGQoYEZvdW5kIGEgLmNvbXBpbGVyYyBhdCAke2NvbXBpbGVyY30sIHVzaW5nIGl0YCk7XG4gICAgcmV0dXJuIGF3YWl0IGNyZWF0ZUNvbXBpbGVySG9zdEZyb21Db25maWdGaWxlKGNvbXBpbGVyYywgcm9vdENhY2hlRGlyKTtcbiAgfVxuICBjb21waWxlcmMgKz0gJy5qc29uJztcbiAgaWYgKHN0YXRTeW5jTm9FeGNlcHRpb24oY29tcGlsZXJjKSkge1xuICAgIGQoYEZvdW5kIGEgLmNvbXBpbGVyYyBhdCAke2NvbXBpbGVyY30sIHVzaW5nIGl0YCk7XG4gICAgcmV0dXJuIGF3YWl0IGNyZWF0ZUNvbXBpbGVySG9zdEZyb21Db25maWdGaWxlKGNvbXBpbGVyYywgcm9vdENhY2hlRGlyKTtcbiAgfVxuXG4gIGxldCBiYWJlbHJjID0gcGF0aC5qb2luKHJvb3REaXIsICcuYmFiZWxyYycpO1xuICBpZiAoc3RhdFN5bmNOb0V4Y2VwdGlvbihiYWJlbHJjKSkge1xuICAgIGQoYEZvdW5kIGEgLmJhYmVscmMgYXQgJHtiYWJlbHJjfSwgdXNpbmcgaXRgKTtcbiAgICByZXR1cm4gYXdhaXQgY3JlYXRlQ29tcGlsZXJIb3N0RnJvbUJhYmVsUmMoYmFiZWxyYywgcm9vdENhY2hlRGlyKTtcbiAgfVxuXG4gIGQoYFVzaW5nIHBhY2thZ2UuanNvbiBvciBkZWZhdWx0IHBhcmFtZXRlcnMgYXQgJHtyb290RGlyfWApO1xuICByZXR1cm4gYXdhaXQgY3JlYXRlQ29tcGlsZXJIb3N0RnJvbUJhYmVsUmMocGF0aC5qb2luKHJvb3REaXIsICdwYWNrYWdlLmpzb24nKSwgcm9vdENhY2hlRGlyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBpbGVySG9zdEZyb21CYWJlbFJjU3luYyhmaWxlLCByb290Q2FjaGVEaXI9bnVsbCkge1xuICBsZXQgaW5mbyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKGZpbGUsICd1dGY4JykpO1xuXG4gIC8vIHBhY2thZ2UuanNvblxuICBpZiAoJ2JhYmVsJyBpbiBpbmZvKSB7XG4gICAgaW5mbyA9IGluZm8uYmFiZWw7XG4gIH1cblxuICBpZiAoJ2VudicgaW4gaW5mbykge1xuICAgIGxldCBvdXJFbnYgPSBwcm9jZXNzLmVudi5CQUJFTF9FTlYgfHwgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgfHwgJ2RldmVsb3BtZW50JztcbiAgICBpbmZvID0gaW5mby5lbnZbb3VyRW52XTtcbiAgfVxuXG4gIC8vIEFyZSB3ZSBzdGlsbCBwYWNrYWdlLmpzb24gKGkuZS4gaXMgdGhlcmUgbm8gYmFiZWwgaW5mbyB3aGF0c29ldmVyPylcbiAgaWYgKCduYW1lJyBpbiBpbmZvICYmICd2ZXJzaW9uJyBpbiBpbmZvKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUNvbXBpbGVySG9zdEZyb21Db25maWd1cmF0aW9uKHtcbiAgICAgIGFwcFJvb3Q6IHBhdGguZGlybmFtZShmaWxlKSxcbiAgICAgIG9wdGlvbnM6IGdldERlZmF1bHRDb25maWd1cmF0aW9uKCksXG4gICAgICByb290Q2FjaGVEaXJcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBjcmVhdGVDb21waWxlckhvc3RGcm9tQ29uZmlndXJhdGlvbih7XG4gICAgYXBwUm9vdDogcGF0aC5kaXJuYW1lKGZpbGUpLFxuICAgIG9wdGlvbnM6IHtcbiAgICAgICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JzogaW5mb1xuICAgIH0sXG4gICAgcm9vdENhY2hlRGlyXG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJIb3N0RnJvbUNvbmZpZ0ZpbGVTeW5jKGZpbGUsIHJvb3RDYWNoZURpcj1udWxsKSB7XG4gIGxldCBpbmZvID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoZmlsZSwgJ3V0ZjgnKSk7XG5cbiAgaWYgKCdlbnYnIGluIGluZm8pIHtcbiAgICBsZXQgb3VyRW52ID0gcHJvY2Vzcy5lbnYuRUxFQ1RST05fQ09NUElMRV9FTlYgfHwgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgfHwgJ2RldmVsb3BtZW50JztcbiAgICBpbmZvID0gaW5mby5lbnZbb3VyRW52XTtcbiAgfVxuXG4gIHJldHVybiBjcmVhdGVDb21waWxlckhvc3RGcm9tQ29uZmlndXJhdGlvbih7XG4gICAgYXBwUm9vdDogcGF0aC5kaXJuYW1lKGZpbGUpLFxuICAgIG9wdGlvbnM6IGluZm8sXG4gICAgcm9vdENhY2hlRGlyXG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcGlsZXJIb3N0RnJvbVByb2plY3RSb290U3luYyhyb290RGlyLCByb290Q2FjaGVEaXI9bnVsbCkge1xuICBsZXQgY29tcGlsZXJjID0gcGF0aC5qb2luKHJvb3REaXIsICcuY29tcGlsZXJjJyk7XG4gIGlmIChzdGF0U3luY05vRXhjZXB0aW9uKGNvbXBpbGVyYykpIHtcbiAgICBkKGBGb3VuZCBhIC5jb21waWxlcmMgYXQgJHtjb21waWxlcmN9LCB1c2luZyBpdGApO1xuICAgIHJldHVybiBjcmVhdGVDb21waWxlckhvc3RGcm9tQ29uZmlnRmlsZVN5bmMoY29tcGlsZXJjLCByb290Q2FjaGVEaXIpO1xuICB9XG5cbiAgbGV0IGJhYmVscmMgPSBwYXRoLmpvaW4ocm9vdERpciwgJy5iYWJlbHJjJyk7XG4gIGlmIChzdGF0U3luY05vRXhjZXB0aW9uKGJhYmVscmMpKSB7XG4gICAgZChgRm91bmQgYSAuYmFiZWxyYyBhdCAke2JhYmVscmN9LCB1c2luZyBpdGApO1xuICAgIHJldHVybiBjcmVhdGVDb21waWxlckhvc3RGcm9tQmFiZWxSY1N5bmMoYmFiZWxyYywgcm9vdENhY2hlRGlyKTtcbiAgfVxuXG4gIGQoYFVzaW5nIHBhY2thZ2UuanNvbiBvciBkZWZhdWx0IHBhcmFtZXRlcnMgYXQgJHtyb290RGlyfWApO1xuICByZXR1cm4gY3JlYXRlQ29tcGlsZXJIb3N0RnJvbUJhYmVsUmNTeW5jKHBhdGguam9pbihyb290RGlyLCAncGFja2FnZS5qc29uJyksIHJvb3RDYWNoZURpcik7XG59XG5cbi8qKlxuICogUmV0dXJucyB3aGF0IGVsZWN0cm9uLWNvbXBpbGUgd291bGQgdXNlIGFzIGEgZGVmYXVsdCByb290Q2FjaGVEaXIuIFVzdWFsbHkgb25seVxuICogdXNlZCBmb3IgZGVidWdnaW5nIHB1cnBvc2VzXG4gKlxuICogQHJldHVybiB7c3RyaW5nfSAgQSBwYXRoIHRoYXQgbWF5IG9yIG1heSBub3QgZXhpc3Qgd2hlcmUgZWxlY3Ryb24tY29tcGlsZSB3b3VsZFxuICogICAgICAgICAgICAgICAgICAgc2V0IHVwIGEgZGV2ZWxvcG1lbnQgbW9kZSBjYWNoZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhbGN1bGF0ZURlZmF1bHRDb21waWxlQ2FjaGVEaXJlY3RvcnkoKSB7XG4gIGxldCB0bXBEaXIgPSBwcm9jZXNzLmVudi5URU1QIHx8IHByb2Nlc3MuZW52LlRNUERJUiB8fCAnL3RtcCc7XG4gIGxldCBoYXNoID0gcmVxdWlyZSgnY3J5cHRvJykuY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKHByb2Nlc3MuZXhlY1BhdGgpLmRpZ2VzdCgnaGV4Jyk7XG5cbiAgbGV0IGNhY2hlRGlyID0gcGF0aC5qb2luKHRtcERpciwgYGNvbXBpbGVDYWNoZV8ke2hhc2h9YCk7XG4gIG1rZGlycC5zeW5jKGNhY2hlRGlyKTtcblxuICBkKGBVc2luZyBkZWZhdWx0IGNhY2hlIGRpcmVjdG9yeTogJHtjYWNoZURpcn1gKTtcbiAgcmV0dXJuIGNhY2hlRGlyO1xufVxuXG5cbi8qKlxuICogUmV0dXJucyB0aGUgZGVmYXVsdCAuY29uZmlncmMgaWYgbm8gY29uZmlndXJhdGlvbiBpbmZvcm1hdGlvbiBjYW4gYmUgZm91bmQuXG4gKlxuICogQHJldHVybiB7T2JqZWN0fSAgQSBsaXN0IG9mIGRlZmF1bHQgY29uZmlnIHNldHRpbmdzIGZvciBlbGVjdHJvbi1jb21waWxlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldERlZmF1bHRDb25maWd1cmF0aW9uKCkge1xuICByZXR1cm4ge1xuICAgICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0Jzoge1xuICAgICAgXCJwcmVzZXRzXCI6IFtcImVzMjAxNi1ub2RlNVwiLCBcInJlYWN0XCJdLFxuICAgICAgXCJzb3VyY2VNYXBzXCI6IFwiaW5saW5lXCJcbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogQWxsb3dzIHlvdSB0byBjcmVhdGUgbmV3IGluc3RhbmNlcyBvZiBhbGwgY29tcGlsZXJzIHRoYXQgYXJlIHN1cHBvcnRlZCBieVxuICogZWxlY3Ryb24tY29tcGlsZSBhbmQgdXNlIHRoZW0gZGlyZWN0bHkuIEN1cnJlbnRseSBzdXBwb3J0cyBCYWJlbCwgQ29mZmVlU2NyaXB0LFxuICogVHlwZVNjcmlwdCwgTGVzcywgYW5kIEphZGUuXG4gKlxuICogQHJldHVybiB7T2JqZWN0fSAgQW4gT2JqZWN0IHdob3NlIEtleXMgYXJlIE1JTUUgdHlwZXMsIGFuZCB3aG9zZSB2YWx1ZXNcbiAqIGFyZSBpbnN0YW5jZXMgb2YgQHtsaW5rIENvbXBpbGVyQmFzZX0uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21waWxlcnMoKSB7XG4gIGlmICghYWxsQ29tcGlsZXJDbGFzc2VzKSB7XG4gICAgLy8gRmlyc3Qgd2Ugd2FudCB0byBzZWUgaWYgZWxlY3Ryb24tY29tcGlsZXJzIGl0c2VsZiBoYXMgYmVlbiBpbnN0YWxsZWQgd2l0aFxuICAgIC8vIGRldkRlcGVuZGVuY2llcy4gSWYgdGhhdCdzIG5vdCB0aGUgY2FzZSwgY2hlY2sgdG8gc2VlIGlmXG4gICAgLy8gZWxlY3Ryb24tY29tcGlsZXJzIGlzIGluc3RhbGxlZCBhcyBhIHBlZXIgZGVwZW5kZW5jeSAocHJvYmFibHkgYXMgYVxuICAgIC8vIGRldkRlcGVuZGVuY3kgb2YgdGhlIHJvb3QgcHJvamVjdCkuXG4gICAgY29uc3QgbG9jYXRpb25zID0gWydlbGVjdHJvbi1jb21waWxlcnMnLCAnLi4vLi4vZWxlY3Ryb24tY29tcGlsZXJzJ107XG5cbiAgICBmb3IgKGxldCBsb2NhdGlvbiBvZiBsb2NhdGlvbnMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGFsbENvbXBpbGVyQ2xhc3NlcyA9IHJlcXVpcmUobG9jYXRpb24pO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBZb2xvXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFhbGxDb21waWxlckNsYXNzZXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkVsZWN0cm9uIGNvbXBpbGVycyBub3QgZm91bmQgYnV0IHdlcmUgcmVxdWVzdGVkIHRvIGJlIGxvYWRlZFwiKTtcbiAgICB9XG4gIH1cblxuICAvLyBOQjogTm90ZSB0aGF0IHRoaXMgY29kZSBpcyBjYXJlZnVsbHkgc2V0IHVwIHNvIHRoYXQgSW5saW5lSHRtbENvbXBpbGVyXG4gIC8vIChpLmUuIGNsYXNzZXMgd2l0aCBgY3JlYXRlRnJvbUNvbXBpbGVyc2ApIGluaXRpYWxseSBnZXQgYW4gZW1wdHkgb2JqZWN0LFxuICAvLyBidXQgd2lsbCBoYXZlIGEgcmVmZXJlbmNlIHRvIHRoZSBmaW5hbCByZXN1bHQgb2Ygd2hhdCB3ZSByZXR1cm4sIHdoaWNoXG4gIC8vIHJlc29sdmVzIHRoZSBjaXJjdWxhciBkZXBlbmRlbmN5IHdlJ2Qgb3RoZXJ3aXNlIGhhdmUgaGVyZS5cbiAgbGV0IHJldCA9IHt9O1xuICBsZXQgaW5zdGFudGlhdGVkQ2xhc3NlcyA9IGFsbENvbXBpbGVyQ2xhc3Nlcy5tYXAoKEtsYXNzKSA9PiB7XG4gICAgaWYgKCdjcmVhdGVGcm9tQ29tcGlsZXJzJyBpbiBLbGFzcykge1xuICAgICAgcmV0dXJuIEtsYXNzLmNyZWF0ZUZyb21Db21waWxlcnMocmV0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5ldyBLbGFzcygpO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5zdGFudGlhdGVkQ2xhc3Nlcy5yZWR1Y2UoKGFjYyx4KSA9PiB7XG4gICAgbGV0IEtsYXNzID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHgpLmNvbnN0cnVjdG9yO1xuXG4gICAgZm9yIChsZXQgdHlwZSBvZiBLbGFzcy5nZXRJbnB1dE1pbWVUeXBlcygpKSB7IGFjY1t0eXBlXSA9IHg7IH1cbiAgICByZXR1cm4gYWNjO1xuICB9LCByZXQpO1xuXG4gIHJldHVybiByZXQ7XG59XG4iXX0=