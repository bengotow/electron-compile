'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _zlib = require('zlib');

var _zlib2 = _interopRequireDefault(_zlib);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _promise = require('./promise');

var _mimeTypes = require('./mime-types');

var _mimeTypes2 = _interopRequireDefault(_mimeTypes);

var _forAllFiles = require('./for-all-files');

var _compileCache = require('./compile-cache');

var _compileCache2 = _interopRequireDefault(_compileCache);

var _fileChangeCache = require('./file-change-cache');

var _fileChangeCache2 = _interopRequireDefault(_fileChangeCache);

var _readOnlyCompiler = require('./read-only-compiler');

var _readOnlyCompiler2 = _interopRequireDefault(_readOnlyCompiler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const d = require('debug-electron')('electron-compile:compiler-host');

// This isn't even my
const finalForms = {
  'text/javascript': true,
  'application/javascript': true,
  'text/html': true,
  'text/css': true,
  'image/svg+xml': true,
  'application/json': true
};

/**
 * This class is the top-level class that encapsulates all of the logic of
 * compiling and caching application code. If you're looking for a "Main class",
 * this is it.
 *
 * This class can be created directly but it is usually created via the methods
 * in config-parser, which will among other things, set up the compiler options
 * given a project root.
 *
 * CompilerHost is also the top-level class that knows how to serialize all of the
 * information necessary to recreate itself, either as a development host (i.e.
 * will allow cache misses and actual compilation), or as a read-only version of
 * itself for production.
 */
class CompilerHost {
  /**
   * Creates an instance of CompilerHost. You probably want to use the methods
   * in config-parser for development, or {@link createReadonlyFromConfiguration}
   * for production instead.
   *
   * @param  {string} rootCacheDir  The root directory to use for the cache
   *
   * @param  {Object} compilers  an Object whose keys are input MIME types and
   *                             whose values are instances of CompilerBase. Create
   *                             this via the {@link createCompilers} method in
   *                             config-parser.
   *
   * @param  {FileChangedCache} fileChangeCache  A file-change cache that is
   *                                             optionally pre-loaded.
   *
   * @param  {boolean} readOnlyMode  If True, cache misses will fail and
   *                                 compilation will not be attempted.
   *
   * @param  {CompilerBase} fallbackCompiler (optional)  When a file is compiled
   *                                         which doesn't have a matching compiler,
   *                                         this compiler will be used instead. If
   *                                         null, will fail compilation. A good
   *                                         alternate fallback is the compiler for
   *                                         'text/plain', which is guaranteed to be
   *                                         present.
   */
  constructor(rootCacheDir, compilers, fileChangeCache, readOnlyMode) {
    let fallbackCompiler = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;

    let compilersByMimeType = Object.assign({}, compilers);
    Object.assign(this, { rootCacheDir, compilersByMimeType, fileChangeCache, readOnlyMode, fallbackCompiler });
    this.appRoot = this.fileChangeCache.appRoot;

    this.cachesForCompilers = Object.keys(compilersByMimeType).reduce((acc, x) => {
      let compiler = compilersByMimeType[x];
      if (acc.has(compiler)) return acc;

      acc.set(compiler, _compileCache2.default.createFromCompiler(rootCacheDir, compiler, fileChangeCache, readOnlyMode));
      return acc;
    }, new Map());
  }

  /**
   * Creates a production-mode CompilerHost from the previously saved
   * configuration
   *
   * @param  {string} rootCacheDir  The root directory to use for the cache. This
   *                                cache must have cache information saved via
   *                                {@link saveConfiguration}
   *
   * @param  {string} appRoot  The top-level directory for your application (i.e.
   *                           the one which has your package.json).
   *
   * @param  {CompilerBase} fallbackCompiler (optional)  When a file is compiled
   *                                         which doesn't have a matching compiler,
   *                                         this compiler will be used instead. If
   *                                         null, will fail compilation. A good
   *                                         alternate fallback is the compiler for
   *                                         'text/plain', which is guaranteed to be
   *                                         present.
   *
   * @return {Promise<CompilerHost>}  A read-only CompilerHost
   */
  static createReadonlyFromConfiguration(rootCacheDir, appRoot) {
    let fallbackCompiler = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    return _asyncToGenerator(function* () {
      let target = _path2.default.join(rootCacheDir, 'compiler-info.json.gz');
      let buf = yield _promise.pfs.readFile(target);
      let info = JSON.parse((yield _promise.pzlib.gunzip(buf)));

      let fileChangeCache = _fileChangeCache2.default.loadFromData(info.fileChangeCache, appRoot, true);

      let compilers = Object.keys(info.compilers).reduce(function (acc, x) {
        let cur = info.compilers[x];
        acc[x] = new _readOnlyCompiler2.default(cur.name, cur.compilerVersion, cur.compilerOptions, cur.inputMimeTypes);

        return acc;
      }, {});

      return new CompilerHost(rootCacheDir, compilers, fileChangeCache, true, fallbackCompiler);
    })();
  }

  /**
   * Creates a development-mode CompilerHost from the previously saved
   * configuration.
   *
   * @param  {string} rootCacheDir  The root directory to use for the cache. This
   *                                cache must have cache information saved via
   *                                {@link saveConfiguration}
   *
   * @param  {string} appRoot  The top-level directory for your application (i.e.
   *                           the one which has your package.json).
   *
   * @param  {Object} compilersByMimeType  an Object whose keys are input MIME
   *                                       types and whose values are instances
   *                                       of CompilerBase. Create this via the
   *                                       {@link createCompilers} method in
   *                                       config-parser.
   *
   * @param  {CompilerBase} fallbackCompiler (optional)  When a file is compiled
   *                                         which doesn't have a matching compiler,
   *                                         this compiler will be used instead. If
   *                                         null, will fail compilation. A good
   *                                         alternate fallback is the compiler for
   *                                         'text/plain', which is guaranteed to be
   *                                         present.
   *
   * @return {Promise<CompilerHost>}  A read-only CompilerHost
   */
  static createFromConfiguration(rootCacheDir, appRoot, compilersByMimeType) {
    let fallbackCompiler = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
    return _asyncToGenerator(function* () {
      let target = _path2.default.join(rootCacheDir, 'compiler-info.json.gz');
      let buf = yield _promise.pfs.readFile(target);
      let info = JSON.parse((yield _promise.pzlib.gunzip(buf)));

      let fileChangeCache = _fileChangeCache2.default.loadFromData(info.fileChangeCache, appRoot, false);

      Object.keys(info.compilers).forEach(function (x) {
        let cur = info.compilers[x];
        compilersByMimeType[x].compilerOptions = cur.compilerOptions;
      });

      return new CompilerHost(rootCacheDir, compilersByMimeType, fileChangeCache, false, fallbackCompiler);
    })();
  }

  /**
   * Saves the current compiler configuration to a file that
   * {@link createReadonlyFromConfiguration} can use to recreate the current
   * compiler environment
   *
   * @return {Promise}  Completion
   */
  saveConfiguration() {
    var _this = this;

    return _asyncToGenerator(function* () {
      let serializedCompilerOpts = Object.keys(_this.compilersByMimeType).reduce(function (acc, x) {
        let compiler = _this.compilersByMimeType[x];
        let Klass = Object.getPrototypeOf(compiler).constructor;

        let val = {
          name: Klass.name,
          inputMimeTypes: Klass.getInputMimeTypes(),
          compilerOptions: compiler.compilerOptions,
          compilerVersion: compiler.getCompilerVersion()
        };

        acc[x] = val;
        return acc;
      }, {});

      let info = {
        fileChangeCache: _this.fileChangeCache.getSavedData(),
        compilers: serializedCompilerOpts
      };

      let target = _path2.default.join(_this.rootCacheDir, 'compiler-info.json.gz');
      let buf = yield _promise.pzlib.gzip(new Buffer(JSON.stringify(info)));
      yield _promise.pfs.writeFile(target, buf);
    })();
  }

  /**
   * Compiles a file and returns the compiled result.
   *
   * @param  {string} filePath  The path to the file to compile
   *
   * @return {Promise<object>}  An Object with the compiled result
   *
   * @property {Object} hashInfo  The hash information returned from getHashForPath
   * @property {string} code  The source code if the file was a text file
   * @property {Buffer} binaryData  The file if it was a binary file
   * @property {string} mimeType  The MIME type saved in the cache.
   * @property {string[]} dependentFiles  The dependent files returned from
   *                                      compiling the file, if any.
   */
  compile(filePath) {
    return this.readOnlyMode ? this.compileReadOnly(filePath) : this.fullCompile(filePath);
  }

  /**
   * Handles compilation in read-only mode
   *
   * @private
   */
  compileReadOnly(filePath) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      // We guarantee that node_modules are always shipped directly
      let type = _mimeTypes2.default.lookup(filePath);
      if (_fileChangeCache2.default.isInNodeModules(filePath)) {
        return {
          mimeType: type || 'application/javascript',
          code: yield _promise.pfs.readFile(filePath, 'utf8')
        };
      }

      let hashInfo = yield _this2.fileChangeCache.getHashForPath(filePath);

      // NB: Here, we're basically only using the compiler here to find
      // the appropriate CompileCache
      let compiler = CompilerHost.shouldPassthrough(hashInfo) ? _this2.getPassthroughCompiler() : _this2.compilersByMimeType[type || '__lolnothere'];

      if (!compiler) {
        compiler = _this2.fallbackCompiler;

        var _ref = yield compiler.get(filePath);

        let code = _ref.code,
            binaryData = _ref.binaryData,
            mimeType = _ref.mimeType;

        return { code: code || binaryData, mimeType };
      }

      let cache = _this2.cachesForCompilers.get(compiler);

      var _ref2 = yield cache.get(filePath);

      let code = _ref2.code,
          binaryData = _ref2.binaryData,
          mimeType = _ref2.mimeType;


      code = code || binaryData;
      if (!code || !mimeType) {
        throw new Error(`Asked to compile ${ filePath } in production, is this file not precompiled?`);
      }

      return { code, mimeType };
    })();
  }

  /**
   * Handles compilation in read-write mode
   *
   * @private
   */
  fullCompile(filePath) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      d(`Compiling ${ filePath }`);

      let hashInfo = yield _this3.fileChangeCache.getHashForPath(filePath);
      let type = _mimeTypes2.default.lookup(filePath);

      if (hashInfo.isInNodeModules) {
        let code = hashInfo.sourceCode || (yield _promise.pfs.readFile(filePath, 'utf8'));
        code = yield CompilerHost.fixNodeModulesSourceMapping(code, filePath, _this3.fileChangeCache.appRoot);
        return { code, mimeType: type };
      }

      let compiler = CompilerHost.shouldPassthrough(hashInfo) ? _this3.getPassthroughCompiler() : _this3.compilersByMimeType[type || '__lolnothere'];

      if (!compiler) {
        d(`Falling back to passthrough compiler for ${ filePath }`);
        compiler = _this3.fallbackCompiler;
      }

      if (!compiler) {
        throw new Error(`Couldn't find a compiler for ${ filePath }`);
      }

      let cache = _this3.cachesForCompilers.get(compiler);
      return yield cache.getOrFetch(filePath, function (filePath, hashInfo) {
        return _this3.compileUncached(filePath, hashInfo, compiler);
      });
    })();
  }

  /**
   * Handles invoking compilers independent of caching
   *
   * @private
   */
  compileUncached(filePath, hashInfo, compiler) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      let inputMimeType = _mimeTypes2.default.lookup(filePath);

      if (hashInfo.isFileBinary) {
        return {
          binaryData: hashInfo.binaryData || (yield _promise.pfs.readFile(filePath)),
          mimeType: inputMimeType,
          dependentFiles: []
        };
      }

      let ctx = {};
      let code = hashInfo.sourceCode || (yield _promise.pfs.readFile(filePath, 'utf8'));

      if (!(yield compiler.shouldCompileFile(code, ctx))) {
        d(`Compiler returned false for shouldCompileFile: ${ filePath }`);
        return { code, mimeType: _mimeTypes2.default.lookup(filePath), dependentFiles: [] };
      }

      let dependentFiles = yield compiler.determineDependentFiles(code, filePath, ctx);

      d(`Using compiler options: ${ JSON.stringify(compiler.compilerOptions) }`);
      let result = yield compiler.compile(code, filePath, ctx);

      let shouldInlineHtmlify = inputMimeType !== 'text/html' && result.mimeType === 'text/html';

      let isPassthrough = result.mimeType === 'text/plain' || !result.mimeType || CompilerHost.shouldPassthrough(hashInfo);

      if (finalForms[result.mimeType] && !shouldInlineHtmlify || isPassthrough) {
        // Got something we can use in-browser, let's return it
        return Object.assign(result, { dependentFiles });
      } else {
        d(`Recursively compiling result of ${ filePath } with non-final MIME type ${ result.mimeType }, input was ${ inputMimeType }`);

        hashInfo = Object.assign({ sourceCode: result.code, mimeType: result.mimeType }, hashInfo);
        compiler = _this4.compilersByMimeType[result.mimeType || '__lolnothere'];

        if (!compiler) {
          d(`Recursive compile failed - intermediate result: ${ JSON.stringify(result) }`);

          throw new Error(`Compiling ${ filePath } resulted in a MIME type of ${ result.mimeType }, which we don't know how to handle`);
        }

        return yield _this4.compileUncached(`${ filePath }.${ _mimeTypes2.default.extension(result.mimeType || 'txt') }`, hashInfo, compiler);
      }
    })();
  }

  /**
   * Pre-caches an entire directory of files recursively. Usually used for
   * building custom compiler tooling.
   *
   * @param  {string} rootDirectory  The top-level directory to compile
   *
   * @param  {Function} shouldCompile (optional)  A Function which allows the
   *                                  caller to disable compiling certain files.
   *                                  It takes a fully-qualified path to a file,
   *                                  and should return a Boolean.
   *
   * @return {Promise}  Completion.
   */
  compileAll(rootDirectory) {
    var _this5 = this;

    let shouldCompile = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    return _asyncToGenerator(function* () {
      let should = shouldCompile || function () {
        return true;
      };

      yield (0, _forAllFiles.forAllFiles)(rootDirectory, function (f) {
        if (!should(f)) return;

        d(`Compiling ${ f }`);
        return _this5.compile(f, _this5.compilersByMimeType);
      });
    })();
  }

  /*
   * Sync Methods
   */

  compileSync(filePath) {
    return this.readOnlyMode ? this.compileReadOnlySync(filePath) : this.fullCompileSync(filePath);
  }

  static createReadonlyFromConfigurationSync(rootCacheDir, appRoot) {
    let fallbackCompiler = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    let target = _path2.default.join(rootCacheDir, 'compiler-info.json.gz');
    let buf = _fs2.default.readFileSync(target);
    let info = JSON.parse(_zlib2.default.gunzipSync(buf));

    let fileChangeCache = _fileChangeCache2.default.loadFromData(info.fileChangeCache, appRoot, true);

    let compilers = Object.keys(info.compilers).reduce((acc, x) => {
      let cur = info.compilers[x];
      acc[x] = new _readOnlyCompiler2.default(cur.name, cur.compilerVersion, cur.compilerOptions, cur.inputMimeTypes);

      return acc;
    }, {});

    return new CompilerHost(rootCacheDir, compilers, fileChangeCache, true, fallbackCompiler);
  }

  static createFromConfigurationSync(rootCacheDir, appRoot, compilersByMimeType) {
    let fallbackCompiler = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

    let target = _path2.default.join(rootCacheDir, 'compiler-info.json.gz');
    let buf = _fs2.default.readFileSync(target);
    let info = JSON.parse(_zlib2.default.gunzipSync(buf));

    let fileChangeCache = _fileChangeCache2.default.loadFromData(info.fileChangeCache, appRoot, false);

    Object.keys(info.compilers).forEach(x => {
      let cur = info.compilers[x];
      compilersByMimeType[x].compilerOptions = cur.compilerOptions;
    });

    return new CompilerHost(rootCacheDir, compilersByMimeType, fileChangeCache, false, fallbackCompiler);
  }

  saveConfigurationSync() {
    let serializedCompilerOpts = Object.keys(this.compilersByMimeType).reduce((acc, x) => {
      let compiler = this.compilersByMimeType[x];
      let Klass = Object.getPrototypeOf(compiler).constructor;

      let val = {
        name: Klass.name,
        inputMimeTypes: Klass.getInputMimeTypes(),
        compilerOptions: compiler.compilerOptions,
        compilerVersion: compiler.getCompilerVersion()
      };

      acc[x] = val;
      return acc;
    }, {});

    let info = {
      fileChangeCache: this.fileChangeCache.getSavedData(),
      compilers: serializedCompilerOpts
    };

    let target = _path2.default.join(this.rootCacheDir, 'compiler-info.json.gz');
    let buf = _zlib2.default.gzipSync(new Buffer(JSON.stringify(info)));
    _fs2.default.writeFileSync(target, buf);
  }

  compileReadOnlySync(filePath) {
    // We guarantee that node_modules are always shipped directly
    let type = _mimeTypes2.default.lookup(filePath);
    if (_fileChangeCache2.default.isInNodeModules(filePath)) {
      return {
        mimeType: type || 'application/javascript',
        code: _fs2.default.readFileSync(filePath, 'utf8')
      };
    }

    let hashInfo = this.fileChangeCache.getHashForPathSync(filePath);

    // We guarantee that node_modules are always shipped directly
    if (hashInfo.isInNodeModules) {
      return {
        mimeType: type,
        code: hashInfo.sourceCode || _fs2.default.readFileSync(filePath, 'utf8')
      };
    }

    // NB: Here, we're basically only using the compiler here to find
    // the appropriate CompileCache
    let compiler = CompilerHost.shouldPassthrough(hashInfo) ? this.getPassthroughCompiler() : this.compilersByMimeType[type || '__lolnothere'];

    if (!compiler) {
      compiler = this.fallbackCompiler;

      var _compiler$getSync = compiler.getSync(filePath);

      let code = _compiler$getSync.code,
          binaryData = _compiler$getSync.binaryData,
          mimeType = _compiler$getSync.mimeType;

      return { code: code || binaryData, mimeType };
    }

    let cache = this.cachesForCompilers.get(compiler);

    var _cache$getSync = cache.getSync(filePath);

    let code = _cache$getSync.code,
        binaryData = _cache$getSync.binaryData,
        mimeType = _cache$getSync.mimeType;


    code = code || binaryData;
    if (!code || !mimeType) {
      throw new Error(`Asked to compile ${ filePath } in production, is this file not precompiled?`);
    }

    return { code, mimeType };
  }

  fullCompileSync(filePath) {
    d(`Compiling ${ filePath }`);

    let hashInfo = this.fileChangeCache.getHashForPathSync(filePath);
    let type = _mimeTypes2.default.lookup(filePath);

    if (hashInfo.isInNodeModules) {
      let code = hashInfo.sourceCode || _fs2.default.readFileSync(filePath, 'utf8');
      code = CompilerHost.fixNodeModulesSourceMappingSync(code, filePath, this.fileChangeCache.appRoot);
      return { code, mimeType: type };
    }

    let compiler = CompilerHost.shouldPassthrough(hashInfo) ? this.getPassthroughCompiler() : this.compilersByMimeType[type || '__lolnothere'];

    if (!compiler) {
      d(`Falling back to passthrough compiler for ${ filePath }`);
      compiler = this.fallbackCompiler;
    }

    if (!compiler) {
      throw new Error(`Couldn't find a compiler for ${ filePath }`);
    }

    let cache = this.cachesForCompilers.get(compiler);
    return cache.getOrFetchSync(filePath, (filePath, hashInfo) => this.compileUncachedSync(filePath, hashInfo, compiler));
  }

  compileUncachedSync(filePath, hashInfo, compiler) {
    let inputMimeType = _mimeTypes2.default.lookup(filePath);

    if (hashInfo.isFileBinary) {
      return {
        binaryData: hashInfo.binaryData || _fs2.default.readFileSync(filePath),
        mimeType: inputMimeType,
        dependentFiles: []
      };
    }

    let ctx = {};
    let code = hashInfo.sourceCode || _fs2.default.readFileSync(filePath, 'utf8');

    if (!compiler.shouldCompileFileSync(code, ctx)) {
      d(`Compiler returned false for shouldCompileFile: ${ filePath }`);
      return { code, mimeType: _mimeTypes2.default.lookup(filePath), dependentFiles: [] };
    }

    let dependentFiles = compiler.determineDependentFilesSync(code, filePath, ctx);

    let result = compiler.compileSync(code, filePath, ctx);

    let shouldInlineHtmlify = inputMimeType !== 'text/html' && result.mimeType === 'text/html';

    let isPassthrough = result.mimeType === 'text/plain' || !result.mimeType || CompilerHost.shouldPassthrough(hashInfo);

    if (finalForms[result.mimeType] && !shouldInlineHtmlify || isPassthrough) {
      // Got something we can use in-browser, let's return it
      return Object.assign(result, { dependentFiles });
    } else {
      d(`Recursively compiling result of ${ filePath } with non-final MIME type ${ result.mimeType }, input was ${ inputMimeType }`);

      hashInfo = Object.assign({ sourceCode: result.code, mimeType: result.mimeType }, hashInfo);
      compiler = this.compilersByMimeType[result.mimeType || '__lolnothere'];

      if (!compiler) {
        d(`Recursive compile failed - intermediate result: ${ JSON.stringify(result) }`);

        throw new Error(`Compiling ${ filePath } resulted in a MIME type of ${ result.mimeType }, which we don't know how to handle`);
      }

      return this.compileUncachedSync(`${ filePath }.${ _mimeTypes2.default.extension(result.mimeType || 'txt') }`, hashInfo, compiler);
    }
  }

  compileAllSync(rootDirectory) {
    let shouldCompile = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    let should = shouldCompile || function () {
      return true;
    };

    (0, _forAllFiles.forAllFilesSync)(rootDirectory, f => {
      if (!should(f)) return;
      return this.compileSync(f, this.compilersByMimeType);
    });
  }

  /*
   * Other stuff
   */

  /**
   * Returns the passthrough compiler
   *
   * @private
   */
  getPassthroughCompiler() {
    return this.compilersByMimeType['text/plain'];
  }

  /**
   * Determines whether we should even try to compile the content. Note that in
   * some cases, content will still be in cache even if this returns true, and
   * in other cases (isInNodeModules), we'll know explicitly to not even bother
   * looking in the cache.
   *
   * @private
   */
  static shouldPassthrough(hashInfo) {
    return hashInfo.isMinified || hashInfo.isInNodeModules || hashInfo.hasSourceMap || hashInfo.isFileBinary;
  }

  /**
   * Look at the code of a node modules and see the sourceMapping path.
   * If there is any, check the path and try to fix it with and
   * root relative path.
   * @private
   */
  static fixNodeModulesSourceMapping(sourceCode, sourcePath, appRoot) {
    return _asyncToGenerator(function* () {
      let regexSourceMapping = /\/\/#.*sourceMappingURL=(?!data:)([^"'].*)/i;
      let sourceMappingCheck = sourceCode.match(regexSourceMapping);

      if (sourceMappingCheck && sourceMappingCheck[1] && sourceMappingCheck[1] !== '') {
        let sourceMapPath = sourceMappingCheck[1];

        try {
          yield _promise.pfs.stat(sourceMapPath);
        } catch (error) {
          let normRoot = _path2.default.normalize(appRoot);
          let absPathToModule = _path2.default.dirname(sourcePath.replace(normRoot, '').substring(1));
          let newMapPath = _path2.default.join(absPathToModule, sourceMapPath);

          return sourceCode.replace(regexSourceMapping, `//# sourceMappingURL=${ newMapPath }`);
        }
      }

      return sourceCode;
    })();
  }

  /**
   * Look at the code of a node modules and see the sourceMapping path.
   * If there is any, check the path and try to fix it with and
   * root relative path.
   * @private
   */
  static fixNodeModulesSourceMappingSync(sourceCode, sourcePath, appRoot) {
    let regexSourceMapping = /\/\/#.*sourceMappingURL=(?!data:)([^"'].*)/i;
    let sourceMappingCheck = sourceCode.match(regexSourceMapping);

    if (sourceMappingCheck && sourceMappingCheck[1] && sourceMappingCheck[1] !== '') {
      let sourceMapPath = sourceMappingCheck[1];

      try {
        _fs2.default.statSync(sourceMapPath);
      } catch (error) {
        let normRoot = _path2.default.normalize(appRoot);
        let absPathToModule = _path2.default.dirname(sourcePath.replace(normRoot, '').substring(1));
        let newMapPath = _path2.default.join(absPathToModule, sourceMapPath);

        return sourceCode.replace(regexSourceMapping, `//# sourceMappingURL=${ newMapPath }`);
      }
    }

    return sourceCode;
  }
}
exports.default = CompilerHost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb21waWxlci1ob3N0LmpzIl0sIm5hbWVzIjpbImQiLCJyZXF1aXJlIiwiZmluYWxGb3JtcyIsIkNvbXBpbGVySG9zdCIsImNvbnN0cnVjdG9yIiwicm9vdENhY2hlRGlyIiwiY29tcGlsZXJzIiwiZmlsZUNoYW5nZUNhY2hlIiwicmVhZE9ubHlNb2RlIiwiZmFsbGJhY2tDb21waWxlciIsImNvbXBpbGVyc0J5TWltZVR5cGUiLCJPYmplY3QiLCJhc3NpZ24iLCJhcHBSb290IiwiY2FjaGVzRm9yQ29tcGlsZXJzIiwia2V5cyIsInJlZHVjZSIsImFjYyIsIngiLCJjb21waWxlciIsImhhcyIsInNldCIsImNyZWF0ZUZyb21Db21waWxlciIsIk1hcCIsImNyZWF0ZVJlYWRvbmx5RnJvbUNvbmZpZ3VyYXRpb24iLCJ0YXJnZXQiLCJqb2luIiwiYnVmIiwicmVhZEZpbGUiLCJpbmZvIiwiSlNPTiIsInBhcnNlIiwiZ3VuemlwIiwibG9hZEZyb21EYXRhIiwiY3VyIiwibmFtZSIsImNvbXBpbGVyVmVyc2lvbiIsImNvbXBpbGVyT3B0aW9ucyIsImlucHV0TWltZVR5cGVzIiwiY3JlYXRlRnJvbUNvbmZpZ3VyYXRpb24iLCJmb3JFYWNoIiwic2F2ZUNvbmZpZ3VyYXRpb24iLCJzZXJpYWxpemVkQ29tcGlsZXJPcHRzIiwiS2xhc3MiLCJnZXRQcm90b3R5cGVPZiIsInZhbCIsImdldElucHV0TWltZVR5cGVzIiwiZ2V0Q29tcGlsZXJWZXJzaW9uIiwiZ2V0U2F2ZWREYXRhIiwiZ3ppcCIsIkJ1ZmZlciIsInN0cmluZ2lmeSIsIndyaXRlRmlsZSIsImNvbXBpbGUiLCJmaWxlUGF0aCIsImNvbXBpbGVSZWFkT25seSIsImZ1bGxDb21waWxlIiwidHlwZSIsImxvb2t1cCIsImlzSW5Ob2RlTW9kdWxlcyIsIm1pbWVUeXBlIiwiY29kZSIsImhhc2hJbmZvIiwiZ2V0SGFzaEZvclBhdGgiLCJzaG91bGRQYXNzdGhyb3VnaCIsImdldFBhc3N0aHJvdWdoQ29tcGlsZXIiLCJnZXQiLCJiaW5hcnlEYXRhIiwiY2FjaGUiLCJFcnJvciIsInNvdXJjZUNvZGUiLCJmaXhOb2RlTW9kdWxlc1NvdXJjZU1hcHBpbmciLCJnZXRPckZldGNoIiwiY29tcGlsZVVuY2FjaGVkIiwiaW5wdXRNaW1lVHlwZSIsImlzRmlsZUJpbmFyeSIsImRlcGVuZGVudEZpbGVzIiwiY3R4Iiwic2hvdWxkQ29tcGlsZUZpbGUiLCJkZXRlcm1pbmVEZXBlbmRlbnRGaWxlcyIsInJlc3VsdCIsInNob3VsZElubGluZUh0bWxpZnkiLCJpc1Bhc3N0aHJvdWdoIiwiZXh0ZW5zaW9uIiwiY29tcGlsZUFsbCIsInJvb3REaXJlY3RvcnkiLCJzaG91bGRDb21waWxlIiwic2hvdWxkIiwiZiIsImNvbXBpbGVTeW5jIiwiY29tcGlsZVJlYWRPbmx5U3luYyIsImZ1bGxDb21waWxlU3luYyIsImNyZWF0ZVJlYWRvbmx5RnJvbUNvbmZpZ3VyYXRpb25TeW5jIiwicmVhZEZpbGVTeW5jIiwiZ3VuemlwU3luYyIsImNyZWF0ZUZyb21Db25maWd1cmF0aW9uU3luYyIsInNhdmVDb25maWd1cmF0aW9uU3luYyIsImd6aXBTeW5jIiwid3JpdGVGaWxlU3luYyIsImdldEhhc2hGb3JQYXRoU3luYyIsImdldFN5bmMiLCJmaXhOb2RlTW9kdWxlc1NvdXJjZU1hcHBpbmdTeW5jIiwiZ2V0T3JGZXRjaFN5bmMiLCJjb21waWxlVW5jYWNoZWRTeW5jIiwic2hvdWxkQ29tcGlsZUZpbGVTeW5jIiwiZGV0ZXJtaW5lRGVwZW5kZW50RmlsZXNTeW5jIiwiY29tcGlsZUFsbFN5bmMiLCJpc01pbmlmaWVkIiwiaGFzU291cmNlTWFwIiwic291cmNlUGF0aCIsInJlZ2V4U291cmNlTWFwcGluZyIsInNvdXJjZU1hcHBpbmdDaGVjayIsIm1hdGNoIiwic291cmNlTWFwUGF0aCIsInN0YXQiLCJlcnJvciIsIm5vcm1Sb290Iiwibm9ybWFsaXplIiwiYWJzUGF0aFRvTW9kdWxlIiwiZGlybmFtZSIsInJlcGxhY2UiLCJzdWJzdHJpbmciLCJuZXdNYXBQYXRoIiwic3RhdFN5bmMiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUVBOzs7O0FBQ0E7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7Ozs7OztBQUVBLE1BQU1BLElBQUlDLFFBQVEsZ0JBQVIsRUFBMEIsZ0NBQTFCLENBQVY7O0FBRUE7QUFDQSxNQUFNQyxhQUFhO0FBQ2pCLHFCQUFtQixJQURGO0FBRWpCLDRCQUEwQixJQUZUO0FBR2pCLGVBQWEsSUFISTtBQUlqQixjQUFZLElBSks7QUFLakIsbUJBQWlCLElBTEE7QUFNakIsc0JBQW9CO0FBTkgsQ0FBbkI7O0FBU0E7Ozs7Ozs7Ozs7Ozs7O0FBY2UsTUFBTUMsWUFBTixDQUFtQjtBQUNoQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUEwQkFDLGNBQVlDLFlBQVosRUFBMEJDLFNBQTFCLEVBQXFDQyxlQUFyQyxFQUFzREMsWUFBdEQsRUFBNkY7QUFBQSxRQUF6QkMsZ0JBQXlCLHVFQUFOLElBQU07O0FBQzNGLFFBQUlDLHNCQUFzQkMsT0FBT0MsTUFBUCxDQUFjLEVBQWQsRUFBa0JOLFNBQWxCLENBQTFCO0FBQ0FLLFdBQU9DLE1BQVAsQ0FBYyxJQUFkLEVBQW9CLEVBQUNQLFlBQUQsRUFBZUssbUJBQWYsRUFBb0NILGVBQXBDLEVBQXFEQyxZQUFyRCxFQUFtRUMsZ0JBQW5FLEVBQXBCO0FBQ0EsU0FBS0ksT0FBTCxHQUFlLEtBQUtOLGVBQUwsQ0FBcUJNLE9BQXBDOztBQUVBLFNBQUtDLGtCQUFMLEdBQTBCSCxPQUFPSSxJQUFQLENBQVlMLG1CQUFaLEVBQWlDTSxNQUFqQyxDQUF3QyxDQUFDQyxHQUFELEVBQU1DLENBQU4sS0FBWTtBQUM1RSxVQUFJQyxXQUFXVCxvQkFBb0JRLENBQXBCLENBQWY7QUFDQSxVQUFJRCxJQUFJRyxHQUFKLENBQVFELFFBQVIsQ0FBSixFQUF1QixPQUFPRixHQUFQOztBQUV2QkEsVUFBSUksR0FBSixDQUNFRixRQURGLEVBRUUsdUJBQWFHLGtCQUFiLENBQWdDakIsWUFBaEMsRUFBOENjLFFBQTlDLEVBQXdEWixlQUF4RCxFQUF5RUMsWUFBekUsQ0FGRjtBQUdBLGFBQU9TLEdBQVA7QUFDRCxLQVJ5QixFQVF2QixJQUFJTSxHQUFKLEVBUnVCLENBQTFCO0FBU0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFCQSxTQUFhQywrQkFBYixDQUE2Q25CLFlBQTdDLEVBQTJEUSxPQUEzRCxFQUEyRjtBQUFBLFFBQXZCSixnQkFBdUIsdUVBQU4sSUFBTTtBQUFBO0FBQ3pGLFVBQUlnQixTQUFTLGVBQUtDLElBQUwsQ0FBVXJCLFlBQVYsRUFBd0IsdUJBQXhCLENBQWI7QUFDQSxVQUFJc0IsTUFBTSxNQUFNLGFBQUlDLFFBQUosQ0FBYUgsTUFBYixDQUFoQjtBQUNBLFVBQUlJLE9BQU9DLEtBQUtDLEtBQUwsRUFBVyxNQUFNLGVBQU1DLE1BQU4sQ0FBYUwsR0FBYixDQUFqQixFQUFYOztBQUVBLFVBQUlwQixrQkFBa0IsMEJBQWlCMEIsWUFBakIsQ0FBOEJKLEtBQUt0QixlQUFuQyxFQUFvRE0sT0FBcEQsRUFBNkQsSUFBN0QsQ0FBdEI7O0FBRUEsVUFBSVAsWUFBWUssT0FBT0ksSUFBUCxDQUFZYyxLQUFLdkIsU0FBakIsRUFBNEJVLE1BQTVCLENBQW1DLFVBQUNDLEdBQUQsRUFBTUMsQ0FBTixFQUFZO0FBQzdELFlBQUlnQixNQUFNTCxLQUFLdkIsU0FBTCxDQUFlWSxDQUFmLENBQVY7QUFDQUQsWUFBSUMsQ0FBSixJQUFTLCtCQUFxQmdCLElBQUlDLElBQXpCLEVBQStCRCxJQUFJRSxlQUFuQyxFQUFvREYsSUFBSUcsZUFBeEQsRUFBeUVILElBQUlJLGNBQTdFLENBQVQ7O0FBRUEsZUFBT3JCLEdBQVA7QUFDRCxPQUxlLEVBS2IsRUFMYSxDQUFoQjs7QUFPQSxhQUFPLElBQUlkLFlBQUosQ0FBaUJFLFlBQWpCLEVBQStCQyxTQUEvQixFQUEwQ0MsZUFBMUMsRUFBMkQsSUFBM0QsRUFBaUVFLGdCQUFqRSxDQUFQO0FBZHlGO0FBZTFGOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUEyQkEsU0FBYThCLHVCQUFiLENBQXFDbEMsWUFBckMsRUFBbURRLE9BQW5ELEVBQTRESCxtQkFBNUQsRUFBd0c7QUFBQSxRQUF2QkQsZ0JBQXVCLHVFQUFOLElBQU07QUFBQTtBQUN0RyxVQUFJZ0IsU0FBUyxlQUFLQyxJQUFMLENBQVVyQixZQUFWLEVBQXdCLHVCQUF4QixDQUFiO0FBQ0EsVUFBSXNCLE1BQU0sTUFBTSxhQUFJQyxRQUFKLENBQWFILE1BQWIsQ0FBaEI7QUFDQSxVQUFJSSxPQUFPQyxLQUFLQyxLQUFMLEVBQVcsTUFBTSxlQUFNQyxNQUFOLENBQWFMLEdBQWIsQ0FBakIsRUFBWDs7QUFFQSxVQUFJcEIsa0JBQWtCLDBCQUFpQjBCLFlBQWpCLENBQThCSixLQUFLdEIsZUFBbkMsRUFBb0RNLE9BQXBELEVBQTZELEtBQTdELENBQXRCOztBQUVBRixhQUFPSSxJQUFQLENBQVljLEtBQUt2QixTQUFqQixFQUE0QmtDLE9BQTVCLENBQW9DLFVBQUN0QixDQUFELEVBQU87QUFDekMsWUFBSWdCLE1BQU1MLEtBQUt2QixTQUFMLENBQWVZLENBQWYsQ0FBVjtBQUNBUiw0QkFBb0JRLENBQXBCLEVBQXVCbUIsZUFBdkIsR0FBeUNILElBQUlHLGVBQTdDO0FBQ0QsT0FIRDs7QUFLQSxhQUFPLElBQUlsQyxZQUFKLENBQWlCRSxZQUFqQixFQUErQkssbUJBQS9CLEVBQW9ESCxlQUFwRCxFQUFxRSxLQUFyRSxFQUE0RUUsZ0JBQTVFLENBQVA7QUFac0c7QUFhdkc7O0FBR0Q7Ozs7Ozs7QUFPTWdDLG1CQUFOLEdBQTBCO0FBQUE7O0FBQUE7QUFDeEIsVUFBSUMseUJBQXlCL0IsT0FBT0ksSUFBUCxDQUFZLE1BQUtMLG1CQUFqQixFQUFzQ00sTUFBdEMsQ0FBNkMsVUFBQ0MsR0FBRCxFQUFNQyxDQUFOLEVBQVk7QUFDcEYsWUFBSUMsV0FBVyxNQUFLVCxtQkFBTCxDQUF5QlEsQ0FBekIsQ0FBZjtBQUNBLFlBQUl5QixRQUFRaEMsT0FBT2lDLGNBQVAsQ0FBc0J6QixRQUF0QixFQUFnQ2YsV0FBNUM7O0FBRUEsWUFBSXlDLE1BQU07QUFDUlYsZ0JBQU1RLE1BQU1SLElBREo7QUFFUkcsMEJBQWdCSyxNQUFNRyxpQkFBTixFQUZSO0FBR1JULDJCQUFpQmxCLFNBQVNrQixlQUhsQjtBQUlSRCwyQkFBaUJqQixTQUFTNEIsa0JBQVQ7QUFKVCxTQUFWOztBQU9BOUIsWUFBSUMsQ0FBSixJQUFTMkIsR0FBVDtBQUNBLGVBQU81QixHQUFQO0FBQ0QsT0FiNEIsRUFhMUIsRUFiMEIsQ0FBN0I7O0FBZUEsVUFBSVksT0FBTztBQUNUdEIseUJBQWlCLE1BQUtBLGVBQUwsQ0FBcUJ5QyxZQUFyQixFQURSO0FBRVQxQyxtQkFBV29DO0FBRkYsT0FBWDs7QUFLQSxVQUFJakIsU0FBUyxlQUFLQyxJQUFMLENBQVUsTUFBS3JCLFlBQWYsRUFBNkIsdUJBQTdCLENBQWI7QUFDQSxVQUFJc0IsTUFBTSxNQUFNLGVBQU1zQixJQUFOLENBQVcsSUFBSUMsTUFBSixDQUFXcEIsS0FBS3FCLFNBQUwsQ0FBZXRCLElBQWYsQ0FBWCxDQUFYLENBQWhCO0FBQ0EsWUFBTSxhQUFJdUIsU0FBSixDQUFjM0IsTUFBZCxFQUFzQkUsR0FBdEIsQ0FBTjtBQXZCd0I7QUF3QnpCOztBQUVEOzs7Ozs7Ozs7Ozs7OztBQWNBMEIsVUFBUUMsUUFBUixFQUFrQjtBQUNoQixXQUFRLEtBQUs5QyxZQUFMLEdBQW9CLEtBQUsrQyxlQUFMLENBQXFCRCxRQUFyQixDQUFwQixHQUFxRCxLQUFLRSxXQUFMLENBQWlCRixRQUFqQixDQUE3RDtBQUNEOztBQUdEOzs7OztBQUtNQyxpQkFBTixDQUFzQkQsUUFBdEIsRUFBZ0M7QUFBQTs7QUFBQTtBQUM5QjtBQUNBLFVBQUlHLE9BQU8sb0JBQVVDLE1BQVYsQ0FBaUJKLFFBQWpCLENBQVg7QUFDQSxVQUFJLDBCQUFpQkssZUFBakIsQ0FBaUNMLFFBQWpDLENBQUosRUFBZ0Q7QUFDOUMsZUFBTztBQUNMTSxvQkFBVUgsUUFBUSx3QkFEYjtBQUVMSSxnQkFBTSxNQUFNLGFBQUlqQyxRQUFKLENBQWEwQixRQUFiLEVBQXVCLE1BQXZCO0FBRlAsU0FBUDtBQUlEOztBQUVELFVBQUlRLFdBQVcsTUFBTSxPQUFLdkQsZUFBTCxDQUFxQndELGNBQXJCLENBQW9DVCxRQUFwQyxDQUFyQjs7QUFFQTtBQUNBO0FBQ0EsVUFBSW5DLFdBQVdoQixhQUFhNkQsaUJBQWIsQ0FBK0JGLFFBQS9CLElBQ2IsT0FBS0csc0JBQUwsRUFEYSxHQUViLE9BQUt2RCxtQkFBTCxDQUF5QitDLFFBQVEsY0FBakMsQ0FGRjs7QUFJQSxVQUFJLENBQUN0QyxRQUFMLEVBQWU7QUFDYkEsbUJBQVcsT0FBS1YsZ0JBQWhCOztBQURhLG1CQUd3QixNQUFNVSxTQUFTK0MsR0FBVCxDQUFhWixRQUFiLENBSDlCOztBQUFBLFlBR1BPLElBSE8sUUFHUEEsSUFITztBQUFBLFlBR0RNLFVBSEMsUUFHREEsVUFIQztBQUFBLFlBR1dQLFFBSFgsUUFHV0EsUUFIWDs7QUFJYixlQUFPLEVBQUVDLE1BQU1BLFFBQVFNLFVBQWhCLEVBQTRCUCxRQUE1QixFQUFQO0FBQ0Q7O0FBRUQsVUFBSVEsUUFBUSxPQUFLdEQsa0JBQUwsQ0FBd0JvRCxHQUF4QixDQUE0Qi9DLFFBQTVCLENBQVo7O0FBekI4QixrQkEwQkssTUFBTWlELE1BQU1GLEdBQU4sQ0FBVVosUUFBVixDQTFCWDs7QUFBQSxVQTBCekJPLElBMUJ5QixTQTBCekJBLElBMUJ5QjtBQUFBLFVBMEJuQk0sVUExQm1CLFNBMEJuQkEsVUExQm1CO0FBQUEsVUEwQlBQLFFBMUJPLFNBMEJQQSxRQTFCTzs7O0FBNEI5QkMsYUFBT0EsUUFBUU0sVUFBZjtBQUNBLFVBQUksQ0FBQ04sSUFBRCxJQUFTLENBQUNELFFBQWQsRUFBd0I7QUFDdEIsY0FBTSxJQUFJUyxLQUFKLENBQVcscUJBQW1CZixRQUFTLGdEQUF2QyxDQUFOO0FBQ0Q7O0FBRUQsYUFBTyxFQUFFTyxJQUFGLEVBQVFELFFBQVIsRUFBUDtBQWpDOEI7QUFrQy9COztBQUVEOzs7OztBQUtNSixhQUFOLENBQWtCRixRQUFsQixFQUE0QjtBQUFBOztBQUFBO0FBQzFCdEQsUUFBRyxjQUFZc0QsUUFBUyxHQUF4Qjs7QUFFQSxVQUFJUSxXQUFXLE1BQU0sT0FBS3ZELGVBQUwsQ0FBcUJ3RCxjQUFyQixDQUFvQ1QsUUFBcEMsQ0FBckI7QUFDQSxVQUFJRyxPQUFPLG9CQUFVQyxNQUFWLENBQWlCSixRQUFqQixDQUFYOztBQUVBLFVBQUlRLFNBQVNILGVBQWIsRUFBOEI7QUFDNUIsWUFBSUUsT0FBT0MsU0FBU1EsVUFBVCxLQUF1QixNQUFNLGFBQUkxQyxRQUFKLENBQWEwQixRQUFiLEVBQXVCLE1BQXZCLENBQTdCLENBQVg7QUFDQU8sZUFBTyxNQUFNMUQsYUFBYW9FLDJCQUFiLENBQXlDVixJQUF6QyxFQUErQ1AsUUFBL0MsRUFBeUQsT0FBSy9DLGVBQUwsQ0FBcUJNLE9BQTlFLENBQWI7QUFDQSxlQUFPLEVBQUVnRCxJQUFGLEVBQVFELFVBQVVILElBQWxCLEVBQVA7QUFDRDs7QUFFRCxVQUFJdEMsV0FBV2hCLGFBQWE2RCxpQkFBYixDQUErQkYsUUFBL0IsSUFDYixPQUFLRyxzQkFBTCxFQURhLEdBRWIsT0FBS3ZELG1CQUFMLENBQXlCK0MsUUFBUSxjQUFqQyxDQUZGOztBQUlBLFVBQUksQ0FBQ3RDLFFBQUwsRUFBZTtBQUNibkIsVUFBRyw2Q0FBMkNzRCxRQUFTLEdBQXZEO0FBQ0FuQyxtQkFBVyxPQUFLVixnQkFBaEI7QUFDRDs7QUFFRCxVQUFJLENBQUNVLFFBQUwsRUFBZTtBQUNiLGNBQU0sSUFBSWtELEtBQUosQ0FBVyxpQ0FBK0JmLFFBQVMsR0FBbkQsQ0FBTjtBQUNEOztBQUVELFVBQUljLFFBQVEsT0FBS3RELGtCQUFMLENBQXdCb0QsR0FBeEIsQ0FBNEIvQyxRQUE1QixDQUFaO0FBQ0EsYUFBTyxNQUFNaUQsTUFBTUksVUFBTixDQUNYbEIsUUFEVyxFQUVYLFVBQUNBLFFBQUQsRUFBV1EsUUFBWDtBQUFBLGVBQXdCLE9BQUtXLGVBQUwsQ0FBcUJuQixRQUFyQixFQUErQlEsUUFBL0IsRUFBeUMzQyxRQUF6QyxDQUF4QjtBQUFBLE9BRlcsQ0FBYjtBQTFCMEI7QUE2QjNCOztBQUVEOzs7OztBQUtNc0QsaUJBQU4sQ0FBc0JuQixRQUF0QixFQUFnQ1EsUUFBaEMsRUFBMEMzQyxRQUExQyxFQUFvRDtBQUFBOztBQUFBO0FBQ2xELFVBQUl1RCxnQkFBZ0Isb0JBQVVoQixNQUFWLENBQWlCSixRQUFqQixDQUFwQjs7QUFFQSxVQUFJUSxTQUFTYSxZQUFiLEVBQTJCO0FBQ3pCLGVBQU87QUFDTFIsc0JBQVlMLFNBQVNLLFVBQVQsS0FBdUIsTUFBTSxhQUFJdkMsUUFBSixDQUFhMEIsUUFBYixDQUE3QixDQURQO0FBRUxNLG9CQUFVYyxhQUZMO0FBR0xFLDBCQUFnQjtBQUhYLFNBQVA7QUFLRDs7QUFFRCxVQUFJQyxNQUFNLEVBQVY7QUFDQSxVQUFJaEIsT0FBT0MsU0FBU1EsVUFBVCxLQUF1QixNQUFNLGFBQUkxQyxRQUFKLENBQWEwQixRQUFiLEVBQXVCLE1BQXZCLENBQTdCLENBQVg7O0FBRUEsVUFBSSxFQUFFLE1BQU1uQyxTQUFTMkQsaUJBQVQsQ0FBMkJqQixJQUEzQixFQUFpQ2dCLEdBQWpDLENBQVIsQ0FBSixFQUFvRDtBQUNsRDdFLFVBQUcsbURBQWlEc0QsUUFBUyxHQUE3RDtBQUNBLGVBQU8sRUFBRU8sSUFBRixFQUFRRCxVQUFVLG9CQUFVRixNQUFWLENBQWlCSixRQUFqQixDQUFsQixFQUE4Q3NCLGdCQUFnQixFQUE5RCxFQUFQO0FBQ0Q7O0FBRUQsVUFBSUEsaUJBQWlCLE1BQU16RCxTQUFTNEQsdUJBQVQsQ0FBaUNsQixJQUFqQyxFQUF1Q1AsUUFBdkMsRUFBaUR1QixHQUFqRCxDQUEzQjs7QUFFQTdFLFFBQUcsNEJBQTBCOEIsS0FBS3FCLFNBQUwsQ0FBZWhDLFNBQVNrQixlQUF4QixDQUF5QyxHQUF0RTtBQUNBLFVBQUkyQyxTQUFTLE1BQU03RCxTQUFTa0MsT0FBVCxDQUFpQlEsSUFBakIsRUFBdUJQLFFBQXZCLEVBQWlDdUIsR0FBakMsQ0FBbkI7O0FBRUEsVUFBSUksc0JBQ0ZQLGtCQUFrQixXQUFsQixJQUNBTSxPQUFPcEIsUUFBUCxLQUFvQixXQUZ0Qjs7QUFJQSxVQUFJc0IsZ0JBQ0ZGLE9BQU9wQixRQUFQLEtBQW9CLFlBQXBCLElBQ0EsQ0FBQ29CLE9BQU9wQixRQURSLElBRUF6RCxhQUFhNkQsaUJBQWIsQ0FBK0JGLFFBQS9CLENBSEY7O0FBS0EsVUFBSzVELFdBQVc4RSxPQUFPcEIsUUFBbEIsS0FBK0IsQ0FBQ3FCLG1CQUFqQyxJQUF5REMsYUFBN0QsRUFBNEU7QUFDMUU7QUFDQSxlQUFPdkUsT0FBT0MsTUFBUCxDQUFjb0UsTUFBZCxFQUFzQixFQUFDSixjQUFELEVBQXRCLENBQVA7QUFDRCxPQUhELE1BR087QUFDTDVFLFVBQUcsb0NBQWtDc0QsUUFBUywrQkFBNEIwQixPQUFPcEIsUUFBUyxpQkFBY2MsYUFBYyxHQUF0SDs7QUFFQVosbUJBQVduRCxPQUFPQyxNQUFQLENBQWMsRUFBRTBELFlBQVlVLE9BQU9uQixJQUFyQixFQUEyQkQsVUFBVW9CLE9BQU9wQixRQUE1QyxFQUFkLEVBQXNFRSxRQUF0RSxDQUFYO0FBQ0EzQyxtQkFBVyxPQUFLVCxtQkFBTCxDQUF5QnNFLE9BQU9wQixRQUFQLElBQW1CLGNBQTVDLENBQVg7O0FBRUEsWUFBSSxDQUFDekMsUUFBTCxFQUFlO0FBQ2JuQixZQUFHLG9EQUFrRDhCLEtBQUtxQixTQUFMLENBQWU2QixNQUFmLENBQXVCLEdBQTVFOztBQUVBLGdCQUFNLElBQUlYLEtBQUosQ0FBVyxjQUFZZixRQUFTLGlDQUE4QjBCLE9BQU9wQixRQUFTLHNDQUE5RSxDQUFOO0FBQ0Q7O0FBRUQsZUFBTyxNQUFNLE9BQUthLGVBQUwsQ0FDVixJQUFFbkIsUUFBUyxNQUFHLG9CQUFVNkIsU0FBVixDQUFvQkgsT0FBT3BCLFFBQVAsSUFBbUIsS0FBdkMsQ0FBOEMsR0FEbEQsRUFFWEUsUUFGVyxFQUVEM0MsUUFGQyxDQUFiO0FBR0Q7QUFuRGlEO0FBb0RuRDs7QUFFRDs7Ozs7Ozs7Ozs7OztBQWFNaUUsWUFBTixDQUFpQkMsYUFBakIsRUFBb0Q7QUFBQTs7QUFBQSxRQUFwQkMsYUFBb0IsdUVBQU4sSUFBTTtBQUFBO0FBQ2xELFVBQUlDLFNBQVNELGlCQUFpQixZQUFXO0FBQUMsZUFBTyxJQUFQO0FBQWEsT0FBdkQ7O0FBRUEsWUFBTSw4QkFBWUQsYUFBWixFQUEyQixVQUFDRyxDQUFELEVBQU87QUFDdEMsWUFBSSxDQUFDRCxPQUFPQyxDQUFQLENBQUwsRUFBZ0I7O0FBRWhCeEYsVUFBRyxjQUFZd0YsQ0FBRSxHQUFqQjtBQUNBLGVBQU8sT0FBS25DLE9BQUwsQ0FBYW1DLENBQWIsRUFBZ0IsT0FBSzlFLG1CQUFyQixDQUFQO0FBQ0QsT0FMSyxDQUFOO0FBSGtEO0FBU25EOztBQUVEOzs7O0FBSUErRSxjQUFZbkMsUUFBWixFQUFzQjtBQUNwQixXQUFRLEtBQUs5QyxZQUFMLEdBQW9CLEtBQUtrRixtQkFBTCxDQUF5QnBDLFFBQXpCLENBQXBCLEdBQXlELEtBQUtxQyxlQUFMLENBQXFCckMsUUFBckIsQ0FBakU7QUFDRDs7QUFFRCxTQUFPc0MsbUNBQVAsQ0FBMkN2RixZQUEzQyxFQUF5RFEsT0FBekQsRUFBeUY7QUFBQSxRQUF2QkosZ0JBQXVCLHVFQUFOLElBQU07O0FBQ3ZGLFFBQUlnQixTQUFTLGVBQUtDLElBQUwsQ0FBVXJCLFlBQVYsRUFBd0IsdUJBQXhCLENBQWI7QUFDQSxRQUFJc0IsTUFBTSxhQUFHa0UsWUFBSCxDQUFnQnBFLE1BQWhCLENBQVY7QUFDQSxRQUFJSSxPQUFPQyxLQUFLQyxLQUFMLENBQVcsZUFBSytELFVBQUwsQ0FBZ0JuRSxHQUFoQixDQUFYLENBQVg7O0FBRUEsUUFBSXBCLGtCQUFrQiwwQkFBaUIwQixZQUFqQixDQUE4QkosS0FBS3RCLGVBQW5DLEVBQW9ETSxPQUFwRCxFQUE2RCxJQUE3RCxDQUF0Qjs7QUFFQSxRQUFJUCxZQUFZSyxPQUFPSSxJQUFQLENBQVljLEtBQUt2QixTQUFqQixFQUE0QlUsTUFBNUIsQ0FBbUMsQ0FBQ0MsR0FBRCxFQUFNQyxDQUFOLEtBQVk7QUFDN0QsVUFBSWdCLE1BQU1MLEtBQUt2QixTQUFMLENBQWVZLENBQWYsQ0FBVjtBQUNBRCxVQUFJQyxDQUFKLElBQVMsK0JBQXFCZ0IsSUFBSUMsSUFBekIsRUFBK0JELElBQUlFLGVBQW5DLEVBQW9ERixJQUFJRyxlQUF4RCxFQUF5RUgsSUFBSUksY0FBN0UsQ0FBVDs7QUFFQSxhQUFPckIsR0FBUDtBQUNELEtBTGUsRUFLYixFQUxhLENBQWhCOztBQU9BLFdBQU8sSUFBSWQsWUFBSixDQUFpQkUsWUFBakIsRUFBK0JDLFNBQS9CLEVBQTBDQyxlQUExQyxFQUEyRCxJQUEzRCxFQUFpRUUsZ0JBQWpFLENBQVA7QUFDRDs7QUFFRCxTQUFPc0YsMkJBQVAsQ0FBbUMxRixZQUFuQyxFQUFpRFEsT0FBakQsRUFBMERILG1CQUExRCxFQUFzRztBQUFBLFFBQXZCRCxnQkFBdUIsdUVBQU4sSUFBTTs7QUFDcEcsUUFBSWdCLFNBQVMsZUFBS0MsSUFBTCxDQUFVckIsWUFBVixFQUF3Qix1QkFBeEIsQ0FBYjtBQUNBLFFBQUlzQixNQUFNLGFBQUdrRSxZQUFILENBQWdCcEUsTUFBaEIsQ0FBVjtBQUNBLFFBQUlJLE9BQU9DLEtBQUtDLEtBQUwsQ0FBVyxlQUFLK0QsVUFBTCxDQUFnQm5FLEdBQWhCLENBQVgsQ0FBWDs7QUFFQSxRQUFJcEIsa0JBQWtCLDBCQUFpQjBCLFlBQWpCLENBQThCSixLQUFLdEIsZUFBbkMsRUFBb0RNLE9BQXBELEVBQTZELEtBQTdELENBQXRCOztBQUVBRixXQUFPSSxJQUFQLENBQVljLEtBQUt2QixTQUFqQixFQUE0QmtDLE9BQTVCLENBQXFDdEIsQ0FBRCxJQUFPO0FBQ3pDLFVBQUlnQixNQUFNTCxLQUFLdkIsU0FBTCxDQUFlWSxDQUFmLENBQVY7QUFDQVIsMEJBQW9CUSxDQUFwQixFQUF1Qm1CLGVBQXZCLEdBQXlDSCxJQUFJRyxlQUE3QztBQUNELEtBSEQ7O0FBS0EsV0FBTyxJQUFJbEMsWUFBSixDQUFpQkUsWUFBakIsRUFBK0JLLG1CQUEvQixFQUFvREgsZUFBcEQsRUFBcUUsS0FBckUsRUFBNEVFLGdCQUE1RSxDQUFQO0FBQ0Q7O0FBRUR1RiwwQkFBd0I7QUFDdEIsUUFBSXRELHlCQUF5Qi9CLE9BQU9JLElBQVAsQ0FBWSxLQUFLTCxtQkFBakIsRUFBc0NNLE1BQXRDLENBQTZDLENBQUNDLEdBQUQsRUFBTUMsQ0FBTixLQUFZO0FBQ3BGLFVBQUlDLFdBQVcsS0FBS1QsbUJBQUwsQ0FBeUJRLENBQXpCLENBQWY7QUFDQSxVQUFJeUIsUUFBUWhDLE9BQU9pQyxjQUFQLENBQXNCekIsUUFBdEIsRUFBZ0NmLFdBQTVDOztBQUVBLFVBQUl5QyxNQUFNO0FBQ1JWLGNBQU1RLE1BQU1SLElBREo7QUFFUkcsd0JBQWdCSyxNQUFNRyxpQkFBTixFQUZSO0FBR1JULHlCQUFpQmxCLFNBQVNrQixlQUhsQjtBQUlSRCx5QkFBaUJqQixTQUFTNEIsa0JBQVQ7QUFKVCxPQUFWOztBQU9BOUIsVUFBSUMsQ0FBSixJQUFTMkIsR0FBVDtBQUNBLGFBQU81QixHQUFQO0FBQ0QsS0FiNEIsRUFhMUIsRUFiMEIsQ0FBN0I7O0FBZUEsUUFBSVksT0FBTztBQUNUdEIsdUJBQWlCLEtBQUtBLGVBQUwsQ0FBcUJ5QyxZQUFyQixFQURSO0FBRVQxQyxpQkFBV29DO0FBRkYsS0FBWDs7QUFLQSxRQUFJakIsU0FBUyxlQUFLQyxJQUFMLENBQVUsS0FBS3JCLFlBQWYsRUFBNkIsdUJBQTdCLENBQWI7QUFDQSxRQUFJc0IsTUFBTSxlQUFLc0UsUUFBTCxDQUFjLElBQUkvQyxNQUFKLENBQVdwQixLQUFLcUIsU0FBTCxDQUFldEIsSUFBZixDQUFYLENBQWQsQ0FBVjtBQUNBLGlCQUFHcUUsYUFBSCxDQUFpQnpFLE1BQWpCLEVBQXlCRSxHQUF6QjtBQUNEOztBQUVEK0Qsc0JBQW9CcEMsUUFBcEIsRUFBOEI7QUFDNUI7QUFDQSxRQUFJRyxPQUFPLG9CQUFVQyxNQUFWLENBQWlCSixRQUFqQixDQUFYO0FBQ0EsUUFBSSwwQkFBaUJLLGVBQWpCLENBQWlDTCxRQUFqQyxDQUFKLEVBQWdEO0FBQzlDLGFBQU87QUFDTE0sa0JBQVVILFFBQVEsd0JBRGI7QUFFTEksY0FBTSxhQUFHZ0MsWUFBSCxDQUFnQnZDLFFBQWhCLEVBQTBCLE1BQTFCO0FBRkQsT0FBUDtBQUlEOztBQUVELFFBQUlRLFdBQVcsS0FBS3ZELGVBQUwsQ0FBcUI0RixrQkFBckIsQ0FBd0M3QyxRQUF4QyxDQUFmOztBQUVBO0FBQ0EsUUFBSVEsU0FBU0gsZUFBYixFQUE4QjtBQUM1QixhQUFPO0FBQ0xDLGtCQUFVSCxJQURMO0FBRUxJLGNBQU1DLFNBQVNRLFVBQVQsSUFBdUIsYUFBR3VCLFlBQUgsQ0FBZ0J2QyxRQUFoQixFQUEwQixNQUExQjtBQUZ4QixPQUFQO0FBSUQ7O0FBRUQ7QUFDQTtBQUNBLFFBQUluQyxXQUFXaEIsYUFBYTZELGlCQUFiLENBQStCRixRQUEvQixJQUNiLEtBQUtHLHNCQUFMLEVBRGEsR0FFYixLQUFLdkQsbUJBQUwsQ0FBeUIrQyxRQUFRLGNBQWpDLENBRkY7O0FBSUEsUUFBSSxDQUFDdEMsUUFBTCxFQUFlO0FBQ2JBLGlCQUFXLEtBQUtWLGdCQUFoQjs7QUFEYSw4QkFHd0JVLFNBQVNpRixPQUFULENBQWlCOUMsUUFBakIsQ0FIeEI7O0FBQUEsVUFHUE8sSUFITyxxQkFHUEEsSUFITztBQUFBLFVBR0RNLFVBSEMscUJBR0RBLFVBSEM7QUFBQSxVQUdXUCxRQUhYLHFCQUdXQSxRQUhYOztBQUliLGFBQU8sRUFBRUMsTUFBTUEsUUFBUU0sVUFBaEIsRUFBNEJQLFFBQTVCLEVBQVA7QUFDRDs7QUFFRCxRQUFJUSxRQUFRLEtBQUt0RCxrQkFBTCxDQUF3Qm9ELEdBQXhCLENBQTRCL0MsUUFBNUIsQ0FBWjs7QUFqQzRCLHlCQWtDT2lELE1BQU1nQyxPQUFOLENBQWM5QyxRQUFkLENBbENQOztBQUFBLFFBa0N2Qk8sSUFsQ3VCLGtCQWtDdkJBLElBbEN1QjtBQUFBLFFBa0NqQk0sVUFsQ2lCLGtCQWtDakJBLFVBbENpQjtBQUFBLFFBa0NMUCxRQWxDSyxrQkFrQ0xBLFFBbENLOzs7QUFvQzVCQyxXQUFPQSxRQUFRTSxVQUFmO0FBQ0EsUUFBSSxDQUFDTixJQUFELElBQVMsQ0FBQ0QsUUFBZCxFQUF3QjtBQUN0QixZQUFNLElBQUlTLEtBQUosQ0FBVyxxQkFBbUJmLFFBQVMsZ0RBQXZDLENBQU47QUFDRDs7QUFFRCxXQUFPLEVBQUVPLElBQUYsRUFBUUQsUUFBUixFQUFQO0FBQ0Q7O0FBRUQrQixrQkFBZ0JyQyxRQUFoQixFQUEwQjtBQUN4QnRELE1BQUcsY0FBWXNELFFBQVMsR0FBeEI7O0FBRUEsUUFBSVEsV0FBVyxLQUFLdkQsZUFBTCxDQUFxQjRGLGtCQUFyQixDQUF3QzdDLFFBQXhDLENBQWY7QUFDQSxRQUFJRyxPQUFPLG9CQUFVQyxNQUFWLENBQWlCSixRQUFqQixDQUFYOztBQUVBLFFBQUlRLFNBQVNILGVBQWIsRUFBOEI7QUFDNUIsVUFBSUUsT0FBT0MsU0FBU1EsVUFBVCxJQUF1QixhQUFHdUIsWUFBSCxDQUFnQnZDLFFBQWhCLEVBQTBCLE1BQTFCLENBQWxDO0FBQ0FPLGFBQU8xRCxhQUFha0csK0JBQWIsQ0FBNkN4QyxJQUE3QyxFQUFtRFAsUUFBbkQsRUFBNkQsS0FBSy9DLGVBQUwsQ0FBcUJNLE9BQWxGLENBQVA7QUFDQSxhQUFPLEVBQUVnRCxJQUFGLEVBQVFELFVBQVVILElBQWxCLEVBQVA7QUFDRDs7QUFFRCxRQUFJdEMsV0FBV2hCLGFBQWE2RCxpQkFBYixDQUErQkYsUUFBL0IsSUFDYixLQUFLRyxzQkFBTCxFQURhLEdBRWIsS0FBS3ZELG1CQUFMLENBQXlCK0MsUUFBUSxjQUFqQyxDQUZGOztBQUlBLFFBQUksQ0FBQ3RDLFFBQUwsRUFBZTtBQUNibkIsUUFBRyw2Q0FBMkNzRCxRQUFTLEdBQXZEO0FBQ0FuQyxpQkFBVyxLQUFLVixnQkFBaEI7QUFDRDs7QUFFRCxRQUFJLENBQUNVLFFBQUwsRUFBZTtBQUNiLFlBQU0sSUFBSWtELEtBQUosQ0FBVyxpQ0FBK0JmLFFBQVMsR0FBbkQsQ0FBTjtBQUNEOztBQUVELFFBQUljLFFBQVEsS0FBS3RELGtCQUFMLENBQXdCb0QsR0FBeEIsQ0FBNEIvQyxRQUE1QixDQUFaO0FBQ0EsV0FBT2lELE1BQU1rQyxjQUFOLENBQ0xoRCxRQURLLEVBRUwsQ0FBQ0EsUUFBRCxFQUFXUSxRQUFYLEtBQXdCLEtBQUt5QyxtQkFBTCxDQUF5QmpELFFBQXpCLEVBQW1DUSxRQUFuQyxFQUE2QzNDLFFBQTdDLENBRm5CLENBQVA7QUFHRDs7QUFFRG9GLHNCQUFvQmpELFFBQXBCLEVBQThCUSxRQUE5QixFQUF3QzNDLFFBQXhDLEVBQWtEO0FBQ2hELFFBQUl1RCxnQkFBZ0Isb0JBQVVoQixNQUFWLENBQWlCSixRQUFqQixDQUFwQjs7QUFFQSxRQUFJUSxTQUFTYSxZQUFiLEVBQTJCO0FBQ3pCLGFBQU87QUFDTFIsb0JBQVlMLFNBQVNLLFVBQVQsSUFBdUIsYUFBRzBCLFlBQUgsQ0FBZ0J2QyxRQUFoQixDQUQ5QjtBQUVMTSxrQkFBVWMsYUFGTDtBQUdMRSx3QkFBZ0I7QUFIWCxPQUFQO0FBS0Q7O0FBRUQsUUFBSUMsTUFBTSxFQUFWO0FBQ0EsUUFBSWhCLE9BQU9DLFNBQVNRLFVBQVQsSUFBdUIsYUFBR3VCLFlBQUgsQ0FBZ0J2QyxRQUFoQixFQUEwQixNQUExQixDQUFsQzs7QUFFQSxRQUFJLENBQUVuQyxTQUFTcUYscUJBQVQsQ0FBK0IzQyxJQUEvQixFQUFxQ2dCLEdBQXJDLENBQU4sRUFBa0Q7QUFDaEQ3RSxRQUFHLG1EQUFpRHNELFFBQVMsR0FBN0Q7QUFDQSxhQUFPLEVBQUVPLElBQUYsRUFBUUQsVUFBVSxvQkFBVUYsTUFBVixDQUFpQkosUUFBakIsQ0FBbEIsRUFBOENzQixnQkFBZ0IsRUFBOUQsRUFBUDtBQUNEOztBQUVELFFBQUlBLGlCQUFpQnpELFNBQVNzRiwyQkFBVCxDQUFxQzVDLElBQXJDLEVBQTJDUCxRQUEzQyxFQUFxRHVCLEdBQXJELENBQXJCOztBQUVBLFFBQUlHLFNBQVM3RCxTQUFTc0UsV0FBVCxDQUFxQjVCLElBQXJCLEVBQTJCUCxRQUEzQixFQUFxQ3VCLEdBQXJDLENBQWI7O0FBRUEsUUFBSUksc0JBQ0ZQLGtCQUFrQixXQUFsQixJQUNBTSxPQUFPcEIsUUFBUCxLQUFvQixXQUZ0Qjs7QUFJQSxRQUFJc0IsZ0JBQ0ZGLE9BQU9wQixRQUFQLEtBQW9CLFlBQXBCLElBQ0EsQ0FBQ29CLE9BQU9wQixRQURSLElBRUF6RCxhQUFhNkQsaUJBQWIsQ0FBK0JGLFFBQS9CLENBSEY7O0FBS0EsUUFBSzVELFdBQVc4RSxPQUFPcEIsUUFBbEIsS0FBK0IsQ0FBQ3FCLG1CQUFqQyxJQUF5REMsYUFBN0QsRUFBNEU7QUFDMUU7QUFDQSxhQUFPdkUsT0FBT0MsTUFBUCxDQUFjb0UsTUFBZCxFQUFzQixFQUFDSixjQUFELEVBQXRCLENBQVA7QUFDRCxLQUhELE1BR087QUFDTDVFLFFBQUcsb0NBQWtDc0QsUUFBUywrQkFBNEIwQixPQUFPcEIsUUFBUyxpQkFBY2MsYUFBYyxHQUF0SDs7QUFFQVosaUJBQVduRCxPQUFPQyxNQUFQLENBQWMsRUFBRTBELFlBQVlVLE9BQU9uQixJQUFyQixFQUEyQkQsVUFBVW9CLE9BQU9wQixRQUE1QyxFQUFkLEVBQXNFRSxRQUF0RSxDQUFYO0FBQ0EzQyxpQkFBVyxLQUFLVCxtQkFBTCxDQUF5QnNFLE9BQU9wQixRQUFQLElBQW1CLGNBQTVDLENBQVg7O0FBRUEsVUFBSSxDQUFDekMsUUFBTCxFQUFlO0FBQ2JuQixVQUFHLG9EQUFrRDhCLEtBQUtxQixTQUFMLENBQWU2QixNQUFmLENBQXVCLEdBQTVFOztBQUVBLGNBQU0sSUFBSVgsS0FBSixDQUFXLGNBQVlmLFFBQVMsaUNBQThCMEIsT0FBT3BCLFFBQVMsc0NBQTlFLENBQU47QUFDRDs7QUFFRCxhQUFPLEtBQUsyQyxtQkFBTCxDQUNKLElBQUVqRCxRQUFTLE1BQUcsb0JBQVU2QixTQUFWLENBQW9CSCxPQUFPcEIsUUFBUCxJQUFtQixLQUF2QyxDQUE4QyxHQUR4RCxFQUVMRSxRQUZLLEVBRUszQyxRQUZMLENBQVA7QUFHRDtBQUNGOztBQUVEdUYsaUJBQWVyQixhQUFmLEVBQWtEO0FBQUEsUUFBcEJDLGFBQW9CLHVFQUFOLElBQU07O0FBQ2hELFFBQUlDLFNBQVNELGlCQUFpQixZQUFXO0FBQUMsYUFBTyxJQUFQO0FBQWEsS0FBdkQ7O0FBRUEsc0NBQWdCRCxhQUFoQixFQUFnQ0csQ0FBRCxJQUFPO0FBQ3BDLFVBQUksQ0FBQ0QsT0FBT0MsQ0FBUCxDQUFMLEVBQWdCO0FBQ2hCLGFBQU8sS0FBS0MsV0FBTCxDQUFpQkQsQ0FBakIsRUFBb0IsS0FBSzlFLG1CQUF6QixDQUFQO0FBQ0QsS0FIRDtBQUlEOztBQUVEOzs7O0FBS0E7Ozs7O0FBS0F1RCwyQkFBeUI7QUFDdkIsV0FBTyxLQUFLdkQsbUJBQUwsQ0FBeUIsWUFBekIsQ0FBUDtBQUNEOztBQUdEOzs7Ozs7OztBQVFBLFNBQU9zRCxpQkFBUCxDQUF5QkYsUUFBekIsRUFBbUM7QUFDakMsV0FBT0EsU0FBUzZDLFVBQVQsSUFBdUI3QyxTQUFTSCxlQUFoQyxJQUFtREcsU0FBUzhDLFlBQTVELElBQTRFOUMsU0FBU2EsWUFBNUY7QUFDRDs7QUFFRDs7Ozs7O0FBTUEsU0FBYUosMkJBQWIsQ0FBeUNELFVBQXpDLEVBQXFEdUMsVUFBckQsRUFBaUVoRyxPQUFqRSxFQUEwRTtBQUFBO0FBQ3hFLFVBQUlpRyxxQkFBcUIsNkNBQXpCO0FBQ0EsVUFBSUMscUJBQXFCekMsV0FBVzBDLEtBQVgsQ0FBaUJGLGtCQUFqQixDQUF6Qjs7QUFFQSxVQUFJQyxzQkFBc0JBLG1CQUFtQixDQUFuQixDQUF0QixJQUErQ0EsbUJBQW1CLENBQW5CLE1BQTBCLEVBQTdFLEVBQWdGO0FBQzlFLFlBQUlFLGdCQUFnQkYsbUJBQW1CLENBQW5CLENBQXBCOztBQUVBLFlBQUk7QUFDRixnQkFBTSxhQUFJRyxJQUFKLENBQVNELGFBQVQsQ0FBTjtBQUNELFNBRkQsQ0FFRSxPQUFPRSxLQUFQLEVBQWM7QUFDZCxjQUFJQyxXQUFXLGVBQUtDLFNBQUwsQ0FBZXhHLE9BQWYsQ0FBZjtBQUNBLGNBQUl5RyxrQkFBa0IsZUFBS0MsT0FBTCxDQUFhVixXQUFXVyxPQUFYLENBQW1CSixRQUFuQixFQUE2QixFQUE3QixFQUFpQ0ssU0FBakMsQ0FBMkMsQ0FBM0MsQ0FBYixDQUF0QjtBQUNBLGNBQUlDLGFBQWEsZUFBS2hHLElBQUwsQ0FBVTRGLGVBQVYsRUFBMkJMLGFBQTNCLENBQWpCOztBQUVBLGlCQUFPM0MsV0FBV2tELE9BQVgsQ0FBbUJWLGtCQUFuQixFQUF3Qyx5QkFBdUJZLFVBQVcsR0FBMUUsQ0FBUDtBQUNEO0FBQ0Y7O0FBRUQsYUFBT3BELFVBQVA7QUFsQndFO0FBbUJ6RTs7QUFFRDs7Ozs7O0FBTUEsU0FBTytCLCtCQUFQLENBQXVDL0IsVUFBdkMsRUFBbUR1QyxVQUFuRCxFQUErRGhHLE9BQS9ELEVBQXdFO0FBQ3RFLFFBQUlpRyxxQkFBcUIsNkNBQXpCO0FBQ0EsUUFBSUMscUJBQXFCekMsV0FBVzBDLEtBQVgsQ0FBaUJGLGtCQUFqQixDQUF6Qjs7QUFFQSxRQUFJQyxzQkFBc0JBLG1CQUFtQixDQUFuQixDQUF0QixJQUErQ0EsbUJBQW1CLENBQW5CLE1BQTBCLEVBQTdFLEVBQWdGO0FBQzlFLFVBQUlFLGdCQUFnQkYsbUJBQW1CLENBQW5CLENBQXBCOztBQUVBLFVBQUk7QUFDRixxQkFBR1ksUUFBSCxDQUFZVixhQUFaO0FBQ0QsT0FGRCxDQUVFLE9BQU9FLEtBQVAsRUFBYztBQUNkLFlBQUlDLFdBQVcsZUFBS0MsU0FBTCxDQUFleEcsT0FBZixDQUFmO0FBQ0EsWUFBSXlHLGtCQUFrQixlQUFLQyxPQUFMLENBQWFWLFdBQVdXLE9BQVgsQ0FBbUJKLFFBQW5CLEVBQTZCLEVBQTdCLEVBQWlDSyxTQUFqQyxDQUEyQyxDQUEzQyxDQUFiLENBQXRCO0FBQ0EsWUFBSUMsYUFBYSxlQUFLaEcsSUFBTCxDQUFVNEYsZUFBVixFQUEyQkwsYUFBM0IsQ0FBakI7O0FBRUEsZUFBTzNDLFdBQVdrRCxPQUFYLENBQW1CVixrQkFBbkIsRUFBd0MseUJBQXVCWSxVQUFXLEdBQTFFLENBQVA7QUFDRDtBQUNGOztBQUVELFdBQU9wRCxVQUFQO0FBQ0Q7QUExbUIrQjtrQkFBYm5FLFkiLCJmaWxlIjoiY29tcGlsZXItaG9zdC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgemxpYiBmcm9tICd6bGliJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtwZnMsIHB6bGlifSBmcm9tICcuL3Byb21pc2UnO1xuXG5pbXBvcnQgbWltZVR5cGVzIGZyb20gJy4vbWltZS10eXBlcyc7XG5pbXBvcnQge2ZvckFsbEZpbGVzLCBmb3JBbGxGaWxlc1N5bmN9IGZyb20gJy4vZm9yLWFsbC1maWxlcyc7XG5pbXBvcnQgQ29tcGlsZUNhY2hlIGZyb20gJy4vY29tcGlsZS1jYWNoZSc7XG5pbXBvcnQgRmlsZUNoYW5nZWRDYWNoZSBmcm9tICcuL2ZpbGUtY2hhbmdlLWNhY2hlJztcbmltcG9ydCBSZWFkT25seUNvbXBpbGVyIGZyb20gJy4vcmVhZC1vbmx5LWNvbXBpbGVyJztcblxuY29uc3QgZCA9IHJlcXVpcmUoJ2RlYnVnLWVsZWN0cm9uJykoJ2VsZWN0cm9uLWNvbXBpbGU6Y29tcGlsZXItaG9zdCcpO1xuXG4vLyBUaGlzIGlzbid0IGV2ZW4gbXlcbmNvbnN0IGZpbmFsRm9ybXMgPSB7XG4gICd0ZXh0L2phdmFzY3JpcHQnOiB0cnVlLFxuICAnYXBwbGljYXRpb24vamF2YXNjcmlwdCc6IHRydWUsXG4gICd0ZXh0L2h0bWwnOiB0cnVlLFxuICAndGV4dC9jc3MnOiB0cnVlLFxuICAnaW1hZ2Uvc3ZnK3htbCc6IHRydWUsXG4gICdhcHBsaWNhdGlvbi9qc29uJzogdHJ1ZVxufTtcblxuLyoqXG4gKiBUaGlzIGNsYXNzIGlzIHRoZSB0b3AtbGV2ZWwgY2xhc3MgdGhhdCBlbmNhcHN1bGF0ZXMgYWxsIG9mIHRoZSBsb2dpYyBvZlxuICogY29tcGlsaW5nIGFuZCBjYWNoaW5nIGFwcGxpY2F0aW9uIGNvZGUuIElmIHlvdSdyZSBsb29raW5nIGZvciBhIFwiTWFpbiBjbGFzc1wiLFxuICogdGhpcyBpcyBpdC5cbiAqXG4gKiBUaGlzIGNsYXNzIGNhbiBiZSBjcmVhdGVkIGRpcmVjdGx5IGJ1dCBpdCBpcyB1c3VhbGx5IGNyZWF0ZWQgdmlhIHRoZSBtZXRob2RzXG4gKiBpbiBjb25maWctcGFyc2VyLCB3aGljaCB3aWxsIGFtb25nIG90aGVyIHRoaW5ncywgc2V0IHVwIHRoZSBjb21waWxlciBvcHRpb25zXG4gKiBnaXZlbiBhIHByb2plY3Qgcm9vdC5cbiAqXG4gKiBDb21waWxlckhvc3QgaXMgYWxzbyB0aGUgdG9wLWxldmVsIGNsYXNzIHRoYXQga25vd3MgaG93IHRvIHNlcmlhbGl6ZSBhbGwgb2YgdGhlXG4gKiBpbmZvcm1hdGlvbiBuZWNlc3NhcnkgdG8gcmVjcmVhdGUgaXRzZWxmLCBlaXRoZXIgYXMgYSBkZXZlbG9wbWVudCBob3N0IChpLmUuXG4gKiB3aWxsIGFsbG93IGNhY2hlIG1pc3NlcyBhbmQgYWN0dWFsIGNvbXBpbGF0aW9uKSwgb3IgYXMgYSByZWFkLW9ubHkgdmVyc2lvbiBvZlxuICogaXRzZWxmIGZvciBwcm9kdWN0aW9uLlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDb21waWxlckhvc3Qge1xuICAvKipcbiAgICogQ3JlYXRlcyBhbiBpbnN0YW5jZSBvZiBDb21waWxlckhvc3QuIFlvdSBwcm9iYWJseSB3YW50IHRvIHVzZSB0aGUgbWV0aG9kc1xuICAgKiBpbiBjb25maWctcGFyc2VyIGZvciBkZXZlbG9wbWVudCwgb3Ige0BsaW5rIGNyZWF0ZVJlYWRvbmx5RnJvbUNvbmZpZ3VyYXRpb259XG4gICAqIGZvciBwcm9kdWN0aW9uIGluc3RlYWQuXG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gcm9vdENhY2hlRGlyICBUaGUgcm9vdCBkaXJlY3RvcnkgdG8gdXNlIGZvciB0aGUgY2FjaGVcbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb21waWxlcnMgIGFuIE9iamVjdCB3aG9zZSBrZXlzIGFyZSBpbnB1dCBNSU1FIHR5cGVzIGFuZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hvc2UgdmFsdWVzIGFyZSBpbnN0YW5jZXMgb2YgQ29tcGlsZXJCYXNlLiBDcmVhdGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMgdmlhIHRoZSB7QGxpbmsgY3JlYXRlQ29tcGlsZXJzfSBtZXRob2QgaW5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy1wYXJzZXIuXG4gICAqXG4gICAqIEBwYXJhbSAge0ZpbGVDaGFuZ2VkQ2FjaGV9IGZpbGVDaGFuZ2VDYWNoZSAgQSBmaWxlLWNoYW5nZSBjYWNoZSB0aGF0IGlzXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uYWxseSBwcmUtbG9hZGVkLlxuICAgKlxuICAgKiBAcGFyYW0gIHtib29sZWFufSByZWFkT25seU1vZGUgIElmIFRydWUsIGNhY2hlIG1pc3NlcyB3aWxsIGZhaWwgYW5kXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGlsYXRpb24gd2lsbCBub3QgYmUgYXR0ZW1wdGVkLlxuICAgKlxuICAgKiBAcGFyYW0gIHtDb21waWxlckJhc2V9IGZhbGxiYWNrQ29tcGlsZXIgKG9wdGlvbmFsKSAgV2hlbiBhIGZpbGUgaXMgY29tcGlsZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdoaWNoIGRvZXNuJ3QgaGF2ZSBhIG1hdGNoaW5nIGNvbXBpbGVyLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcyBjb21waWxlciB3aWxsIGJlIHVzZWQgaW5zdGVhZC4gSWZcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsIHdpbGwgZmFpbCBjb21waWxhdGlvbi4gQSBnb29kXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbHRlcm5hdGUgZmFsbGJhY2sgaXMgdGhlIGNvbXBpbGVyIGZvclxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RleHQvcGxhaW4nLCB3aGljaCBpcyBndWFyYW50ZWVkIHRvIGJlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVzZW50LlxuICAgKi9cbiAgY29uc3RydWN0b3Iocm9vdENhY2hlRGlyLCBjb21waWxlcnMsIGZpbGVDaGFuZ2VDYWNoZSwgcmVhZE9ubHlNb2RlLCBmYWxsYmFja0NvbXBpbGVyID0gbnVsbCkge1xuICAgIGxldCBjb21waWxlcnNCeU1pbWVUeXBlID0gT2JqZWN0LmFzc2lnbih7fSwgY29tcGlsZXJzKTtcbiAgICBPYmplY3QuYXNzaWduKHRoaXMsIHtyb290Q2FjaGVEaXIsIGNvbXBpbGVyc0J5TWltZVR5cGUsIGZpbGVDaGFuZ2VDYWNoZSwgcmVhZE9ubHlNb2RlLCBmYWxsYmFja0NvbXBpbGVyfSk7XG4gICAgdGhpcy5hcHBSb290ID0gdGhpcy5maWxlQ2hhbmdlQ2FjaGUuYXBwUm9vdDtcblxuICAgIHRoaXMuY2FjaGVzRm9yQ29tcGlsZXJzID0gT2JqZWN0LmtleXMoY29tcGlsZXJzQnlNaW1lVHlwZSkucmVkdWNlKChhY2MsIHgpID0+IHtcbiAgICAgIGxldCBjb21waWxlciA9IGNvbXBpbGVyc0J5TWltZVR5cGVbeF07XG4gICAgICBpZiAoYWNjLmhhcyhjb21waWxlcikpIHJldHVybiBhY2M7XG5cbiAgICAgIGFjYy5zZXQoXG4gICAgICAgIGNvbXBpbGVyLFxuICAgICAgICBDb21waWxlQ2FjaGUuY3JlYXRlRnJvbUNvbXBpbGVyKHJvb3RDYWNoZURpciwgY29tcGlsZXIsIGZpbGVDaGFuZ2VDYWNoZSwgcmVhZE9ubHlNb2RlKSk7XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIG5ldyBNYXAoKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIHByb2R1Y3Rpb24tbW9kZSBDb21waWxlckhvc3QgZnJvbSB0aGUgcHJldmlvdXNseSBzYXZlZFxuICAgKiBjb25maWd1cmF0aW9uXG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gcm9vdENhY2hlRGlyICBUaGUgcm9vdCBkaXJlY3RvcnkgdG8gdXNlIGZvciB0aGUgY2FjaGUuIFRoaXNcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlIG11c3QgaGF2ZSBjYWNoZSBpbmZvcm1hdGlvbiBzYXZlZCB2aWFcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtAbGluayBzYXZlQ29uZmlndXJhdGlvbn1cbiAgICpcbiAgICogQHBhcmFtICB7c3RyaW5nfSBhcHBSb290ICBUaGUgdG9wLWxldmVsIGRpcmVjdG9yeSBmb3IgeW91ciBhcHBsaWNhdGlvbiAoaS5lLlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZSBvbmUgd2hpY2ggaGFzIHlvdXIgcGFja2FnZS5qc29uKS5cbiAgICpcbiAgICogQHBhcmFtICB7Q29tcGlsZXJCYXNlfSBmYWxsYmFja0NvbXBpbGVyIChvcHRpb25hbCkgIFdoZW4gYSBmaWxlIGlzIGNvbXBpbGVkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aGljaCBkb2Vzbid0IGhhdmUgYSBtYXRjaGluZyBjb21waWxlcixcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMgY29tcGlsZXIgd2lsbCBiZSB1c2VkIGluc3RlYWQuIElmXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLCB3aWxsIGZhaWwgY29tcGlsYXRpb24uIEEgZ29vZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWx0ZXJuYXRlIGZhbGxiYWNrIGlzIHRoZSBjb21waWxlciBmb3JcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0L3BsYWluJywgd2hpY2ggaXMgZ3VhcmFudGVlZCB0byBiZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlc2VudC5cbiAgICpcbiAgICogQHJldHVybiB7UHJvbWlzZTxDb21waWxlckhvc3Q+fSAgQSByZWFkLW9ubHkgQ29tcGlsZXJIb3N0XG4gICAqL1xuICBzdGF0aWMgYXN5bmMgY3JlYXRlUmVhZG9ubHlGcm9tQ29uZmlndXJhdGlvbihyb290Q2FjaGVEaXIsIGFwcFJvb3QsIGZhbGxiYWNrQ29tcGlsZXI9bnVsbCkge1xuICAgIGxldCB0YXJnZXQgPSBwYXRoLmpvaW4ocm9vdENhY2hlRGlyLCAnY29tcGlsZXItaW5mby5qc29uLmd6Jyk7XG4gICAgbGV0IGJ1ZiA9IGF3YWl0IHBmcy5yZWFkRmlsZSh0YXJnZXQpO1xuICAgIGxldCBpbmZvID0gSlNPTi5wYXJzZShhd2FpdCBwemxpYi5ndW56aXAoYnVmKSk7XG5cbiAgICBsZXQgZmlsZUNoYW5nZUNhY2hlID0gRmlsZUNoYW5nZWRDYWNoZS5sb2FkRnJvbURhdGEoaW5mby5maWxlQ2hhbmdlQ2FjaGUsIGFwcFJvb3QsIHRydWUpO1xuXG4gICAgbGV0IGNvbXBpbGVycyA9IE9iamVjdC5rZXlzKGluZm8uY29tcGlsZXJzKS5yZWR1Y2UoKGFjYywgeCkgPT4ge1xuICAgICAgbGV0IGN1ciA9IGluZm8uY29tcGlsZXJzW3hdO1xuICAgICAgYWNjW3hdID0gbmV3IFJlYWRPbmx5Q29tcGlsZXIoY3VyLm5hbWUsIGN1ci5jb21waWxlclZlcnNpb24sIGN1ci5jb21waWxlck9wdGlvbnMsIGN1ci5pbnB1dE1pbWVUeXBlcyk7XG5cbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgcmV0dXJuIG5ldyBDb21waWxlckhvc3Qocm9vdENhY2hlRGlyLCBjb21waWxlcnMsIGZpbGVDaGFuZ2VDYWNoZSwgdHJ1ZSwgZmFsbGJhY2tDb21waWxlcik7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGRldmVsb3BtZW50LW1vZGUgQ29tcGlsZXJIb3N0IGZyb20gdGhlIHByZXZpb3VzbHkgc2F2ZWRcbiAgICogY29uZmlndXJhdGlvbi5cbiAgICpcbiAgICogQHBhcmFtICB7c3RyaW5nfSByb290Q2FjaGVEaXIgIFRoZSByb290IGRpcmVjdG9yeSB0byB1c2UgZm9yIHRoZSBjYWNoZS4gVGhpc1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGUgbXVzdCBoYXZlIGNhY2hlIGluZm9ybWF0aW9uIHNhdmVkIHZpYVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge0BsaW5rIHNhdmVDb25maWd1cmF0aW9ufVxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGFwcFJvb3QgIFRoZSB0b3AtbGV2ZWwgZGlyZWN0b3J5IGZvciB5b3VyIGFwcGxpY2F0aW9uIChpLmUuXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlIG9uZSB3aGljaCBoYXMgeW91ciBwYWNrYWdlLmpzb24pLlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbXBpbGVyc0J5TWltZVR5cGUgIGFuIE9iamVjdCB3aG9zZSBrZXlzIGFyZSBpbnB1dCBNSU1FXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZXMgYW5kIHdob3NlIHZhbHVlcyBhcmUgaW5zdGFuY2VzXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2YgQ29tcGlsZXJCYXNlLiBDcmVhdGUgdGhpcyB2aWEgdGhlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge0BsaW5rIGNyZWF0ZUNvbXBpbGVyc30gbWV0aG9kIGluXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnLXBhcnNlci5cbiAgICpcbiAgICogQHBhcmFtICB7Q29tcGlsZXJCYXNlfSBmYWxsYmFja0NvbXBpbGVyIChvcHRpb25hbCkgIFdoZW4gYSBmaWxlIGlzIGNvbXBpbGVkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aGljaCBkb2Vzbid0IGhhdmUgYSBtYXRjaGluZyBjb21waWxlcixcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMgY29tcGlsZXIgd2lsbCBiZSB1c2VkIGluc3RlYWQuIElmXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLCB3aWxsIGZhaWwgY29tcGlsYXRpb24uIEEgZ29vZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWx0ZXJuYXRlIGZhbGxiYWNrIGlzIHRoZSBjb21waWxlciBmb3JcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0L3BsYWluJywgd2hpY2ggaXMgZ3VhcmFudGVlZCB0byBiZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlc2VudC5cbiAgICpcbiAgICogQHJldHVybiB7UHJvbWlzZTxDb21waWxlckhvc3Q+fSAgQSByZWFkLW9ubHkgQ29tcGlsZXJIb3N0XG4gICAqL1xuICBzdGF0aWMgYXN5bmMgY3JlYXRlRnJvbUNvbmZpZ3VyYXRpb24ocm9vdENhY2hlRGlyLCBhcHBSb290LCBjb21waWxlcnNCeU1pbWVUeXBlLCBmYWxsYmFja0NvbXBpbGVyPW51bGwpIHtcbiAgICBsZXQgdGFyZ2V0ID0gcGF0aC5qb2luKHJvb3RDYWNoZURpciwgJ2NvbXBpbGVyLWluZm8uanNvbi5neicpO1xuICAgIGxldCBidWYgPSBhd2FpdCBwZnMucmVhZEZpbGUodGFyZ2V0KTtcbiAgICBsZXQgaW5mbyA9IEpTT04ucGFyc2UoYXdhaXQgcHpsaWIuZ3VuemlwKGJ1ZikpO1xuXG4gICAgbGV0IGZpbGVDaGFuZ2VDYWNoZSA9IEZpbGVDaGFuZ2VkQ2FjaGUubG9hZEZyb21EYXRhKGluZm8uZmlsZUNoYW5nZUNhY2hlLCBhcHBSb290LCBmYWxzZSk7XG5cbiAgICBPYmplY3Qua2V5cyhpbmZvLmNvbXBpbGVycykuZm9yRWFjaCgoeCkgPT4ge1xuICAgICAgbGV0IGN1ciA9IGluZm8uY29tcGlsZXJzW3hdO1xuICAgICAgY29tcGlsZXJzQnlNaW1lVHlwZVt4XS5jb21waWxlck9wdGlvbnMgPSBjdXIuY29tcGlsZXJPcHRpb25zO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBDb21waWxlckhvc3Qocm9vdENhY2hlRGlyLCBjb21waWxlcnNCeU1pbWVUeXBlLCBmaWxlQ2hhbmdlQ2FjaGUsIGZhbHNlLCBmYWxsYmFja0NvbXBpbGVyKTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFNhdmVzIHRoZSBjdXJyZW50IGNvbXBpbGVyIGNvbmZpZ3VyYXRpb24gdG8gYSBmaWxlIHRoYXRcbiAgICoge0BsaW5rIGNyZWF0ZVJlYWRvbmx5RnJvbUNvbmZpZ3VyYXRpb259IGNhbiB1c2UgdG8gcmVjcmVhdGUgdGhlIGN1cnJlbnRcbiAgICogY29tcGlsZXIgZW52aXJvbm1lbnRcbiAgICpcbiAgICogQHJldHVybiB7UHJvbWlzZX0gIENvbXBsZXRpb25cbiAgICovXG4gIGFzeW5jIHNhdmVDb25maWd1cmF0aW9uKCkge1xuICAgIGxldCBzZXJpYWxpemVkQ29tcGlsZXJPcHRzID0gT2JqZWN0LmtleXModGhpcy5jb21waWxlcnNCeU1pbWVUeXBlKS5yZWR1Y2UoKGFjYywgeCkgPT4ge1xuICAgICAgbGV0IGNvbXBpbGVyID0gdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlW3hdO1xuICAgICAgbGV0IEtsYXNzID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKGNvbXBpbGVyKS5jb25zdHJ1Y3RvcjtcblxuICAgICAgbGV0IHZhbCA9IHtcbiAgICAgICAgbmFtZTogS2xhc3MubmFtZSxcbiAgICAgICAgaW5wdXRNaW1lVHlwZXM6IEtsYXNzLmdldElucHV0TWltZVR5cGVzKCksXG4gICAgICAgIGNvbXBpbGVyT3B0aW9uczogY29tcGlsZXIuY29tcGlsZXJPcHRpb25zLFxuICAgICAgICBjb21waWxlclZlcnNpb246IGNvbXBpbGVyLmdldENvbXBpbGVyVmVyc2lvbigpXG4gICAgICB9O1xuXG4gICAgICBhY2NbeF0gPSB2YWw7XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcblxuICAgIGxldCBpbmZvID0ge1xuICAgICAgZmlsZUNoYW5nZUNhY2hlOiB0aGlzLmZpbGVDaGFuZ2VDYWNoZS5nZXRTYXZlZERhdGEoKSxcbiAgICAgIGNvbXBpbGVyczogc2VyaWFsaXplZENvbXBpbGVyT3B0c1xuICAgIH07XG5cbiAgICBsZXQgdGFyZ2V0ID0gcGF0aC5qb2luKHRoaXMucm9vdENhY2hlRGlyLCAnY29tcGlsZXItaW5mby5qc29uLmd6Jyk7XG4gICAgbGV0IGJ1ZiA9IGF3YWl0IHB6bGliLmd6aXAobmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShpbmZvKSkpO1xuICAgIGF3YWl0IHBmcy53cml0ZUZpbGUodGFyZ2V0LCBidWYpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXBpbGVzIGEgZmlsZSBhbmQgcmV0dXJucyB0aGUgY29tcGlsZWQgcmVzdWx0LlxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGZpbGVQYXRoICBUaGUgcGF0aCB0byB0aGUgZmlsZSB0byBjb21waWxlXG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2U8b2JqZWN0Pn0gIEFuIE9iamVjdCB3aXRoIHRoZSBjb21waWxlZCByZXN1bHRcbiAgICpcbiAgICogQHByb3BlcnR5IHtPYmplY3R9IGhhc2hJbmZvICBUaGUgaGFzaCBpbmZvcm1hdGlvbiByZXR1cm5lZCBmcm9tIGdldEhhc2hGb3JQYXRoXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBjb2RlICBUaGUgc291cmNlIGNvZGUgaWYgdGhlIGZpbGUgd2FzIGEgdGV4dCBmaWxlXG4gICAqIEBwcm9wZXJ0eSB7QnVmZmVyfSBiaW5hcnlEYXRhICBUaGUgZmlsZSBpZiBpdCB3YXMgYSBiaW5hcnkgZmlsZVxuICAgKiBAcHJvcGVydHkge3N0cmluZ30gbWltZVR5cGUgIFRoZSBNSU1FIHR5cGUgc2F2ZWQgaW4gdGhlIGNhY2hlLlxuICAgKiBAcHJvcGVydHkge3N0cmluZ1tdfSBkZXBlbmRlbnRGaWxlcyAgVGhlIGRlcGVuZGVudCBmaWxlcyByZXR1cm5lZCBmcm9tXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21waWxpbmcgdGhlIGZpbGUsIGlmIGFueS5cbiAgICovXG4gIGNvbXBpbGUoZmlsZVBhdGgpIHtcbiAgICByZXR1cm4gKHRoaXMucmVhZE9ubHlNb2RlID8gdGhpcy5jb21waWxlUmVhZE9ubHkoZmlsZVBhdGgpIDogdGhpcy5mdWxsQ29tcGlsZShmaWxlUGF0aCkpO1xuICB9XG5cblxuICAvKipcbiAgICogSGFuZGxlcyBjb21waWxhdGlvbiBpbiByZWFkLW9ubHkgbW9kZVxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgY29tcGlsZVJlYWRPbmx5KGZpbGVQYXRoKSB7XG4gICAgLy8gV2UgZ3VhcmFudGVlIHRoYXQgbm9kZV9tb2R1bGVzIGFyZSBhbHdheXMgc2hpcHBlZCBkaXJlY3RseVxuICAgIGxldCB0eXBlID0gbWltZVR5cGVzLmxvb2t1cChmaWxlUGF0aCk7XG4gICAgaWYgKEZpbGVDaGFuZ2VkQ2FjaGUuaXNJbk5vZGVNb2R1bGVzKGZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWltZVR5cGU6IHR5cGUgfHwgJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnLFxuICAgICAgICBjb2RlOiBhd2FpdCBwZnMucmVhZEZpbGUoZmlsZVBhdGgsICd1dGY4JylcbiAgICAgIH07XG4gICAgfVxuXG4gICAgbGV0IGhhc2hJbmZvID0gYXdhaXQgdGhpcy5maWxlQ2hhbmdlQ2FjaGUuZ2V0SGFzaEZvclBhdGgoZmlsZVBhdGgpO1xuXG4gICAgLy8gTkI6IEhlcmUsIHdlJ3JlIGJhc2ljYWxseSBvbmx5IHVzaW5nIHRoZSBjb21waWxlciBoZXJlIHRvIGZpbmRcbiAgICAvLyB0aGUgYXBwcm9wcmlhdGUgQ29tcGlsZUNhY2hlXG4gICAgbGV0IGNvbXBpbGVyID0gQ29tcGlsZXJIb3N0LnNob3VsZFBhc3N0aHJvdWdoKGhhc2hJbmZvKSA/XG4gICAgICB0aGlzLmdldFBhc3N0aHJvdWdoQ29tcGlsZXIoKSA6XG4gICAgICB0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGVbdHlwZSB8fCAnX19sb2xub3RoZXJlJ107XG5cbiAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICBjb21waWxlciA9IHRoaXMuZmFsbGJhY2tDb21waWxlcjtcblxuICAgICAgbGV0IHsgY29kZSwgYmluYXJ5RGF0YSwgbWltZVR5cGUgfSA9IGF3YWl0IGNvbXBpbGVyLmdldChmaWxlUGF0aCk7XG4gICAgICByZXR1cm4geyBjb2RlOiBjb2RlIHx8IGJpbmFyeURhdGEsIG1pbWVUeXBlIH07XG4gICAgfVxuXG4gICAgbGV0IGNhY2hlID0gdGhpcy5jYWNoZXNGb3JDb21waWxlcnMuZ2V0KGNvbXBpbGVyKTtcbiAgICBsZXQge2NvZGUsIGJpbmFyeURhdGEsIG1pbWVUeXBlfSA9IGF3YWl0IGNhY2hlLmdldChmaWxlUGF0aCk7XG5cbiAgICBjb2RlID0gY29kZSB8fCBiaW5hcnlEYXRhO1xuICAgIGlmICghY29kZSB8fCAhbWltZVR5cGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNrZWQgdG8gY29tcGlsZSAke2ZpbGVQYXRofSBpbiBwcm9kdWN0aW9uLCBpcyB0aGlzIGZpbGUgbm90IHByZWNvbXBpbGVkP2ApO1xuICAgIH1cblxuICAgIHJldHVybiB7IGNvZGUsIG1pbWVUeXBlIH07XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlcyBjb21waWxhdGlvbiBpbiByZWFkLXdyaXRlIG1vZGVcbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGFzeW5jIGZ1bGxDb21waWxlKGZpbGVQYXRoKSB7XG4gICAgZChgQ29tcGlsaW5nICR7ZmlsZVBhdGh9YCk7XG5cbiAgICBsZXQgaGFzaEluZm8gPSBhd2FpdCB0aGlzLmZpbGVDaGFuZ2VDYWNoZS5nZXRIYXNoRm9yUGF0aChmaWxlUGF0aCk7XG4gICAgbGV0IHR5cGUgPSBtaW1lVHlwZXMubG9va3VwKGZpbGVQYXRoKTtcblxuICAgIGlmIChoYXNoSW5mby5pc0luTm9kZU1vZHVsZXMpIHtcbiAgICAgIGxldCBjb2RlID0gaGFzaEluZm8uc291cmNlQ29kZSB8fCBhd2FpdCBwZnMucmVhZEZpbGUoZmlsZVBhdGgsICd1dGY4Jyk7XG4gICAgICBjb2RlID0gYXdhaXQgQ29tcGlsZXJIb3N0LmZpeE5vZGVNb2R1bGVzU291cmNlTWFwcGluZyhjb2RlLCBmaWxlUGF0aCwgdGhpcy5maWxlQ2hhbmdlQ2FjaGUuYXBwUm9vdCk7XG4gICAgICByZXR1cm4geyBjb2RlLCBtaW1lVHlwZTogdHlwZSB9O1xuICAgIH1cblxuICAgIGxldCBjb21waWxlciA9IENvbXBpbGVySG9zdC5zaG91bGRQYXNzdGhyb3VnaChoYXNoSW5mbykgP1xuICAgICAgdGhpcy5nZXRQYXNzdGhyb3VnaENvbXBpbGVyKCkgOlxuICAgICAgdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlW3R5cGUgfHwgJ19fbG9sbm90aGVyZSddO1xuXG4gICAgaWYgKCFjb21waWxlcikge1xuICAgICAgZChgRmFsbGluZyBiYWNrIHRvIHBhc3N0aHJvdWdoIGNvbXBpbGVyIGZvciAke2ZpbGVQYXRofWApO1xuICAgICAgY29tcGlsZXIgPSB0aGlzLmZhbGxiYWNrQ29tcGlsZXI7XG4gICAgfVxuXG4gICAgaWYgKCFjb21waWxlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBmaW5kIGEgY29tcGlsZXIgZm9yICR7ZmlsZVBhdGh9YCk7XG4gICAgfVxuXG4gICAgbGV0IGNhY2hlID0gdGhpcy5jYWNoZXNGb3JDb21waWxlcnMuZ2V0KGNvbXBpbGVyKTtcbiAgICByZXR1cm4gYXdhaXQgY2FjaGUuZ2V0T3JGZXRjaChcbiAgICAgIGZpbGVQYXRoLFxuICAgICAgKGZpbGVQYXRoLCBoYXNoSW5mbykgPT4gdGhpcy5jb21waWxlVW5jYWNoZWQoZmlsZVBhdGgsIGhhc2hJbmZvLCBjb21waWxlcikpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMgaW52b2tpbmcgY29tcGlsZXJzIGluZGVwZW5kZW50IG9mIGNhY2hpbmdcbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGFzeW5jIGNvbXBpbGVVbmNhY2hlZChmaWxlUGF0aCwgaGFzaEluZm8sIGNvbXBpbGVyKSB7XG4gICAgbGV0IGlucHV0TWltZVR5cGUgPSBtaW1lVHlwZXMubG9va3VwKGZpbGVQYXRoKTtcblxuICAgIGlmIChoYXNoSW5mby5pc0ZpbGVCaW5hcnkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGJpbmFyeURhdGE6IGhhc2hJbmZvLmJpbmFyeURhdGEgfHwgYXdhaXQgcGZzLnJlYWRGaWxlKGZpbGVQYXRoKSxcbiAgICAgICAgbWltZVR5cGU6IGlucHV0TWltZVR5cGUsXG4gICAgICAgIGRlcGVuZGVudEZpbGVzOiBbXVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBsZXQgY3R4ID0ge307XG4gICAgbGV0IGNvZGUgPSBoYXNoSW5mby5zb3VyY2VDb2RlIHx8IGF3YWl0IHBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0ZjgnKTtcblxuICAgIGlmICghKGF3YWl0IGNvbXBpbGVyLnNob3VsZENvbXBpbGVGaWxlKGNvZGUsIGN0eCkpKSB7XG4gICAgICBkKGBDb21waWxlciByZXR1cm5lZCBmYWxzZSBmb3Igc2hvdWxkQ29tcGlsZUZpbGU6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICByZXR1cm4geyBjb2RlLCBtaW1lVHlwZTogbWltZVR5cGVzLmxvb2t1cChmaWxlUGF0aCksIGRlcGVuZGVudEZpbGVzOiBbXSB9O1xuICAgIH1cblxuICAgIGxldCBkZXBlbmRlbnRGaWxlcyA9IGF3YWl0IGNvbXBpbGVyLmRldGVybWluZURlcGVuZGVudEZpbGVzKGNvZGUsIGZpbGVQYXRoLCBjdHgpO1xuXG4gICAgZChgVXNpbmcgY29tcGlsZXIgb3B0aW9uczogJHtKU09OLnN0cmluZ2lmeShjb21waWxlci5jb21waWxlck9wdGlvbnMpfWApO1xuICAgIGxldCByZXN1bHQgPSBhd2FpdCBjb21waWxlci5jb21waWxlKGNvZGUsIGZpbGVQYXRoLCBjdHgpO1xuXG4gICAgbGV0IHNob3VsZElubGluZUh0bWxpZnkgPVxuICAgICAgaW5wdXRNaW1lVHlwZSAhPT0gJ3RleHQvaHRtbCcgJiZcbiAgICAgIHJlc3VsdC5taW1lVHlwZSA9PT0gJ3RleHQvaHRtbCc7XG5cbiAgICBsZXQgaXNQYXNzdGhyb3VnaCA9XG4gICAgICByZXN1bHQubWltZVR5cGUgPT09ICd0ZXh0L3BsYWluJyB8fFxuICAgICAgIXJlc3VsdC5taW1lVHlwZSB8fFxuICAgICAgQ29tcGlsZXJIb3N0LnNob3VsZFBhc3N0aHJvdWdoKGhhc2hJbmZvKTtcblxuICAgIGlmICgoZmluYWxGb3Jtc1tyZXN1bHQubWltZVR5cGVdICYmICFzaG91bGRJbmxpbmVIdG1saWZ5KSB8fCBpc1Bhc3N0aHJvdWdoKSB7XG4gICAgICAvLyBHb3Qgc29tZXRoaW5nIHdlIGNhbiB1c2UgaW4tYnJvd3NlciwgbGV0J3MgcmV0dXJuIGl0XG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihyZXN1bHQsIHtkZXBlbmRlbnRGaWxlc30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBkKGBSZWN1cnNpdmVseSBjb21waWxpbmcgcmVzdWx0IG9mICR7ZmlsZVBhdGh9IHdpdGggbm9uLWZpbmFsIE1JTUUgdHlwZSAke3Jlc3VsdC5taW1lVHlwZX0sIGlucHV0IHdhcyAke2lucHV0TWltZVR5cGV9YCk7XG5cbiAgICAgIGhhc2hJbmZvID0gT2JqZWN0LmFzc2lnbih7IHNvdXJjZUNvZGU6IHJlc3VsdC5jb2RlLCBtaW1lVHlwZTogcmVzdWx0Lm1pbWVUeXBlIH0sIGhhc2hJbmZvKTtcbiAgICAgIGNvbXBpbGVyID0gdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlW3Jlc3VsdC5taW1lVHlwZSB8fCAnX19sb2xub3RoZXJlJ107XG5cbiAgICAgIGlmICghY29tcGlsZXIpIHtcbiAgICAgICAgZChgUmVjdXJzaXZlIGNvbXBpbGUgZmFpbGVkIC0gaW50ZXJtZWRpYXRlIHJlc3VsdDogJHtKU09OLnN0cmluZ2lmeShyZXN1bHQpfWApO1xuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29tcGlsaW5nICR7ZmlsZVBhdGh9IHJlc3VsdGVkIGluIGEgTUlNRSB0eXBlIG9mICR7cmVzdWx0Lm1pbWVUeXBlfSwgd2hpY2ggd2UgZG9uJ3Qga25vdyBob3cgdG8gaGFuZGxlYCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbXBpbGVVbmNhY2hlZChcbiAgICAgICAgYCR7ZmlsZVBhdGh9LiR7bWltZVR5cGVzLmV4dGVuc2lvbihyZXN1bHQubWltZVR5cGUgfHwgJ3R4dCcpfWAsXG4gICAgICAgIGhhc2hJbmZvLCBjb21waWxlcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByZS1jYWNoZXMgYW4gZW50aXJlIGRpcmVjdG9yeSBvZiBmaWxlcyByZWN1cnNpdmVseS4gVXN1YWxseSB1c2VkIGZvclxuICAgKiBidWlsZGluZyBjdXN0b20gY29tcGlsZXIgdG9vbGluZy5cbiAgICpcbiAgICogQHBhcmFtICB7c3RyaW5nfSByb290RGlyZWN0b3J5ICBUaGUgdG9wLWxldmVsIGRpcmVjdG9yeSB0byBjb21waWxlXG4gICAqXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBzaG91bGRDb21waWxlIChvcHRpb25hbCkgIEEgRnVuY3Rpb24gd2hpY2ggYWxsb3dzIHRoZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsZXIgdG8gZGlzYWJsZSBjb21waWxpbmcgY2VydGFpbiBmaWxlcy5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSXQgdGFrZXMgYSBmdWxseS1xdWFsaWZpZWQgcGF0aCB0byBhIGZpbGUsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFuZCBzaG91bGQgcmV0dXJuIGEgQm9vbGVhbi5cbiAgICpcbiAgICogQHJldHVybiB7UHJvbWlzZX0gIENvbXBsZXRpb24uXG4gICAqL1xuICBhc3luYyBjb21waWxlQWxsKHJvb3REaXJlY3RvcnksIHNob3VsZENvbXBpbGU9bnVsbCkge1xuICAgIGxldCBzaG91bGQgPSBzaG91bGRDb21waWxlIHx8IGZ1bmN0aW9uKCkge3JldHVybiB0cnVlO307XG5cbiAgICBhd2FpdCBmb3JBbGxGaWxlcyhyb290RGlyZWN0b3J5LCAoZikgPT4ge1xuICAgICAgaWYgKCFzaG91bGQoZikpIHJldHVybjtcblxuICAgICAgZChgQ29tcGlsaW5nICR7Zn1gKTtcbiAgICAgIHJldHVybiB0aGlzLmNvbXBpbGUoZiwgdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIFN5bmMgTWV0aG9kc1xuICAgKi9cblxuICBjb21waWxlU3luYyhmaWxlUGF0aCkge1xuICAgIHJldHVybiAodGhpcy5yZWFkT25seU1vZGUgPyB0aGlzLmNvbXBpbGVSZWFkT25seVN5bmMoZmlsZVBhdGgpIDogdGhpcy5mdWxsQ29tcGlsZVN5bmMoZmlsZVBhdGgpKTtcbiAgfVxuXG4gIHN0YXRpYyBjcmVhdGVSZWFkb25seUZyb21Db25maWd1cmF0aW9uU3luYyhyb290Q2FjaGVEaXIsIGFwcFJvb3QsIGZhbGxiYWNrQ29tcGlsZXI9bnVsbCkge1xuICAgIGxldCB0YXJnZXQgPSBwYXRoLmpvaW4ocm9vdENhY2hlRGlyLCAnY29tcGlsZXItaW5mby5qc29uLmd6Jyk7XG4gICAgbGV0IGJ1ZiA9IGZzLnJlYWRGaWxlU3luYyh0YXJnZXQpO1xuICAgIGxldCBpbmZvID0gSlNPTi5wYXJzZSh6bGliLmd1bnppcFN5bmMoYnVmKSk7XG5cbiAgICBsZXQgZmlsZUNoYW5nZUNhY2hlID0gRmlsZUNoYW5nZWRDYWNoZS5sb2FkRnJvbURhdGEoaW5mby5maWxlQ2hhbmdlQ2FjaGUsIGFwcFJvb3QsIHRydWUpO1xuXG4gICAgbGV0IGNvbXBpbGVycyA9IE9iamVjdC5rZXlzKGluZm8uY29tcGlsZXJzKS5yZWR1Y2UoKGFjYywgeCkgPT4ge1xuICAgICAgbGV0IGN1ciA9IGluZm8uY29tcGlsZXJzW3hdO1xuICAgICAgYWNjW3hdID0gbmV3IFJlYWRPbmx5Q29tcGlsZXIoY3VyLm5hbWUsIGN1ci5jb21waWxlclZlcnNpb24sIGN1ci5jb21waWxlck9wdGlvbnMsIGN1ci5pbnB1dE1pbWVUeXBlcyk7XG5cbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgcmV0dXJuIG5ldyBDb21waWxlckhvc3Qocm9vdENhY2hlRGlyLCBjb21waWxlcnMsIGZpbGVDaGFuZ2VDYWNoZSwgdHJ1ZSwgZmFsbGJhY2tDb21waWxlcik7XG4gIH1cblxuICBzdGF0aWMgY3JlYXRlRnJvbUNvbmZpZ3VyYXRpb25TeW5jKHJvb3RDYWNoZURpciwgYXBwUm9vdCwgY29tcGlsZXJzQnlNaW1lVHlwZSwgZmFsbGJhY2tDb21waWxlcj1udWxsKSB7XG4gICAgbGV0IHRhcmdldCA9IHBhdGguam9pbihyb290Q2FjaGVEaXIsICdjb21waWxlci1pbmZvLmpzb24uZ3onKTtcbiAgICBsZXQgYnVmID0gZnMucmVhZEZpbGVTeW5jKHRhcmdldCk7XG4gICAgbGV0IGluZm8gPSBKU09OLnBhcnNlKHpsaWIuZ3VuemlwU3luYyhidWYpKTtcblxuICAgIGxldCBmaWxlQ2hhbmdlQ2FjaGUgPSBGaWxlQ2hhbmdlZENhY2hlLmxvYWRGcm9tRGF0YShpbmZvLmZpbGVDaGFuZ2VDYWNoZSwgYXBwUm9vdCwgZmFsc2UpO1xuXG4gICAgT2JqZWN0LmtleXMoaW5mby5jb21waWxlcnMpLmZvckVhY2goKHgpID0+IHtcbiAgICAgIGxldCBjdXIgPSBpbmZvLmNvbXBpbGVyc1t4XTtcbiAgICAgIGNvbXBpbGVyc0J5TWltZVR5cGVbeF0uY29tcGlsZXJPcHRpb25zID0gY3VyLmNvbXBpbGVyT3B0aW9ucztcbiAgICB9KTtcblxuICAgIHJldHVybiBuZXcgQ29tcGlsZXJIb3N0KHJvb3RDYWNoZURpciwgY29tcGlsZXJzQnlNaW1lVHlwZSwgZmlsZUNoYW5nZUNhY2hlLCBmYWxzZSwgZmFsbGJhY2tDb21waWxlcik7XG4gIH1cblxuICBzYXZlQ29uZmlndXJhdGlvblN5bmMoKSB7XG4gICAgbGV0IHNlcmlhbGl6ZWRDb21waWxlck9wdHMgPSBPYmplY3Qua2V5cyh0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGUpLnJlZHVjZSgoYWNjLCB4KSA9PiB7XG4gICAgICBsZXQgY29tcGlsZXIgPSB0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGVbeF07XG4gICAgICBsZXQgS2xhc3MgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YoY29tcGlsZXIpLmNvbnN0cnVjdG9yO1xuXG4gICAgICBsZXQgdmFsID0ge1xuICAgICAgICBuYW1lOiBLbGFzcy5uYW1lLFxuICAgICAgICBpbnB1dE1pbWVUeXBlczogS2xhc3MuZ2V0SW5wdXRNaW1lVHlwZXMoKSxcbiAgICAgICAgY29tcGlsZXJPcHRpb25zOiBjb21waWxlci5jb21waWxlck9wdGlvbnMsXG4gICAgICAgIGNvbXBpbGVyVmVyc2lvbjogY29tcGlsZXIuZ2V0Q29tcGlsZXJWZXJzaW9uKClcbiAgICAgIH07XG5cbiAgICAgIGFjY1t4XSA9IHZhbDtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgbGV0IGluZm8gPSB7XG4gICAgICBmaWxlQ2hhbmdlQ2FjaGU6IHRoaXMuZmlsZUNoYW5nZUNhY2hlLmdldFNhdmVkRGF0YSgpLFxuICAgICAgY29tcGlsZXJzOiBzZXJpYWxpemVkQ29tcGlsZXJPcHRzXG4gICAgfTtcblxuICAgIGxldCB0YXJnZXQgPSBwYXRoLmpvaW4odGhpcy5yb290Q2FjaGVEaXIsICdjb21waWxlci1pbmZvLmpzb24uZ3onKTtcbiAgICBsZXQgYnVmID0gemxpYi5nemlwU3luYyhuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KGluZm8pKSk7XG4gICAgZnMud3JpdGVGaWxlU3luYyh0YXJnZXQsIGJ1Zik7XG4gIH1cblxuICBjb21waWxlUmVhZE9ubHlTeW5jKGZpbGVQYXRoKSB7XG4gICAgLy8gV2UgZ3VhcmFudGVlIHRoYXQgbm9kZV9tb2R1bGVzIGFyZSBhbHdheXMgc2hpcHBlZCBkaXJlY3RseVxuICAgIGxldCB0eXBlID0gbWltZVR5cGVzLmxvb2t1cChmaWxlUGF0aCk7XG4gICAgaWYgKEZpbGVDaGFuZ2VkQ2FjaGUuaXNJbk5vZGVNb2R1bGVzKGZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWltZVR5cGU6IHR5cGUgfHwgJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnLFxuICAgICAgICBjb2RlOiBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGY4JylcbiAgICAgIH07XG4gICAgfVxuXG4gICAgbGV0IGhhc2hJbmZvID0gdGhpcy5maWxlQ2hhbmdlQ2FjaGUuZ2V0SGFzaEZvclBhdGhTeW5jKGZpbGVQYXRoKTtcblxuICAgIC8vIFdlIGd1YXJhbnRlZSB0aGF0IG5vZGVfbW9kdWxlcyBhcmUgYWx3YXlzIHNoaXBwZWQgZGlyZWN0bHlcbiAgICBpZiAoaGFzaEluZm8uaXNJbk5vZGVNb2R1bGVzKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBtaW1lVHlwZTogdHlwZSxcbiAgICAgICAgY29kZTogaGFzaEluZm8uc291cmNlQ29kZSB8fCBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGY4JylcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gTkI6IEhlcmUsIHdlJ3JlIGJhc2ljYWxseSBvbmx5IHVzaW5nIHRoZSBjb21waWxlciBoZXJlIHRvIGZpbmRcbiAgICAvLyB0aGUgYXBwcm9wcmlhdGUgQ29tcGlsZUNhY2hlXG4gICAgbGV0IGNvbXBpbGVyID0gQ29tcGlsZXJIb3N0LnNob3VsZFBhc3N0aHJvdWdoKGhhc2hJbmZvKSA/XG4gICAgICB0aGlzLmdldFBhc3N0aHJvdWdoQ29tcGlsZXIoKSA6XG4gICAgICB0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGVbdHlwZSB8fCAnX19sb2xub3RoZXJlJ107XG5cbiAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICBjb21waWxlciA9IHRoaXMuZmFsbGJhY2tDb21waWxlcjtcblxuICAgICAgbGV0IHsgY29kZSwgYmluYXJ5RGF0YSwgbWltZVR5cGUgfSA9IGNvbXBpbGVyLmdldFN5bmMoZmlsZVBhdGgpO1xuICAgICAgcmV0dXJuIHsgY29kZTogY29kZSB8fCBiaW5hcnlEYXRhLCBtaW1lVHlwZSB9O1xuICAgIH1cblxuICAgIGxldCBjYWNoZSA9IHRoaXMuY2FjaGVzRm9yQ29tcGlsZXJzLmdldChjb21waWxlcik7XG4gICAgbGV0IHtjb2RlLCBiaW5hcnlEYXRhLCBtaW1lVHlwZX0gPSBjYWNoZS5nZXRTeW5jKGZpbGVQYXRoKTtcblxuICAgIGNvZGUgPSBjb2RlIHx8IGJpbmFyeURhdGE7XG4gICAgaWYgKCFjb2RlIHx8ICFtaW1lVHlwZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc2tlZCB0byBjb21waWxlICR7ZmlsZVBhdGh9IGluIHByb2R1Y3Rpb24sIGlzIHRoaXMgZmlsZSBub3QgcHJlY29tcGlsZWQ/YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgY29kZSwgbWltZVR5cGUgfTtcbiAgfVxuXG4gIGZ1bGxDb21waWxlU3luYyhmaWxlUGF0aCkge1xuICAgIGQoYENvbXBpbGluZyAke2ZpbGVQYXRofWApO1xuXG4gICAgbGV0IGhhc2hJbmZvID0gdGhpcy5maWxlQ2hhbmdlQ2FjaGUuZ2V0SGFzaEZvclBhdGhTeW5jKGZpbGVQYXRoKTtcbiAgICBsZXQgdHlwZSA9IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpO1xuXG4gICAgaWYgKGhhc2hJbmZvLmlzSW5Ob2RlTW9kdWxlcykge1xuICAgICAgbGV0IGNvZGUgPSBoYXNoSW5mby5zb3VyY2VDb2RlIHx8IGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0ZjgnKTtcbiAgICAgIGNvZGUgPSBDb21waWxlckhvc3QuZml4Tm9kZU1vZHVsZXNTb3VyY2VNYXBwaW5nU3luYyhjb2RlLCBmaWxlUGF0aCwgdGhpcy5maWxlQ2hhbmdlQ2FjaGUuYXBwUm9vdCk7XG4gICAgICByZXR1cm4geyBjb2RlLCBtaW1lVHlwZTogdHlwZSB9O1xuICAgIH1cblxuICAgIGxldCBjb21waWxlciA9IENvbXBpbGVySG9zdC5zaG91bGRQYXNzdGhyb3VnaChoYXNoSW5mbykgP1xuICAgICAgdGhpcy5nZXRQYXNzdGhyb3VnaENvbXBpbGVyKCkgOlxuICAgICAgdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlW3R5cGUgfHwgJ19fbG9sbm90aGVyZSddO1xuXG4gICAgaWYgKCFjb21waWxlcikge1xuICAgICAgZChgRmFsbGluZyBiYWNrIHRvIHBhc3N0aHJvdWdoIGNvbXBpbGVyIGZvciAke2ZpbGVQYXRofWApO1xuICAgICAgY29tcGlsZXIgPSB0aGlzLmZhbGxiYWNrQ29tcGlsZXI7XG4gICAgfVxuXG4gICAgaWYgKCFjb21waWxlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZG4ndCBmaW5kIGEgY29tcGlsZXIgZm9yICR7ZmlsZVBhdGh9YCk7XG4gICAgfVxuXG4gICAgbGV0IGNhY2hlID0gdGhpcy5jYWNoZXNGb3JDb21waWxlcnMuZ2V0KGNvbXBpbGVyKTtcbiAgICByZXR1cm4gY2FjaGUuZ2V0T3JGZXRjaFN5bmMoXG4gICAgICBmaWxlUGF0aCxcbiAgICAgIChmaWxlUGF0aCwgaGFzaEluZm8pID0+IHRoaXMuY29tcGlsZVVuY2FjaGVkU3luYyhmaWxlUGF0aCwgaGFzaEluZm8sIGNvbXBpbGVyKSk7XG4gIH1cblxuICBjb21waWxlVW5jYWNoZWRTeW5jKGZpbGVQYXRoLCBoYXNoSW5mbywgY29tcGlsZXIpIHtcbiAgICBsZXQgaW5wdXRNaW1lVHlwZSA9IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpO1xuXG4gICAgaWYgKGhhc2hJbmZvLmlzRmlsZUJpbmFyeSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYmluYXJ5RGF0YTogaGFzaEluZm8uYmluYXJ5RGF0YSB8fCBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgpLFxuICAgICAgICBtaW1lVHlwZTogaW5wdXRNaW1lVHlwZSxcbiAgICAgICAgZGVwZW5kZW50RmlsZXM6IFtdXG4gICAgICB9O1xuICAgIH1cblxuICAgIGxldCBjdHggPSB7fTtcbiAgICBsZXQgY29kZSA9IGhhc2hJbmZvLnNvdXJjZUNvZGUgfHwgZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmOCcpO1xuXG4gICAgaWYgKCEoY29tcGlsZXIuc2hvdWxkQ29tcGlsZUZpbGVTeW5jKGNvZGUsIGN0eCkpKSB7XG4gICAgICBkKGBDb21waWxlciByZXR1cm5lZCBmYWxzZSBmb3Igc2hvdWxkQ29tcGlsZUZpbGU6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICByZXR1cm4geyBjb2RlLCBtaW1lVHlwZTogbWltZVR5cGVzLmxvb2t1cChmaWxlUGF0aCksIGRlcGVuZGVudEZpbGVzOiBbXSB9O1xuICAgIH1cblxuICAgIGxldCBkZXBlbmRlbnRGaWxlcyA9IGNvbXBpbGVyLmRldGVybWluZURlcGVuZGVudEZpbGVzU3luYyhjb2RlLCBmaWxlUGF0aCwgY3R4KTtcblxuICAgIGxldCByZXN1bHQgPSBjb21waWxlci5jb21waWxlU3luYyhjb2RlLCBmaWxlUGF0aCwgY3R4KTtcblxuICAgIGxldCBzaG91bGRJbmxpbmVIdG1saWZ5ID1cbiAgICAgIGlucHV0TWltZVR5cGUgIT09ICd0ZXh0L2h0bWwnICYmXG4gICAgICByZXN1bHQubWltZVR5cGUgPT09ICd0ZXh0L2h0bWwnO1xuXG4gICAgbGV0IGlzUGFzc3Rocm91Z2ggPVxuICAgICAgcmVzdWx0Lm1pbWVUeXBlID09PSAndGV4dC9wbGFpbicgfHxcbiAgICAgICFyZXN1bHQubWltZVR5cGUgfHxcbiAgICAgIENvbXBpbGVySG9zdC5zaG91bGRQYXNzdGhyb3VnaChoYXNoSW5mbyk7XG5cbiAgICBpZiAoKGZpbmFsRm9ybXNbcmVzdWx0Lm1pbWVUeXBlXSAmJiAhc2hvdWxkSW5saW5lSHRtbGlmeSkgfHwgaXNQYXNzdGhyb3VnaCkge1xuICAgICAgLy8gR290IHNvbWV0aGluZyB3ZSBjYW4gdXNlIGluLWJyb3dzZXIsIGxldCdzIHJldHVybiBpdFxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocmVzdWx0LCB7ZGVwZW5kZW50RmlsZXN9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZChgUmVjdXJzaXZlbHkgY29tcGlsaW5nIHJlc3VsdCBvZiAke2ZpbGVQYXRofSB3aXRoIG5vbi1maW5hbCBNSU1FIHR5cGUgJHtyZXN1bHQubWltZVR5cGV9LCBpbnB1dCB3YXMgJHtpbnB1dE1pbWVUeXBlfWApO1xuXG4gICAgICBoYXNoSW5mbyA9IE9iamVjdC5hc3NpZ24oeyBzb3VyY2VDb2RlOiByZXN1bHQuY29kZSwgbWltZVR5cGU6IHJlc3VsdC5taW1lVHlwZSB9LCBoYXNoSW5mbyk7XG4gICAgICBjb21waWxlciA9IHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZVtyZXN1bHQubWltZVR5cGUgfHwgJ19fbG9sbm90aGVyZSddO1xuXG4gICAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICAgIGQoYFJlY3Vyc2l2ZSBjb21waWxlIGZhaWxlZCAtIGludGVybWVkaWF0ZSByZXN1bHQ6ICR7SlNPTi5zdHJpbmdpZnkocmVzdWx0KX1gKTtcblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBpbGluZyAke2ZpbGVQYXRofSByZXN1bHRlZCBpbiBhIE1JTUUgdHlwZSBvZiAke3Jlc3VsdC5taW1lVHlwZX0sIHdoaWNoIHdlIGRvbid0IGtub3cgaG93IHRvIGhhbmRsZWApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5jb21waWxlVW5jYWNoZWRTeW5jKFxuICAgICAgICBgJHtmaWxlUGF0aH0uJHttaW1lVHlwZXMuZXh0ZW5zaW9uKHJlc3VsdC5taW1lVHlwZSB8fCAndHh0Jyl9YCxcbiAgICAgICAgaGFzaEluZm8sIGNvbXBpbGVyKTtcbiAgICB9XG4gIH1cblxuICBjb21waWxlQWxsU3luYyhyb290RGlyZWN0b3J5LCBzaG91bGRDb21waWxlPW51bGwpIHtcbiAgICBsZXQgc2hvdWxkID0gc2hvdWxkQ29tcGlsZSB8fCBmdW5jdGlvbigpIHtyZXR1cm4gdHJ1ZTt9O1xuXG4gICAgZm9yQWxsRmlsZXNTeW5jKHJvb3REaXJlY3RvcnksIChmKSA9PiB7XG4gICAgICBpZiAoIXNob3VsZChmKSkgcmV0dXJuO1xuICAgICAgcmV0dXJuIHRoaXMuY29tcGlsZVN5bmMoZiwgdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIE90aGVyIHN0dWZmXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHBhc3N0aHJvdWdoIGNvbXBpbGVyXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBnZXRQYXNzdGhyb3VnaENvbXBpbGVyKCkge1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGVbJ3RleHQvcGxhaW4nXTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgd2hldGhlciB3ZSBzaG91bGQgZXZlbiB0cnkgdG8gY29tcGlsZSB0aGUgY29udGVudC4gTm90ZSB0aGF0IGluXG4gICAqIHNvbWUgY2FzZXMsIGNvbnRlbnQgd2lsbCBzdGlsbCBiZSBpbiBjYWNoZSBldmVuIGlmIHRoaXMgcmV0dXJucyB0cnVlLCBhbmRcbiAgICogaW4gb3RoZXIgY2FzZXMgKGlzSW5Ob2RlTW9kdWxlcyksIHdlJ2xsIGtub3cgZXhwbGljaXRseSB0byBub3QgZXZlbiBib3RoZXJcbiAgICogbG9va2luZyBpbiB0aGUgY2FjaGUuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGF0aWMgc2hvdWxkUGFzc3Rocm91Z2goaGFzaEluZm8pIHtcbiAgICByZXR1cm4gaGFzaEluZm8uaXNNaW5pZmllZCB8fCBoYXNoSW5mby5pc0luTm9kZU1vZHVsZXMgfHwgaGFzaEluZm8uaGFzU291cmNlTWFwIHx8IGhhc2hJbmZvLmlzRmlsZUJpbmFyeTtcbiAgfVxuICAgIFxuICAvKipcbiAgICogTG9vayBhdCB0aGUgY29kZSBvZiBhIG5vZGUgbW9kdWxlcyBhbmQgc2VlIHRoZSBzb3VyY2VNYXBwaW5nIHBhdGguXG4gICAqIElmIHRoZXJlIGlzIGFueSwgY2hlY2sgdGhlIHBhdGggYW5kIHRyeSB0byBmaXggaXQgd2l0aCBhbmRcbiAgICogcm9vdCByZWxhdGl2ZSBwYXRoLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGZpeE5vZGVNb2R1bGVzU291cmNlTWFwcGluZyhzb3VyY2VDb2RlLCBzb3VyY2VQYXRoLCBhcHBSb290KSB7XG4gICAgbGV0IHJlZ2V4U291cmNlTWFwcGluZyA9IC9cXC9cXC8jLipzb3VyY2VNYXBwaW5nVVJMPSg/IWRhdGE6KShbXlwiJ10uKikvaTtcbiAgICBsZXQgc291cmNlTWFwcGluZ0NoZWNrID0gc291cmNlQ29kZS5tYXRjaChyZWdleFNvdXJjZU1hcHBpbmcpO1xuXG4gICAgaWYgKHNvdXJjZU1hcHBpbmdDaGVjayAmJiBzb3VyY2VNYXBwaW5nQ2hlY2tbMV0gJiYgc291cmNlTWFwcGluZ0NoZWNrWzFdICE9PSAnJyl7XG4gICAgICBsZXQgc291cmNlTWFwUGF0aCA9IHNvdXJjZU1hcHBpbmdDaGVja1sxXTtcbiAgICAgIFxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgcGZzLnN0YXQoc291cmNlTWFwUGF0aCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsZXQgbm9ybVJvb3QgPSBwYXRoLm5vcm1hbGl6ZShhcHBSb290KTtcbiAgICAgICAgbGV0IGFic1BhdGhUb01vZHVsZSA9IHBhdGguZGlybmFtZShzb3VyY2VQYXRoLnJlcGxhY2Uobm9ybVJvb3QsICcnKS5zdWJzdHJpbmcoMSkpO1xuICAgICAgICBsZXQgbmV3TWFwUGF0aCA9IHBhdGguam9pbihhYnNQYXRoVG9Nb2R1bGUsIHNvdXJjZU1hcFBhdGgpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHNvdXJjZUNvZGUucmVwbGFjZShyZWdleFNvdXJjZU1hcHBpbmcsIGAvLyMgc291cmNlTWFwcGluZ1VSTD0ke25ld01hcFBhdGh9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzb3VyY2VDb2RlO1xuICB9XG5cbiAgLyoqXG4gICAqIExvb2sgYXQgdGhlIGNvZGUgb2YgYSBub2RlIG1vZHVsZXMgYW5kIHNlZSB0aGUgc291cmNlTWFwcGluZyBwYXRoLlxuICAgKiBJZiB0aGVyZSBpcyBhbnksIGNoZWNrIHRoZSBwYXRoIGFuZCB0cnkgdG8gZml4IGl0IHdpdGggYW5kXG4gICAqIHJvb3QgcmVsYXRpdmUgcGF0aC5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIHN0YXRpYyBmaXhOb2RlTW9kdWxlc1NvdXJjZU1hcHBpbmdTeW5jKHNvdXJjZUNvZGUsIHNvdXJjZVBhdGgsIGFwcFJvb3QpIHtcbiAgICBsZXQgcmVnZXhTb3VyY2VNYXBwaW5nID0gL1xcL1xcLyMuKnNvdXJjZU1hcHBpbmdVUkw9KD8hZGF0YTopKFteXCInXS4qKS9pO1xuICAgIGxldCBzb3VyY2VNYXBwaW5nQ2hlY2sgPSBzb3VyY2VDb2RlLm1hdGNoKHJlZ2V4U291cmNlTWFwcGluZyk7XG5cbiAgICBpZiAoc291cmNlTWFwcGluZ0NoZWNrICYmIHNvdXJjZU1hcHBpbmdDaGVja1sxXSAmJiBzb3VyY2VNYXBwaW5nQ2hlY2tbMV0gIT09ICcnKXtcbiAgICAgIGxldCBzb3VyY2VNYXBQYXRoID0gc291cmNlTWFwcGluZ0NoZWNrWzFdO1xuICAgICAgXG4gICAgICB0cnkge1xuICAgICAgICBmcy5zdGF0U3luYyhzb3VyY2VNYXBQYXRoKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxldCBub3JtUm9vdCA9IHBhdGgubm9ybWFsaXplKGFwcFJvb3QpO1xuICAgICAgICBsZXQgYWJzUGF0aFRvTW9kdWxlID0gcGF0aC5kaXJuYW1lKHNvdXJjZVBhdGgucmVwbGFjZShub3JtUm9vdCwgJycpLnN1YnN0cmluZygxKSk7XG4gICAgICAgIGxldCBuZXdNYXBQYXRoID0gcGF0aC5qb2luKGFic1BhdGhUb01vZHVsZSwgc291cmNlTWFwUGF0aCk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gc291cmNlQ29kZS5yZXBsYWNlKHJlZ2V4U291cmNlTWFwcGluZywgYC8vIyBzb3VyY2VNYXBwaW5nVVJMPSR7bmV3TWFwUGF0aH1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHNvdXJjZUNvZGU7XG4gIH1cbn1cbiJdfQ==