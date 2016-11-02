'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _zlib = require('zlib');

var _zlib2 = _interopRequireDefault(_zlib);

var _digestForObject = require('./digest-for-object');

var _digestForObject2 = _interopRequireDefault(_digestForObject);

var _promise = require('./promise');

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const d = require('debug-electron')('electron-compile:compile-cache');

/**
 * CompileCache manages getting and setting entries for a single compiler; each
 * in-use compiler will have an instance of this class, usually created via
 * {@link createFromCompiler}.
 *
 * You usually will not use this class directly, it is an implementation class
 * for {@link CompileHost}.
 */
class CompileCache {
  /**
   * Creates an instance, usually used for testing only.
   *
   * @param  {string} cachePath  The root directory to use as a cache path
   *
   * @param  {FileChangedCache} fileChangeCache  A file-change cache that is
   *                                             optionally pre-loaded.
   */
  constructor(cachePath, fileChangeCache) {
    this.cachePath = cachePath;
    this.fileChangeCache = fileChangeCache;
  }

  /**
   * Creates a CompileCache from a class compatible with the CompilerBase
   * interface. This method uses the compiler name / version / options to
   * generate a unique directory name for cached results
   *
   * @param  {string} cachePath  The root path to use for the cache, a directory
   *                             representing the hash of the compiler parameters
   *                             will be created here.
   *
   * @param  {CompilerBase} compiler  The compiler to use for version / option
   *                                  information.
   *
   * @param  {FileChangedCache} fileChangeCache  A file-change cache that is
   *                                             optionally pre-loaded.
   *
   * @param  {boolean} readOnlyMode  Don't attempt to create the cache directory.
   *
   * @return {CompileCache}  A configured CompileCache instance.
   */
  static createFromCompiler(cachePath, compiler, fileChangeCache) {
    let readOnlyMode = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

    let newCachePath = null;
    let getCachePath = () => {
      if (newCachePath) return newCachePath;

      const digestObj = {
        name: compiler.name || Object.getPrototypeOf(compiler).constructor.name,
        version: compiler.getCompilerVersion(),
        options: compiler.compilerOptions
      };

      newCachePath = _path2.default.join(cachePath, (0, _digestForObject2.default)(digestObj));

      d(`Path for ${ digestObj.name }: ${ newCachePath }`);
      d(`Set up with parameters: ${ JSON.stringify(digestObj) }`);

      if (!readOnlyMode) _mkdirp2.default.sync(newCachePath);
      return newCachePath;
    };

    let ret = new CompileCache('', fileChangeCache);
    ret.getCachePath = getCachePath;

    return ret;
  }

  /**
   * Returns a file's compiled contents from the cache.
   *
   * @param  {string} filePath  The path to the file. FileChangedCache will look
   *                            up the hash and use that as the key in the cache.
   *
   * @return {Promise<Object>}  An object with all kinds of information
   *
   * @property {Object} hashInfo  The hash information returned from getHashForPath
   * @property {string} code  The source code if the file was a text file
   * @property {Buffer} binaryData  The file if it was a binary file
   * @property {string} mimeType  The MIME type saved in the cache.
   * @property {string[]} dependentFiles  The dependent files returned from
   *                                      compiling the file, if any.
   */
  get(filePath) {
    var _this = this;

    return _asyncToGenerator(function* () {
      d(`Fetching ${ filePath } from cache`);
      let hashInfo = yield _this.fileChangeCache.getHashForPath(_path2.default.resolve(filePath));

      let code = null;
      let mimeType = null;
      let binaryData = null;
      let dependentFiles = null;

      let cacheFile = null;
      try {
        cacheFile = _path2.default.join(_this.getCachePath(), hashInfo.hash);
        let result = null;

        if (hashInfo.isFileBinary) {
          d("File is binary, reading out info");
          let info = JSON.parse((yield _promise.pfs.readFile(cacheFile + '.info')));
          mimeType = info.mimeType;
          dependentFiles = info.dependentFiles;

          binaryData = hashInfo.binaryData;
          if (!binaryData) {
            binaryData = yield _promise.pfs.readFile(cacheFile);
            binaryData = yield _promise.pzlib.gunzip(binaryData);
          }
        } else {
          let buf = yield _promise.pfs.readFile(cacheFile);
          let str = (yield _promise.pzlib.gunzip(buf)).toString('utf8');

          result = JSON.parse(str);
          code = result.code;
          mimeType = result.mimeType;
          dependentFiles = result.dependentFiles;
        }
      } catch (e) {
        d(`Failed to read cache for ${ filePath }, looked in ${ cacheFile }: ${ e.message }`);
      }

      return { hashInfo, code, mimeType, binaryData, dependentFiles };
    })();
  }

  /**
   * Saves a compiled result to cache
   *
   * @param  {Object} hashInfo  The hash information returned from getHashForPath
   *
   * @param  {string / Buffer} codeOrBinaryData   The file's contents, either as
   *                                              a string or a Buffer.
   * @param  {string} mimeType  The MIME type returned by the compiler.
   *
   * @param  {string[]} dependentFiles  The list of dependent files returned by
   *                                    the compiler.
   * @return {Promise}  Completion.
   */
  save(hashInfo, codeOrBinaryData, mimeType, dependentFiles) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      let buf = null;
      let target = _path2.default.join(_this2.getCachePath(), hashInfo.hash);
      d(`Saving to ${ target }`);

      if (hashInfo.isFileBinary) {
        buf = yield _promise.pzlib.gzip(codeOrBinaryData);
        yield _promise.pfs.writeFile(target + '.info', JSON.stringify({ mimeType, dependentFiles }), 'utf8');
      } else {
        buf = yield _promise.pzlib.gzip(new Buffer(JSON.stringify({ code: codeOrBinaryData, mimeType, dependentFiles })));
      }

      yield _promise.pfs.writeFile(target, buf);
    })();
  }

  /**
   * Attempts to first get a key via {@link get}, then if it fails, call a method
   * to retrieve the contents, then save the result to cache.
   *
   * The fetcher parameter is expected to have the signature:
   *
   * Promise<Object> fetcher(filePath : string, hashInfo : Object);
   *
   * hashInfo is a value returned from getHashForPath
   * The return value of fetcher must be an Object with the properties:
   *
   * mimeType - the MIME type of the data to save
   * code (optional) - the source code as a string, if file is text
   * binaryData (optional) - the file contents as a Buffer, if file is binary
   * dependentFiles - the dependent files returned by the compiler.
   *
   * @param  {string} filePath  The path to the file. FileChangedCache will look
   *                            up the hash and use that as the key in the cache.
   *
   * @param  {Function} fetcher  A method which conforms to the description above.
   *
   * @return {Promise<Object>}  An Object which has the same fields as the
   *                            {@link get} method return result.
   */
  getOrFetch(filePath, fetcher) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      let cacheResult = yield _this3.get(filePath);
      if (cacheResult.code || cacheResult.binaryData) return cacheResult;

      let result = (yield fetcher(filePath, cacheResult.hashInfo)) || { hashInfo: cacheResult.hashInfo };

      if (result.mimeType && !cacheResult.hashInfo.isInNodeModules) {
        d(`Cache miss: saving out info for ${ filePath }`);
        yield _this3.save(cacheResult.hashInfo, result.code || result.binaryData, result.mimeType, result.dependentFiles);
      }

      result.hashInfo = cacheResult.hashInfo;
      return result;
    })();
  }

  getSync(filePath) {
    d(`Fetching ${ filePath } from cache`);
    let hashInfo = this.fileChangeCache.getHashForPathSync(_path2.default.resolve(filePath));

    let code = null;
    let mimeType = null;
    let binaryData = null;
    let dependentFiles = null;

    try {
      let cacheFile = _path2.default.join(this.getCachePath(), hashInfo.hash);

      let result = null;
      if (hashInfo.isFileBinary) {
        d("File is binary, reading out info");
        let info = JSON.parse(_fs2.default.readFileSync(cacheFile + '.info'));
        mimeType = info.mimeType;
        dependentFiles = info.dependentFiles;

        binaryData = hashInfo.binaryData;
        if (!binaryData) {
          binaryData = _fs2.default.readFileSync(cacheFile);
          binaryData = _zlib2.default.gunzipSync(binaryData);
        }
      } else {
        let buf = _fs2.default.readFileSync(cacheFile);
        let str = _zlib2.default.gunzipSync(buf).toString('utf8');

        result = JSON.parse(str);
        code = result.code;
        mimeType = result.mimeType;
        dependentFiles = result.dependentFiles;
      }
    } catch (e) {
      d(`Failed to read cache for ${ filePath }`);
    }

    return { hashInfo, code, mimeType, binaryData, dependentFiles };
  }

  saveSync(hashInfo, codeOrBinaryData, mimeType, dependentFiles) {
    let buf = null;
    let target = _path2.default.join(this.getCachePath(), hashInfo.hash);
    d(`Saving to ${ target }`);

    if (hashInfo.isFileBinary) {
      buf = _zlib2.default.gzipSync(codeOrBinaryData);
      _fs2.default.writeFileSync(target + '.info', JSON.stringify({ mimeType, dependentFiles }), 'utf8');
    } else {
      buf = _zlib2.default.gzipSync(new Buffer(JSON.stringify({ code: codeOrBinaryData, mimeType, dependentFiles })));
    }

    _fs2.default.writeFileSync(target, buf);
  }

  getOrFetchSync(filePath, fetcher) {
    let cacheResult = this.getSync(filePath);
    if (cacheResult.code || cacheResult.binaryData) return cacheResult;

    let result = fetcher(filePath, cacheResult.hashInfo) || { hashInfo: cacheResult.hashInfo };

    if (result.mimeType && !cacheResult.hashInfo.isInNodeModules) {
      d(`Cache miss: saving out info for ${ filePath }`);
      this.saveSync(cacheResult.hashInfo, result.code || result.binaryData, result.mimeType, result.dependentFiles);
    }

    result.hashInfo = cacheResult.hashInfo;
    return result;
  }

  /**
   * @private
   */
  getCachePath() {
    // NB: This is an evil hack so that createFromCompiler can stomp it
    // at will
    return this.cachePath;
  }

  /**
   * Returns whether a file should not be compiled. Note that this doesn't
   * necessarily mean it won't end up in the cache, only that its contents are
   * saved verbatim instead of trying to find an appropriate compiler.
   *
   * @param  {Object} hashInfo  The hash information returned from getHashForPath
   *
   * @return {boolean}  True if a file should be ignored
   */
  static shouldPassthrough(hashInfo) {
    return hashInfo.isMinified || hashInfo.isInNodeModules || hashInfo.hasSourceMap || hashInfo.isFileBinary;
  }
}
exports.default = CompileCache;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb21waWxlLWNhY2hlLmpzIl0sIm5hbWVzIjpbImQiLCJyZXF1aXJlIiwiQ29tcGlsZUNhY2hlIiwiY29uc3RydWN0b3IiLCJjYWNoZVBhdGgiLCJmaWxlQ2hhbmdlQ2FjaGUiLCJjcmVhdGVGcm9tQ29tcGlsZXIiLCJjb21waWxlciIsInJlYWRPbmx5TW9kZSIsIm5ld0NhY2hlUGF0aCIsImdldENhY2hlUGF0aCIsImRpZ2VzdE9iaiIsIm5hbWUiLCJPYmplY3QiLCJnZXRQcm90b3R5cGVPZiIsInZlcnNpb24iLCJnZXRDb21waWxlclZlcnNpb24iLCJvcHRpb25zIiwiY29tcGlsZXJPcHRpb25zIiwiam9pbiIsIkpTT04iLCJzdHJpbmdpZnkiLCJzeW5jIiwicmV0IiwiZ2V0IiwiZmlsZVBhdGgiLCJoYXNoSW5mbyIsImdldEhhc2hGb3JQYXRoIiwicmVzb2x2ZSIsImNvZGUiLCJtaW1lVHlwZSIsImJpbmFyeURhdGEiLCJkZXBlbmRlbnRGaWxlcyIsImNhY2hlRmlsZSIsImhhc2giLCJyZXN1bHQiLCJpc0ZpbGVCaW5hcnkiLCJpbmZvIiwicGFyc2UiLCJyZWFkRmlsZSIsImd1bnppcCIsImJ1ZiIsInN0ciIsInRvU3RyaW5nIiwiZSIsIm1lc3NhZ2UiLCJzYXZlIiwiY29kZU9yQmluYXJ5RGF0YSIsInRhcmdldCIsImd6aXAiLCJ3cml0ZUZpbGUiLCJCdWZmZXIiLCJnZXRPckZldGNoIiwiZmV0Y2hlciIsImNhY2hlUmVzdWx0IiwiaXNJbk5vZGVNb2R1bGVzIiwiZ2V0U3luYyIsImdldEhhc2hGb3JQYXRoU3luYyIsInJlYWRGaWxlU3luYyIsImd1bnppcFN5bmMiLCJzYXZlU3luYyIsImd6aXBTeW5jIiwid3JpdGVGaWxlU3luYyIsImdldE9yRmV0Y2hTeW5jIiwic2hvdWxkUGFzc3Rocm91Z2giLCJpc01pbmlmaWVkIiwiaGFzU291cmNlTWFwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7OztBQUVBLE1BQU1BLElBQUlDLFFBQVEsZ0JBQVIsRUFBMEIsZ0NBQTFCLENBQVY7O0FBRUE7Ozs7Ozs7O0FBUWUsTUFBTUMsWUFBTixDQUFtQjtBQUNoQzs7Ozs7Ozs7QUFRQUMsY0FBWUMsU0FBWixFQUF1QkMsZUFBdkIsRUFBd0M7QUFDdEMsU0FBS0QsU0FBTCxHQUFpQkEsU0FBakI7QUFDQSxTQUFLQyxlQUFMLEdBQXVCQSxlQUF2QjtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBLFNBQU9DLGtCQUFQLENBQTBCRixTQUExQixFQUFxQ0csUUFBckMsRUFBK0NGLGVBQS9DLEVBQW9GO0FBQUEsUUFBcEJHLFlBQW9CLHVFQUFQLEtBQU87O0FBQ2xGLFFBQUlDLGVBQWUsSUFBbkI7QUFDQSxRQUFJQyxlQUFlLE1BQU07QUFDdkIsVUFBSUQsWUFBSixFQUFrQixPQUFPQSxZQUFQOztBQUVsQixZQUFNRSxZQUFZO0FBQ2hCQyxjQUFNTCxTQUFTSyxJQUFULElBQWlCQyxPQUFPQyxjQUFQLENBQXNCUCxRQUF0QixFQUFnQ0osV0FBaEMsQ0FBNENTLElBRG5EO0FBRWhCRyxpQkFBU1IsU0FBU1Msa0JBQVQsRUFGTztBQUdoQkMsaUJBQVNWLFNBQVNXO0FBSEYsT0FBbEI7O0FBTUFULHFCQUFlLGVBQUtVLElBQUwsQ0FBVWYsU0FBVixFQUFxQiwrQkFBc0JPLFNBQXRCLENBQXJCLENBQWY7O0FBRUFYLFFBQUcsYUFBV1csVUFBVUMsSUFBSyxPQUFJSCxZQUFhLEdBQTlDO0FBQ0FULFFBQUcsNEJBQTBCb0IsS0FBS0MsU0FBTCxDQUFlVixTQUFmLENBQTBCLEdBQXZEOztBQUVBLFVBQUksQ0FBQ0gsWUFBTCxFQUFtQixpQkFBT2MsSUFBUCxDQUFZYixZQUFaO0FBQ25CLGFBQU9BLFlBQVA7QUFDRCxLQWhCRDs7QUFrQkEsUUFBSWMsTUFBTSxJQUFJckIsWUFBSixDQUFpQixFQUFqQixFQUFxQkcsZUFBckIsQ0FBVjtBQUNBa0IsUUFBSWIsWUFBSixHQUFtQkEsWUFBbkI7O0FBRUEsV0FBT2EsR0FBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7QUFlTUMsS0FBTixDQUFVQyxRQUFWLEVBQW9CO0FBQUE7O0FBQUE7QUFDbEJ6QixRQUFHLGFBQVd5QixRQUFTLGNBQXZCO0FBQ0EsVUFBSUMsV0FBVyxNQUFNLE1BQUtyQixlQUFMLENBQXFCc0IsY0FBckIsQ0FBb0MsZUFBS0MsT0FBTCxDQUFhSCxRQUFiLENBQXBDLENBQXJCOztBQUVBLFVBQUlJLE9BQU8sSUFBWDtBQUNBLFVBQUlDLFdBQVcsSUFBZjtBQUNBLFVBQUlDLGFBQWEsSUFBakI7QUFDQSxVQUFJQyxpQkFBaUIsSUFBckI7O0FBRUEsVUFBSUMsWUFBWSxJQUFoQjtBQUNBLFVBQUk7QUFDRkEsb0JBQVksZUFBS2QsSUFBTCxDQUFVLE1BQUtULFlBQUwsRUFBVixFQUErQmdCLFNBQVNRLElBQXhDLENBQVo7QUFDQSxZQUFJQyxTQUFTLElBQWI7O0FBRUEsWUFBSVQsU0FBU1UsWUFBYixFQUEyQjtBQUN6QnBDLFlBQUUsa0NBQUY7QUFDQSxjQUFJcUMsT0FBT2pCLEtBQUtrQixLQUFMLEVBQVcsTUFBTSxhQUFJQyxRQUFKLENBQWFOLFlBQVksT0FBekIsQ0FBakIsRUFBWDtBQUNBSCxxQkFBV08sS0FBS1AsUUFBaEI7QUFDQUUsMkJBQWlCSyxLQUFLTCxjQUF0Qjs7QUFFQUQsdUJBQWFMLFNBQVNLLFVBQXRCO0FBQ0EsY0FBSSxDQUFDQSxVQUFMLEVBQWlCO0FBQ2ZBLHlCQUFhLE1BQU0sYUFBSVEsUUFBSixDQUFhTixTQUFiLENBQW5CO0FBQ0FGLHlCQUFhLE1BQU0sZUFBTVMsTUFBTixDQUFhVCxVQUFiLENBQW5CO0FBQ0Q7QUFDRixTQVhELE1BV087QUFDTCxjQUFJVSxNQUFNLE1BQU0sYUFBSUYsUUFBSixDQUFhTixTQUFiLENBQWhCO0FBQ0EsY0FBSVMsTUFBTSxDQUFDLE1BQU0sZUFBTUYsTUFBTixDQUFhQyxHQUFiLENBQVAsRUFBMEJFLFFBQTFCLENBQW1DLE1BQW5DLENBQVY7O0FBRUFSLG1CQUFTZixLQUFLa0IsS0FBTCxDQUFXSSxHQUFYLENBQVQ7QUFDQWIsaUJBQU9NLE9BQU9OLElBQWQ7QUFDQUMscUJBQVdLLE9BQU9MLFFBQWxCO0FBQ0FFLDJCQUFpQkcsT0FBT0gsY0FBeEI7QUFDRDtBQUNGLE9BeEJELENBd0JFLE9BQU9ZLENBQVAsRUFBVTtBQUNWNUMsVUFBRyw2QkFBMkJ5QixRQUFTLGlCQUFjUSxTQUFVLE9BQUlXLEVBQUVDLE9BQVEsR0FBN0U7QUFDRDs7QUFFRCxhQUFPLEVBQUVuQixRQUFGLEVBQVlHLElBQVosRUFBa0JDLFFBQWxCLEVBQTRCQyxVQUE1QixFQUF3Q0MsY0FBeEMsRUFBUDtBQXRDa0I7QUF1Q25COztBQUdEOzs7Ozs7Ozs7Ozs7O0FBYU1jLE1BQU4sQ0FBV3BCLFFBQVgsRUFBcUJxQixnQkFBckIsRUFBdUNqQixRQUF2QyxFQUFpREUsY0FBakQsRUFBaUU7QUFBQTs7QUFBQTtBQUMvRCxVQUFJUyxNQUFNLElBQVY7QUFDQSxVQUFJTyxTQUFTLGVBQUs3QixJQUFMLENBQVUsT0FBS1QsWUFBTCxFQUFWLEVBQStCZ0IsU0FBU1EsSUFBeEMsQ0FBYjtBQUNBbEMsUUFBRyxjQUFZZ0QsTUFBTyxHQUF0Qjs7QUFFQSxVQUFJdEIsU0FBU1UsWUFBYixFQUEyQjtBQUN6QkssY0FBTSxNQUFNLGVBQU1RLElBQU4sQ0FBV0YsZ0JBQVgsQ0FBWjtBQUNBLGNBQU0sYUFBSUcsU0FBSixDQUFjRixTQUFTLE9BQXZCLEVBQWdDNUIsS0FBS0MsU0FBTCxDQUFlLEVBQUNTLFFBQUQsRUFBV0UsY0FBWCxFQUFmLENBQWhDLEVBQTRFLE1BQTVFLENBQU47QUFDRCxPQUhELE1BR087QUFDTFMsY0FBTSxNQUFNLGVBQU1RLElBQU4sQ0FBVyxJQUFJRSxNQUFKLENBQVcvQixLQUFLQyxTQUFMLENBQWUsRUFBQ1EsTUFBTWtCLGdCQUFQLEVBQXlCakIsUUFBekIsRUFBbUNFLGNBQW5DLEVBQWYsQ0FBWCxDQUFYLENBQVo7QUFDRDs7QUFFRCxZQUFNLGFBQUlrQixTQUFKLENBQWNGLE1BQWQsRUFBc0JQLEdBQXRCLENBQU47QUFaK0Q7QUFhaEU7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXdCTVcsWUFBTixDQUFpQjNCLFFBQWpCLEVBQTJCNEIsT0FBM0IsRUFBb0M7QUFBQTs7QUFBQTtBQUNsQyxVQUFJQyxjQUFjLE1BQU0sT0FBSzlCLEdBQUwsQ0FBU0MsUUFBVCxDQUF4QjtBQUNBLFVBQUk2QixZQUFZekIsSUFBWixJQUFvQnlCLFlBQVl2QixVQUFwQyxFQUFnRCxPQUFPdUIsV0FBUDs7QUFFaEQsVUFBSW5CLFNBQVMsT0FBTWtCLFFBQVE1QixRQUFSLEVBQWtCNkIsWUFBWTVCLFFBQTlCLENBQU4sS0FBaUQsRUFBRUEsVUFBVTRCLFlBQVk1QixRQUF4QixFQUE5RDs7QUFFQSxVQUFJUyxPQUFPTCxRQUFQLElBQW1CLENBQUN3QixZQUFZNUIsUUFBWixDQUFxQjZCLGVBQTdDLEVBQThEO0FBQzVEdkQsVUFBRyxvQ0FBa0N5QixRQUFTLEdBQTlDO0FBQ0EsY0FBTSxPQUFLcUIsSUFBTCxDQUFVUSxZQUFZNUIsUUFBdEIsRUFBZ0NTLE9BQU9OLElBQVAsSUFBZU0sT0FBT0osVUFBdEQsRUFBa0VJLE9BQU9MLFFBQXpFLEVBQW1GSyxPQUFPSCxjQUExRixDQUFOO0FBQ0Q7O0FBRURHLGFBQU9ULFFBQVAsR0FBa0I0QixZQUFZNUIsUUFBOUI7QUFDQSxhQUFPUyxNQUFQO0FBWmtDO0FBYW5DOztBQUVEcUIsVUFBUS9CLFFBQVIsRUFBa0I7QUFDaEJ6QixNQUFHLGFBQVd5QixRQUFTLGNBQXZCO0FBQ0EsUUFBSUMsV0FBVyxLQUFLckIsZUFBTCxDQUFxQm9ELGtCQUFyQixDQUF3QyxlQUFLN0IsT0FBTCxDQUFhSCxRQUFiLENBQXhDLENBQWY7O0FBRUEsUUFBSUksT0FBTyxJQUFYO0FBQ0EsUUFBSUMsV0FBVyxJQUFmO0FBQ0EsUUFBSUMsYUFBYSxJQUFqQjtBQUNBLFFBQUlDLGlCQUFpQixJQUFyQjs7QUFFQSxRQUFJO0FBQ0YsVUFBSUMsWUFBWSxlQUFLZCxJQUFMLENBQVUsS0FBS1QsWUFBTCxFQUFWLEVBQStCZ0IsU0FBU1EsSUFBeEMsQ0FBaEI7O0FBRUEsVUFBSUMsU0FBUyxJQUFiO0FBQ0EsVUFBSVQsU0FBU1UsWUFBYixFQUEyQjtBQUN6QnBDLFVBQUUsa0NBQUY7QUFDQSxZQUFJcUMsT0FBT2pCLEtBQUtrQixLQUFMLENBQVcsYUFBR29CLFlBQUgsQ0FBZ0J6QixZQUFZLE9BQTVCLENBQVgsQ0FBWDtBQUNBSCxtQkFBV08sS0FBS1AsUUFBaEI7QUFDQUUseUJBQWlCSyxLQUFLTCxjQUF0Qjs7QUFFQUQscUJBQWFMLFNBQVNLLFVBQXRCO0FBQ0EsWUFBSSxDQUFDQSxVQUFMLEVBQWlCO0FBQ2ZBLHVCQUFhLGFBQUcyQixZQUFILENBQWdCekIsU0FBaEIsQ0FBYjtBQUNBRix1QkFBYSxlQUFLNEIsVUFBTCxDQUFnQjVCLFVBQWhCLENBQWI7QUFDRDtBQUNGLE9BWEQsTUFXTztBQUNMLFlBQUlVLE1BQU0sYUFBR2lCLFlBQUgsQ0FBZ0J6QixTQUFoQixDQUFWO0FBQ0EsWUFBSVMsTUFBTyxlQUFLaUIsVUFBTCxDQUFnQmxCLEdBQWhCLENBQUQsQ0FBdUJFLFFBQXZCLENBQWdDLE1BQWhDLENBQVY7O0FBRUFSLGlCQUFTZixLQUFLa0IsS0FBTCxDQUFXSSxHQUFYLENBQVQ7QUFDQWIsZUFBT00sT0FBT04sSUFBZDtBQUNBQyxtQkFBV0ssT0FBT0wsUUFBbEI7QUFDQUUseUJBQWlCRyxPQUFPSCxjQUF4QjtBQUNEO0FBQ0YsS0F4QkQsQ0F3QkUsT0FBT1ksQ0FBUCxFQUFVO0FBQ1Y1QyxRQUFHLDZCQUEyQnlCLFFBQVMsR0FBdkM7QUFDRDs7QUFFRCxXQUFPLEVBQUVDLFFBQUYsRUFBWUcsSUFBWixFQUFrQkMsUUFBbEIsRUFBNEJDLFVBQTVCLEVBQXdDQyxjQUF4QyxFQUFQO0FBQ0Q7O0FBRUQ0QixXQUFTbEMsUUFBVCxFQUFtQnFCLGdCQUFuQixFQUFxQ2pCLFFBQXJDLEVBQStDRSxjQUEvQyxFQUErRDtBQUM3RCxRQUFJUyxNQUFNLElBQVY7QUFDQSxRQUFJTyxTQUFTLGVBQUs3QixJQUFMLENBQVUsS0FBS1QsWUFBTCxFQUFWLEVBQStCZ0IsU0FBU1EsSUFBeEMsQ0FBYjtBQUNBbEMsTUFBRyxjQUFZZ0QsTUFBTyxHQUF0Qjs7QUFFQSxRQUFJdEIsU0FBU1UsWUFBYixFQUEyQjtBQUN6QkssWUFBTSxlQUFLb0IsUUFBTCxDQUFjZCxnQkFBZCxDQUFOO0FBQ0EsbUJBQUdlLGFBQUgsQ0FBaUJkLFNBQVMsT0FBMUIsRUFBbUM1QixLQUFLQyxTQUFMLENBQWUsRUFBQ1MsUUFBRCxFQUFXRSxjQUFYLEVBQWYsQ0FBbkMsRUFBK0UsTUFBL0U7QUFDRCxLQUhELE1BR087QUFDTFMsWUFBTSxlQUFLb0IsUUFBTCxDQUFjLElBQUlWLE1BQUosQ0FBVy9CLEtBQUtDLFNBQUwsQ0FBZSxFQUFDUSxNQUFNa0IsZ0JBQVAsRUFBeUJqQixRQUF6QixFQUFtQ0UsY0FBbkMsRUFBZixDQUFYLENBQWQsQ0FBTjtBQUNEOztBQUVELGlCQUFHOEIsYUFBSCxDQUFpQmQsTUFBakIsRUFBeUJQLEdBQXpCO0FBQ0Q7O0FBRURzQixpQkFBZXRDLFFBQWYsRUFBeUI0QixPQUF6QixFQUFrQztBQUNoQyxRQUFJQyxjQUFjLEtBQUtFLE9BQUwsQ0FBYS9CLFFBQWIsQ0FBbEI7QUFDQSxRQUFJNkIsWUFBWXpCLElBQVosSUFBb0J5QixZQUFZdkIsVUFBcEMsRUFBZ0QsT0FBT3VCLFdBQVA7O0FBRWhELFFBQUluQixTQUFTa0IsUUFBUTVCLFFBQVIsRUFBa0I2QixZQUFZNUIsUUFBOUIsS0FBMkMsRUFBRUEsVUFBVTRCLFlBQVk1QixRQUF4QixFQUF4RDs7QUFFQSxRQUFJUyxPQUFPTCxRQUFQLElBQW1CLENBQUN3QixZQUFZNUIsUUFBWixDQUFxQjZCLGVBQTdDLEVBQThEO0FBQzVEdkQsUUFBRyxvQ0FBa0N5QixRQUFTLEdBQTlDO0FBQ0EsV0FBS21DLFFBQUwsQ0FBY04sWUFBWTVCLFFBQTFCLEVBQW9DUyxPQUFPTixJQUFQLElBQWVNLE9BQU9KLFVBQTFELEVBQXNFSSxPQUFPTCxRQUE3RSxFQUF1RkssT0FBT0gsY0FBOUY7QUFDRDs7QUFFREcsV0FBT1QsUUFBUCxHQUFrQjRCLFlBQVk1QixRQUE5QjtBQUNBLFdBQU9TLE1BQVA7QUFDRDs7QUFHRDs7O0FBR0F6QixpQkFBZTtBQUNiO0FBQ0E7QUFDQSxXQUFPLEtBQUtOLFNBQVo7QUFDRDs7QUFHRDs7Ozs7Ozs7O0FBU0EsU0FBTzRELGlCQUFQLENBQXlCdEMsUUFBekIsRUFBbUM7QUFDakMsV0FBT0EsU0FBU3VDLFVBQVQsSUFBdUJ2QyxTQUFTNkIsZUFBaEMsSUFBbUQ3QixTQUFTd0MsWUFBNUQsSUFBNEV4QyxTQUFTVSxZQUE1RjtBQUNEO0FBblIrQjtrQkFBYmxDLFkiLCJmaWxlIjoiY29tcGlsZS1jYWNoZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB6bGliIGZyb20gJ3psaWInO1xuaW1wb3J0IGNyZWF0ZURpZ2VzdEZvck9iamVjdCBmcm9tICcuL2RpZ2VzdC1mb3Itb2JqZWN0JztcbmltcG9ydCB7cGZzLCBwemxpYn0gZnJvbSAnLi9wcm9taXNlJztcbmltcG9ydCBta2RpcnAgZnJvbSAnbWtkaXJwJztcblxuY29uc3QgZCA9IHJlcXVpcmUoJ2RlYnVnLWVsZWN0cm9uJykoJ2VsZWN0cm9uLWNvbXBpbGU6Y29tcGlsZS1jYWNoZScpO1xuXG4vKipcbiAqIENvbXBpbGVDYWNoZSBtYW5hZ2VzIGdldHRpbmcgYW5kIHNldHRpbmcgZW50cmllcyBmb3IgYSBzaW5nbGUgY29tcGlsZXI7IGVhY2hcbiAqIGluLXVzZSBjb21waWxlciB3aWxsIGhhdmUgYW4gaW5zdGFuY2Ugb2YgdGhpcyBjbGFzcywgdXN1YWxseSBjcmVhdGVkIHZpYVxuICoge0BsaW5rIGNyZWF0ZUZyb21Db21waWxlcn0uXG4gKlxuICogWW91IHVzdWFsbHkgd2lsbCBub3QgdXNlIHRoaXMgY2xhc3MgZGlyZWN0bHksIGl0IGlzIGFuIGltcGxlbWVudGF0aW9uIGNsYXNzXG4gKiBmb3Ige0BsaW5rIENvbXBpbGVIb3N0fS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ29tcGlsZUNhY2hlIHtcbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gaW5zdGFuY2UsIHVzdWFsbHkgdXNlZCBmb3IgdGVzdGluZyBvbmx5LlxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGNhY2hlUGF0aCAgVGhlIHJvb3QgZGlyZWN0b3J5IHRvIHVzZSBhcyBhIGNhY2hlIHBhdGhcbiAgICpcbiAgICogQHBhcmFtICB7RmlsZUNoYW5nZWRDYWNoZX0gZmlsZUNoYW5nZUNhY2hlICBBIGZpbGUtY2hhbmdlIGNhY2hlIHRoYXQgaXNcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25hbGx5IHByZS1sb2FkZWQuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihjYWNoZVBhdGgsIGZpbGVDaGFuZ2VDYWNoZSkge1xuICAgIHRoaXMuY2FjaGVQYXRoID0gY2FjaGVQYXRoO1xuICAgIHRoaXMuZmlsZUNoYW5nZUNhY2hlID0gZmlsZUNoYW5nZUNhY2hlO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBDb21waWxlQ2FjaGUgZnJvbSBhIGNsYXNzIGNvbXBhdGlibGUgd2l0aCB0aGUgQ29tcGlsZXJCYXNlXG4gICAqIGludGVyZmFjZS4gVGhpcyBtZXRob2QgdXNlcyB0aGUgY29tcGlsZXIgbmFtZSAvIHZlcnNpb24gLyBvcHRpb25zIHRvXG4gICAqIGdlbmVyYXRlIGEgdW5pcXVlIGRpcmVjdG9yeSBuYW1lIGZvciBjYWNoZWQgcmVzdWx0c1xuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGNhY2hlUGF0aCAgVGhlIHJvb3QgcGF0aCB0byB1c2UgZm9yIHRoZSBjYWNoZSwgYSBkaXJlY3RvcnlcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcHJlc2VudGluZyB0aGUgaGFzaCBvZiB0aGUgY29tcGlsZXIgcGFyYW1ldGVyc1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lsbCBiZSBjcmVhdGVkIGhlcmUuXG4gICAqXG4gICAqIEBwYXJhbSAge0NvbXBpbGVyQmFzZX0gY29tcGlsZXIgIFRoZSBjb21waWxlciB0byB1c2UgZm9yIHZlcnNpb24gLyBvcHRpb25cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5mb3JtYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSAge0ZpbGVDaGFuZ2VkQ2FjaGV9IGZpbGVDaGFuZ2VDYWNoZSAgQSBmaWxlLWNoYW5nZSBjYWNoZSB0aGF0IGlzXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uYWxseSBwcmUtbG9hZGVkLlxuICAgKlxuICAgKiBAcGFyYW0gIHtib29sZWFufSByZWFkT25seU1vZGUgIERvbid0IGF0dGVtcHQgdG8gY3JlYXRlIHRoZSBjYWNoZSBkaXJlY3RvcnkuXG4gICAqXG4gICAqIEByZXR1cm4ge0NvbXBpbGVDYWNoZX0gIEEgY29uZmlndXJlZCBDb21waWxlQ2FjaGUgaW5zdGFuY2UuXG4gICAqL1xuICBzdGF0aWMgY3JlYXRlRnJvbUNvbXBpbGVyKGNhY2hlUGF0aCwgY29tcGlsZXIsIGZpbGVDaGFuZ2VDYWNoZSwgcmVhZE9ubHlNb2RlPWZhbHNlKSB7XG4gICAgbGV0IG5ld0NhY2hlUGF0aCA9IG51bGw7XG4gICAgbGV0IGdldENhY2hlUGF0aCA9ICgpID0+IHtcbiAgICAgIGlmIChuZXdDYWNoZVBhdGgpIHJldHVybiBuZXdDYWNoZVBhdGg7XG5cbiAgICAgIGNvbnN0IGRpZ2VzdE9iaiA9IHtcbiAgICAgICAgbmFtZTogY29tcGlsZXIubmFtZSB8fCBPYmplY3QuZ2V0UHJvdG90eXBlT2YoY29tcGlsZXIpLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICAgIHZlcnNpb246IGNvbXBpbGVyLmdldENvbXBpbGVyVmVyc2lvbigpLFxuICAgICAgICBvcHRpb25zOiBjb21waWxlci5jb21waWxlck9wdGlvbnNcbiAgICAgIH07XG5cbiAgICAgIG5ld0NhY2hlUGF0aCA9IHBhdGguam9pbihjYWNoZVBhdGgsIGNyZWF0ZURpZ2VzdEZvck9iamVjdChkaWdlc3RPYmopKTtcblxuICAgICAgZChgUGF0aCBmb3IgJHtkaWdlc3RPYmoubmFtZX06ICR7bmV3Q2FjaGVQYXRofWApO1xuICAgICAgZChgU2V0IHVwIHdpdGggcGFyYW1ldGVyczogJHtKU09OLnN0cmluZ2lmeShkaWdlc3RPYmopfWApO1xuXG4gICAgICBpZiAoIXJlYWRPbmx5TW9kZSkgbWtkaXJwLnN5bmMobmV3Q2FjaGVQYXRoKTtcbiAgICAgIHJldHVybiBuZXdDYWNoZVBhdGg7XG4gICAgfTtcblxuICAgIGxldCByZXQgPSBuZXcgQ29tcGlsZUNhY2hlKCcnLCBmaWxlQ2hhbmdlQ2FjaGUpO1xuICAgIHJldC5nZXRDYWNoZVBhdGggPSBnZXRDYWNoZVBhdGg7XG5cbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBmaWxlJ3MgY29tcGlsZWQgY29udGVudHMgZnJvbSB0aGUgY2FjaGUuXG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gZmlsZVBhdGggIFRoZSBwYXRoIHRvIHRoZSBmaWxlLiBGaWxlQ2hhbmdlZENhY2hlIHdpbGwgbG9va1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cCB0aGUgaGFzaCBhbmQgdXNlIHRoYXQgYXMgdGhlIGtleSBpbiB0aGUgY2FjaGUuXG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0Pn0gIEFuIG9iamVjdCB3aXRoIGFsbCBraW5kcyBvZiBpbmZvcm1hdGlvblxuICAgKlxuICAgKiBAcHJvcGVydHkge09iamVjdH0gaGFzaEluZm8gIFRoZSBoYXNoIGluZm9ybWF0aW9uIHJldHVybmVkIGZyb20gZ2V0SGFzaEZvclBhdGhcbiAgICogQHByb3BlcnR5IHtzdHJpbmd9IGNvZGUgIFRoZSBzb3VyY2UgY29kZSBpZiB0aGUgZmlsZSB3YXMgYSB0ZXh0IGZpbGVcbiAgICogQHByb3BlcnR5IHtCdWZmZXJ9IGJpbmFyeURhdGEgIFRoZSBmaWxlIGlmIGl0IHdhcyBhIGJpbmFyeSBmaWxlXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBtaW1lVHlwZSAgVGhlIE1JTUUgdHlwZSBzYXZlZCBpbiB0aGUgY2FjaGUuXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nW119IGRlcGVuZGVudEZpbGVzICBUaGUgZGVwZW5kZW50IGZpbGVzIHJldHVybmVkIGZyb21cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBpbGluZyB0aGUgZmlsZSwgaWYgYW55LlxuICAgKi9cbiAgYXN5bmMgZ2V0KGZpbGVQYXRoKSB7XG4gICAgZChgRmV0Y2hpbmcgJHtmaWxlUGF0aH0gZnJvbSBjYWNoZWApO1xuICAgIGxldCBoYXNoSW5mbyA9IGF3YWl0IHRoaXMuZmlsZUNoYW5nZUNhY2hlLmdldEhhc2hGb3JQYXRoKHBhdGgucmVzb2x2ZShmaWxlUGF0aCkpO1xuXG4gICAgbGV0IGNvZGUgPSBudWxsO1xuICAgIGxldCBtaW1lVHlwZSA9IG51bGw7XG4gICAgbGV0IGJpbmFyeURhdGEgPSBudWxsO1xuICAgIGxldCBkZXBlbmRlbnRGaWxlcyA9IG51bGw7XG5cbiAgICBsZXQgY2FjaGVGaWxlID0gbnVsbDtcbiAgICB0cnkge1xuICAgICAgY2FjaGVGaWxlID0gcGF0aC5qb2luKHRoaXMuZ2V0Q2FjaGVQYXRoKCksIGhhc2hJbmZvLmhhc2gpO1xuICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG5cbiAgICAgIGlmIChoYXNoSW5mby5pc0ZpbGVCaW5hcnkpIHtcbiAgICAgICAgZChcIkZpbGUgaXMgYmluYXJ5LCByZWFkaW5nIG91dCBpbmZvXCIpO1xuICAgICAgICBsZXQgaW5mbyA9IEpTT04ucGFyc2UoYXdhaXQgcGZzLnJlYWRGaWxlKGNhY2hlRmlsZSArICcuaW5mbycpKTtcbiAgICAgICAgbWltZVR5cGUgPSBpbmZvLm1pbWVUeXBlO1xuICAgICAgICBkZXBlbmRlbnRGaWxlcyA9IGluZm8uZGVwZW5kZW50RmlsZXM7XG5cbiAgICAgICAgYmluYXJ5RGF0YSA9IGhhc2hJbmZvLmJpbmFyeURhdGE7XG4gICAgICAgIGlmICghYmluYXJ5RGF0YSkge1xuICAgICAgICAgIGJpbmFyeURhdGEgPSBhd2FpdCBwZnMucmVhZEZpbGUoY2FjaGVGaWxlKTtcbiAgICAgICAgICBiaW5hcnlEYXRhID0gYXdhaXQgcHpsaWIuZ3VuemlwKGJpbmFyeURhdGEpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgYnVmID0gYXdhaXQgcGZzLnJlYWRGaWxlKGNhY2hlRmlsZSk7XG4gICAgICAgIGxldCBzdHIgPSAoYXdhaXQgcHpsaWIuZ3VuemlwKGJ1ZikpLnRvU3RyaW5nKCd1dGY4Jyk7XG5cbiAgICAgICAgcmVzdWx0ID0gSlNPTi5wYXJzZShzdHIpO1xuICAgICAgICBjb2RlID0gcmVzdWx0LmNvZGU7XG4gICAgICAgIG1pbWVUeXBlID0gcmVzdWx0Lm1pbWVUeXBlO1xuICAgICAgICBkZXBlbmRlbnRGaWxlcyA9IHJlc3VsdC5kZXBlbmRlbnRGaWxlcztcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBkKGBGYWlsZWQgdG8gcmVhZCBjYWNoZSBmb3IgJHtmaWxlUGF0aH0sIGxvb2tlZCBpbiAke2NhY2hlRmlsZX06ICR7ZS5tZXNzYWdlfWApO1xuICAgIH1cblxuICAgIHJldHVybiB7IGhhc2hJbmZvLCBjb2RlLCBtaW1lVHlwZSwgYmluYXJ5RGF0YSwgZGVwZW5kZW50RmlsZXMgfTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFNhdmVzIGEgY29tcGlsZWQgcmVzdWx0IHRvIGNhY2hlXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gaGFzaEluZm8gIFRoZSBoYXNoIGluZm9ybWF0aW9uIHJldHVybmVkIGZyb20gZ2V0SGFzaEZvclBhdGhcbiAgICpcbiAgICogQHBhcmFtICB7c3RyaW5nIC8gQnVmZmVyfSBjb2RlT3JCaW5hcnlEYXRhICAgVGhlIGZpbGUncyBjb250ZW50cywgZWl0aGVyIGFzXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGEgc3RyaW5nIG9yIGEgQnVmZmVyLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG1pbWVUeXBlICBUaGUgTUlNRSB0eXBlIHJldHVybmVkIGJ5IHRoZSBjb21waWxlci5cbiAgICpcbiAgICogQHBhcmFtICB7c3RyaW5nW119IGRlcGVuZGVudEZpbGVzICBUaGUgbGlzdCBvZiBkZXBlbmRlbnQgZmlsZXMgcmV0dXJuZWQgYnlcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgY29tcGlsZXIuXG4gICAqIEByZXR1cm4ge1Byb21pc2V9ICBDb21wbGV0aW9uLlxuICAgKi9cbiAgYXN5bmMgc2F2ZShoYXNoSW5mbywgY29kZU9yQmluYXJ5RGF0YSwgbWltZVR5cGUsIGRlcGVuZGVudEZpbGVzKSB7XG4gICAgbGV0IGJ1ZiA9IG51bGw7XG4gICAgbGV0IHRhcmdldCA9IHBhdGguam9pbih0aGlzLmdldENhY2hlUGF0aCgpLCBoYXNoSW5mby5oYXNoKTtcbiAgICBkKGBTYXZpbmcgdG8gJHt0YXJnZXR9YCk7XG5cbiAgICBpZiAoaGFzaEluZm8uaXNGaWxlQmluYXJ5KSB7XG4gICAgICBidWYgPSBhd2FpdCBwemxpYi5nemlwKGNvZGVPckJpbmFyeURhdGEpO1xuICAgICAgYXdhaXQgcGZzLndyaXRlRmlsZSh0YXJnZXQgKyAnLmluZm8nLCBKU09OLnN0cmluZ2lmeSh7bWltZVR5cGUsIGRlcGVuZGVudEZpbGVzfSksICd1dGY4Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZiA9IGF3YWl0IHB6bGliLmd6aXAobmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeSh7Y29kZTogY29kZU9yQmluYXJ5RGF0YSwgbWltZVR5cGUsIGRlcGVuZGVudEZpbGVzfSkpKTtcbiAgICB9XG5cbiAgICBhd2FpdCBwZnMud3JpdGVGaWxlKHRhcmdldCwgYnVmKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBdHRlbXB0cyB0byBmaXJzdCBnZXQgYSBrZXkgdmlhIHtAbGluayBnZXR9LCB0aGVuIGlmIGl0IGZhaWxzLCBjYWxsIGEgbWV0aG9kXG4gICAqIHRvIHJldHJpZXZlIHRoZSBjb250ZW50cywgdGhlbiBzYXZlIHRoZSByZXN1bHQgdG8gY2FjaGUuXG4gICAqXG4gICAqIFRoZSBmZXRjaGVyIHBhcmFtZXRlciBpcyBleHBlY3RlZCB0byBoYXZlIHRoZSBzaWduYXR1cmU6XG4gICAqXG4gICAqIFByb21pc2U8T2JqZWN0PiBmZXRjaGVyKGZpbGVQYXRoIDogc3RyaW5nLCBoYXNoSW5mbyA6IE9iamVjdCk7XG4gICAqXG4gICAqIGhhc2hJbmZvIGlzIGEgdmFsdWUgcmV0dXJuZWQgZnJvbSBnZXRIYXNoRm9yUGF0aFxuICAgKiBUaGUgcmV0dXJuIHZhbHVlIG9mIGZldGNoZXIgbXVzdCBiZSBhbiBPYmplY3Qgd2l0aCB0aGUgcHJvcGVydGllczpcbiAgICpcbiAgICogbWltZVR5cGUgLSB0aGUgTUlNRSB0eXBlIG9mIHRoZSBkYXRhIHRvIHNhdmVcbiAgICogY29kZSAob3B0aW9uYWwpIC0gdGhlIHNvdXJjZSBjb2RlIGFzIGEgc3RyaW5nLCBpZiBmaWxlIGlzIHRleHRcbiAgICogYmluYXJ5RGF0YSAob3B0aW9uYWwpIC0gdGhlIGZpbGUgY29udGVudHMgYXMgYSBCdWZmZXIsIGlmIGZpbGUgaXMgYmluYXJ5XG4gICAqIGRlcGVuZGVudEZpbGVzIC0gdGhlIGRlcGVuZGVudCBmaWxlcyByZXR1cm5lZCBieSB0aGUgY29tcGlsZXIuXG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gZmlsZVBhdGggIFRoZSBwYXRoIHRvIHRoZSBmaWxlLiBGaWxlQ2hhbmdlZENhY2hlIHdpbGwgbG9va1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cCB0aGUgaGFzaCBhbmQgdXNlIHRoYXQgYXMgdGhlIGtleSBpbiB0aGUgY2FjaGUuXG4gICAqXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmZXRjaGVyICBBIG1ldGhvZCB3aGljaCBjb25mb3JtcyB0byB0aGUgZGVzY3JpcHRpb24gYWJvdmUuXG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0Pn0gIEFuIE9iamVjdCB3aGljaCBoYXMgdGhlIHNhbWUgZmllbGRzIGFzIHRoZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7QGxpbmsgZ2V0fSBtZXRob2QgcmV0dXJuIHJlc3VsdC5cbiAgICovXG4gIGFzeW5jIGdldE9yRmV0Y2goZmlsZVBhdGgsIGZldGNoZXIpIHtcbiAgICBsZXQgY2FjaGVSZXN1bHQgPSBhd2FpdCB0aGlzLmdldChmaWxlUGF0aCk7XG4gICAgaWYgKGNhY2hlUmVzdWx0LmNvZGUgfHwgY2FjaGVSZXN1bHQuYmluYXJ5RGF0YSkgcmV0dXJuIGNhY2hlUmVzdWx0O1xuXG4gICAgbGV0IHJlc3VsdCA9IGF3YWl0IGZldGNoZXIoZmlsZVBhdGgsIGNhY2hlUmVzdWx0Lmhhc2hJbmZvKSB8fCB7IGhhc2hJbmZvOiBjYWNoZVJlc3VsdC5oYXNoSW5mbyB9O1xuXG4gICAgaWYgKHJlc3VsdC5taW1lVHlwZSAmJiAhY2FjaGVSZXN1bHQuaGFzaEluZm8uaXNJbk5vZGVNb2R1bGVzKSB7XG4gICAgICBkKGBDYWNoZSBtaXNzOiBzYXZpbmcgb3V0IGluZm8gZm9yICR7ZmlsZVBhdGh9YCk7XG4gICAgICBhd2FpdCB0aGlzLnNhdmUoY2FjaGVSZXN1bHQuaGFzaEluZm8sIHJlc3VsdC5jb2RlIHx8IHJlc3VsdC5iaW5hcnlEYXRhLCByZXN1bHQubWltZVR5cGUsIHJlc3VsdC5kZXBlbmRlbnRGaWxlcyk7XG4gICAgfVxuXG4gICAgcmVzdWx0Lmhhc2hJbmZvID0gY2FjaGVSZXN1bHQuaGFzaEluZm87XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGdldFN5bmMoZmlsZVBhdGgpIHtcbiAgICBkKGBGZXRjaGluZyAke2ZpbGVQYXRofSBmcm9tIGNhY2hlYCk7XG4gICAgbGV0IGhhc2hJbmZvID0gdGhpcy5maWxlQ2hhbmdlQ2FjaGUuZ2V0SGFzaEZvclBhdGhTeW5jKHBhdGgucmVzb2x2ZShmaWxlUGF0aCkpO1xuXG4gICAgbGV0IGNvZGUgPSBudWxsO1xuICAgIGxldCBtaW1lVHlwZSA9IG51bGw7XG4gICAgbGV0IGJpbmFyeURhdGEgPSBudWxsO1xuICAgIGxldCBkZXBlbmRlbnRGaWxlcyA9IG51bGw7XG5cbiAgICB0cnkge1xuICAgICAgbGV0IGNhY2hlRmlsZSA9IHBhdGguam9pbih0aGlzLmdldENhY2hlUGF0aCgpLCBoYXNoSW5mby5oYXNoKTtcblxuICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG4gICAgICBpZiAoaGFzaEluZm8uaXNGaWxlQmluYXJ5KSB7XG4gICAgICAgIGQoXCJGaWxlIGlzIGJpbmFyeSwgcmVhZGluZyBvdXQgaW5mb1wiKTtcbiAgICAgICAgbGV0IGluZm8gPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhjYWNoZUZpbGUgKyAnLmluZm8nKSk7XG4gICAgICAgIG1pbWVUeXBlID0gaW5mby5taW1lVHlwZTtcbiAgICAgICAgZGVwZW5kZW50RmlsZXMgPSBpbmZvLmRlcGVuZGVudEZpbGVzO1xuXG4gICAgICAgIGJpbmFyeURhdGEgPSBoYXNoSW5mby5iaW5hcnlEYXRhO1xuICAgICAgICBpZiAoIWJpbmFyeURhdGEpIHtcbiAgICAgICAgICBiaW5hcnlEYXRhID0gZnMucmVhZEZpbGVTeW5jKGNhY2hlRmlsZSk7XG4gICAgICAgICAgYmluYXJ5RGF0YSA9IHpsaWIuZ3VuemlwU3luYyhiaW5hcnlEYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IGJ1ZiA9IGZzLnJlYWRGaWxlU3luYyhjYWNoZUZpbGUpO1xuICAgICAgICBsZXQgc3RyID0gKHpsaWIuZ3VuemlwU3luYyhidWYpKS50b1N0cmluZygndXRmOCcpO1xuXG4gICAgICAgIHJlc3VsdCA9IEpTT04ucGFyc2Uoc3RyKTtcbiAgICAgICAgY29kZSA9IHJlc3VsdC5jb2RlO1xuICAgICAgICBtaW1lVHlwZSA9IHJlc3VsdC5taW1lVHlwZTtcbiAgICAgICAgZGVwZW5kZW50RmlsZXMgPSByZXN1bHQuZGVwZW5kZW50RmlsZXM7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZChgRmFpbGVkIHRvIHJlYWQgY2FjaGUgZm9yICR7ZmlsZVBhdGh9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgaGFzaEluZm8sIGNvZGUsIG1pbWVUeXBlLCBiaW5hcnlEYXRhLCBkZXBlbmRlbnRGaWxlcyB9O1xuICB9XG5cbiAgc2F2ZVN5bmMoaGFzaEluZm8sIGNvZGVPckJpbmFyeURhdGEsIG1pbWVUeXBlLCBkZXBlbmRlbnRGaWxlcykge1xuICAgIGxldCBidWYgPSBudWxsO1xuICAgIGxldCB0YXJnZXQgPSBwYXRoLmpvaW4odGhpcy5nZXRDYWNoZVBhdGgoKSwgaGFzaEluZm8uaGFzaCk7XG4gICAgZChgU2F2aW5nIHRvICR7dGFyZ2V0fWApO1xuXG4gICAgaWYgKGhhc2hJbmZvLmlzRmlsZUJpbmFyeSkge1xuICAgICAgYnVmID0gemxpYi5nemlwU3luYyhjb2RlT3JCaW5hcnlEYXRhKTtcbiAgICAgIGZzLndyaXRlRmlsZVN5bmModGFyZ2V0ICsgJy5pbmZvJywgSlNPTi5zdHJpbmdpZnkoe21pbWVUeXBlLCBkZXBlbmRlbnRGaWxlc30pLCAndXRmOCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBidWYgPSB6bGliLmd6aXBTeW5jKG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkoe2NvZGU6IGNvZGVPckJpbmFyeURhdGEsIG1pbWVUeXBlLCBkZXBlbmRlbnRGaWxlc30pKSk7XG4gICAgfVxuXG4gICAgZnMud3JpdGVGaWxlU3luYyh0YXJnZXQsIGJ1Zik7XG4gIH1cblxuICBnZXRPckZldGNoU3luYyhmaWxlUGF0aCwgZmV0Y2hlcikge1xuICAgIGxldCBjYWNoZVJlc3VsdCA9IHRoaXMuZ2V0U3luYyhmaWxlUGF0aCk7XG4gICAgaWYgKGNhY2hlUmVzdWx0LmNvZGUgfHwgY2FjaGVSZXN1bHQuYmluYXJ5RGF0YSkgcmV0dXJuIGNhY2hlUmVzdWx0O1xuXG4gICAgbGV0IHJlc3VsdCA9IGZldGNoZXIoZmlsZVBhdGgsIGNhY2hlUmVzdWx0Lmhhc2hJbmZvKSB8fCB7IGhhc2hJbmZvOiBjYWNoZVJlc3VsdC5oYXNoSW5mbyB9O1xuXG4gICAgaWYgKHJlc3VsdC5taW1lVHlwZSAmJiAhY2FjaGVSZXN1bHQuaGFzaEluZm8uaXNJbk5vZGVNb2R1bGVzKSB7XG4gICAgICBkKGBDYWNoZSBtaXNzOiBzYXZpbmcgb3V0IGluZm8gZm9yICR7ZmlsZVBhdGh9YCk7XG4gICAgICB0aGlzLnNhdmVTeW5jKGNhY2hlUmVzdWx0Lmhhc2hJbmZvLCByZXN1bHQuY29kZSB8fCByZXN1bHQuYmluYXJ5RGF0YSwgcmVzdWx0Lm1pbWVUeXBlLCByZXN1bHQuZGVwZW5kZW50RmlsZXMpO1xuICAgIH1cblxuICAgIHJlc3VsdC5oYXNoSW5mbyA9IGNhY2hlUmVzdWx0Lmhhc2hJbmZvO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZ2V0Q2FjaGVQYXRoKCkge1xuICAgIC8vIE5COiBUaGlzIGlzIGFuIGV2aWwgaGFjayBzbyB0aGF0IGNyZWF0ZUZyb21Db21waWxlciBjYW4gc3RvbXAgaXRcbiAgICAvLyBhdCB3aWxsXG4gICAgcmV0dXJuIHRoaXMuY2FjaGVQYXRoO1xuICB9XG5cblxuICAvKipcbiAgICogUmV0dXJucyB3aGV0aGVyIGEgZmlsZSBzaG91bGQgbm90IGJlIGNvbXBpbGVkLiBOb3RlIHRoYXQgdGhpcyBkb2Vzbid0XG4gICAqIG5lY2Vzc2FyaWx5IG1lYW4gaXQgd29uJ3QgZW5kIHVwIGluIHRoZSBjYWNoZSwgb25seSB0aGF0IGl0cyBjb250ZW50cyBhcmVcbiAgICogc2F2ZWQgdmVyYmF0aW0gaW5zdGVhZCBvZiB0cnlpbmcgdG8gZmluZCBhbiBhcHByb3ByaWF0ZSBjb21waWxlci5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSBoYXNoSW5mbyAgVGhlIGhhc2ggaW5mb3JtYXRpb24gcmV0dXJuZWQgZnJvbSBnZXRIYXNoRm9yUGF0aFxuICAgKlxuICAgKiBAcmV0dXJuIHtib29sZWFufSAgVHJ1ZSBpZiBhIGZpbGUgc2hvdWxkIGJlIGlnbm9yZWRcbiAgICovXG4gIHN0YXRpYyBzaG91bGRQYXNzdGhyb3VnaChoYXNoSW5mbykge1xuICAgIHJldHVybiBoYXNoSW5mby5pc01pbmlmaWVkIHx8IGhhc2hJbmZvLmlzSW5Ob2RlTW9kdWxlcyB8fCBoYXNoSW5mby5oYXNTb3VyY2VNYXAgfHwgaGFzaEluZm8uaXNGaWxlQmluYXJ5O1xuICB9XG59XG4iXX0=