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
        acc[x] = (0, _readOnlyCompiler2.default)(info.compilers[x]);
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
          outputMimeType: Klass.getOutputMimeType(),
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
      acc[x] = (0, _readOnlyCompiler2.default)(info.compilers[x]);
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
        outputMimeType: Klass.getOutputMimeType(),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb21waWxlci1ob3N0LmpzIl0sIm5hbWVzIjpbImQiLCJyZXF1aXJlIiwiZmluYWxGb3JtcyIsIkNvbXBpbGVySG9zdCIsImNvbnN0cnVjdG9yIiwicm9vdENhY2hlRGlyIiwiY29tcGlsZXJzIiwiZmlsZUNoYW5nZUNhY2hlIiwicmVhZE9ubHlNb2RlIiwiZmFsbGJhY2tDb21waWxlciIsImNvbXBpbGVyc0J5TWltZVR5cGUiLCJPYmplY3QiLCJhc3NpZ24iLCJhcHBSb290IiwiY2FjaGVzRm9yQ29tcGlsZXJzIiwia2V5cyIsInJlZHVjZSIsImFjYyIsIngiLCJjb21waWxlciIsImhhcyIsInNldCIsImNyZWF0ZUZyb21Db21waWxlciIsIk1hcCIsImNyZWF0ZVJlYWRvbmx5RnJvbUNvbmZpZ3VyYXRpb24iLCJ0YXJnZXQiLCJqb2luIiwiYnVmIiwicmVhZEZpbGUiLCJpbmZvIiwiSlNPTiIsInBhcnNlIiwiZ3VuemlwIiwibG9hZEZyb21EYXRhIiwiY3JlYXRlRnJvbUNvbmZpZ3VyYXRpb24iLCJmb3JFYWNoIiwiY3VyIiwiY29tcGlsZXJPcHRpb25zIiwic2F2ZUNvbmZpZ3VyYXRpb24iLCJzZXJpYWxpemVkQ29tcGlsZXJPcHRzIiwiS2xhc3MiLCJnZXRQcm90b3R5cGVPZiIsInZhbCIsIm5hbWUiLCJpbnB1dE1pbWVUeXBlcyIsImdldElucHV0TWltZVR5cGVzIiwib3V0cHV0TWltZVR5cGUiLCJnZXRPdXRwdXRNaW1lVHlwZSIsImNvbXBpbGVyVmVyc2lvbiIsImdldENvbXBpbGVyVmVyc2lvbiIsImdldFNhdmVkRGF0YSIsImd6aXAiLCJCdWZmZXIiLCJzdHJpbmdpZnkiLCJ3cml0ZUZpbGUiLCJjb21waWxlIiwiZmlsZVBhdGgiLCJjb21waWxlUmVhZE9ubHkiLCJmdWxsQ29tcGlsZSIsInR5cGUiLCJsb29rdXAiLCJpc0luTm9kZU1vZHVsZXMiLCJtaW1lVHlwZSIsImNvZGUiLCJoYXNoSW5mbyIsImdldEhhc2hGb3JQYXRoIiwic2hvdWxkUGFzc3Rocm91Z2giLCJnZXRQYXNzdGhyb3VnaENvbXBpbGVyIiwiZ2V0IiwiYmluYXJ5RGF0YSIsImNhY2hlIiwiRXJyb3IiLCJzb3VyY2VDb2RlIiwiZml4Tm9kZU1vZHVsZXNTb3VyY2VNYXBwaW5nIiwiZ2V0T3JGZXRjaCIsImNvbXBpbGVVbmNhY2hlZCIsImlucHV0TWltZVR5cGUiLCJpc0ZpbGVCaW5hcnkiLCJkZXBlbmRlbnRGaWxlcyIsImN0eCIsInNob3VsZENvbXBpbGVGaWxlIiwiZGV0ZXJtaW5lRGVwZW5kZW50RmlsZXMiLCJyZXN1bHQiLCJzaG91bGRJbmxpbmVIdG1saWZ5IiwiZGlkS2VlcE1pbWV0eXBlIiwiaXNQYXNzdGhyb3VnaCIsImV4dGVuc2lvbiIsImNvbXBpbGVBbGwiLCJyb290RGlyZWN0b3J5Iiwic2hvdWxkQ29tcGlsZSIsInNob3VsZCIsImYiLCJjb21waWxlU3luYyIsImNvbXBpbGVSZWFkT25seVN5bmMiLCJmdWxsQ29tcGlsZVN5bmMiLCJjcmVhdGVSZWFkb25seUZyb21Db25maWd1cmF0aW9uU3luYyIsInJlYWRGaWxlU3luYyIsImd1bnppcFN5bmMiLCJjcmVhdGVGcm9tQ29uZmlndXJhdGlvblN5bmMiLCJzYXZlQ29uZmlndXJhdGlvblN5bmMiLCJnemlwU3luYyIsIndyaXRlRmlsZVN5bmMiLCJnZXRIYXNoRm9yUGF0aFN5bmMiLCJnZXRTeW5jIiwiZml4Tm9kZU1vZHVsZXNTb3VyY2VNYXBwaW5nU3luYyIsImdldE9yRmV0Y2hTeW5jIiwiY29tcGlsZVVuY2FjaGVkU3luYyIsInNob3VsZENvbXBpbGVGaWxlU3luYyIsImRldGVybWluZURlcGVuZGVudEZpbGVzU3luYyIsImNvbXBpbGVBbGxTeW5jIiwiaXNNaW5pZmllZCIsImhhc1NvdXJjZU1hcCIsInNvdXJjZVBhdGgiLCJyZWdleFNvdXJjZU1hcHBpbmciLCJzb3VyY2VNYXBwaW5nQ2hlY2siLCJtYXRjaCIsInNvdXJjZU1hcFBhdGgiLCJzdGF0IiwiZXJyb3IiLCJub3JtUm9vdCIsIm5vcm1hbGl6ZSIsImFic1BhdGhUb01vZHVsZSIsImRpcm5hbWUiLCJyZXBsYWNlIiwic3Vic3RyaW5nIiwibmV3TWFwUGF0aCIsInN0YXRTeW5jIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7QUFFQTs7OztBQUNBOztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7Ozs7Ozs7QUFFQSxNQUFNQSxJQUFJQyxRQUFRLGdCQUFSLEVBQTBCLGdDQUExQixDQUFWOztBQUVBO0FBQ0EsTUFBTUMsYUFBYTtBQUNqQixxQkFBbUIsSUFERjtBQUVqQiw0QkFBMEIsSUFGVDtBQUdqQixlQUFhLElBSEk7QUFJakIsY0FBWSxJQUpLO0FBS2pCLG1CQUFpQixJQUxBO0FBTWpCLHNCQUFvQjtBQU5ILENBQW5COztBQVNBOzs7Ozs7Ozs7Ozs7OztBQWNlLE1BQU1DLFlBQU4sQ0FBbUI7QUFDaEM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBMEJBQyxjQUFZQyxZQUFaLEVBQTBCQyxTQUExQixFQUFxQ0MsZUFBckMsRUFBc0RDLFlBQXRELEVBQTZGO0FBQUEsUUFBekJDLGdCQUF5Qix1RUFBTixJQUFNOztBQUMzRixRQUFJQyxzQkFBc0JDLE9BQU9DLE1BQVAsQ0FBYyxFQUFkLEVBQWtCTixTQUFsQixDQUExQjtBQUNBSyxXQUFPQyxNQUFQLENBQWMsSUFBZCxFQUFvQixFQUFDUCxZQUFELEVBQWVLLG1CQUFmLEVBQW9DSCxlQUFwQyxFQUFxREMsWUFBckQsRUFBbUVDLGdCQUFuRSxFQUFwQjtBQUNBLFNBQUtJLE9BQUwsR0FBZSxLQUFLTixlQUFMLENBQXFCTSxPQUFwQzs7QUFFQSxTQUFLQyxrQkFBTCxHQUEwQkgsT0FBT0ksSUFBUCxDQUFZTCxtQkFBWixFQUFpQ00sTUFBakMsQ0FBd0MsQ0FBQ0MsR0FBRCxFQUFNQyxDQUFOLEtBQVk7QUFDNUUsVUFBSUMsV0FBV1Qsb0JBQW9CUSxDQUFwQixDQUFmO0FBQ0EsVUFBSUQsSUFBSUcsR0FBSixDQUFRRCxRQUFSLENBQUosRUFBdUIs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b3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHpsaWIgZnJvbSAnemxpYic7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7cGZzLCBwemxpYn0gZnJvbSAnLi9wcm9taXNlJztcblxuaW1wb3J0IG1pbWVUeXBlcyBmcm9tICcuL21pbWUtdHlwZXMnO1xuaW1wb3J0IHtmb3JBbGxGaWxlcywgZm9yQWxsRmlsZXNTeW5jfSBmcm9tICcuL2Zvci1hbGwtZmlsZXMnO1xuaW1wb3J0IENvbXBpbGVDYWNoZSBmcm9tICcuL2NvbXBpbGUtY2FjaGUnO1xuaW1wb3J0IEZpbGVDaGFuZ2VkQ2FjaGUgZnJvbSAnLi9maWxlLWNoYW5nZS1jYWNoZSc7XG5pbXBvcnQgUmVhZE9ubHlDb21waWxlckZhY3RvcnkgZnJvbSAnLi9yZWFkLW9ubHktY29tcGlsZXInO1xuXG5jb25zdCBkID0gcmVxdWlyZSgnZGVidWctZWxlY3Ryb24nKSgnZWxlY3Ryb24tY29tcGlsZTpjb21waWxlci1ob3N0Jyk7XG5cbi8vIFRoaXMgaXNuJ3QgZXZlbiBteVxuY29uc3QgZmluYWxGb3JtcyA9IHtcbiAgJ3RleHQvamF2YXNjcmlwdCc6IHRydWUsXG4gICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JzogdHJ1ZSxcbiAgJ3RleHQvaHRtbCc6IHRydWUsXG4gICd0ZXh0L2Nzcyc6IHRydWUsXG4gICdpbWFnZS9zdmcreG1sJzogdHJ1ZSxcbiAgJ2FwcGxpY2F0aW9uL2pzb24nOiB0cnVlXG59O1xuXG4vKipcbiAqIFRoaXMgY2xhc3MgaXMgdGhlIHRvcC1sZXZlbCBjbGFzcyB0aGF0IGVuY2Fwc3VsYXRlcyBhbGwgb2YgdGhlIGxvZ2ljIG9mXG4gKiBjb21waWxpbmcgYW5kIGNhY2hpbmcgYXBwbGljYXRpb24gY29kZS4gSWYgeW91J3JlIGxvb2tpbmcgZm9yIGEgXCJNYWluIGNsYXNzXCIsXG4gKiB0aGlzIGlzIGl0LlxuICpcbiAqIFRoaXMgY2xhc3MgY2FuIGJlIGNyZWF0ZWQgZGlyZWN0bHkgYnV0IGl0IGlzIHVzdWFsbHkgY3JlYXRlZCB2aWEgdGhlIG1ldGhvZHNcbiAqIGluIGNvbmZpZy1wYXJzZXIsIHdoaWNoIHdpbGwgYW1vbmcgb3RoZXIgdGhpbmdzLCBzZXQgdXAgdGhlIGNvbXBpbGVyIG9wdGlvbnNcbiAqIGdpdmVuIGEgcHJvamVjdCByb290LlxuICpcbiAqIENvbXBpbGVySG9zdCBpcyBhbHNvIHRoZSB0b3AtbGV2ZWwgY2xhc3MgdGhhdCBrbm93cyBob3cgdG8gc2VyaWFsaXplIGFsbCBvZiB0aGVcbiAqIGluZm9ybWF0aW9uIG5lY2Vzc2FyeSB0byByZWNyZWF0ZSBpdHNlbGYsIGVpdGhlciBhcyBhIGRldmVsb3BtZW50IGhvc3QgKGkuZS5cbiAqIHdpbGwgYWxsb3cgY2FjaGUgbWlzc2VzIGFuZCBhY3R1YWwgY29tcGlsYXRpb24pLCBvciBhcyBhIHJlYWQtb25seSB2ZXJzaW9uIG9mXG4gKiBpdHNlbGYgZm9yIHByb2R1Y3Rpb24uXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvbXBpbGVySG9zdCB7XG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIGluc3RhbmNlIG9mIENvbXBpbGVySG9zdC4gWW91IHByb2JhYmx5IHdhbnQgdG8gdXNlIHRoZSBtZXRob2RzXG4gICAqIGluIGNvbmZpZy1wYXJzZXIgZm9yIGRldmVsb3BtZW50LCBvciB7QGxpbmsgY3JlYXRlUmVhZG9ubHlGcm9tQ29uZmlndXJhdGlvbn1cbiAgICogZm9yIHByb2R1Y3Rpb24gaW5zdGVhZC5cbiAgICpcbiAgICogQHBhcmFtICB7c3RyaW5nfSByb290Q2FjaGVEaXIgIFRoZSByb290IGRpcmVjdG9yeSB0byB1c2UgZm9yIHRoZSBjYWNoZVxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbXBpbGVycyAgYW4gT2JqZWN0IHdob3NlIGtleXMgYXJlIGlucHV0IE1JTUUgdHlwZXMgYW5kXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aG9zZSB2YWx1ZXMgYXJlIGluc3RhbmNlcyBvZiBDb21waWxlckJhc2UuIENyZWF0ZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcyB2aWEgdGhlIHtAbGluayBjcmVhdGVDb21waWxlcnN9IG1ldGhvZCBpblxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnLXBhcnNlci5cbiAgICpcbiAgICogQHBhcmFtICB7RmlsZUNoYW5nZWRDYWNoZX0gZmlsZUNoYW5nZUNhY2hlICBBIGZpbGUtY2hhbmdlIGNhY2hlIHRoYXQgaXNcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25hbGx5IHByZS1sb2FkZWQuXG4gICAqXG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IHJlYWRPbmx5TW9kZSAgSWYgVHJ1ZSwgY2FjaGUgbWlzc2VzIHdpbGwgZmFpbCBhbmRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21waWxhdGlvbiB3aWxsIG5vdCBiZSBhdHRlbXB0ZWQuXG4gICAqXG4gICAqIEBwYXJhbSAge0NvbXBpbGVyQmFzZX0gZmFsbGJhY2tDb21waWxlciAob3B0aW9uYWwpICBXaGVuIGEgZmlsZSBpcyBjb21waWxlZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hpY2ggZG9lc24ndCBoYXZlIGEgbWF0Y2hpbmcgY29tcGlsZXIsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzIGNvbXBpbGVyIHdpbGwgYmUgdXNlZCBpbnN0ZWFkLiBJZlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCwgd2lsbCBmYWlsIGNvbXBpbGF0aW9uLiBBIGdvb2RcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsdGVybmF0ZSBmYWxsYmFjayBpcyB0aGUgY29tcGlsZXIgZm9yXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGV4dC9wbGFpbicsIHdoaWNoIGlzIGd1YXJhbnRlZWQgdG8gYmVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXNlbnQuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihyb290Q2FjaGVEaXIsIGNvbXBpbGVycywgZmlsZUNoYW5nZUNhY2hlLCByZWFkT25seU1vZGUsIGZhbGxiYWNrQ29tcGlsZXIgPSBudWxsKSB7XG4gICAgbGV0IGNvbXBpbGVyc0J5TWltZVR5cGUgPSBPYmplY3QuYXNzaWduKHt9LCBjb21waWxlcnMpO1xuICAgIE9iamVjdC5hc3NpZ24odGhpcywge3Jvb3RDYWNoZURpciwgY29tcGlsZXJzQnlNaW1lVHlwZSwgZmlsZUNoYW5nZUNhY2hlLCByZWFkT25seU1vZGUsIGZhbGxiYWNrQ29tcGlsZXJ9KTtcbiAgICB0aGlzLmFwcFJvb3QgPSB0aGlzLmZpbGVDaGFuZ2VDYWNoZS5hcHBSb290O1xuXG4gICAgdGhpcy5jYWNoZXNGb3JDb21waWxlcnMgPSBPYmplY3Qua2V5cyhjb21waWxlcnNCeU1pbWVUeXBlKS5yZWR1Y2UoKGFjYywgeCkgPT4ge1xuICAgICAgbGV0IGNvbXBpbGVyID0gY29tcGlsZXJzQnlNaW1lVHlwZVt4XTtcbiAgICAgIGlmIChhY2MuaGFzKGNvbXBpbGVyKSkgcmV0dXJuIGFjYztcblxuICAgICAgYWNjLnNldChcbiAgICAgICAgY29tcGlsZXIsXG4gICAgICAgIENvbXBpbGVDYWNoZS5jcmVhdGVGcm9tQ29tcGlsZXIocm9vdENhY2hlRGlyLCBjb21waWxlciwgZmlsZUNoYW5nZUNhY2hlLCByZWFkT25seU1vZGUpKTtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwgbmV3IE1hcCgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgcHJvZHVjdGlvbi1tb2RlIENvbXBpbGVySG9zdCBmcm9tIHRoZSBwcmV2aW91c2x5IHNhdmVkXG4gICAqIGNvbmZpZ3VyYXRpb25cbiAgICpcbiAgICogQHBhcmFtICB7c3RyaW5nfSByb290Q2FjaGVEaXIgIFRoZSByb290IGRpcmVjdG9yeSB0byB1c2UgZm9yIHRoZSBjYWNoZS4gVGhpc1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FjaGUgbXVzdCBoYXZlIGNhY2hlIGluZm9ybWF0aW9uIHNhdmVkIHZpYVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge0BsaW5rIHNhdmVDb25maWd1cmF0aW9ufVxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGFwcFJvb3QgIFRoZSB0b3AtbGV2ZWwgZGlyZWN0b3J5IGZvciB5b3VyIGFwcGxpY2F0aW9uIChpLmUuXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlIG9uZSB3aGljaCBoYXMgeW91ciBwYWNrYWdlLmpzb24pLlxuICAgKlxuICAgKiBAcGFyYW0gIHtDb21waWxlckJhc2V9IGZhbGxiYWNrQ29tcGlsZXIgKG9wdGlvbmFsKSAgV2hlbiBhIGZpbGUgaXMgY29tcGlsZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdoaWNoIGRvZXNuJ3QgaGF2ZSBhIG1hdGNoaW5nIGNvbXBpbGVyLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcyBjb21waWxlciB3aWxsIGJlIHVzZWQgaW5zdGVhZC4gSWZcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bGwsIHdpbGwgZmFpbCBjb21waWxhdGlvbi4gQSBnb29kXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbHRlcm5hdGUgZmFsbGJhY2sgaXMgdGhlIGNvbXBpbGVyIGZvclxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RleHQvcGxhaW4nLCB3aGljaCBpcyBndWFyYW50ZWVkIHRvIGJlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVzZW50LlxuICAgKlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPENvbXBpbGVySG9zdD59ICBBIHJlYWQtb25seSBDb21waWxlckhvc3RcbiAgICovXG4gIHN0YXRpYyBhc3luYyBjcmVhdGVSZWFkb25seUZyb21Db25maWd1cmF0aW9uKHJvb3RDYWNoZURpciwgYXBwUm9vdCwgZmFsbGJhY2tDb21waWxlcj1udWxsKSB7XG4gICAgbGV0IHRhcmdldCA9IHBhdGguam9pbihyb290Q2FjaGVEaXIsICdjb21waWxlci1pbmZvLmpzb24uZ3onKTtcbiAgICBsZXQgYnVmID0gYXdhaXQgcGZzLnJlYWRGaWxlKHRhcmdldCk7XG4gICAgbGV0IGluZm8gPSBKU09OLnBhcnNlKGF3YWl0IHB6bGliLmd1bnppcChidWYpKTtcblxuICAgIGxldCBmaWxlQ2hhbmdlQ2FjaGUgPSBGaWxlQ2hhbmdlZENhY2hlLmxvYWRGcm9tRGF0YShpbmZvLmZpbGVDaGFuZ2VDYWNoZSwgYXBwUm9vdCwgdHJ1ZSk7XG5cbiAgICBsZXQgY29tcGlsZXJzID0gT2JqZWN0LmtleXMoaW5mby5jb21waWxlcnMpLnJlZHVjZSgoYWNjLCB4KSA9PiB7XG4gICAgICBhY2NbeF0gPSBSZWFkT25seUNvbXBpbGVyRmFjdG9yeShpbmZvLmNvbXBpbGVyc1t4XSk7XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcblxuICAgIHJldHVybiBuZXcgQ29tcGlsZXJIb3N0KHJvb3RDYWNoZURpciwgY29tcGlsZXJzLCBmaWxlQ2hhbmdlQ2FjaGUsIHRydWUsIGZhbGxiYWNrQ29tcGlsZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBkZXZlbG9wbWVudC1tb2RlIENvbXBpbGVySG9zdCBmcm9tIHRoZSBwcmV2aW91c2x5IHNhdmVkXG4gICAqIGNvbmZpZ3VyYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gcm9vdENhY2hlRGlyICBUaGUgcm9vdCBkaXJlY3RvcnkgdG8gdXNlIGZvciB0aGUgY2FjaGUuIFRoaXNcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlIG11c3QgaGF2ZSBjYWNoZSBpbmZvcm1hdGlvbiBzYXZlZCB2aWFcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtAbGluayBzYXZlQ29uZmlndXJhdGlvbn1cbiAgICpcbiAgICogQHBhcmFtICB7c3RyaW5nfSBhcHBSb290ICBUaGUgdG9wLWxldmVsIGRpcmVjdG9yeSBmb3IgeW91ciBhcHBsaWNhdGlvbiAoaS5lLlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZSBvbmUgd2hpY2ggaGFzIHlvdXIgcGFja2FnZS5qc29uKS5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb21waWxlcnNCeU1pbWVUeXBlICBhbiBPYmplY3Qgd2hvc2Uga2V5cyBhcmUgaW5wdXQgTUlNRVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVzIGFuZCB3aG9zZSB2YWx1ZXMgYXJlIGluc3RhbmNlc1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mIENvbXBpbGVyQmFzZS4gQ3JlYXRlIHRoaXMgdmlhIHRoZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtAbGluayBjcmVhdGVDb21waWxlcnN9IG1ldGhvZCBpblxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy1wYXJzZXIuXG4gICAqXG4gICAqIEBwYXJhbSAge0NvbXBpbGVyQmFzZX0gZmFsbGJhY2tDb21waWxlciAob3B0aW9uYWwpICBXaGVuIGEgZmlsZSBpcyBjb21waWxlZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hpY2ggZG9lc24ndCBoYXZlIGEgbWF0Y2hpbmcgY29tcGlsZXIsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzIGNvbXBpbGVyIHdpbGwgYmUgdXNlZCBpbnN0ZWFkLiBJZlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCwgd2lsbCBmYWlsIGNvbXBpbGF0aW9uLiBBIGdvb2RcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsdGVybmF0ZSBmYWxsYmFjayBpcyB0aGUgY29tcGlsZXIgZm9yXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGV4dC9wbGFpbicsIHdoaWNoIGlzIGd1YXJhbnRlZWQgdG8gYmVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXNlbnQuXG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2U8Q29tcGlsZXJIb3N0Pn0gIEEgcmVhZC1vbmx5IENvbXBpbGVySG9zdFxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGNyZWF0ZUZyb21Db25maWd1cmF0aW9uKHJvb3RDYWNoZURpciwgYXBwUm9vdCwgY29tcGlsZXJzQnlNaW1lVHlwZSwgZmFsbGJhY2tDb21waWxlcj1udWxsKSB7XG4gICAgbGV0IHRhcmdldCA9IHBhdGguam9pbihyb290Q2FjaGVEaXIsICdjb21waWxlci1pbmZvLmpzb24uZ3onKTtcbiAgICBsZXQgYnVmID0gYXdhaXQgcGZzLnJlYWRGaWxlKHRhcmdldCk7XG4gICAgbGV0IGluZm8gPSBKU09OLnBhcnNlKGF3YWl0IHB6bGliLmd1bnppcChidWYpKTtcblxuICAgIGxldCBmaWxlQ2hhbmdlQ2FjaGUgPSBGaWxlQ2hhbmdlZENhY2hlLmxvYWRGcm9tRGF0YShpbmZvLmZpbGVDaGFuZ2VDYWNoZSwgYXBwUm9vdCwgZmFsc2UpO1xuXG4gICAgT2JqZWN0LmtleXMoaW5mby5jb21waWxlcnMpLmZvckVhY2goKHgpID0+IHtcbiAgICAgIGxldCBjdXIgPSBpbmZvLmNvbXBpbGVyc1t4XTtcbiAgICAgIGNvbXBpbGVyc0J5TWltZVR5cGVbeF0uY29tcGlsZXJPcHRpb25zID0gY3VyLmNvbXBpbGVyT3B0aW9ucztcbiAgICB9KTtcblxuICAgIHJldHVybiBuZXcgQ29tcGlsZXJIb3N0KHJvb3RDYWNoZURpciwgY29tcGlsZXJzQnlNaW1lVHlwZSwgZmlsZUNoYW5nZUNhY2hlLCBmYWxzZSwgZmFsbGJhY2tDb21waWxlcik7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBTYXZlcyB0aGUgY3VycmVudCBjb21waWxlciBjb25maWd1cmF0aW9uIHRvIGEgZmlsZSB0aGF0XG4gICAqIHtAbGluayBjcmVhdGVSZWFkb25seUZyb21Db25maWd1cmF0aW9ufSBjYW4gdXNlIHRvIHJlY3JlYXRlIHRoZSBjdXJyZW50XG4gICAqIGNvbXBpbGVyIGVudmlyb25tZW50XG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2V9ICBDb21wbGV0aW9uXG4gICAqL1xuICBhc3luYyBzYXZlQ29uZmlndXJhdGlvbigpIHtcbiAgICBsZXQgc2VyaWFsaXplZENvbXBpbGVyT3B0cyA9IE9iamVjdC5rZXlzKHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZSkucmVkdWNlKChhY2MsIHgpID0+IHtcbiAgICAgIGxldCBjb21waWxlciA9IHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZVt4XTtcbiAgICAgIGxldCBLbGFzcyA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihjb21waWxlcikuY29uc3RydWN0b3I7XG5cbiAgICAgIGxldCB2YWwgPSB7XG4gICAgICAgIG5hbWU6IEtsYXNzLm5hbWUsXG4gICAgICAgIGlucHV0TWltZVR5cGVzOiBLbGFzcy5nZXRJbnB1dE1pbWVUeXBlcygpLFxuICAgICAgICBvdXRwdXRNaW1lVHlwZTogS2xhc3MuZ2V0T3V0cHV0TWltZVR5cGUoKSxcbiAgICAgICAgY29tcGlsZXJPcHRpb25zOiBjb21waWxlci5jb21waWxlck9wdGlvbnMsXG4gICAgICAgIGNvbXBpbGVyVmVyc2lvbjogY29tcGlsZXIuZ2V0Q29tcGlsZXJWZXJzaW9uKClcbiAgICAgIH07XG5cbiAgICAgIGFjY1t4XSA9IHZhbDtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgbGV0IGluZm8gPSB7XG4gICAgICBmaWxlQ2hhbmdlQ2FjaGU6IHRoaXMuZmlsZUNoYW5nZUNhY2hlLmdldFNhdmVkRGF0YSgpLFxuICAgICAgY29tcGlsZXJzOiBzZXJpYWxpemVkQ29tcGlsZXJPcHRzXG4gICAgfTtcblxuICAgIGxldCB0YXJnZXQgPSBwYXRoLmpvaW4odGhpcy5yb290Q2FjaGVEaXIsICdjb21waWxlci1pbmZvLmpzb24uZ3onKTtcbiAgICBsZXQgYnVmID0gYXdhaXQgcHpsaWIuZ3ppcChuZXcgQnVmZmVyKEpTT04uc3RyaW5naWZ5KGluZm8pKSk7XG4gICAgYXdhaXQgcGZzLndyaXRlRmlsZSh0YXJnZXQsIGJ1Zik7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGlsZXMgYSBmaWxlIGFuZCByZXR1cm5zIHRoZSBjb21waWxlZCByZXN1bHQuXG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gZmlsZVBhdGggIFRoZSBwYXRoIHRvIHRoZSBmaWxlIHRvIGNvbXBpbGVcbiAgICpcbiAgICogQHJldHVybiB7UHJvbWlzZTxvYmplY3Q+fSAgQW4gT2JqZWN0IHdpdGggdGhlIGNvbXBpbGVkIHJlc3VsdFxuICAgKlxuICAgKiBAcHJvcGVydHkge09iamVjdH0gaGFzaEluZm8gIFRoZSBoYXNoIGluZm9ybWF0aW9uIHJldHVybmVkIGZyb20gZ2V0SGFzaEZvclBhdGhcbiAgICogQHByb3BlcnR5IHtzdHJpbmd9IGNvZGUgIFRoZSBzb3VyY2UgY29kZSBpZiB0aGUgZmlsZSB3YXMgYSB0ZXh0IGZpbGVcbiAgICogQHByb3BlcnR5IHtCdWZmZXJ9IGJpbmFyeURhdGEgIFRoZSBmaWxlIGlmIGl0IHdhcyBhIGJpbmFyeSBmaWxlXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBtaW1lVHlwZSAgVGhlIE1JTUUgdHlwZSBzYXZlZCBpbiB0aGUgY2FjaGUuXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nW119IGRlcGVuZGVudEZpbGVzICBUaGUgZGVwZW5kZW50IGZpbGVzIHJldHVybmVkIGZyb21cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBpbGluZyB0aGUgZmlsZSwgaWYgYW55LlxuICAgKi9cbiAgY29tcGlsZShmaWxlUGF0aCkge1xuICAgIHJldHVybiAodGhpcy5yZWFkT25seU1vZGUgPyB0aGlzLmNvbXBpbGVSZWFkT25seShmaWxlUGF0aCkgOiB0aGlzLmZ1bGxDb21waWxlKGZpbGVQYXRoKSk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBIYW5kbGVzIGNvbXBpbGF0aW9uIGluIHJlYWQtb25seSBtb2RlXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBhc3luYyBjb21waWxlUmVhZE9ubHkoZmlsZVBhdGgpIHtcbiAgICAvLyBXZSBndWFyYW50ZWUgdGhhdCBub2RlX21vZHVsZXMgYXJlIGFsd2F5cyBzaGlwcGVkIGRpcmVjdGx5XG4gICAgbGV0IHR5cGUgPSBtaW1lVHlwZXMubG9va3VwKGZpbGVQYXRoKTtcbiAgICBpZiAoRmlsZUNoYW5nZWRDYWNoZS5pc0luTm9kZU1vZHVsZXMoZmlsZVBhdGgpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBtaW1lVHlwZTogdHlwZSB8fCAnYXBwbGljYXRpb24vamF2YXNjcmlwdCcsXG4gICAgICAgIGNvZGU6IGF3YWl0IHBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0ZjgnKVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBsZXQgaGFzaEluZm8gPSBhd2FpdCB0aGlzLmZpbGVDaGFuZ2VDYWNoZS5nZXRIYXNoRm9yUGF0aChmaWxlUGF0aCk7XG5cbiAgICAvLyBOQjogSGVyZSwgd2UncmUgYmFzaWNhbGx5IG9ubHkgdXNpbmcgdGhlIGNvbXBpbGVyIGhlcmUgdG8gZmluZFxuICAgIC8vIHRoZSBhcHByb3ByaWF0ZSBDb21waWxlQ2FjaGVcbiAgICBsZXQgY29tcGlsZXIgPSBDb21waWxlckhvc3Quc2hvdWxkUGFzc3Rocm91Z2goaGFzaEluZm8pID9cbiAgICAgIHRoaXMuZ2V0UGFzc3Rocm91Z2hDb21waWxlcigpIDpcbiAgICAgIHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZVt0eXBlIHx8ICdfX2xvbG5vdGhlcmUnXTtcblxuICAgIGlmICghY29tcGlsZXIpIHtcbiAgICAgIGNvbXBpbGVyID0gdGhpcy5mYWxsYmFja0NvbXBpbGVyO1xuXG4gICAgICBsZXQgeyBjb2RlLCBiaW5hcnlEYXRhLCBtaW1lVHlwZSB9ID0gYXdhaXQgY29tcGlsZXIuZ2V0KGZpbGVQYXRoKTtcbiAgICAgIHJldHVybiB7IGNvZGU6IGNvZGUgfHwgYmluYXJ5RGF0YSwgbWltZVR5cGUgfTtcbiAgICB9XG5cbiAgICBsZXQgY2FjaGUgPSB0aGlzLmNhY2hlc0ZvckNvbXBpbGVycy5nZXQoY29tcGlsZXIpO1xuICAgIGxldCB7Y29kZSwgYmluYXJ5RGF0YSwgbWltZVR5cGV9ID0gYXdhaXQgY2FjaGUuZ2V0KGZpbGVQYXRoKTtcblxuICAgIGNvZGUgPSBjb2RlIHx8IGJpbmFyeURhdGE7XG4gICAgaWYgKCFjb2RlIHx8ICFtaW1lVHlwZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc2tlZCB0byBjb21waWxlICR7ZmlsZVBhdGh9IGluIHByb2R1Y3Rpb24sIGlzIHRoaXMgZmlsZSBub3QgcHJlY29tcGlsZWQ/YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgY29kZSwgbWltZVR5cGUgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGVzIGNvbXBpbGF0aW9uIGluIHJlYWQtd3JpdGUgbW9kZVxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgZnVsbENvbXBpbGUoZmlsZVBhdGgpIHtcbiAgICBkKGBDb21waWxpbmcgJHtmaWxlUGF0aH1gKTtcblxuICAgIGxldCBoYXNoSW5mbyA9IGF3YWl0IHRoaXMuZmlsZUNoYW5nZUNhY2hlLmdldEhhc2hGb3JQYXRoKGZpbGVQYXRoKTtcbiAgICBsZXQgdHlwZSA9IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpO1xuXG4gICAgaWYgKGhhc2hJbmZvLmlzSW5Ob2RlTW9kdWxlcykge1xuICAgICAgbGV0IGNvZGUgPSBoYXNoSW5mby5zb3VyY2VDb2RlIHx8IGF3YWl0IHBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0ZjgnKTtcbiAgICAgIGNvZGUgPSBhd2FpdCBDb21waWxlckhvc3QuZml4Tm9kZU1vZHVsZXNTb3VyY2VNYXBwaW5nKGNvZGUsIGZpbGVQYXRoLCB0aGlzLmZpbGVDaGFuZ2VDYWNoZS5hcHBSb290KTtcbiAgICAgIHJldHVybiB7IGNvZGUsIG1pbWVUeXBlOiB0eXBlIH07XG4gICAgfVxuXG4gICAgbGV0IGNvbXBpbGVyID0gQ29tcGlsZXJIb3N0LnNob3VsZFBhc3N0aHJvdWdoKGhhc2hJbmZvKSA/XG4gICAgICB0aGlzLmdldFBhc3N0aHJvdWdoQ29tcGlsZXIoKSA6XG4gICAgICB0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGVbdHlwZSB8fCAnX19sb2xub3RoZXJlJ107XG5cbiAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICBkKGBGYWxsaW5nIGJhY2sgdG8gcGFzc3Rocm91Z2ggY29tcGlsZXIgZm9yICR7ZmlsZVBhdGh9YCk7XG4gICAgICBjb21waWxlciA9IHRoaXMuZmFsbGJhY2tDb21waWxlcjtcbiAgICB9XG5cbiAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkbid0IGZpbmQgYSBjb21waWxlciBmb3IgJHtmaWxlUGF0aH1gKTtcbiAgICB9XG5cbiAgICBsZXQgY2FjaGUgPSB0aGlzLmNhY2hlc0ZvckNvbXBpbGVycy5nZXQoY29tcGlsZXIpO1xuICAgIHJldHVybiBhd2FpdCBjYWNoZS5nZXRPckZldGNoKFxuICAgICAgZmlsZVBhdGgsXG4gICAgICAoZmlsZVBhdGgsIGhhc2hJbmZvKSA9PiB0aGlzLmNvbXBpbGVVbmNhY2hlZChmaWxlUGF0aCwgaGFzaEluZm8sIGNvbXBpbGVyKSk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlcyBpbnZva2luZyBjb21waWxlcnMgaW5kZXBlbmRlbnQgb2YgY2FjaGluZ1xuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgY29tcGlsZVVuY2FjaGVkKGZpbGVQYXRoLCBoYXNoSW5mbywgY29tcGlsZXIpIHtcbiAgICBsZXQgaW5wdXRNaW1lVHlwZSA9IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpO1xuXG4gICAgaWYgKGhhc2hJbmZvLmlzRmlsZUJpbmFyeSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYmluYXJ5RGF0YTogaGFzaEluZm8uYmluYXJ5RGF0YSB8fCBhd2FpdCBwZnMucmVhZEZpbGUoZmlsZVBhdGgpLFxuICAgICAgICBtaW1lVHlwZTogaW5wdXRNaW1lVHlwZSxcbiAgICAgICAgZGVwZW5kZW50RmlsZXM6IFtdXG4gICAgICB9O1xuICAgIH1cblxuICAgIGxldCBjdHggPSB7fTtcbiAgICBsZXQgY29kZSA9IGhhc2hJbmZvLnNvdXJjZUNvZGUgfHwgYXdhaXQgcGZzLnJlYWRGaWxlKGZpbGVQYXRoLCAndXRmOCcpO1xuXG4gICAgaWYgKCEoYXdhaXQgY29tcGlsZXIuc2hvdWxkQ29tcGlsZUZpbGUoY29kZSwgY3R4KSkpIHtcbiAgICAgIGQoYENvbXBpbGVyIHJldHVybmVkIGZhbHNlIGZvciBzaG91bGRDb21waWxlRmlsZTogJHtmaWxlUGF0aH1gKTtcbiAgICAgIHJldHVybiB7IGNvZGUsIG1pbWVUeXBlOiBtaW1lVHlwZXMubG9va3VwKGZpbGVQYXRoKSwgZGVwZW5kZW50RmlsZXM6IFtdIH07XG4gICAgfVxuXG4gICAgbGV0IGRlcGVuZGVudEZpbGVzID0gYXdhaXQgY29tcGlsZXIuZGV0ZXJtaW5lRGVwZW5kZW50RmlsZXMoY29kZSwgZmlsZVBhdGgsIGN0eCk7XG5cbiAgICBkKGBVc2luZyBjb21waWxlciBvcHRpb25zOiAke0pTT04uc3RyaW5naWZ5KGNvbXBpbGVyLmNvbXBpbGVyT3B0aW9ucyl9YCk7XG4gICAgbGV0IHJlc3VsdCA9IGF3YWl0IGNvbXBpbGVyLmNvbXBpbGUoY29kZSwgZmlsZVBhdGgsIGN0eCk7XG5cbiAgICBsZXQgc2hvdWxkSW5saW5lSHRtbGlmeSA9XG4gICAgICBpbnB1dE1pbWVUeXBlICE9PSAndGV4dC9odG1sJyAmJlxuICAgICAgcmVzdWx0Lm1pbWVUeXBlID09PSAndGV4dC9odG1sJztcblxuICAgIGxldCBkaWRLZWVwTWltZXR5cGUgPSBpbnB1dE1pbWVUeXBlID09PSByZXN1bHQubWltZVR5cGU7XG5cbiAgICBsZXQgaXNQYXNzdGhyb3VnaCA9XG4gICAgICByZXN1bHQubWltZVR5cGUgPT09ICd0ZXh0L3BsYWluJyB8fFxuICAgICAgIXJlc3VsdC5taW1lVHlwZSB8fFxuICAgICAgQ29tcGlsZXJIb3N0LnNob3VsZFBhc3N0aHJvdWdoKGhhc2hJbmZvKTtcblxuICAgIGlmICgoZmluYWxGb3Jtc1tyZXN1bHQubWltZVR5cGVdICYmICFzaG91bGRJbmxpbmVIdG1saWZ5KSB8fCBkaWRLZWVwTWltZXR5cGUgfHwgaXNQYXNzdGhyb3VnaCkge1xuICAgICAgLy8gR290IHNvbWV0aGluZyB3ZSBjYW4gdXNlIGluLWJyb3dzZXIsIGxldCdzIHJldHVybiBpdFxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocmVzdWx0LCB7ZGVwZW5kZW50RmlsZXN9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZChgUmVjdXJzaXZlbHkgY29tcGlsaW5nIHJlc3VsdCBvZiAke2ZpbGVQYXRofSB3aXRoIG5vbi1maW5hbCBNSU1FIHR5cGUgJHtyZXN1bHQubWltZVR5cGV9LCBpbnB1dCB3YXMgJHtpbnB1dE1pbWVUeXBlfWApO1xuXG4gICAgICBoYXNoSW5mbyA9IE9iamVjdC5hc3NpZ24oeyBzb3VyY2VDb2RlOiByZXN1bHQuY29kZSwgbWltZVR5cGU6IHJlc3VsdC5taW1lVHlwZSB9LCBoYXNoSW5mbyk7XG4gICAgICBjb21waWxlciA9IHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZVtyZXN1bHQubWltZVR5cGUgfHwgJ19fbG9sbm90aGVyZSddO1xuXG4gICAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICAgIGQoYFJlY3Vyc2l2ZSBjb21waWxlIGZhaWxlZCAtIGludGVybWVkaWF0ZSByZXN1bHQ6ICR7SlNPTi5zdHJpbmdpZnkocmVzdWx0KX1gKTtcblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBpbGluZyAke2ZpbGVQYXRofSByZXN1bHRlZCBpbiBhIE1JTUUgdHlwZSBvZiAke3Jlc3VsdC5taW1lVHlwZX0sIHdoaWNoIHdlIGRvbid0IGtub3cgaG93IHRvIGhhbmRsZWApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5jb21waWxlVW5jYWNoZWQoXG4gICAgICAgIGAke2ZpbGVQYXRofS4ke21pbWVUeXBlcy5leHRlbnNpb24ocmVzdWx0Lm1pbWVUeXBlIHx8ICd0eHQnKX1gLFxuICAgICAgICBoYXNoSW5mbywgY29tcGlsZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcmUtY2FjaGVzIGFuIGVudGlyZSBkaXJlY3Rvcnkgb2YgZmlsZXMgcmVjdXJzaXZlbHkuIFVzdWFsbHkgdXNlZCBmb3JcbiAgICogYnVpbGRpbmcgY3VzdG9tIGNvbXBpbGVyIHRvb2xpbmcuXG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gcm9vdERpcmVjdG9yeSAgVGhlIHRvcC1sZXZlbCBkaXJlY3RvcnkgdG8gY29tcGlsZVxuICAgKlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gc2hvdWxkQ29tcGlsZSAob3B0aW9uYWwpICBBIEZ1bmN0aW9uIHdoaWNoIGFsbG93cyB0aGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGVyIHRvIGRpc2FibGUgY29tcGlsaW5nIGNlcnRhaW4gZmlsZXMuXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEl0IHRha2VzIGEgZnVsbHktcXVhbGlmaWVkIHBhdGggdG8gYSBmaWxlLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbmQgc2hvdWxkIHJldHVybiBhIEJvb2xlYW4uXG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2V9ICBDb21wbGV0aW9uLlxuICAgKi9cbiAgYXN5bmMgY29tcGlsZUFsbChyb290RGlyZWN0b3J5LCBzaG91bGRDb21waWxlPW51bGwpIHtcbiAgICBsZXQgc2hvdWxkID0gc2hvdWxkQ29tcGlsZSB8fCBmdW5jdGlvbigpIHtyZXR1cm4gdHJ1ZTt9O1xuXG4gICAgYXdhaXQgZm9yQWxsRmlsZXMocm9vdERpcmVjdG9yeSwgKGYpID0+IHtcbiAgICAgIGlmICghc2hvdWxkKGYpKSByZXR1cm47XG5cbiAgICAgIGQoYENvbXBpbGluZyAke2Z9YCk7XG4gICAgICByZXR1cm4gdGhpcy5jb21waWxlKGYsIHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZSk7XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBTeW5jIE1ldGhvZHNcbiAgICovXG5cbiAgY29tcGlsZVN5bmMoZmlsZVBhdGgpIHtcbiAgICByZXR1cm4gKHRoaXMucmVhZE9ubHlNb2RlID8gdGhpcy5jb21waWxlUmVhZE9ubHlTeW5jKGZpbGVQYXRoKSA6IHRoaXMuZnVsbENvbXBpbGVTeW5jKGZpbGVQYXRoKSk7XG4gIH1cblxuICBzdGF0aWMgY3JlYXRlUmVhZG9ubHlGcm9tQ29uZmlndXJhdGlvblN5bmMocm9vdENhY2hlRGlyLCBhcHBSb290LCBmYWxsYmFja0NvbXBpbGVyPW51bGwpIHtcbiAgICBsZXQgdGFyZ2V0ID0gcGF0aC5qb2luKHJvb3RDYWNoZURpciwgJ2NvbXBpbGVyLWluZm8uanNvbi5neicpO1xuICAgIGxldCBidWYgPSBmcy5yZWFkRmlsZVN5bmModGFyZ2V0KTtcbiAgICBsZXQgaW5mbyA9IEpTT04ucGFyc2UoemxpYi5ndW56aXBTeW5jKGJ1ZikpO1xuXG4gICAgbGV0IGZpbGVDaGFuZ2VDYWNoZSA9IEZpbGVDaGFuZ2VkQ2FjaGUubG9hZEZyb21EYXRhKGluZm8uZmlsZUNoYW5nZUNhY2hlLCBhcHBSb290LCB0cnVlKTtcblxuICAgIGxldCBjb21waWxlcnMgPSBPYmplY3Qua2V5cyhpbmZvLmNvbXBpbGVycykucmVkdWNlKChhY2MsIHgpID0+IHtcbiAgICAgIGFjY1t4XSA9IFJlYWRPbmx5Q29tcGlsZXJGYWN0b3J5KGluZm8uY29tcGlsZXJzW3hdKTtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgcmV0dXJuIG5ldyBDb21waWxlckhvc3Qocm9vdENhY2hlRGlyLCBjb21waWxlcnMsIGZpbGVDaGFuZ2VDYWNoZSwgdHJ1ZSwgZmFsbGJhY2tDb21waWxlcik7XG4gIH1cblxuICBzdGF0aWMgY3JlYXRlRnJvbUNvbmZpZ3VyYXRpb25TeW5jKHJvb3RDYWNoZURpciwgYXBwUm9vdCwgY29tcGlsZXJzQnlNaW1lVHlwZSwgZmFsbGJhY2tDb21waWxlcj1udWxsKSB7XG4gICAgbGV0IHRhcmdldCA9IHBhdGguam9pbihyb290Q2FjaGVEaXIsICdjb21waWxlci1pbmZvLmpzb24uZ3onKTtcbiAgICBsZXQgYnVmID0gZnMucmVhZEZpbGVTeW5jKHRhcmdldCk7XG4gICAgbGV0IGluZm8gPSBKU09OLnBhcnNlKHpsaWIuZ3VuemlwU3luYyhidWYpKTtcblxuICAgIGxldCBmaWxlQ2hhbmdlQ2FjaGUgPSBGaWxlQ2hhbmdlZENhY2hlLmxvYWRGcm9tRGF0YShpbmZvLmZpbGVDaGFuZ2VDYWNoZSwgYXBwUm9vdCwgZmFsc2UpO1xuXG4gICAgT2JqZWN0LmtleXMoaW5mby5jb21waWxlcnMpLmZvckVhY2goKHgpID0+IHtcbiAgICAgIGxldCBjdXIgPSBpbmZvLmNvbXBpbGVyc1t4XTtcbiAgICAgIGNvbXBpbGVyc0J5TWltZVR5cGVbeF0uY29tcGlsZXJPcHRpb25zID0gY3VyLmNvbXBpbGVyT3B0aW9ucztcbiAgICB9KTtcblxuICAgIHJldHVybiBuZXcgQ29tcGlsZXJIb3N0KHJvb3RDYWNoZURpciwgY29tcGlsZXJzQnlNaW1lVHlwZSwgZmlsZUNoYW5nZUNhY2hlLCBmYWxzZSwgZmFsbGJhY2tDb21waWxlcik7XG4gIH1cblxuICBzYXZlQ29uZmlndXJhdGlvblN5bmMoKSB7XG4gICAgbGV0IHNlcmlhbGl6ZWRDb21waWxlck9wdHMgPSBPYmplY3Qua2V5cyh0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGUpLnJlZHVjZSgoYWNjLCB4KSA9PiB7XG4gICAgICBsZXQgY29tcGlsZXIgPSB0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGVbeF07XG4gICAgICBsZXQgS2xhc3MgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YoY29tcGlsZXIpLmNvbnN0cnVjdG9yO1xuXG4gICAgICBsZXQgdmFsID0ge1xuICAgICAgICBuYW1lOiBLbGFzcy5uYW1lLFxuICAgICAgICBpbnB1dE1pbWVUeXBlczogS2xhc3MuZ2V0SW5wdXRNaW1lVHlwZXMoKSxcbiAgICAgICAgb3V0cHV0TWltZVR5cGU6IEtsYXNzLmdldE91dHB1dE1pbWVUeXBlKCksXG4gICAgICAgIGNvbXBpbGVyT3B0aW9uczogY29tcGlsZXIuY29tcGlsZXJPcHRpb25zLFxuICAgICAgICBjb21waWxlclZlcnNpb246IGNvbXBpbGVyLmdldENvbXBpbGVyVmVyc2lvbigpXG4gICAgICB9O1xuXG4gICAgICBhY2NbeF0gPSB2YWw7XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcblxuICAgIGxldCBpbmZvID0ge1xuICAgICAgZmlsZUNoYW5nZUNhY2hlOiB0aGlzLmZpbGVDaGFuZ2VDYWNoZS5nZXRTYXZlZERhdGEoKSxcbiAgICAgIGNvbXBpbGVyczogc2VyaWFsaXplZENvbXBpbGVyT3B0c1xuICAgIH07XG5cbiAgICBsZXQgdGFyZ2V0ID0gcGF0aC5qb2luKHRoaXMucm9vdENhY2hlRGlyLCAnY29tcGlsZXItaW5mby5qc29uLmd6Jyk7XG4gICAgbGV0IGJ1ZiA9IHpsaWIuZ3ppcFN5bmMobmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeShpbmZvKSkpO1xuICAgIGZzLndyaXRlRmlsZVN5bmModGFyZ2V0LCBidWYpO1xuICB9XG5cbiAgY29tcGlsZVJlYWRPbmx5U3luYyhmaWxlUGF0aCkge1xuICAgIC8vIFdlIGd1YXJhbnRlZSB0aGF0IG5vZGVfbW9kdWxlcyBhcmUgYWx3YXlzIHNoaXBwZWQgZGlyZWN0bHlcbiAgICBsZXQgdHlwZSA9IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpO1xuICAgIGlmIChGaWxlQ2hhbmdlZENhY2hlLmlzSW5Ob2RlTW9kdWxlcyhmaWxlUGF0aCkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1pbWVUeXBlOiB0eXBlIHx8ICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JyxcbiAgICAgICAgY29kZTogZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmOCcpXG4gICAgICB9O1xuICAgIH1cblxuICAgIGxldCBoYXNoSW5mbyA9IHRoaXMuZmlsZUNoYW5nZUNhY2hlLmdldEhhc2hGb3JQYXRoU3luYyhmaWxlUGF0aCk7XG5cbiAgICAvLyBXZSBndWFyYW50ZWUgdGhhdCBub2RlX21vZHVsZXMgYXJlIGFsd2F5cyBzaGlwcGVkIGRpcmVjdGx5XG4gICAgaWYgKGhhc2hJbmZvLmlzSW5Ob2RlTW9kdWxlcykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWltZVR5cGU6IHR5cGUsXG4gICAgICAgIGNvZGU6IGhhc2hJbmZvLnNvdXJjZUNvZGUgfHwgZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmOCcpXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIE5COiBIZXJlLCB3ZSdyZSBiYXNpY2FsbHkgb25seSB1c2luZyB0aGUgY29tcGlsZXIgaGVyZSB0byBmaW5kXG4gICAgLy8gdGhlIGFwcHJvcHJpYXRlIENvbXBpbGVDYWNoZVxuICAgIGxldCBjb21waWxlciA9IENvbXBpbGVySG9zdC5zaG91bGRQYXNzdGhyb3VnaChoYXNoSW5mbykgP1xuICAgICAgdGhpcy5nZXRQYXNzdGhyb3VnaENvbXBpbGVyKCkgOlxuICAgICAgdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlW3R5cGUgfHwgJ19fbG9sbm90aGVyZSddO1xuXG4gICAgaWYgKCFjb21waWxlcikge1xuICAgICAgY29tcGlsZXIgPSB0aGlzLmZhbGxiYWNrQ29tcGlsZXI7XG5cbiAgICAgIGxldCB7IGNvZGUsIGJpbmFyeURhdGEsIG1pbWVUeXBlIH0gPSBjb21waWxlci5nZXRTeW5jKGZpbGVQYXRoKTtcbiAgICAgIHJldHVybiB7IGNvZGU6IGNvZGUgfHwgYmluYXJ5RGF0YSwgbWltZVR5cGUgfTtcbiAgICB9XG5cbiAgICBsZXQgY2FjaGUgPSB0aGlzLmNhY2hlc0ZvckNvbXBpbGVycy5nZXQoY29tcGlsZXIpO1xuICAgIGxldCB7Y29kZSwgYmluYXJ5RGF0YSwgbWltZVR5cGV9ID0gY2FjaGUuZ2V0U3luYyhmaWxlUGF0aCk7XG5cbiAgICBjb2RlID0gY29kZSB8fCBiaW5hcnlEYXRhO1xuICAgIGlmICghY29kZSB8fCAhbWltZVR5cGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNrZWQgdG8gY29tcGlsZSAke2ZpbGVQYXRofSBpbiBwcm9kdWN0aW9uLCBpcyB0aGlzIGZpbGUgbm90IHByZWNvbXBpbGVkP2ApO1xuICAgIH1cblxuICAgIHJldHVybiB7IGNvZGUsIG1pbWVUeXBlIH07XG4gIH1cblxuICBmdWxsQ29tcGlsZVN5bmMoZmlsZVBhdGgpIHtcbiAgICBkKGBDb21waWxpbmcgJHtmaWxlUGF0aH1gKTtcblxuICAgIGxldCBoYXNoSW5mbyA9IHRoaXMuZmlsZUNoYW5nZUNhY2hlLmdldEhhc2hGb3JQYXRoU3luYyhmaWxlUGF0aCk7XG4gICAgbGV0IHR5cGUgPSBtaW1lVHlwZXMubG9va3VwKGZpbGVQYXRoKTtcblxuICAgIGlmIChoYXNoSW5mby5pc0luTm9kZU1vZHVsZXMpIHtcbiAgICAgIGxldCBjb2RlID0gaGFzaEluZm8uc291cmNlQ29kZSB8fCBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGY4Jyk7XG4gICAgICBjb2RlID0gQ29tcGlsZXJIb3N0LmZpeE5vZGVNb2R1bGVzU291cmNlTWFwcGluZ1N5bmMoY29kZSwgZmlsZVBhdGgsIHRoaXMuZmlsZUNoYW5nZUNhY2hlLmFwcFJvb3QpO1xuICAgICAgcmV0dXJuIHsgY29kZSwgbWltZVR5cGU6IHR5cGUgfTtcbiAgICB9XG5cbiAgICBsZXQgY29tcGlsZXIgPSBDb21waWxlckhvc3Quc2hvdWxkUGFzc3Rocm91Z2goaGFzaEluZm8pID9cbiAgICAgIHRoaXMuZ2V0UGFzc3Rocm91Z2hDb21waWxlcigpIDpcbiAgICAgIHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZVt0eXBlIHx8ICdfX2xvbG5vdGhlcmUnXTtcblxuICAgIGlmICghY29tcGlsZXIpIHtcbiAgICAgIGQoYEZhbGxpbmcgYmFjayB0byBwYXNzdGhyb3VnaCBjb21waWxlciBmb3IgJHtmaWxlUGF0aH1gKTtcbiAgICAgIGNvbXBpbGVyID0gdGhpcy5mYWxsYmFja0NvbXBpbGVyO1xuICAgIH1cblxuICAgIGlmICghY29tcGlsZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGRuJ3QgZmluZCBhIGNvbXBpbGVyIGZvciAke2ZpbGVQYXRofWApO1xuICAgIH1cblxuICAgIGxldCBjYWNoZSA9IHRoaXMuY2FjaGVzRm9yQ29tcGlsZXJzLmdldChjb21waWxlcik7XG4gICAgcmV0dXJuIGNhY2hlLmdldE9yRmV0Y2hTeW5jKFxuICAgICAgZmlsZVBhdGgsXG4gICAgICAoZmlsZVBhdGgsIGhhc2hJbmZvKSA9PiB0aGlzLmNvbXBpbGVVbmNhY2hlZFN5bmMoZmlsZVBhdGgsIGhhc2hJbmZvLCBjb21waWxlcikpO1xuICB9XG5cbiAgY29tcGlsZVVuY2FjaGVkU3luYyhmaWxlUGF0aCwgaGFzaEluZm8sIGNvbXBpbGVyKSB7XG4gICAgbGV0IGlucHV0TWltZVR5cGUgPSBtaW1lVHlwZXMubG9va3VwKGZpbGVQYXRoKTtcblxuICAgIGlmIChoYXNoSW5mby5pc0ZpbGVCaW5hcnkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGJpbmFyeURhdGE6IGhhc2hJbmZvLmJpbmFyeURhdGEgfHwgZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoKSxcbiAgICAgICAgbWltZVR5cGU6IGlucHV0TWltZVR5cGUsXG4gICAgICAgIGRlcGVuZGVudEZpbGVzOiBbXVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBsZXQgY3R4ID0ge307XG4gICAgbGV0IGNvZGUgPSBoYXNoSW5mby5zb3VyY2VDb2RlIHx8IGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0ZjgnKTtcblxuICAgIGlmICghKGNvbXBpbGVyLnNob3VsZENvbXBpbGVGaWxlU3luYyhjb2RlLCBjdHgpKSkge1xuICAgICAgZChgQ29tcGlsZXIgcmV0dXJuZWQgZmFsc2UgZm9yIHNob3VsZENvbXBpbGVGaWxlOiAke2ZpbGVQYXRofWApO1xuICAgICAgcmV0dXJuIHsgY29kZSwgbWltZVR5cGU6IG1pbWVUeXBlcy5sb29rdXAoZmlsZVBhdGgpLCBkZXBlbmRlbnRGaWxlczogW10gfTtcbiAgICB9XG5cbiAgICBsZXQgZGVwZW5kZW50RmlsZXMgPSBjb21waWxlci5kZXRlcm1pbmVEZXBlbmRlbnRGaWxlc1N5bmMoY29kZSwgZmlsZVBhdGgsIGN0eCk7XG5cbiAgICBsZXQgcmVzdWx0ID0gY29tcGlsZXIuY29tcGlsZVN5bmMoY29kZSwgZmlsZVBhdGgsIGN0eCk7XG5cbiAgICBsZXQgc2hvdWxkSW5saW5lSHRtbGlmeSA9XG4gICAgICBpbnB1dE1pbWVUeXBlICE9PSAndGV4dC9odG1sJyAmJlxuICAgICAgcmVzdWx0Lm1pbWVUeXBlID09PSAndGV4dC9odG1sJztcblxuICAgIGxldCBkaWRLZWVwTWltZXR5cGUgPSBpbnB1dE1pbWVUeXBlID09PSByZXN1bHQubWltZVR5cGU7XG5cbiAgICBsZXQgaXNQYXNzdGhyb3VnaCA9XG4gICAgICByZXN1bHQubWltZVR5cGUgPT09ICd0ZXh0L3BsYWluJyB8fFxuICAgICAgIXJlc3VsdC5taW1lVHlwZSB8fFxuICAgICAgQ29tcGlsZXJIb3N0LnNob3VsZFBhc3N0aHJvdWdoKGhhc2hJbmZvKTtcblxuICAgIGlmICgoZmluYWxGb3Jtc1tyZXN1bHQubWltZVR5cGVdICYmICFzaG91bGRJbmxpbmVIdG1saWZ5KSB8fCBkaWRLZWVwTWltZXR5cGUgfHwgaXNQYXNzdGhyb3VnaCkge1xuICAgICAgLy8gR290IHNvbWV0aGluZyB3ZSBjYW4gdXNlIGluLWJyb3dzZXIsIGxldCdzIHJldHVybiBpdFxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocmVzdWx0LCB7ZGVwZW5kZW50RmlsZXN9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZChgUmVjdXJzaXZlbHkgY29tcGlsaW5nIHJlc3VsdCBvZiAke2ZpbGVQYXRofSB3aXRoIG5vbi1maW5hbCBNSU1FIHR5cGUgJHtyZXN1bHQubWltZVR5cGV9LCBpbnB1dCB3YXMgJHtpbnB1dE1pbWVUeXBlfWApO1xuXG4gICAgICBoYXNoSW5mbyA9IE9iamVjdC5hc3NpZ24oeyBzb3VyY2VDb2RlOiByZXN1bHQuY29kZSwgbWltZVR5cGU6IHJlc3VsdC5taW1lVHlwZSB9LCBoYXNoSW5mbyk7XG4gICAgICBjb21waWxlciA9IHRoaXMuY29tcGlsZXJzQnlNaW1lVHlwZVtyZXN1bHQubWltZVR5cGUgfHwgJ19fbG9sbm90aGVyZSddO1xuXG4gICAgICBpZiAoIWNvbXBpbGVyKSB7XG4gICAgICAgIGQoYFJlY3Vyc2l2ZSBjb21waWxlIGZhaWxlZCAtIGludGVybWVkaWF0ZSByZXN1bHQ6ICR7SlNPTi5zdHJpbmdpZnkocmVzdWx0KX1gKTtcblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBpbGluZyAke2ZpbGVQYXRofSByZXN1bHRlZCBpbiBhIE1JTUUgdHlwZSBvZiAke3Jlc3VsdC5taW1lVHlwZX0sIHdoaWNoIHdlIGRvbid0IGtub3cgaG93IHRvIGhhbmRsZWApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5jb21waWxlVW5jYWNoZWRTeW5jKFxuICAgICAgICBgJHtmaWxlUGF0aH0uJHttaW1lVHlwZXMuZXh0ZW5zaW9uKHJlc3VsdC5taW1lVHlwZSB8fCAndHh0Jyl9YCxcbiAgICAgICAgaGFzaEluZm8sIGNvbXBpbGVyKTtcbiAgICB9XG4gIH1cblxuICBjb21waWxlQWxsU3luYyhyb290RGlyZWN0b3J5LCBzaG91bGRDb21waWxlPW51bGwpIHtcbiAgICBsZXQgc2hvdWxkID0gc2hvdWxkQ29tcGlsZSB8fCBmdW5jdGlvbigpIHtyZXR1cm4gdHJ1ZTt9O1xuXG4gICAgZm9yQWxsRmlsZXNTeW5jKHJvb3REaXJlY3RvcnksIChmKSA9PiB7XG4gICAgICBpZiAoIXNob3VsZChmKSkgcmV0dXJuO1xuICAgICAgcmV0dXJuIHRoaXMuY29tcGlsZVN5bmMoZiwgdGhpcy5jb21waWxlcnNCeU1pbWVUeXBlKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIE90aGVyIHN0dWZmXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHBhc3N0aHJvdWdoIGNvbXBpbGVyXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBnZXRQYXNzdGhyb3VnaENvbXBpbGVyKCkge1xuICAgIHJldHVybiB0aGlzLmNvbXBpbGVyc0J5TWltZVR5cGVbJ3RleHQvcGxhaW4nXTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgd2hldGhlciB3ZSBzaG91bGQgZXZlbiB0cnkgdG8gY29tcGlsZSB0aGUgY29udGVudC4gTm90ZSB0aGF0IGluXG4gICAqIHNvbWUgY2FzZXMsIGNvbnRlbnQgd2lsbCBzdGlsbCBiZSBpbiBjYWNoZSBldmVuIGlmIHRoaXMgcmV0dXJucyB0cnVlLCBhbmRcbiAgICogaW4gb3RoZXIgY2FzZXMgKGlzSW5Ob2RlTW9kdWxlcyksIHdlJ2xsIGtub3cgZXhwbGljaXRseSB0byBub3QgZXZlbiBib3RoZXJcbiAgICogbG9va2luZyBpbiB0aGUgY2FjaGUuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGF0aWMgc2hvdWxkUGFzc3Rocm91Z2goaGFzaEluZm8pIHtcbiAgICByZXR1cm4gaGFzaEluZm8uaXNNaW5pZmllZCB8fCBoYXNoSW5mby5pc0luTm9kZU1vZHVsZXMgfHwgaGFzaEluZm8uaGFzU291cmNlTWFwIHx8IGhhc2hJbmZvLmlzRmlsZUJpbmFyeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb29rIGF0IHRoZSBjb2RlIG9mIGEgbm9kZSBtb2R1bGVzIGFuZCBzZWUgdGhlIHNvdXJjZU1hcHBpbmcgcGF0aC5cbiAgICogSWYgdGhlcmUgaXMgYW55LCBjaGVjayB0aGUgcGF0aCBhbmQgdHJ5IHRvIGZpeCBpdCB3aXRoIGFuZFxuICAgKiByb290IHJlbGF0aXZlIHBhdGguXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgZml4Tm9kZU1vZHVsZXNTb3VyY2VNYXBwaW5nKHNvdXJjZUNvZGUsIHNvdXJjZVBhdGgsIGFwcFJvb3QpIHtcbiAgICBsZXQgcmVnZXhTb3VyY2VNYXBwaW5nID0gL1xcL1xcLyMuKnNvdXJjZU1hcHBpbmdVUkw9KD8hZGF0YTopKFteXCInXS4qKS9pO1xuICAgIGxldCBzb3VyY2VNYXBwaW5nQ2hlY2sgPSBzb3VyY2VDb2RlLm1hdGNoKHJlZ2V4U291cmNlTWFwcGluZyk7XG5cbiAgICBpZiAoc291cmNlTWFwcGluZ0NoZWNrICYmIHNvdXJjZU1hcHBpbmdDaGVja1sxXSAmJiBzb3VyY2VNYXBwaW5nQ2hlY2tbMV0gIT09ICcnKXtcbiAgICAgIGxldCBzb3VyY2VNYXBQYXRoID0gc291cmNlTWFwcGluZ0NoZWNrWzFdO1xuXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBwZnMuc3RhdChzb3VyY2VNYXBQYXRoKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxldCBub3JtUm9vdCA9IHBhdGgubm9ybWFsaXplKGFwcFJvb3QpO1xuICAgICAgICBsZXQgYWJzUGF0aFRvTW9kdWxlID0gcGF0aC5kaXJuYW1lKHNvdXJjZVBhdGgucmVwbGFjZShub3JtUm9vdCwgJycpLnN1YnN0cmluZygxKSk7XG4gICAgICAgIGxldCBuZXdNYXBQYXRoID0gcGF0aC5qb2luKGFic1BhdGhUb01vZHVsZSwgc291cmNlTWFwUGF0aCk7XG5cbiAgICAgICAgcmV0dXJuIHNvdXJjZUNvZGUucmVwbGFjZShyZWdleFNvdXJjZU1hcHBpbmcsIGAvLyMgc291cmNlTWFwcGluZ1VSTD0ke25ld01hcFBhdGh9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNvdXJjZUNvZGU7XG4gIH1cblxuICAvKipcbiAgICogTG9vayBhdCB0aGUgY29kZSBvZiBhIG5vZGUgbW9kdWxlcyBhbmQgc2VlIHRoZSBzb3VyY2VNYXBwaW5nIHBhdGguXG4gICAqIElmIHRoZXJlIGlzIGFueSwgY2hlY2sgdGhlIHBhdGggYW5kIHRyeSB0byBmaXggaXQgd2l0aCBhbmRcbiAgICogcm9vdCByZWxhdGl2ZSBwYXRoLlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc3RhdGljIGZpeE5vZGVNb2R1bGVzU291cmNlTWFwcGluZ1N5bmMoc291cmNlQ29kZSwgc291cmNlUGF0aCwgYXBwUm9vdCkge1xuICAgIGxldCByZWdleFNvdXJjZU1hcHBpbmcgPSAvXFwvXFwvIy4qc291cmNlTWFwcGluZ1VSTD0oPyFkYXRhOikoW15cIiddLiopL2k7XG4gICAgbGV0IHNvdXJjZU1hcHBpbmdDaGVjayA9IHNvdXJjZUNvZGUubWF0Y2gocmVnZXhTb3VyY2VNYXBwaW5nKTtcblxuICAgIGlmIChzb3VyY2VNYXBwaW5nQ2hlY2sgJiYgc291cmNlTWFwcGluZ0NoZWNrWzFdICYmIHNvdXJjZU1hcHBpbmdDaGVja1sxXSAhPT0gJycpe1xuICAgICAgbGV0IHNvdXJjZU1hcFBhdGggPSBzb3VyY2VNYXBwaW5nQ2hlY2tbMV07XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGZzLnN0YXRTeW5jKHNvdXJjZU1hcFBhdGgpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbGV0IG5vcm1Sb290ID0gcGF0aC5ub3JtYWxpemUoYXBwUm9vdCk7XG4gICAgICAgIGxldCBhYnNQYXRoVG9Nb2R1bGUgPSBwYXRoLmRpcm5hbWUoc291cmNlUGF0aC5yZXBsYWNlKG5vcm1Sb290LCAnJykuc3Vic3RyaW5nKDEpKTtcbiAgICAgICAgbGV0IG5ld01hcFBhdGggPSBwYXRoLmpvaW4oYWJzUGF0aFRvTW9kdWxlLCBzb3VyY2VNYXBQYXRoKTtcblxuICAgICAgICByZXR1cm4gc291cmNlQ29kZS5yZXBsYWNlKHJlZ2V4U291cmNlTWFwcGluZywgYC8vIyBzb3VyY2VNYXBwaW5nVVJMPSR7bmV3TWFwUGF0aH1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc291cmNlQ29kZTtcbiAgfVxufVxuIl19