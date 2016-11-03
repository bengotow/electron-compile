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

      let didKeepMimetype = inputMimeType === result.mimeType;

      let isPassthrough = result.mimeType === 'text/plain' || !result.mimeType || CompilerHost.shouldPassthrough(hashInfo);

      if (finalForms[result.mimeType] && !shouldInlineHtmlify || didKeepMimetype || isPassthrough) {
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

    let didKeepMimetype = inputMimeType === result.mimeType;

    let isPassthrough = result.mimeType === 'text/plain' || !result.mimeType || CompilerHost.shouldPassthrough(hashInfo);

    if (finalForms[result.mimeType] && !shouldInlineHtmlify || didKeepMimetype || isPassthrough) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb21waWxlci1ob3N0LmpzIl0sIm5hbWVzIjpbImQiLCJyZXF1aXJlIiwiZmluYWxGb3JtcyIsIkNvbXBpbGVySG9zdCIsImNvbnN0cnVjdG9yIiwicm9vdENhY2hlRGlyIiwiY29tcGlsZXJzIiwiZmlsZUNoYW5nZUNhY2hlIiwicmVhZE9ubHlNb2RlIiwiZmFsbGJhY2tDb21waWxlciIsImNvbXBpbGVyc0J5TWltZVR5cGUiLCJPYmplY3QiLCJhc3NpZ24iLCJhcHBSb290IiwiY2FjaGVzRm9yQ29tcGlsZXJzIiwia2V5cyIsInJlZHVjZSIsImFjYyIsIngiLCJjb21waWxlciIsImhhcyIsInNldCIsImNyZWF0ZUZyb21Db21waWxlciIsIk1hcCIsImNyZWF0ZVJlYWRvbmx5RnJvbUNvbmZpZ3VyYXRpb24iLCJ0YXJnZXQiLCJqb2luIiwiYnVmIiwicmVhZEZpbGUiLCJpbmZvIiwiSlNPTiIsInBhcnNlIiwiZ3VuemlwIiwibG9hZEZyb21EYXRhIiwiY3VyIiwibmFtZSIsImNvbXBpbGVyVmVyc2lvbiIsImNvbXBpbGVyT3B0aW9ucyIsImlucHV0TWltZVR5cGVzIiwiY3JlYXRlRnJvbUNvbmZpZ3VyYXRpb24iLCJmb3JFYWNoIiwic2F2ZUNvbmZpZ3VyYXRpb24iLCJzZXJpYWxpemVkQ29tcGlsZXJPcHRzIiwiS2xhc3MiLCJnZXRQcm90b3R5cGVPZiIsInZhbCIsImdldElucHV0TWltZVR5cGVzIiwiZ2V0Q29tcGlsZXJWZXJzaW9uIiwiZ2V0U2F2ZWREYXRhIiwiZ3ppcCIsIkJ1ZmZlciIsInN0cmluZ2lmeSIsIndyaXRlRmlsZSIsImNvbXBpbGUiLCJmaWxlUGF0aCIsImNvbXBpbGVSZWFkT25seSIsImZ1bGxDb21waWxlIiwidHlwZSIsImxvb2t1cCIsImlzSW5Ob2RlTW9kdWxlcyIsIm1pbWVUeXBlIiwiY29kZSIsImhhc2hJbmZvIiwiZ2V0SGFzaEZvclBhdGgiLCJzaG91bGRQYXNzdGhyb3VnaCIsImdldFBhc3N0aHJvdWdoQ29tcGlsZXIiLCJnZXQiLCJiaW5hcnlEYXRhIiwiY2FjaGUiLCJFcnJvciIsInNvdXJjZUNvZGUiLCJmaXhOb2RlTW9kdWxlc1NvdXJjZU1hcHBpbmciLCJnZXRPckZldGNoIiwiY29tcGlsZVVuY2FjaGVkIiwiaW5wdXRNaW1lVHlwZSIsImlzRmlsZUJpbmFyeSIsImRlcGVuZGVudEZpbGVzIiwiY3R4Iiwic2hvdWxkQ29tcGlsZUZpbGUiLCJkZXRlcm1pbmVEZXBlbmRlbnRGaWxlcyIsInJlc3VsdCIsInNob3VsZElubGluZUh0bWxpZnkiLCJkaWRLZWVwTWltZXR5cGUiLCJpc1Bhc3N0aHJvdWdoIiwiZXh0ZW5zaW9uIiwiY29tcGlsZUFsbCIsInJvb3REaXJlY3RvcnkiLCJzaG91bGRDb21waWxlIiwic2hvdWxkIiwiZiIsImNvbXBpbGVTeW5jIiwiY29tcGlsZVJlYWRPbmx5U3luYyIsImZ1bGxDb21waWxlU3luYyIsImNyZWF0ZVJlYWRvbmx5RnJvbUNvbmZpZ3VyYXRpb25TeW5jIiwicmVhZEZpbGVTeW5jIiwiZ3VuemlwU3luYyIsImNyZWF0ZUZyb21Db25maWd1cmF0aW9uU3luYyIsInNhdmVDb25maWd1cmF0aW9uU3luYyIsImd6aXBTeW5jIiwid3JpdGVGaWxlU3luYyIsImdldEhhc2hGb3JQYXRoU3luYyIsImdldFN5bmMiLCJmaXhOb2RlTW9kdWxlc1NvdXJjZU1hcHBpbmdTeW5jIiwiZ2V0T3JGZXRjaFN5bmMiLCJjb21waWxlVW5jYWNoZWRTeW5jIiwic2hvdWxkQ29tcGlsZUZpbGVTeW5jIiwiZGV0ZXJtaW5lRGVwZW5kZW50RmlsZXNTeW5jIiwiY29tcGlsZUFsbFN5bmMiLCJpc01pbmlmaWVkIiwiaGFzU291cmNlTWFwIiwic291cmNlUGF0aCIsInJlZ2V4U291cmNlTWFwcGluZyIsInNvdXJjZU1hcHBpbmdDaGVjayIsIm1hdGNoIiwic291cmNlTWFwUGF0aCIsInN0YXQiLCJlcnJvciIsIm5vcm1Sb290Iiwibm9ybWFsaXplIiwiYWJzUGF0aFRvTW9kdWxlIiwiZGlybmFtZSIs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QUNEO0FBQ0Y7O0FBRUQsV0FBT3JELFVBQVA7QUFDRDtBQTltQitCO2tCQUFibkUsWSIsImZpbGUiOiJjb21waWxlci1ob3N0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB6bGliIGZyb20gJ3psaWInO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQge3BmcywgcHpsaWJ9IGZyb20gJy4vcHJvbWlzZSc7XG5cbmltcG9ydCBtaW1lVHlwZXMgZnJvbSAnLi9taW1lLXR5cGVzJztcbmltcG9ydCB7Zm9yQWxsRmlsZXMsIGZvckFsbEZpbGVzU3luY30gZnJvbSAnLi9mb3ItYWxsLWZpbGVzJztcbmltcG9ydCBDb21waWxlQ2FjaGUgZnJvbSAnLi9jb21waWxlLWNhY2hlJztcbmltcG9ydCBGaWxlQ2hhbmdlZENhY2hlIGZyb20gJy4vZmlsZS1jaGFuZ2UtY2FjaGUnO1xuaW1wb3J0IFJlYWRPbmx5Q29tcGlsZXIgZnJvbSAnLi9yZWFkLW9ubHktY29tcGlsZXInO1xuXG5jb25zdCBkID0gcmVxdWlyZSgnZGVidWctZWxlY3Ryb24nKSgnZWxlY3Ryb24tY29tcGlsZTpjb21waWxlci1ob3N0Jyk7XG5cbi8vIFRoaXMgaXNuJ3QgZXZlbiBteVxuY29uc3QgZmluYWxGb3JtcyA9IHtcbiAgJ3RleHQvamF2YXNjcmlwdCc6IHRydWUsXG4gICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JzogdHJ1ZSxcbiAgJ3RleHQvaHRtbCc6IHRydWUsXG4gICd0ZXh0L2Nzcyc6IHRydWUsXG4gICdpbWFnZS9zdmcreG1sJzogdHJ1ZSxcbiAgJ2FwcGxpY2F0aW9uL2pzb24nOiB0cnVlXG59O1xuXG4vKipcbiAqIFRoaXMgY2xhc3MgaXMgdGhlIHRvcC1sZXZlbCBjbGFzcyB0aGF0IGVuY2Fwc3VsYXRlcyBhbGwgb2YgdGhlIGxvZ2ljIG9mXG4gKiBjb21waWxpbmcgYW5kIGNhY2hpbmcgYXBwbGljYXRpb24gY29kZS4gSWYgeW91J3JlIGxvb2tpbmcgZm9yIGEgXCJNYWluIGNsYXNzXCIsXG4gKiB0aGlzIGlzIGl0LlxuICpcbiAqIFRoaXMgY2xhc3MgY2FuIGJlIGNyZWF0ZWQgZGlyZWN0bHkgYnV0IGl0IGlzIHVzdWFsbHkgY3JlYXRlZCB2aWEgdGhlIG1ldGhvZHNcbiAqIGluIGNvbmZpZy1wYXJzZXIsIHdoaWNoIHdpbGwgYW1vbmcgb3RoZXIgdGhpbmdzLCBzZXQgdXAgdGhlIGNvbXBpbGVyIG9wdGlvbnNcbiAqIGdpdmVuIGEgcHJvamVjdCByb290LlxuICpcbiAqIENvbXBpbGVySG9zdCBpcyBhbHNvIHRoZSB0b3AtbGV2ZWwgY2xhc3MgdGhhdCBrbm93cyBob3cgdG8gc2VyaWFsaXplIGFsbCBvZiB0aGVcbiAqIGluZm9ybWF0aW9uIG5lY2Vzc2FyeSB0byByZWNyZWF0ZSBpdHNlbGYsIGVpdGhlciBhcyBhIGRldmVsb3BtZW50IGhvc3QgKGkuZS5cbiAqIHdpbGwgYWxsb3cgY2FjaGUgbWlzc2VzIGFuZCBhY3R1YWwgY29tcGlsYXRpb24pLCBvciBhcyBhIHJlYWQtb25seSB2ZXJzaW9uIG9mXG4gKiBpdHNlbGYgZm9yIHByb2R1Y3Rpb24uXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvbXBpbGVySG9zdCB7XG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGluc3RhbmNlIG9mIENvbXBpbGVySG9zdC4gWW91IHByb2JhYmx5IHdhbnQgdG8gdXNlIHRoZSBtZXRob2RzXG4gICAqIGluIGNvbmZpZy1wYXJzZXIgZm9yIGRldmVsb3BtZW50LCBvciB7QGxpbmsgY3JlYXRlUmVhZG9ubHlGcm9tQ29uZmlndXJhdGlvbn1cbiAgICogZm9yIHByb2R1Y3Rpb24gaW5zdGVhZC5cbiAgICpcbiAgICogQHBhcmFtICB7c3RyaW5nfSByb290Q2FjaGVEaXIgIFRoZSByb290IGRpcmVjdG9yeSB0byB1c2UgZm9yIHRoZSBjYWNoZVxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbXBpbGVycyAgYW4gT2JqZWN0IHdob3NlIGtleXMgYXJlIGlucHV0IE1JTUUgdHlwZXMgYW5kXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aG9zZSB2YWx1ZXMgYXJlIGluc3RhbmNlcyBvZiBDb21waWxlckJhc2UuIENyZWF0ZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcyB2aWEgdGhlIHtAbGluayBjcmVhdGVDb21waWxlcnN9IG1ldGhvZCBpblxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnLXBhcnNlci5cbiAgICpcbiAgICogQHBhcmFtICB7RmlsZUNoYW5nZWRDYWNoZX0gZmlsZUNoYW5nZUNhY2hlICBBIGZpbGUtY2hhbmdlIGNhY2hlIHRoYXQgaXNcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25hbGx5IHByZS1sb2FkZWQuXG4gICAqXG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IHJlYWRPbmx5TW9kZSAgSWYgVHJ1ZSwgY2FjaGUgbWlzc2VzIHdpbGwgZmFpbCBhbmRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21waWxhdGlvbiB3aWxsIG5vdCBiZSBhdHRlbXB0ZWQuXG4gICAqXG4gICAqIEBwYXJhbSAge0NvbXBpbGVyQmFzZX0gZmFsbGJhY2tDb21waWxlciAob3B0aW9uYWwpICBXaGVuIGEgZmlsZSBpcyBjb21waWxlZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hpY2ggZG9lc24ndCBoYXZlIGEgbWF0Y2hpbmcgY29tcGlsZXIsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzIGNvbXBpbGVyIHdpbGwgYmUgdXNlZCBpbnN0ZWFkLiBJZlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCwgd2lsbCBmYWlsIGNvbXBpbGF0aW9uLiBBIGdvb2RcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsdGVybmF0ZSBmYWxsYmFjayBpcyB0aGUgY29tcGlsZXIgZm9yXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGV4dC9wbGFpbicsIHdoaWNoIGlzIGd1YXJhbnRlZWQgdG8gYmVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXNlbnQuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihyb290Q2FjaGVEaXIsIGNvbXBpbGVycywgZmlsZUNoYW5nZUNhY2hlLCByZWFkT25seU1vZGUsIGZhbGxiYWNrQ29tcGlsZXIgPSBudWxsKSB7XG4gICAgbGV0IGNvbXBpbGVyc0J5TWltZVR5cGUgPSBPYmplY3QuYXNzaWduKHt9LCBjb21waWxlcnMpO1xuICAgIE9iamVjdC5hc3NpZ24odGhpcywge3Jvb3RDYWNoZURpciwgY29tcGlsZXJzQnlNaW1lVHlwZSwgZmlsZUNoYW5nZUNhY2hlLCByZWFkT25seU1vZGUsIGZhbGxiYWNrQ29tcGlsZXJ9KTtcbiAgICB0aGlzLmFwcFJvb3QgPSB0aGlzLmZpbGVDaGFuZ2VDYWNoZS5hcHBSb290O1xuXG4gICAgdGhpcy5jYWNoZXNGb3JDb21waWxlcnMgPSBPYmplY3Qua2V5cyhjb21waWxlcnNCeU1pbWVUeXBlKS5yZWR1Y2UoKGFjYywgeCkgPT4ge1xuICAgICAgbGV0IGNvbXBpbGVyID0gY29tcGlsZXJzQnlNaW1lVHlwZVt4XTtcbiAgICAgIGlmIChhY2MuaGFzKGNvbXBpbGVyKSkgcmV0dXJuIGFjYztcblxuICAgICAgYWNjLnNldChcbiAgICAgICAgY29tcGlsZXIsXG4gICAgICAgIENvbXBpbGVDYWNoZS5jcmVhdGVGcm9tQ29tcGlsZXIocm9vdENhY2hlRGlyLCBjb21waWxlciwgZmlsZUNoYW5nZUNhY2hlLCByZWFkT25seU1vZGUpKTtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwgbmV3IE1hcCgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgcHJvZHVjdGlvbi1tb2RlIENvbXBpbGVySG9zdCBmcm9tIHRoZSBwcmV2aW91c2x5IHNhdmVkXG4gICAqIGNvbmZpZ3VyYXRpb25cbiAgICpcbiAgICogQHBhcmFtICB7c3RyaW5nfSByb290Q2FjaGVEaXIgIFRoZSByb290IGRpcmVjdG9yeSB0byB1c2UgZm9yIHRoZSBjYWNoZS4gVGhpc1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGUgbXVzdCBoYXZlIGNhY2hlIGluZm9ybWF0aW9uIHNhdmVkIHZpYVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge0BsaW5rIHNhdmVDb25maWd1cmF0aW9ufVxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGFwcFJvb3QgIFRoZSB0b3AtbGV2ZWwgZGlyZWN0b3J5IGZvciB5b3VyIGFwcGxpY2F0aW9uIChpLmUuXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlIG9uZSB3aGljaCBoYXMgeW91ciBwYWNrYWdlLmpzb24pLlxuICAgKlxuICAgKiBAcGFyYW0gIHtDb21waWxlckJhc2V9IGZhbGxiYWNrQ29tcGlsZXIgKG9wdGlvbmFsKSAgV2hlbiBhIGZpbGUgaXMgY29tcGlsZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdoaWNoIGRvZXNuJ3QgaGF2ZSBhIG1hdGNoaW5nIGNvbXBpbGVyLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcyBjb21waWxlciB3aWxsIGJlIHVzZWQgaW5zdGVhZC4gSWZcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsIHdpbGwgZmFpbCBjb21waWxhdGlvbi4gQSBnb29kXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbHRlcm5hdGUgZmFsbGJhY2sgaXMgdGhlIGNvbXBpbGVyIGZvclxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RleHQvcGxhaW4nLCB3aGljaCBpcyBndWFyYW50ZWVkIHRvIGJlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVzZW50LlxuICAgKlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPENvbXBpbGVySG9zdD59ICBBIHJlYWQtb25seSBDb21waWxlckhvc3RcbiAgICovXG4gIHN0YXRpYyBhc3luYyBjcmVhdGVSZWFkb25seUZyb21Db25maWd1cmF0aW9uKHJvb3RDYWNoZURpciwgYXBwUm9vdCwgZmFsbGJhY2tDb21waWxlcj1udWxsKSB7XG4gICAgbGV0IHRhcmdldCA9IHBhdGguam9pbihyb290Q2FjaGVEaXIsICdjb21waWxlci1pbmZvLmpzb24uZ3onKTtcbiAgICBsZXQgYnVmID0gYXdhaXQgcGZzLnJlYWRGaWxlKHRhcmdldCk7XG4gICAgbGV0IGluZm8gPSBKU09OLnBhcnNlKGF3YWl0IHB6bGliLmd1bnppcChidWYpKTtcblxuICAgIGxldCBmaWxlQ2hhbmdlQ2FjaGUgPSBGaWxlQ2hhbmdlZENhY2hlLmxvYWRGcm9tRGF0YShpbmZvLmZpbGVDaGFuZ2VDYWNoZSwgYXBwUm9vdCwgdHJ1ZSk7XG5cbiAgICBsZXQgY29tcGlsZXJzID0gT2JqZWN0LmtleXMoaW5mby5jb21waWxlcnMpLnJlZHVjZSgoYWNjLCB4KSA9PiB7XG4gICAgICBsZXQgY3VyID0gaW5mby5jb21waWxlcnNbeF07XG4gICAgICBhY2NbeF0gPSBuZXcgUmVhZE9ubHlDb21waWxlcihjdXIubmFtZSwgY3VyLmNvbXBpbGVyVmVyc2lvbiwgY3VyLmNvbXBpbGVyT3B0aW9ucywgY3VyLmlucHV0TWltZVR5cGVzKTtcblxuICAgICAgcmV0dXJuIGFjYztcbiAgICB9LCB7fSk7XG5cbiAgICByZXR1cm4gbmV3IENvbXBpbGVySG9zdChyb290Q2FjaGVEaXIsIGNvbXBpbGVycywgZmlsZUNoYW5nZUNhY2hlLCB0cnVlLCBmYWxsYmFja0NvbXBpbGVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgZGV2ZWxvcG1lbnQtbW9kZSBDb21waWxlckhvc3QgZnJvbSB0aGUgcHJldmlvdXNseSBzYXZlZFxuICAgKiBjb25maWd1cmF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IHJvb3RDYWNoZURpciAgVGhlIHJvb3QgZGlyZWN0b3J5IHRvIHVzZSBmb3IgdGhlIGNhY2hlLiBUaGlzXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWNoZSBtdXN0IGhhdmUgY2FjaGUgaW5mb3JtYXRpb24gc2F2ZWQgdmlhXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7QGxpbmsgc2F2ZUNvbmZpZ3VyYXRpb259XG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gYXBwUm9vdCAgVGhlIHRvcC1sZXZlbCBkaXJlY3RvcnkgZm9yIHlvdXIgYXBwbGljYXRpb24gKGkuZS5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgb25lIHdoaWNoIGhhcyB5b3VyIHBhY2thZ2UuanNvbikuXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gY29tcGlsZXJzQnlNaW1lVHlwZSAgYW4gT2JqZWN0IHdob3NlIGtleXMgYXJlIGlucHV0IE1JTUVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlcyBhbmQgd2hvc2UgdmFsdWVzIGFyZSBpbnN0YW5jZXNcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZiBDb21waWxlckJhc2UuIENyZWF0ZSB0aGlzIHZpYSB0aGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7QGxpbmsgY3JlYXRlQ29tcGlsZXJzfSBtZXRob2QgaW5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25maWctcGFyc2VyLlxuICAgKlxuICAgKiBAcGFyYW0gIHtDb21waWxlckJhc2V9IGZhbGxiYWNrQ29tcGlsZXIgKG9wdGlvbmFsKSAgV2hlbiBhIGZpbGUgaXMgY29tcGlsZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdoaWNoIGRvZXNuJ3QgaGF2ZSBhIG1hdGNoaW5nIGNvbXBpbGVyLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcyBjb21waWxlciB3aWxsIGJlIHVzZWQgaW5zdGVhZC4gSWZcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsIHdpbGwgZmFpbCBjb21waWxhdGlvbi4gQSBnb29kXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbHRlcm5hdGUgZmFsbGJhY2sgaXMgdGhlIGNvbXBpbGVyIGZvclxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RleHQvcGxhaW4nLCB3aGljaCBpcyBndWFyYW50ZWVkIHRvIGJlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVzZW50LlxuICAgKlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPENvbXBpbGVySG9zdD59ICBBIHJlYWQtb25seSBDb21waWxlckhvc3RcbiAgICovXG4gIHN0YXRpYyBhc3luYyBjcmVhdGVGcm9tQ29uZmlndXJhdGlvbihyb290Q2FjaGVEaXIsIGFwcFJvb3QsIGNvbXBpbGVyc0J5TWltZVR5cGUsIGZhbGxiYWNrQ29tcGlsZXI9bnVsbCkge1xuICAgIGxldCB0YXJnZXQgPSBwYXRoLmpvaW4ocm9vdENhY2hlRGlyLCAnY29tcGlsZXItaW5mby5qc29uLmd6Jyk7XG4gICAgbGV0IGJ1ZiA9IGF3YWl0IHBmcy5yZWFkRmlsZSh0YXJnZXQpO1xuICAgIGxldCBpbmZvID0gSlNPTi5wYXJzZShhd2FpdCBwemxpYi5ndW56aXAoYnVmKSk7XG5cbiAgICBsZXQgZmlsZUNoYW5nZUNhY2hlID0gRmlsZUNoYW5nZWRDYWNoZS5sb2FkRnJvbURhdGEoaW5mby5maWxlQ2hhbmdlQ2FjaGUsIGFwcFJvb3QsIGZhbHNlKTtcblxuICAgIE9iamVjdC5rZXlzKGluZm8uY29tcGlsZXJzKS5mb3JFYWNoKCh4KSA9PiB7XG4gICAgICBsZXQgY3VyID0gaW5mby5jb21waWxlcnNbeF07XG4gICAgICBjb21waWxlcnNCeU1pbWVUeXBlW3hdLmNvbXBpbGVyT3B0aW9ucyA9IGN1ci5jb21waWxlck9wdGlvbnM7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbmV3IENvbXBpbGVySG9zdChyb290Q2FjaGVEaXIsIGNvbXBpbGVyc0J5TWltZVR5cGUsIGZpbGVDaGFuZ2VDYWNoZSwgZmFsc2UsIGZhbGxiYWNrQ29tcGlsZXIpO1xuICB9XG5cblxuICAvKipcbiAgICogU2F2ZXMgdGhlIGN1cnJlbnQgY29tcGlsZXIgY29uZmlndXJhdGlvbiB0byBhIGZpbGUgdGhhdFxuICAgKiB7QGxpbmsgY3JlYXRlUmVhZG9ubHlGcm9tQ29uZmlndXJhdGlvbn0gY2FuIHVzZSB0byByZWNyZWF0ZSB0aGUgY3VycmVudFxuICAgKiBjb21waWxlciBlbnZpcm9ubWVudFxuICAgKlxuICAgKiBAcmV0dXJuIHtQcm9taXNlfSAgQ29tcGxldGlvblxuICAgKi9cbiAgYXN5bmMgc2F2ZUNvbmZpZ3VyYXRpb24oKSB7XG4gICAgbGV0IHNlcmlhbGl6ZWRDb21waWxlck9wdHMgPSBPYmplY3Qua2V5cyh0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGUpLnJlZHVjZSgoYWNjLCB4KSA9PiB7XG4gICAgICBsZXQgY29tcGlsZXIgPSB0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGVbeF07XG4gICAgICBsZXQgS2xhc3MgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YoY29tcGlsZXIpLmNvbnN0cnVjdG9yO1xuXG4gICAgICBsZXQgdmFsID0ge1xuICAgICAgICBuYW1lOiBLbGFzcy5uYW1lLFxuICAgICAgICBpbnB1dE1pbWVUeXBlczogS2xhc3MuZ2V0SW5wdXRNaW1lVHlwZXMoKSxcbiAgICAgICAgY29tcGlsZXJPcHRpb25zOiBjb21waWxlci5jb21waWxlck9wdGlvbnMsXG4gICAgICAgIGNvbXBpbGVyVmVyc2lvbjogY29tcGlsZXIuZ2V0Q29tcGlsZXJWZXJzaW9uKClcbiAgICAgIH07XG5cbiAgICAgIGFjY1t4XSA9IHZhbDtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgbGV0IGluZm8gPSB7XG4gICAgICBmaWxlQ2hhbmdlQ2FjaGU6IHRoaXMuZmlsZUNoYW5nZUNhY2hlLmdldFNhdmVkRGF0YSgpLFxuICAgICAgY29tcGlsZXJzOiBzZXJpYWxpemVkQ29tcGlsZXJPcHRzXG4gICAgfTtcblxuICAgIGxldCB0YXJnZXQgPSBwYXRoLmpvaW4odGhpcy5yb290Q2FjaGVEaXIsICdjb21waWxlci1pbmZvLmpzb24uZ3onKTtcbiAgICBsZXQgYnVmID0gYXdhaXQgcHpsaWIuZ3ppcChuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KGluZm8pKSk7XG4gICAgYXdhaXQgcGZzLndyaXRlRmlsZSh0YXJnZXQsIGJ1Zik7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGlsZXMgYSBmaWxlIGFuZCByZXR1cm5zIHRoZSBjb21waWxlZCByZXN1bHQuXG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gZmlsZVBhdGggIFRoZSBwYXRoIHRvIHRoZSBmaWxlIHRvIGNvbXBpbGVcbiAgICpcbiAgICogQHJldHVybiB7UHJvbWlzZTxvYmplY3Q+fSAgQW4gT2JqZWN0IHdpdGggdGhlIGNvbXBpbGVkIHJlc3VsdFxuICAgKlxuICAgKiBAcHJvcGVydHkge09iamVjdH0gaGFzaEluZm8gIFRoZSBoYXNoIGluZm9ybWF0aW9uIHJldHVybmVkIGZyb20gZ2V0SGFzaEZvclBhdGhcbiAgICogQHByb3BlcnR5IHtzdHJpbmd9IGNvZGUgIFRoZSBzb3VyY2UgY29kZSBpZiB0aGUgZmlsZSB3YXMgYSB0ZXh0IGZpbGVcbiAgICogQHByb3BlcnR5IHtCdWZmZXJ9IGJpbmFyeURhdGEgIFRoZSBmaWxlIGlmIGl0IHdhcyBhIGJpbmFyeSBmaWxlXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBtaW1lVHlwZSAgVGhlIE1JTUUgdHlwZSBzYXZlZCBpbiB0aGUgY2FjaGUuXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nW119IGRlcGVuZGVudEZpbGVzICBUaGUgZGVwZW5kZW50IGZpbGVzIHJldHVybmVkIGZyb21cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBpbGluZyB0aGUgZmlsZSwgaWYgYW55LlxuICAgKi9cbiAgY29tcGlsZShmaWxlUGF0aCkge1xuICAgIHJldHVybiAodGhpcy5yZWFkT25seU1vZGUgPyB0aGlzLmNvbXBpbGVSZWFkT25seShmaWxlUGF0aCkgOiB0aGlzLmZ1bGxDb21waWxlKGZpbGVQYXRoKSk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBIYW5kbGVzIGNvbXBpbGF0aW9uIGluIHJlYWQtb25seSBtb2RlXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBhc3luYyBjb21waWxlUmVhZE9ubHkoZmlsZVBhdGgpIHtcbiAgICAvLyBXZSBndWFyYW50ZWUgdGhhdCBub2RlX21vZHVsZXMgYXJlIGFsd2F5cyBzaGlwcGVkIGRpcmVjdGx5XG4gICAgbGV0IHR5cGUgPSBtaW1lVHlwZXMubG9va3VwKGZpbGVQYXRoKTtcbiAgICBpZiAoRmlsZUNoYW5nZWRDYWNoZS5pc0luTm9kZU1vZHVsZXMoZmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBtaW1lVHlwZTogdHlwZSB8fCAnYXBwbGljYXRpb24vamF2YXNjcmlwdCcsXG4gICAgICAgIGNvZGU6IGF3YWl0IHBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0ZjgnKVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBsZXQgaGFzaEluZm8gPSBhd2FpdCB0aGlzLmZpbGVDaGFuZ2VDYWNoZS5nZXRIYXNoRm9yUGF0aChmaWxlUGF0aCk7XG5cbiAgICAvLyBOQjogSGVyZSwgd2UncmUgYmFzaWNhbGx5IG9ubHkgdXNpbmcgdGhlIGNvbXBpbGVyIGhlcmUgdG8gZmluZFxuICAgIC8vIHRoZSBhcHByb3ByaWF0ZSBDb21waWxlQ2FjaGVcbiAgICBsZXQgY29tcGlsZXIgPSBDb21waWxlckhvc3Quc2hvdWxkUGFzc3Rocm91Z2goaGFzaEluZm8pID9cbiAgICAgIHRoaXMuZ2V0UGFzc3Rocm91Z2hDb21waWxlcigpIDpcbiAgICAgIHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZVt0eXBlIHx8ICdfX2xvbG5vdGhlcmUnXTtcblxuICAgIGlmICghY29tcGlsZXIpIHtcbiAgICAgIGNvbXBpbGVyID0gdGhpcy5mYWxsYmFja0NvbXBpbGVyO1xuXG4gICAgICBsZXQgeyBjb2RlLCBiaW5hcnlEYXRhLCBtaW1lVHlwZSB9ID0gYXdhaXQgY29tcGlsZXIuZ2V0KGZpbGVQYXRoKTtcbiAgICAgIHJldHVybiB7IGNvZGU6IGNvZGUgfHwgYmluYXJ5RGF0YSwgbWltZVR5cGUgfTtcbiAgICB9XG5cbiAgICBsZXQgY2FjaGUgPSB0aGlzLmNhY2hlc0ZvckNvbXBpbGVycy5nZXQoY29tcGlsZXIpO1xuICAgIGxldCB7Y29kZSwgYmluYXJ5RGF0YSwgbWltZVR5cGV9ID0gYXdhaXQgY2FjaGUuZ2V0KGZpbGVQYXRoKTtcblxuICAgIGNvZGUgPSBjb2RlIHx8IGJpbmFyeURhdGE7XG4gICAgaWYgKCFjb2RlIHx8ICFtaW1lVHlwZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc2tlZCB0byBjb21waWxlICR7ZmlsZVBhdGh9IGluIHByb2R1Y3Rpb24sIGlzIHRoaXMgZmlsZSBub3QgcHJlY29tcGlsZWQ/YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgY29kZSwgbWltZVR5cGUgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGVzIGNvbXBpbGF0aW9uIGluIHJlYWQtd3JpdGUgbW9kZVxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgZnVsbENvbXBpbGUoZmlsZVBhdGgpIHtcbiAgICBkKGBDb21waWxpbmcgJHtmaWxlUGF0aH1gKTtcblxuICAgIGxldCBoYXNoSW5mbyA9IGF3YWl0IHRoaXMuZmlsZUNoYW5nZUNhY2hlLmdldEhhc2hGb3JQYXRoKGZpbGVQYXRoKTtcbiAgICBsZXQgdHlwZSA9IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpO1xuXG4gICAgaWYgKGhhc2hJbmZvLmlzSW5Ob2RlTW9kdWxlcykge1xuICAgICAgbGV0IGNvZGUgPSBoYXNoSW5mby5zb3VyY2VDb2RlIHx8IGF3YWl0IHBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0ZjgnKTtcbiAgICAgIGNvZGUgPSBhd2FpdCBDb21waWxlckhvc3QuZml4Tm9kZU1vZHVsZXNTb3VyY2VNYXBwaW5nKGNvZGUsIGZpbGVQYXRoLCB0aGlzLmZpbGVDaGFuZ2VDYWNoZS5hcHBSb290KTtcbiAgICAgIHJldHVybiB7IGNvZGUsIG1pbWVUeXBlOiB0eXBlIH07XG4gICAgfVxuXG4gICAgbGV0IGNvbXBpbGVyID0gQ29tcGlsZXJIb3N0LnNob3VsZFBhc3N0aHJvdWdoKGhhc2hJbmZvKSA/XG4gICAgICB0aGlzLmdldFBhc3N0aHJvdWdoQ29tcGlsZXIoKSA6XG4gICAgICB0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGVbdHlwZSB8fCAnX19sb2xub3RoZXJlJ107XG5cbiAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICBkKGBGYWxsaW5nIGJhY2sgdG8gcGFzc3Rocm91Z2ggY29tcGlsZXIgZm9yICR7ZmlsZVBhdGh9YCk7XG4gICAgICBjb21waWxlciA9IHRoaXMuZmFsbGJhY2tDb21waWxlcjtcbiAgICB9XG5cbiAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IGZpbmQgYSBjb21waWxlciBmb3IgJHtmaWxlUGF0aH1gKTtcbiAgICB9XG5cbiAgICBsZXQgY2FjaGUgPSB0aGlzLmNhY2hlc0ZvckNvbXBpbGVycy5nZXQoY29tcGlsZXIpO1xuICAgIHJldHVybiBhd2FpdCBjYWNoZS5nZXRPckZldGNoKFxuICAgICAgZmlsZVBhdGgsXG4gICAgICAoZmlsZVBhdGgsIGhhc2hJbmZvKSA9PiB0aGlzLmNvbXBpbGVVbmNhY2hlZChmaWxlUGF0aCwgaGFzaEluZm8sIGNvbXBpbGVyKSk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlcyBpbnZva2luZyBjb21waWxlcnMgaW5kZXBlbmRlbnQgb2YgY2FjaGluZ1xuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgY29tcGlsZVVuY2FjaGVkKGZpbGVQYXRoLCBoYXNoSW5mbywgY29tcGlsZXIpIHtcbiAgICBsZXQgaW5wdXRNaW1lVHlwZSA9IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpO1xuXG4gICAgaWYgKGhhc2hJbmZvLmlzRmlsZUJpbmFyeSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYmluYXJ5RGF0YTogaGFzaEluZm8uYmluYXJ5RGF0YSB8fCBhd2FpdCBwZnMucmVhZEZpbGUoZmlsZVBhdGgpLFxuICAgICAgICBtaW1lVHlwZTogaW5wdXRNaW1lVHlwZSxcbiAgICAgICAgZGVwZW5kZW50RmlsZXM6IFtdXG4gICAgICB9O1xuICAgIH1cblxuICAgIGxldCBjdHggPSB7fTtcbiAgICBsZXQgY29kZSA9IGhhc2hJbmZvLnNvdXJjZUNvZGUgfHwgYXdhaXQgcGZzLnJlYWRGaWxlKGZpbGVQYXRoLCAndXRmOCcpO1xuXG4gICAgaWYgKCEoYXdhaXQgY29tcGlsZXIuc2hvdWxkQ29tcGlsZUZpbGUoY29kZSwgY3R4KSkpIHtcbiAgICAgIGQoYENvbXBpbGVyIHJldHVybmVkIGZhbHNlIGZvciBzaG91bGRDb21waWxlRmlsZTogJHtmaWxlUGF0aH1gKTtcbiAgICAgIHJldHVybiB7IGNvZGUsIG1pbWVUeXBlOiBtaW1lVHlwZXMubG9va3VwKGZpbGVQYXRoKSwgZGVwZW5kZW50RmlsZXM6IFtdIH07XG4gICAgfVxuXG4gICAgbGV0IGRlcGVuZGVudEZpbGVzID0gYXdhaXQgY29tcGlsZXIuZGV0ZXJtaW5lRGVwZW5kZW50RmlsZXMoY29kZSwgZmlsZVBhdGgsIGN0eCk7XG5cbiAgICBkKGBVc2luZyBjb21waWxlciBvcHRpb25zOiAke0pTT04uc3RyaW5naWZ5KGNvbXBpbGVyLmNvbXBpbGVyT3B0aW9ucyl9YCk7XG4gICAgbGV0IHJlc3VsdCA9IGF3YWl0IGNvbXBpbGVyLmNvbXBpbGUoY29kZSwgZmlsZVBhdGgsIGN0eCk7XG5cbiAgICBsZXQgc2hvdWxkSW5saW5lSHRtbGlmeSA9XG4gICAgICBpbnB1dE1pbWVUeXBlICE9PSAndGV4dC9odG1sJyAmJlxuICAgICAgcmVzdWx0Lm1pbWVUeXBlID09PSAndGV4dC9odG1sJztcblxuICAgIGxldCBkaWRLZWVwTWltZXR5cGUgPSBpbnB1dE1pbWVUeXBlID09PSByZXN1bHQubWltZVR5cGU7XG5cbiAgICBsZXQgaXNQYXNzdGhyb3VnaCA9XG4gICAgICByZXN1bHQubWltZVR5cGUgPT09ICd0ZXh0L3BsYWluJyB8fFxuICAgICAgIXJlc3VsdC5taW1lVHlwZSB8fFxuICAgICAgQ29tcGlsZXJIb3N0LnNob3VsZFBhc3N0aHJvdWdoKGhhc2hJbmZvKTtcblxuICAgIGlmICgoZmluYWxGb3Jtc1tyZXN1bHQubWltZVR5cGVdICYmICFzaG91bGRJbmxpbmVIdG1saWZ5KSB8fCBkaWRLZWVwTWltZXR5cGUgfHwgaXNQYXNzdGhyb3VnaCkge1xuICAgICAgLy8gR290IHNvbWV0aGluZyB3ZSBjYW4gdXNlIGluLWJyb3dzZXIsIGxldCdzIHJldHVybiBpdFxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocmVzdWx0LCB7ZGVwZW5kZW50RmlsZXN9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZChgUmVjdXJzaXZlbHkgY29tcGlsaW5nIHJlc3VsdCBvZiAke2ZpbGVQYXRofSB3aXRoIG5vbi1maW5hbCBNSU1FIHR5cGUgJHtyZXN1bHQubWltZVR5cGV9LCBpbnB1dCB3YXMgJHtpbnB1dE1pbWVUeXBlfWApO1xuXG4gICAgICBoYXNoSW5mbyA9IE9iamVjdC5hc3NpZ24oeyBzb3VyY2VDb2RlOiByZXN1bHQuY29kZSwgbWltZVR5cGU6IHJlc3VsdC5taW1lVHlwZSB9LCBoYXNoSW5mbyk7XG4gICAgICBjb21waWxlciA9IHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZVtyZXN1bHQubWltZVR5cGUgfHwgJ19fbG9sbm90aGVyZSddO1xuXG4gICAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICAgIGQoYFJlY3Vyc2l2ZSBjb21waWxlIGZhaWxlZCAtIGludGVybWVkaWF0ZSByZXN1bHQ6ICR7SlNPTi5zdHJpbmdpZnkocmVzdWx0KX1gKTtcblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBpbGluZyAke2ZpbGVQYXRofSByZXN1bHRlZCBpbiBhIE1JTUUgdHlwZSBvZiAke3Jlc3VsdC5taW1lVHlwZX0sIHdoaWNoIHdlIGRvbid0IGtub3cgaG93IHRvIGhhbmRsZWApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb21waWxlVW5jYWNoZWQoXG4gICAgICAgIGAke2ZpbGVQYXRofS4ke21pbWVUeXBlcy5leHRlbnNpb24ocmVzdWx0Lm1pbWVUeXBlIHx8ICd0eHQnKX1gLFxuICAgICAgICBoYXNoSW5mbywgY29tcGlsZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcmUtY2FjaGVzIGFuIGVudGlyZSBkaXJlY3Rvcnkgb2YgZmlsZXMgcmVjdXJzaXZlbHkuIFVzdWFsbHkgdXNlZCBmb3JcbiAgICogYnVpbGRpbmcgY3VzdG9tIGNvbXBpbGVyIHRvb2xpbmcuXG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gcm9vdERpcmVjdG9yeSAgVGhlIHRvcC1sZXZlbCBkaXJlY3RvcnkgdG8gY29tcGlsZVxuICAgKlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gc2hvdWxkQ29tcGlsZSAob3B0aW9uYWwpICBBIEZ1bmN0aW9uIHdoaWNoIGFsbG93cyB0aGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGVyIHRvIGRpc2FibGUgY29tcGlsaW5nIGNlcnRhaW4gZmlsZXMuXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEl0IHRha2VzIGEgZnVsbHktcXVhbGlmaWVkIHBhdGggdG8gYSBmaWxlLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbmQgc2hvdWxkIHJldHVybiBhIEJvb2xlYW4uXG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2V9ICBDb21wbGV0aW9uLlxuICAgKi9cbiAgYXN5bmMgY29tcGlsZUFsbChyb290RGlyZWN0b3J5LCBzaG91bGRDb21waWxlPW51bGwpIHtcbiAgICBsZXQgc2hvdWxkID0gc2hvdWxkQ29tcGlsZSB8fCBmdW5jdGlvbigpIHtyZXR1cm4gdHJ1ZTt9O1xuXG4gICAgYXdhaXQgZm9yQWxsRmlsZXMocm9vdERpcmVjdG9yeSwgKGYpID0+IHtcbiAgICAgIGlmICghc2hvdWxkKGYpKSByZXR1cm47XG5cbiAgICAgIGQoYENvbXBpbGluZyAke2Z9YCk7XG4gICAgICByZXR1cm4gdGhpcy5jb21waWxlKGYsIHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZSk7XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBTeW5jIE1ldGhvZHNcbiAgICovXG5cbiAgY29tcGlsZVN5bmMoZmlsZVBhdGgpIHtcbiAgICByZXR1cm4gKHRoaXMucmVhZE9ubHlNb2RlID8gdGhpcy5jb21waWxlUmVhZE9ubHlTeW5jKGZpbGVQYXRoKSA6IHRoaXMuZnVsbENvbXBpbGVTeW5jKGZpbGVQYXRoKSk7XG4gIH1cblxuICBzdGF0aWMgY3JlYXRlUmVhZG9ubHlGcm9tQ29uZmlndXJhdGlvblN5bmMocm9vdENhY2hlRGlyLCBhcHBSb290LCBmYWxsYmFja0NvbXBpbGVyPW51bGwpIHtcbiAgICBsZXQgdGFyZ2V0ID0gcGF0aC5qb2luKHJvb3RDYWNoZURpciwgJ2NvbXBpbGVyLWluZm8uanNvbi5neicpO1xuICAgIGxldCBidWYgPSBmcy5yZWFkRmlsZVN5bmModGFyZ2V0KTtcbiAgICBsZXQgaW5mbyA9IEpTT04ucGFyc2UoemxpYi5ndW56aXBTeW5jKGJ1ZikpO1xuXG4gICAgbGV0IGZpbGVDaGFuZ2VDYWNoZSA9IEZpbGVDaGFuZ2VkQ2FjaGUubG9hZEZyb21EYXRhKGluZm8uZmlsZUNoYW5nZUNhY2hlLCBhcHBSb290LCB0cnVlKTtcblxuICAgIGxldCBjb21waWxlcnMgPSBPYmplY3Qua2V5cyhpbmZvLmNvbXBpbGVycykucmVkdWNlKChhY2MsIHgpID0+IHtcbiAgICAgIGxldCBjdXIgPSBpbmZvLmNvbXBpbGVyc1t4XTtcbiAgICAgIGFjY1t4XSA9IG5ldyBSZWFkT25seUNvbXBpbGVyKGN1ci5uYW1lLCBjdXIuY29tcGlsZXJWZXJzaW9uLCBjdXIuY29tcGlsZXJPcHRpb25zLCBjdXIuaW5wdXRNaW1lVHlwZXMpO1xuXG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcblxuICAgIHJldHVybiBuZXcgQ29tcGlsZXJIb3N0KHJvb3RDYWNoZURpciwgY29tcGlsZXJzLCBmaWxlQ2hhbmdlQ2FjaGUsIHRydWUsIGZhbGxiYWNrQ29tcGlsZXIpO1xuICB9XG5cbiAgc3RhdGljIGNyZWF0ZUZyb21Db25maWd1cmF0aW9uU3luYyhyb290Q2FjaGVEaXIsIGFwcFJvb3QsIGNvbXBpbGVyc0J5TWltZVR5cGUsIGZhbGxiYWNrQ29tcGlsZXI9bnVsbCkge1xuICAgIGxldCB0YXJnZXQgPSBwYXRoLmpvaW4ocm9vdENhY2hlRGlyLCAnY29tcGlsZXItaW5mby5qc29uLmd6Jyk7XG4gICAgbGV0IGJ1ZiA9IGZzLnJlYWRGaWxlU3luYyh0YXJnZXQpO1xuICAgIGxldCBpbmZvID0gSlNPTi5wYXJzZSh6bGliLmd1bnppcFN5bmMoYnVmKSk7XG5cbiAgICBsZXQgZmlsZUNoYW5nZUNhY2hlID0gRmlsZUNoYW5nZWRDYWNoZS5sb2FkRnJvbURhdGEoaW5mby5maWxlQ2hhbmdlQ2FjaGUsIGFwcFJvb3QsIGZhbHNlKTtcblxuICAgIE9iamVjdC5rZXlzKGluZm8uY29tcGlsZXJzKS5mb3JFYWNoKCh4KSA9PiB7XG4gICAgICBsZXQgY3VyID0gaW5mby5jb21waWxlcnNbeF07XG4gICAgICBjb21waWxlcnNCeU1pbWVUeXBlW3hdLmNvbXBpbGVyT3B0aW9ucyA9IGN1ci5jb21waWxlck9wdGlvbnM7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbmV3IENvbXBpbGVySG9zdChyb290Q2FjaGVEaXIsIGNvbXBpbGVyc0J5TWltZVR5cGUsIGZpbGVDaGFuZ2VDYWNoZSwgZmFsc2UsIGZhbGxiYWNrQ29tcGlsZXIpO1xuICB9XG5cbiAgc2F2ZUNvbmZpZ3VyYXRpb25TeW5jKCkge1xuICAgIGxldCBzZXJpYWxpemVkQ29tcGlsZXJPcHRzID0gT2JqZWN0LmtleXModGhpcy5jb21waWxlcnNCeU1pbWVUeXBlKS5yZWR1Y2UoKGFjYywgeCkgPT4ge1xuICAgICAgbGV0IGNvbXBpbGVyID0gdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlW3hdO1xuICAgICAgbGV0IEtsYXNzID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKGNvbXBpbGVyKS5jb25zdHJ1Y3RvcjtcblxuICAgICAgbGV0IHZhbCA9IHtcbiAgICAgICAgbmFtZTogS2xhc3MubmFtZSxcbiAgICAgICAgaW5wdXRNaW1lVHlwZXM6IEtsYXNzLmdldElucHV0TWltZVR5cGVzKCksXG4gICAgICAgIGNvbXBpbGVyT3B0aW9uczogY29tcGlsZXIuY29tcGlsZXJPcHRpb25zLFxuICAgICAgICBjb21waWxlclZlcnNpb246IGNvbXBpbGVyLmdldENvbXBpbGVyVmVyc2lvbigpXG4gICAgICB9O1xuXG4gICAgICBhY2NbeF0gPSB2YWw7XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcblxuICAgIGxldCBpbmZvID0ge1xuICAgICAgZmlsZUNoYW5nZUNhY2hlOiB0aGlzLmZpbGVDaGFuZ2VDYWNoZS5nZXRTYXZlZERhdGEoKSxcbiAgICAgIGNvbXBpbGVyczogc2VyaWFsaXplZENvbXBpbGVyT3B0c1xuICAgIH07XG5cbiAgICBsZXQgdGFyZ2V0ID0gcGF0aC5qb2luKHRoaXMucm9vdENhY2hlRGlyLCAnY29tcGlsZXItaW5mby5qc29uLmd6Jyk7XG4gICAgbGV0IGJ1ZiA9IHpsaWIuZ3ppcFN5bmMobmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShpbmZvKSkpO1xuICAgIGZzLndyaXRlRmlsZVN5bmModGFyZ2V0LCBidWYpO1xuICB9XG5cbiAgY29tcGlsZVJlYWRPbmx5U3luYyhmaWxlUGF0aCkge1xuICAgIC8vIFdlIGd1YXJhbnRlZSB0aGF0IG5vZGVfbW9kdWxlcyBhcmUgYWx3YXlzIHNoaXBwZWQgZGlyZWN0bHlcbiAgICBsZXQgdHlwZSA9IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpO1xuICAgIGlmIChGaWxlQ2hhbmdlZENhY2hlLmlzSW5Ob2RlTW9kdWxlcyhmaWxlUGF0aCkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1pbWVUeXBlOiB0eXBlIHx8ICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JyxcbiAgICAgICAgY29kZTogZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmOCcpXG4gICAgICB9O1xuICAgIH1cblxuICAgIGxldCBoYXNoSW5mbyA9IHRoaXMuZmlsZUNoYW5nZUNhY2hlLmdldEhhc2hGb3JQYXRoU3luYyhmaWxlUGF0aCk7XG5cbiAgICAvLyBXZSBndWFyYW50ZWUgdGhhdCBub2RlX21vZHVsZXMgYXJlIGFsd2F5cyBzaGlwcGVkIGRpcmVjdGx5XG4gICAgaWYgKGhhc2hJbmZvLmlzSW5Ob2RlTW9kdWxlcykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWltZVR5cGU6IHR5cGUsXG4gICAgICAgIGNvZGU6IGhhc2hJbmZvLnNvdXJjZUNvZGUgfHwgZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmOCcpXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIE5COiBIZXJlLCB3ZSdyZSBiYXNpY2FsbHkgb25seSB1c2luZyB0aGUgY29tcGlsZXIgaGVyZSB0byBmaW5kXG4gICAgLy8gdGhlIGFwcHJvcHJpYXRlIENvbXBpbGVDYWNoZVxuICAgIGxldCBjb21waWxlciA9IENvbXBpbGVySG9zdC5zaG91bGRQYXNzdGhyb3VnaChoYXNoSW5mbykgP1xuICAgICAgdGhpcy5nZXRQYXNzdGhyb3VnaENvbXBpbGVyKCkgOlxuICAgICAgdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlW3R5cGUgfHwgJ19fbG9sbm90aGVyZSddO1xuXG4gICAgaWYgKCFjb21waWxlcikge1xuICAgICAgY29tcGlsZXIgPSB0aGlzLmZhbGxiYWNrQ29tcGlsZXI7XG5cbiAgICAgIGxldCB7IGNvZGUsIGJpbmFyeURhdGEsIG1pbWVUeXBlIH0gPSBjb21waWxlci5nZXRTeW5jKGZpbGVQYXRoKTtcbiAgICAgIHJldHVybiB7IGNvZGU6IGNvZGUgfHwgYmluYXJ5RGF0YSwgbWltZVR5cGUgfTtcbiAgICB9XG5cbiAgICBsZXQgY2FjaGUgPSB0aGlzLmNhY2hlc0ZvckNvbXBpbGVycy5nZXQoY29tcGlsZXIpO1xuICAgIGxldCB7Y29kZSwgYmluYXJ5RGF0YSwgbWltZVR5cGV9ID0gY2FjaGUuZ2V0U3luYyhmaWxlUGF0aCk7XG5cbiAgICBjb2RlID0gY29kZSB8fCBiaW5hcnlEYXRhO1xuICAgIGlmICghY29kZSB8fCAhbWltZVR5cGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNrZWQgdG8gY29tcGlsZSAke2ZpbGVQYXRofSBpbiBwcm9kdWN0aW9uLCBpcyB0aGlzIGZpbGUgbm90IHByZWNvbXBpbGVkP2ApO1xuICAgIH1cblxuICAgIHJldHVybiB7IGNvZGUsIG1pbWVUeXBlIH07XG4gIH1cblxuICBmdWxsQ29tcGlsZVN5bmMoZmlsZVBhdGgpIHtcbiAgICBkKGBDb21waWxpbmcgJHtmaWxlUGF0aH1gKTtcblxuICAgIGxldCBoYXNoSW5mbyA9IHRoaXMuZmlsZUNoYW5nZUNhY2hlLmdldEhhc2hGb3JQYXRoU3luYyhmaWxlUGF0aCk7XG4gICAgbGV0IHR5cGUgPSBtaW1lVHlwZXMubG9va3VwKGZpbGVQYXRoKTtcblxuICAgIGlmIChoYXNoSW5mby5pc0luTm9kZU1vZHVsZXMpIHtcbiAgICAgIGxldCBjb2RlID0gaGFzaEluZm8uc291cmNlQ29kZSB8fCBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGY4Jyk7XG4gICAgICBjb2RlID0gQ29tcGlsZXJIb3N0LmZpeE5vZGVNb2R1bGVzU291cmNlTWFwcGluZ1N5bmMoY29kZSwgZmlsZVBhdGgsIHRoaXMuZmlsZUNoYW5nZUNhY2hlLmFwcFJvb3QpO1xuICAgICAgcmV0dXJuIHsgY29kZSwgbWltZVR5cGU6IHR5cGUgfTtcbiAgICB9XG5cbiAgICBsZXQgY29tcGlsZXIgPSBDb21waWxlckhvc3Quc2hvdWxkUGFzc3Rocm91Z2goaGFzaEluZm8pID9cbiAgICAgIHRoaXMuZ2V0UGFzc3Rocm91Z2hDb21waWxlcigpIDpcbiAgICAgIHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZVt0eXBlIHx8ICdfX2xvbG5vdGhlcmUnXTtcblxuICAgIGlmICghY29tcGlsZXIpIHtcbiAgICAgIGQoYEZhbGxpbmcgYmFjayB0byBwYXNzdGhyb3VnaCBjb21waWxlciBmb3IgJHtmaWxlUGF0aH1gKTtcbiAgICAgIGNvbXBpbGVyID0gdGhpcy5mYWxsYmFja0NvbXBpbGVyO1xuICAgIH1cblxuICAgIGlmICghY29tcGlsZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBhIGNvbXBpbGVyIGZvciAke2ZpbGVQYXRofWApO1xuICAgIH1cblxuICAgIGxldCBjYWNoZSA9IHRoaXMuY2FjaGVzRm9yQ29tcGlsZXJzLmdldChjb21waWxlcik7XG4gICAgcmV0dXJuIGNhY2hlLmdldE9yRmV0Y2hTeW5jKFxuICAgICAgZmlsZVBhdGgsXG4gICAgICAoZmlsZVBhdGgsIGhhc2hJbmZvKSA9PiB0aGlzLmNvbXBpbGVVbmNhY2hlZFN5bmMoZmlsZVBhdGgsIGhhc2hJbmZvLCBjb21waWxlcikpO1xuICB9XG5cbiAgY29tcGlsZVVuY2FjaGVkU3luYyhmaWxlUGF0aCwgaGFzaEluZm8sIGNvbXBpbGVyKSB7XG4gICAgbGV0IGlucHV0TWltZVR5cGUgPSBtaW1lVHlwZXMubG9va3VwKGZpbGVQYXRoKTtcblxuICAgIGlmIChoYXNoSW5mby5pc0ZpbGVCaW5hcnkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGJpbmFyeURhdGE6IGhhc2hJbmZvLmJpbmFyeURhdGEgfHwgZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoKSxcbiAgICAgICAgbWltZVR5cGU6IGlucHV0TWltZVR5cGUsXG4gICAgICAgIGRlcGVuZGVudEZpbGVzOiBbXVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBsZXQgY3R4ID0ge307XG4gICAgbGV0IGNvZGUgPSBoYXNoSW5mby5zb3VyY2VDb2RlIHx8IGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0ZjgnKTtcblxuICAgIGlmICghKGNvbXBpbGVyLnNob3VsZENvbXBpbGVGaWxlU3luYyhjb2RlLCBjdHgpKSkge1xuICAgICAgZChgQ29tcGlsZXIgcmV0dXJuZWQgZmFsc2UgZm9yIHNob3VsZENvbXBpbGVGaWxlOiAke2ZpbGVQYXRofWApO1xuICAgICAgcmV0dXJuIHsgY29kZSwgbWltZVR5cGU6IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpLCBkZXBlbmRlbnRGaWxlczogW10gfTtcbiAgICB9XG5cbiAgICBsZXQgZGVwZW5kZW50RmlsZXMgPSBjb21waWxlci5kZXRlcm1pbmVEZXBlbmRlbnRGaWxlc1N5bmMoY29kZSwgZmlsZVBhdGgsIGN0eCk7XG5cbiAgICBsZXQgcmVzdWx0ID0gY29tcGlsZXIuY29tcGlsZVN5bmMoY29kZSwgZmlsZVBhdGgsIGN0eCk7XG5cbiAgICBsZXQgc2hvdWxkSW5saW5lSHRtbGlmeSA9XG4gICAgICBpbnB1dE1pbWVUeXBlICE9PSAndGV4dC9odG1sJyAmJlxuICAgICAgcmVzdWx0Lm1pbWVUeXBlID09PSAndGV4dC9odG1sJztcblxuICAgIGxldCBkaWRLZWVwTWltZXR5cGUgPSBpbnB1dE1pbWVUeXBlID09PSByZXN1bHQubWltZVR5cGU7XG5cbiAgICBsZXQgaXNQYXNzdGhyb3VnaCA9XG4gICAgICByZXN1bHQubWltZVR5cGUgPT09ICd0ZXh0L3BsYWluJyB8fFxuICAgICAgIXJlc3VsdC5taW1lVHlwZSB8fFxuICAgICAgQ29tcGlsZXJIb3N0LnNob3VsZFBhc3N0aHJvdWdoKGhhc2hJbmZvKTtcblxuICAgIGlmICgoZmluYWxGb3Jtc1tyZXN1bHQubWltZVR5cGVdICYmICFzaG91bGRJbmxpbmVIdG1saWZ5KSB8fCBkaWRLZWVwTWltZXR5cGUgfHwgaXNQYXNzdGhyb3VnaCkge1xuICAgICAgLy8gR290IHNvbWV0aGluZyB3ZSBjYW4gdXNlIGluLWJyb3dzZXIsIGxldCdzIHJldHVybiBpdFxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocmVzdWx0LCB7ZGVwZW5kZW50RmlsZXN9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZChgUmVjdXJzaXZlbHkgY29tcGlsaW5nIHJlc3VsdCBvZiAke2ZpbGVQYXRofSB3aXRoIG5vbi1maW5hbCBNSU1FIHR5cGUgJHtyZXN1bHQubWltZVR5cGV9LCBpbnB1dCB3YXMgJHtpbnB1dE1pbWVUeXBlfWApO1xuXG4gICAgICBoYXNoSW5mbyA9IE9iamVjdC5hc3NpZ24oeyBzb3VyY2VDb2RlOiByZXN1bHQuY29kZSwgbWltZVR5cGU6IHJlc3VsdC5taW1lVHlwZSB9LCBoYXNoSW5mbyk7XG4gICAgICBjb21waWxlciA9IHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZVtyZXN1bHQubWltZVR5cGUgfHwgJ19fbG9sbm90aGVyZSddO1xuXG4gICAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICAgIGQoYFJlY3Vyc2l2ZSBjb21waWxlIGZhaWxlZCAtIGludGVybWVkaWF0ZSByZXN1bHQ6ICR7SlNPTi5zdHJpbmdpZnkocmVzdWx0KX1gKTtcblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBpbGluZyAke2ZpbGVQYXRofSByZXN1bHRlZCBpbiBhIE1JTUUgdHlwZSBvZiAke3Jlc3VsdC5taW1lVHlwZX0sIHdoaWNoIHdlIGRvbid0IGtub3cgaG93IHRvIGhhbmRsZWApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5jb21waWxlVW5jYWNoZWRTeW5jKFxuICAgICAgICBgJHtmaWxlUGF0aH0uJHttaW1lVHlwZXMuZXh0ZW5zaW9uKHJlc3VsdC5taW1lVHlwZSB8fCAndHh0Jyl9YCxcbiAgICAgICAgaGFzaEluZm8sIGNvbXBpbGVyKTtcbiAgICB9XG4gIH1cblxuICBjb21waWxlQWxsU3luYyhyb290RGlyZWN0b3J5LCBzaG91bGRDb21waWxlPW51bGwpIHtcbiAgICBsZXQgc2hvdWxkID0gc2hvdWxkQ29tcGlsZSB8fCBmdW5jdGlvbigpIHtyZXR1cm4gdHJ1ZTt9O1xuXG4gICAgZm9yQWxsRmlsZXNTeW5jKHJvb3REaXJlY3RvcnksIChmKSA9PiB7XG4gICAgICBpZiAoIXNob3VsZChmKSkgcmV0dXJuO1xuICAgICAgcmV0dXJuIHRoaXMuY29tcGlsZVN5bmMoZiwgdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIE90aGVyIHN0dWZmXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHBhc3N0aHJvdWdoIGNvbXBpbGVyXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBnZXRQYXNzdGhyb3VnaENvbXBpbGVyKCkge1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGVbJ3RleHQvcGxhaW4nXTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgd2hldGhlciB3ZSBzaG91bGQgZXZlbiB0cnkgdG8gY29tcGlsZSB0aGUgY29udGVudC4gTm90ZSB0aGF0IGluXG4gICAqIHNvbWUgY2FzZXMsIGNvbnRlbnQgd2lsbCBzdGlsbCBiZSBpbiBjYWNoZSBldmVuIGlmIHRoaXMgcmV0dXJucyB0cnVlLCBhbmRcbiAgICogaW4gb3RoZXIgY2FzZXMgKGlzSW5Ob2RlTW9kdWxlcyksIHdlJ2xsIGtub3cgZXhwbGljaXRseSB0byBub3QgZXZlbiBib3RoZXJcbiAgICogbG9va2luZyBpbiB0aGUgY2FjaGUuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGF0aWMgc2hvdWxkUGFzc3Rocm91Z2goaGFzaEluZm8pIHtcbiAgICByZXR1cm4gaGFzaEluZm8uaXNNaW5pZmllZCB8fCBoYXNoSW5mby5pc0luTm9kZU1vZHVsZXMgfHwgaGFzaEluZm8uaGFzU291cmNlTWFwIHx8IGhhc2hJbmZvLmlzRmlsZUJpbmFyeTtcbiAgfVxuICAgIFxuICAvKipcbiAgICogTG9vayBhdCB0aGUgY29kZSBvZiBhIG5vZGUgbW9kdWxlcyBhbmQgc2VlIHRoZSBzb3VyY2VNYXBwaW5nIHBhdGguXG4gICAqIElmIHRoZXJlIGlzIGFueSwgY2hlY2sgdGhlIHBhdGggYW5kIHRyeSB0byBmaXggaXQgd2l0aCBhbmRcbiAgICogcm9vdCByZWxhdGl2ZSBwYXRoLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGZpeE5vZGVNb2R1bGVzU291cmNlTWFwcGluZyhzb3VyY2VDb2RlLCBzb3VyY2VQYXRoLCBhcHBSb290KSB7XG4gICAgbGV0IHJlZ2V4U291cmNlTWFwcGluZyA9IC9cXC9cXC8jLipzb3VyY2VNYXBwaW5nVVJMPSg/IWRhdGE6KShbXlwiJ10uKikvaTtcbiAgICBsZXQgc291cmNlTWFwcGluZ0NoZWNrID0gc291cmNlQ29kZS5tYXRjaChyZWdleFNvdXJjZU1hcHBpbmcpO1xuXG4gICAgaWYgKHNvdXJjZU1hcHBpbmdDaGVjayAmJiBzb3VyY2VNYXBwaW5nQ2hlY2tbMV0gJiYgc291cmNlTWFwcGluZ0NoZWNrWzFdICE9PSAnJyl7XG4gICAgICBsZXQgc291cmNlTWFwUGF0aCA9IHNvdXJjZU1hcHBpbmdDaGVja1sxXTtcbiAgICAgIFxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgcGZzLnN0YXQoc291cmNlTWFwUGF0aCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsZXQgbm9ybVJvb3QgPSBwYXRoLm5vcm1hbGl6ZShhcHBSb290KTtcbiAgICAgICAgbGV0IGFic1BhdGhUb01vZHVsZSA9IHBhdGguZGlybmFtZShzb3VyY2VQYXRoLnJlcGxhY2Uobm9ybVJvb3QsICcnKS5zdWJzdHJpbmcoMSkpO1xuICAgICAgICBsZXQgbmV3TWFwUGF0aCA9IHBhdGguam9pbihhYnNQYXRoVG9Nb2R1bGUsIHNvdXJjZU1hcFBhdGgpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHNvdXJjZUNvZGUucmVwbGFjZShyZWdleFNvdXJjZU1hcHBpbmcsIGAvLyMgc291cmNlTWFwcGluZ1VSTD0ke25ld01hcFBhdGh9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzb3VyY2VDb2RlO1xuICB9XG5cbiAgLyoqXG4gICAqIExvb2sgYXQgdGhlIGNvZGUgb2YgYSBub2RlIG1vZHVsZXMgYW5kIHNlZSB0aGUgc291cmNlTWFwcGluZyBwYXRoLlxuICAgKiBJZiB0aGVyZSBpcyBhbnksIGNoZWNrIHRoZSBwYXRoIGFuZCB0cnkgdG8gZml4IGl0IHdpdGggYW5kXG4gICAqIHJvb3QgcmVsYXRpdmUgcGF0aC5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIHN0YXRpYyBmaXhOb2RlTW9kdWxlc1NvdXJjZU1hcHBpbmdTeW5jKHNvdXJjZUNvZGUsIHNvdXJjZVBhdGgsIGFwcFJvb3QpIHtcbiAgICBsZXQgcmVnZXhTb3VyY2VNYXBwaW5nID0gL1xcL1xcLyMuKnNvdXJjZU1hcHBpbmdVUkw9KD8hZGF0YTopKFteXCInXS4qKS9pO1xuICAgIGxldCBzb3VyY2VNYXBwaW5nQ2hlY2sgPSBzb3VyY2VDb2RlLm1hdGNoKHJlZ2V4U291cmNlTWFwcGluZyk7XG5cbiAgICBpZiAoc291cmNlTWFwcGluZ0NoZWNrICYmIHNvdXJjZU1hcHBpbmdDaGVja1sxXSAmJiBzb3VyY2VNYXBwaW5nQ2hlY2tbMV0gIT09ICcnKXtcbiAgICAgIGxldCBzb3VyY2VNYXBQYXRoID0gc291cmNlTWFwcGluZ0NoZWNrWzFdO1xuICAgICAgXG4gICAgICB0cnkge1xuICAgICAgICBmcy5zdGF0U3luYyhzb3VyY2VNYXBQYXRoKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxldCBub3JtUm9vdCA9IHBhdGgubm9ybWFsaXplKGFwcFJvb3QpO1xuICAgICAgICBsZXQgYWJzUGF0aFRvTW9kdWxlID0gcGF0aC5kaXJuYW1lKHNvdXJjZVBhdGgucmVwbGFjZShub3JtUm9vdCwgJycpLnN1YnN0cmluZygxKSk7XG4gICAgICAgIGxldCBuZXdNYXBQYXRoID0gcGF0aC5qb2luKGFic1BhdGhUb01vZHVsZSwgc291cmNlTWFwUGF0aCk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gc291cmNlQ29kZS5yZXBsYWNlKHJlZ2V4U291cmNlTWFwcGluZywgYC8vIyBzb3VyY2VNYXBwaW5nVVJMPSR7bmV3TWFwUGF0aH1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHNvdXJjZUNvZGU7XG4gIH1cbn1cbiJdfQ==