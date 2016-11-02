'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _zlib = require('zlib');

var _zlib2 = _interopRequireDefault(_zlib);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _promise = require('./promise');

var _sanitizePaths = require('./sanitize-paths');

var _sanitizePaths2 = _interopRequireDefault(_sanitizePaths);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const d = require('debug-electron')('electron-compile:file-change-cache');

/**
 * This class caches information about files and determines whether they have
 * changed contents or not. Most importantly, this class caches the hash of seen
 * files so that at development time, we don't have to recalculate them constantly.
 *
 * This class is also the core of how electron-compile runs quickly in production
 * mode - after precompilation, the cache is serialized along with the rest of the
 * data in {@link CompilerHost}, so that when we load the app in production mode,
 * we don't end up calculating hashes of file content at all, only using the contents
 * of this cache.
 */
class FileChangedCache {
  constructor(appRoot) {
    let failOnCacheMiss = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    this.appRoot = (0, _sanitizePaths2.default)(appRoot);

    this.failOnCacheMiss = failOnCacheMiss;
    this.changeCache = {};
  }

  /**
   * Allows you to create a FileChangedCache from serialized data saved from
   * {@link getSavedData}.
   *
   * @param  {Object} data  Saved data from getSavedData.
   *
   * @param  {string} appRoot  The top-level directory for your application (i.e.
   *                           the one which has your package.json).
   *
   * @param  {boolean} failOnCacheMiss (optional)  If True, cache misses will throw.
   *
   * @return {FileChangedCache}
   */
  static loadFromData(data, appRoot) {
    let failOnCacheMiss = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

    let ret = new FileChangedCache(appRoot, failOnCacheMiss);
    ret.changeCache = data.changeCache;
    ret.originalAppRoot = data.appRoot;

    return ret;
  }

  /**
   * Allows you to create a FileChangedCache from serialized data saved from
   * {@link save}.
   *
   * @param  {string} file  Saved data from save.
   *
   * @param  {string} appRoot  The top-level directory for your application (i.e.
   *                           the one which has your package.json).
   *
   * @param  {boolean} failOnCacheMiss (optional)  If True, cache misses will throw.
   *
   * @return {Promise<FileChangedCache>}
   */
  static loadFromFile(file, appRoot) {
    let failOnCacheMiss = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    return _asyncToGenerator(function* () {
      d(`Loading canned FileChangedCache from ${ file }`);

      let buf = yield _promise.pfs.readFile(file);
      return FileChangedCache.loadFromData(JSON.parse((yield _promise.pzlib.gunzip(buf))), appRoot, failOnCacheMiss);
    })();
  }

  /**
   * Returns information about a given file, including its hash. This method is
   * the main method for this cache.
   *
   * @param  {string} absoluteFilePath  The path to a file to retrieve info on.
   *
   * @return {Promise<Object>}
   *
   * @property {string} hash  The SHA1 hash of the file
   * @property {boolean} isMinified  True if the file is minified
   * @property {boolean} isInNodeModules  True if the file is in a library directory
   * @property {boolean} hasSourceMap  True if the file has a source map
   * @property {boolean} isFileBinary  True if the file is not a text file
   * @property {Buffer} binaryData (optional)  The buffer that was read if the file
   *                                           was binary and there was a cache miss.
   * @property {string} code (optional)  The string that was read if the file
   *                                     was text and there was a cache miss
   */
  getHashForPath(absoluteFilePath) {
    var _this = this;

    return _asyncToGenerator(function* () {
      let cacheKey = (0, _sanitizePaths2.default)(absoluteFilePath);
      if (_this.appRoot) {
        cacheKey = cacheKey.replace(_this.appRoot, '');
      }

      // NB: We do this because x-require will include an absolute path from the
      // original built app and we need to still grok it
      if (_this.originalAppRoot) {
        cacheKey = cacheKey.replace(_this.originalAppRoot, '');
      }

      let cacheEntry = _this.changeCache[cacheKey];

      if (_this.failOnCacheMiss) {
        if (!cacheEntry) {
          d(`Tried to read file cache entry for ${ absoluteFilePath }`);
          d(`cacheKey: ${ cacheKey }, appRoot: ${ _this.appRoot }, originalAppRoot: ${ _this.originalAppRoot }`);
          throw new Error(`Asked for ${ absoluteFilePath } but it was not precompiled!`);
        }

        return cacheEntry.info;
      }

      let stat = yield _promise.pfs.stat(absoluteFilePath);
      let ctime = stat.ctime.getTime();
      let size = stat.size;
      if (!stat || !stat.isFile()) throw new Error(`Can't stat ${ absoluteFilePath }`);

      if (cacheEntry) {
        if (cacheEntry.ctime >= ctime && cacheEntry.size === size) {
          return cacheEntry.info;
        }

        d(`Invalidating cache entry: ${ cacheEntry.ctime } === ${ ctime } && ${ cacheEntry.size } === ${ size }`);
        delete _this.changeCache.cacheEntry;
      }

      var _ref = yield _this.calculateHashForFile(absoluteFilePath);

      let digest = _ref.digest,
          sourceCode = _ref.sourceCode,
          binaryData = _ref.binaryData;


      let info = {
        hash: digest,
        isMinified: FileChangedCache.contentsAreMinified(sourceCode || ''),
        isInNodeModules: FileChangedCache.isInNodeModules(absoluteFilePath),
        hasSourceMap: FileChangedCache.hasSourceMap(sourceCode || ''),
        isFileBinary: !!binaryData
      };

      _this.changeCache[cacheKey] = { ctime, size, info };
      d(`Cache entry for ${ cacheKey }: ${ JSON.stringify(_this.changeCache[cacheKey]) }`);

      if (binaryData) {
        return Object.assign({ binaryData }, info);
      } else {
        return Object.assign({ sourceCode }, info);
      }
    })();
  }

  /**
   * Returns data that can passed to {@link loadFromData} to rehydrate this cache.
   *
   * @return {Object}
   */
  getSavedData() {
    return { changeCache: this.changeCache, appRoot: this.appRoot };
  }

  /**
   * Serializes this object's data to a file.
   *
   * @param {string} filePath  The path to save data to.
   *
   * @return {Promise} Completion.
   */
  save(filePath) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      let toSave = _this2.getSavedData();

      let buf = yield _promise.pzlib.gzip(new Buffer(JSON.stringify(toSave)));
      yield _promise.pfs.writeFile(filePath, buf);
    })();
  }

  calculateHashForFile(absoluteFilePath) {
    return _asyncToGenerator(function* () {
      let buf = yield _promise.pfs.readFile(absoluteFilePath);
      let encoding = FileChangedCache.detectFileEncoding(buf);

      if (!encoding) {
        let digest = _crypto2.default.createHash('sha1').update(buf).digest('hex');
        return { sourceCode: null, digest, binaryData: buf };
      }

      let sourceCode = yield _promise.pfs.readFile(absoluteFilePath, encoding);
      let digest = _crypto2.default.createHash('sha1').update(sourceCode, 'utf8').digest('hex');

      return { sourceCode, digest, binaryData: null };
    })();
  }

  getHashForPathSync(absoluteFilePath) {
    let cacheKey = (0, _sanitizePaths2.default)(absoluteFilePath);
    if (this.appRoot) {
      cacheKey = cacheKey.replace(this.appRoot, '');
    }

    // NB: We do this because x-require will include an absolute path from the
    // original built app and we need to still grok it
    if (this.originalAppRoot) {
      cacheKey = cacheKey.replace(this.originalAppRoot, '');
    }

    if (this.realAppRoot) {
      cacheKey = cacheKey.replace(this.realAppRoot, '');
    }

    let cacheEntry = this.changeCache[cacheKey];

    if (this.failOnCacheMiss) {
      if (!cacheEntry) {
        d(`Tried to read file cache entry for ${ absoluteFilePath }`);
        d(`cacheKey: ${ cacheKey }, appRoot: ${ this.appRoot }, originalAppRoot: ${ this.originalAppRoot }`);
        throw new Error(`Asked for ${ absoluteFilePath } but it was not precompiled!`);
      }

      return cacheEntry.info;
    }

    let stat = _fs2.default.statSync(absoluteFilePath);
    let ctime = stat.ctime.getTime();
    let size = stat.size;
    if (!stat || !stat.isFile()) throw new Error(`Can't stat ${ absoluteFilePath }`);

    if (cacheEntry) {
      if (cacheEntry.ctime >= ctime && cacheEntry.size === size) {
        return cacheEntry.info;
      }

      d(`Invalidating cache entry: ${ cacheEntry.ctime } === ${ ctime } && ${ cacheEntry.size } === ${ size }`);
      delete this.changeCache.cacheEntry;
    }

    var _calculateHashForFile = this.calculateHashForFileSync(absoluteFilePath);

    let digest = _calculateHashForFile.digest,
        sourceCode = _calculateHashForFile.sourceCode,
        binaryData = _calculateHashForFile.binaryData;


    let info = {
      hash: digest,
      isMinified: FileChangedCache.contentsAreMinified(sourceCode || ''),
      isInNodeModules: FileChangedCache.isInNodeModules(absoluteFilePath),
      hasSourceMap: FileChangedCache.hasSourceMap(sourceCode || ''),
      isFileBinary: !!binaryData
    };

    this.changeCache[cacheKey] = { ctime, size, info };
    d(`Cache entry for ${ cacheKey }: ${ JSON.stringify(this.changeCache[cacheKey]) }`);

    if (binaryData) {
      return Object.assign({ binaryData }, info);
    } else {
      return Object.assign({ sourceCode }, info);
    }
  }

  saveSync(filePath) {
    let toSave = this.getSavedData();

    let buf = _zlib2.default.gzipSync(new Buffer(JSON.stringify(toSave)));
    _fs2.default.writeFileSync(filePath, buf);
  }

  calculateHashForFileSync(absoluteFilePath) {
    let buf = _fs2.default.readFileSync(absoluteFilePath);
    let encoding = FileChangedCache.detectFileEncoding(buf);

    if (!encoding) {
      let digest = _crypto2.default.createHash('sha1').update(buf).digest('hex');
      return { sourceCode: null, digest, binaryData: buf };
    }

    let sourceCode = _fs2.default.readFileSync(absoluteFilePath, encoding);
    let digest = _crypto2.default.createHash('sha1').update(sourceCode, 'utf8').digest('hex');

    return { sourceCode, digest, binaryData: null };
  }

  /**
   * Determines via some statistics whether a file is likely to be minified.
   *
   * @private
   */
  static contentsAreMinified(source) {
    let length = source.length;
    if (length > 1024) length = 1024;

    let newlineCount = 0;

    // Roll through the characters and determine the average line length
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '\n') newlineCount++;
    }

    // No Newlines? Any file other than a super small one is minified
    if (newlineCount === 0) {
      return length > 80;
    }

    let avgLineLength = length / newlineCount;
    return avgLineLength > 80;
  }

  /**
   * Determines whether a path is in node_modules or the Electron init code
   *
   * @private
   */
  static isInNodeModules(filePath) {
    return !!(filePath.match(/(node_modules|bower_components)[\\\/]/i) || filePath.match(/(atom|electron)\.asar/));
  }

  /**
   * Returns whether a file has an inline source map
   *
   * @private
   */
  static hasSourceMap(sourceCode) {
    const trimmed = sourceCode.trim();
    return trimmed.lastIndexOf('//# sourceMap') > trimmed.lastIndexOf('\n');
  }

  /**
   * Determines the encoding of a file from the two most common encodings by trying
   * to decode it then looking for encoding errors
   *
   * @private
   */
  static detectFileEncoding(buffer) {
    if (buffer.length < 1) return false;
    let buf = buffer.length < 4096 ? buffer : buffer.slice(0, 4096);

    const encodings = ['utf8', 'utf16le'];

    let encoding = encodings.find(x => !FileChangedCache.containsControlCharacters(buf.toString(x)));

    return encoding;
  }

  /**
   * Determines whether a string is likely to be poorly encoded by looking for
   * control characters above a certain threshold
   *
   * @private
   */
  static containsControlCharacters(str) {
    let controlCount = 0;
    let spaceCount = 0;
    let threshold = 2;
    if (str.length > 64) threshold = 4;
    if (str.length > 512) threshold = 8;

    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c === 65536 || c < 8) controlCount++;
      if (c > 14 && c < 32) controlCount++;
      if (c === 32) spaceCount++;

      if (controlCount > threshold) return true;
    }

    if (spaceCount < threshold) return true;

    if (controlCount === 0) return false;
    return controlCount / str.length < 0.02;
  }
}
exports.default = FileChangedCache;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9maWxlLWNoYW5nZS1jYWNoZS5qcyJdLCJuYW1lcyI6WyJkIiwicmVxdWlyZSIsIkZpbGVDaGFuZ2VkQ2FjaGUiLCJjb25zdHJ1Y3RvciIsImFwcFJvb3QiLCJmYWlsT25DYWNoZU1pc3MiLCJjaGFuZ2VDYWNoZSIsImxvYWRGcm9tRGF0YSIsImRhdGEiLCJyZXQiLCJvcmlnaW5hbEFwcFJvb3QiLCJsb2FkRnJvbUZpbGUiLCJmaWxlIiwiYnVmIiwicmVhZEZpbGUiLCJKU09OIiwicGFyc2UiLCJndW56aXAiLCJnZXRIYXNoRm9yUGF0aCIsImFic29sdXRlRmlsZVBhdGgiLCJjYWNoZUtleSIsInJlcGxhY2UiLCJjYWNoZUVudHJ5IiwiRXJyb3IiLCJpbmZvIiwic3RhdCIsImN0aW1lIiwiZ2V0VGltZSIsInNpemUiLCJpc0ZpbGUiLCJjYWxjdWxhdGVIYXNoRm9yRmlsZSIsImRpZ2VzdCIsInNvdXJjZUNvZGUiLCJiaW5hcnlEYXRhIiwiaGFzaCIsImlzTWluaWZpZWQiLCJjb250ZW50c0FyZU1pbmlmaWVkIiwiaXNJbk5vZGVNb2R1bGVzIiwiaGFzU291cmNlTWFwIiwiaXNGaWxlQmluYXJ5Iiwic3RyaW5naWZ5IiwiT2JqZWN0IiwiYXNzaWduIiwiZ2V0U2F2ZWREYXRhIiwic2F2ZSIsImZpbGVQYXRoIiwidG9TYXZlIiwiZ3ppcCIsIkJ1ZmZlciIsIndyaXRlRmlsZSIsImVuY29kaW5nIiwiZGV0ZWN0RmlsZUVuY29kaW5nIiwiY3JlYXRlSGFzaCIsInVwZGF0ZSIsImdldEhhc2hGb3JQYXRoU3luYyIsInJlYWxBcHBSb290Iiwic3RhdFN5bmMiLCJjYWxjdWxhdGVIYXNoRm9yRmlsZVN5bmMiLCJzYXZlU3luYyIsImd6aXBTeW5jIiwid3JpdGVGaWxlU3luYyIsInJlYWRGaWxlU3luYyIsInNvdXJjZSIsImxlbmd0aCIsIm5ld2xpbmVDb3VudCIsImkiLCJhdmdMaW5lTGVuZ3RoIiwibWF0Y2giLCJ0cmltbWVkIiwidHJpbSIsImxhc3RJbmRleE9mIiwiYnVmZmVyIiwic2xpY2UiLCJlbmNvZGluZ3MiLCJmaW5kIiwieCIsImNvbnRhaW5zQ29udHJvbENoYXJhY3RlcnMiLCJ0b1N0cmluZyIsInN0ciIsImNvbnRyb2xDb3VudCIsInNwYWNlQ291bnQiLCJ0aHJlc2hvbGQiLCJjIiwiY2hhckNvZGVBdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7O0FBQ0E7Ozs7Ozs7O0FBRUEsTUFBTUEsSUFBSUMsUUFBUSxnQkFBUixFQUEwQixvQ0FBMUIsQ0FBVjs7QUFFQTs7Ozs7Ozs7Ozs7QUFXZSxNQUFNQyxnQkFBTixDQUF1QjtBQUNwQ0MsY0FBWUMsT0FBWixFQUE0QztBQUFBLFFBQXZCQyxlQUF1Qix1RUFBUCxLQUFPOztBQUMxQyxTQUFLRCxPQUFMLEdBQWUsNkJBQWlCQSxPQUFqQixDQUFmOztBQUVBLFNBQUtDLGVBQUwsR0FBdUJBLGVBQXZCO0FBQ0EsU0FBS0MsV0FBTCxHQUFtQixFQUFuQjtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7O0FBYUEsU0FBT0MsWUFBUCxDQUFvQkMsSUFBcEIsRUFBMEJKLE9BQTFCLEVBQXlEO0FBQUEsUUFBdEJDLGVBQXNCLHVFQUFOLElBQU07O0FBQ3ZELFFBQUlJLE1BQU0sSUFBSVAsZ0JBQUosQ0FBcUJFLE9BQXJCLEVBQThCQyxlQUE5QixDQUFWO0FBQ0FJLFFBQUlILFdBQUosR0FBa0JFLEtBQUtGLFdBQXZCO0FBQ0FHLFFBQUlDLGVBQUosR0FBc0JGLEtBQUtKLE9BQTNCOztBQUVBLFdBQU9LLEdBQVA7QUFDRDs7QUFHRDs7Ozs7Ozs7Ozs7OztBQWFBLFNBQWFFLFlBQWIsQ0FBMEJDLElBQTFCLEVBQWdDUixPQUFoQyxFQUErRDtBQUFBLFFBQXRCQyxlQUFzQix1RUFBTixJQUFNO0FBQUE7QUFDN0RMLFFBQUcseUNBQXVDWSxJQUFLLEdBQS9DOztBQUVBLFVBQUlDLE1BQU0sTUFBTSxhQUFJQyxRQUFKLENBQWFGLElBQWIsQ0FBaEI7QUFDQSxhQUFPVixpQkFB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ZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHpsaWIgZnJvbSAnemxpYic7XG5pbXBvcnQgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQge3BmcywgcHpsaWJ9IGZyb20gJy4vcHJvbWlzZSc7XG5pbXBvcnQgc2FuaXRpemVGaWxlUGF0aCBmcm9tICcuL3Nhbml0aXplLXBhdGhzJztcblxuY29uc3QgZCA9IHJlcXVpcmUoJ2RlYnVnLWVsZWN0cm9uJykoJ2VsZWN0cm9uLWNvbXBpbGU6ZmlsZS1jaGFuZ2UtY2FjaGUnKTtcblxuLyoqXG4gKiBUaGlzIGNsYXNzIGNhY2hlcyBpbmZvcm1hdGlvbiBhYm91dCBmaWxlcyBhbmQgZGV0ZXJtaW5lcyB3aGV0aGVyIHRoZXkgaGF2ZVxuICogY2hhbmdlZCBjb250ZW50cyBvciBub3QuIE1vc3QgaW1wb3J0YW50bHksIHRoaXMgY2xhc3MgY2FjaGVzIHRoZSBoYXNoIG9mIHNlZW5cbiAqIGZpbGVzIHNvIHRoYXQgYXQgZGV2ZWxvcG1lbnQgdGltZSwgd2UgZG9uJ3QgaGF2ZSB0byByZWNhbGN1bGF0ZSB0aGVtIGNvbnN0YW50bHkuXG4gKlxuICogVGhpcyBjbGFzcyBpcyBhbHNvIHRoZSBjb3JlIG9mIGhvdyBlbGVjdHJvbi1jb21waWxlIHJ1bnMgcXVpY2tseSBpbiBwcm9kdWN0aW9uXG4gKiBtb2RlIC0gYWZ0ZXIgcHJlY29tcGlsYXRpb24sIHRoZSBjYWNoZSBpcyBzZXJpYWxpemVkIGFsb25nIHdpdGggdGhlIHJlc3Qgb2YgdGhlXG4gKiBkYXRhIGluIHtAbGluayBDb21waWxlckhvc3R9LCBzbyB0aGF0IHdoZW4gd2UgbG9hZCB0aGUgYXBwIGluIHByb2R1Y3Rpb24gbW9kZSxcbiAqIHdlIGRvbid0IGVuZCB1cCBjYWxjdWxhdGluZyBoYXNoZXMgb2YgZmlsZSBjb250ZW50IGF0IGFsbCwgb25seSB1c2luZyB0aGUgY29udGVudHNcbiAqIG9mIHRoaXMgY2FjaGUuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZpbGVDaGFuZ2VkQ2FjaGUge1xuICBjb25zdHJ1Y3RvcihhcHBSb290LCBmYWlsT25DYWNoZU1pc3M9ZmFsc2UpIHtcbiAgICB0aGlzLmFwcFJvb3QgPSBzYW5pdGl6ZUZpbGVQYXRoKGFwcFJvb3QpO1xuXG4gICAgdGhpcy5mYWlsT25DYWNoZU1pc3MgPSBmYWlsT25DYWNoZU1pc3M7XG4gICAgdGhpcy5jaGFuZ2VDYWNoZSA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIEFsbG93cyB5b3UgdG8gY3JlYXRlIGEgRmlsZUNoYW5nZWRDYWNoZSBmcm9tIHNlcmlhbGl6ZWQgZGF0YSBzYXZlZCBmcm9tXG4gICAqIHtAbGluayBnZXRTYXZlZERhdGF9LlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgIFNhdmVkIGRhdGEgZnJvbSBnZXRTYXZlZERhdGEuXG4gICAqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gYXBwUm9vdCAgVGhlIHRvcC1sZXZlbCBkaXJlY3RvcnkgZm9yIHlvdXIgYXBwbGljYXRpb24gKGkuZS5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgb25lIHdoaWNoIGhhcyB5b3VyIHBhY2thZ2UuanNvbikuXG4gICAqXG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IGZhaWxPbkNhY2hlTWlzcyAob3B0aW9uYWwpICBJZiBUcnVlLCBjYWNoZSBtaXNzZXMgd2lsbCB0aHJvdy5cbiAgICpcbiAgICogQHJldHVybiB7RmlsZUNoYW5nZWRDYWNoZX1cbiAgICovXG4gIHN0YXRpYyBsb2FkRnJvbURhdGEoZGF0YSwgYXBwUm9vdCwgZmFpbE9uQ2FjaGVNaXNzPXRydWUpIHtcbiAgICBsZXQgcmV0ID0gbmV3IEZpbGVDaGFuZ2VkQ2FjaGUoYXBwUm9vdCwgZmFpbE9uQ2FjaGVNaXNzKTtcbiAgICByZXQuY2hhbmdlQ2FjaGUgPSBkYXRhLmNoYW5nZUNhY2hlO1xuICAgIHJldC5vcmlnaW5hbEFwcFJvb3QgPSBkYXRhLmFwcFJvb3Q7XG5cbiAgICByZXR1cm4gcmV0O1xuICB9XG5cblxuICAvKipcbiAgICogQWxsb3dzIHlvdSB0byBjcmVhdGUgYSBGaWxlQ2hhbmdlZENhY2hlIGZyb20gc2VyaWFsaXplZCBkYXRhIHNhdmVkIGZyb21cbiAgICoge0BsaW5rIHNhdmV9LlxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGZpbGUgIFNhdmVkIGRhdGEgZnJvbSBzYXZlLlxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGFwcFJvb3QgIFRoZSB0b3AtbGV2ZWwgZGlyZWN0b3J5IGZvciB5b3VyIGFwcGxpY2F0aW9uIChpLmUuXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlIG9uZSB3aGljaCBoYXMgeW91ciBwYWNrYWdlLmpzb24pLlxuICAgKlxuICAgKiBAcGFyYW0gIHtib29sZWFufSBmYWlsT25DYWNoZU1pc3MgKG9wdGlvbmFsKSAgSWYgVHJ1ZSwgY2FjaGUgbWlzc2VzIHdpbGwgdGhyb3cuXG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2U8RmlsZUNoYW5nZWRDYWNoZT59XG4gICAqL1xuICBzdGF0aWMgYXN5bmMgbG9hZEZyb21GaWxlKGZpbGUsIGFwcFJvb3QsIGZhaWxPbkNhY2hlTWlzcz10cnVlKSB7XG4gICAgZChgTG9hZGluZyBjYW5uZWQgRmlsZUNoYW5nZWRDYWNoZSBmcm9tICR7ZmlsZX1gKTtcblxuICAgIGxldCBidWYgPSBhd2FpdCBwZnMucmVhZEZpbGUoZmlsZSk7XG4gICAgcmV0dXJuIEZpbGVDaGFuZ2VkQ2FjaGUubG9hZEZyb21EYXRhKEpTT04ucGFyc2UoYXdhaXQgcHpsaWIuZ3VuemlwKGJ1ZikpLCBhcHBSb290LCBmYWlsT25DYWNoZU1pc3MpO1xuICB9XG5cblxuICAvKipcbiAgICogUmV0dXJucyBpbmZvcm1hdGlvbiBhYm91dCBhIGdpdmVuIGZpbGUsIGluY2x1ZGluZyBpdHMgaGFzaC4gVGhpcyBtZXRob2QgaXNcbiAgICogdGhlIG1haW4gbWV0aG9kIGZvciB0aGlzIGNhY2hlLlxuICAgKlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGFic29sdXRlRmlsZVBhdGggIFRoZSBwYXRoIHRvIGEgZmlsZSB0byByZXRyaWV2ZSBpbmZvIG9uLlxuICAgKlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdD59XG4gICAqXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBoYXNoICBUaGUgU0hBMSBoYXNoIG9mIHRoZSBmaWxlXG4gICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gaXNNaW5pZmllZCAgVHJ1ZSBpZiB0aGUgZmlsZSBpcyBtaW5pZmllZFxuICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IGlzSW5Ob2RlTW9kdWxlcyAgVHJ1ZSBpZiB0aGUgZmlsZSBpcyBpbiBhIGxpYnJhcnkgZGlyZWN0b3J5XG4gICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gaGFzU291cmNlTWFwICBUcnVlIGlmIHRoZSBmaWxlIGhhcyBhIHNvdXJjZSBtYXBcbiAgICogQHByb3BlcnR5IHtib29sZWFufSBpc0ZpbGVCaW5hcnkgIFRydWUgaWYgdGhlIGZpbGUgaXMgbm90IGEgdGV4dCBmaWxlXG4gICAqIEBwcm9wZXJ0eSB7QnVmZmVyfSBiaW5hcnlEYXRhIChvcHRpb25hbCkgIFRoZSBidWZmZXIgdGhhdCB3YXMgcmVhZCBpZiB0aGUgZmlsZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3YXMgYmluYXJ5IGFuZCB0aGVyZSB3YXMgYSBjYWNoZSBtaXNzLlxuICAgKiBAcHJvcGVydHkge3N0cmluZ30gY29kZSAob3B0aW9uYWwpICBUaGUgc3RyaW5nIHRoYXQgd2FzIHJlYWQgaWYgdGhlIGZpbGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2FzIHRleHQgYW5kIHRoZXJlIHdhcyBhIGNhY2hlIG1pc3NcbiAgICovXG4gIGFzeW5jIGdldEhhc2hGb3JQYXRoKGFic29sdXRlRmlsZVBhdGgpIHtcbiAgICBsZXQgY2FjaGVLZXkgPSBzYW5pdGl6ZUZpbGVQYXRoKGFic29sdXRlRmlsZVBhdGgpO1xuICAgIGlmICh0aGlzLmFwcFJvb3QpIHtcbiAgICAgIGNhY2hlS2V5ID0gY2FjaGVLZXkucmVwbGFjZSh0aGlzLmFwcFJvb3QsICcnKTtcbiAgICB9XG5cbiAgICAvLyBOQjogV2UgZG8gdGhpcyBiZWNhdXNlIHgtcmVxdWlyZSB3aWxsIGluY2x1ZGUgYW4gYWJzb2x1dGUgcGF0aCBmcm9tIHRoZVxuICAgIC8vIG9yaWdpbmFsIGJ1aWx0IGFwcCBhbmQgd2UgbmVlZCB0byBzdGlsbCBncm9rIGl0XG4gICAgaWYgKHRoaXMub3JpZ2luYWxBcHBSb290KSB7XG4gICAgICBjYWNoZUtleSA9IGNhY2hlS2V5LnJlcGxhY2UodGhpcy5vcmlnaW5hbEFwcFJvb3QsICcnKTtcbiAgICB9XG5cbiAgICBsZXQgY2FjaGVFbnRyeSA9IHRoaXMuY2hhbmdlQ2FjaGVbY2FjaGVLZXldO1xuXG4gICAgaWYgKHRoaXMuZmFpbE9uQ2FjaGVNaXNzKSB7XG4gICAgICBpZiAoIWNhY2hlRW50cnkpIHtcbiAgICAgICAgZChgVHJpZWQgdG8gcmVhZCBmaWxlIGNhY2hlIGVudHJ5IGZvciAke2Fic29sdXRlRmlsZVBhdGh9YCk7XG4gICAgICAgIGQoYGNhY2hlS2V5OiAke2NhY2hlS2V5fSwgYXBwUm9vdDogJHt0aGlzLmFwcFJvb3R9LCBvcmlnaW5hbEFwcFJvb3Q6ICR7dGhpcy5vcmlnaW5hbEFwcFJvb3R9YCk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNrZWQgZm9yICR7YWJzb2x1dGVGaWxlUGF0aH0gYnV0IGl0IHdhcyBub3QgcHJlY29tcGlsZWQhYCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBjYWNoZUVudHJ5LmluZm87XG4gICAgfVxuXG4gICAgbGV0IHN0YXQgPSBhd2FpdCBwZnMuc3RhdChhYnNvbHV0ZUZpbGVQYXRoKTtcbiAgICBsZXQgY3RpbWUgPSBzdGF0LmN0aW1lLmdldFRpbWUoKTtcbiAgICBsZXQgc2l6ZSA9IHN0YXQuc2l6ZTtcbiAgICBpZiAoIXN0YXQgfHwgIXN0YXQuaXNGaWxlKCkpIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc3RhdCAke2Fic29sdXRlRmlsZVBhdGh9YCk7XG5cbiAgICBpZiAoY2FjaGVFbnRyeSkge1xuICAgICAgaWYgKGNhY2hlRW50cnkuY3RpbWUgPj0gY3RpbWUgJiYgY2FjaGVFbnRyeS5zaXplID09PSBzaXplKSB7XG4gICAgICAgIHJldHVybiBjYWNoZUVudHJ5LmluZm87XG4gICAgICB9XG5cbiAgICAgIGQoYEludmFsaWRhdGluZyBjYWNoZSBlbnRyeTogJHtjYWNoZUVudHJ5LmN0aW1lfSA9PT0gJHtjdGltZX0gJiYgJHtjYWNoZUVudHJ5LnNpemV9ID09PSAke3NpemV9YCk7XG4gICAgICBkZWxldGUgdGhpcy5jaGFuZ2VDYWNoZS5jYWNoZUVudHJ5O1xuICAgIH1cblxuICAgIGxldCB7ZGlnZXN0LCBzb3VyY2VDb2RlLCBiaW5hcnlEYXRhfSA9IGF3YWl0IHRoaXMuY2FsY3VsYXRlSGFzaEZvckZpbGUoYWJzb2x1dGVGaWxlUGF0aCk7XG5cbiAgICBsZXQgaW5mbyA9IHtcbiAgICAgIGhhc2g6IGRpZ2VzdCxcbiAgICAgIGlzTWluaWZpZWQ6IEZpbGVDaGFuZ2VkQ2FjaGUuY29udGVudHNBcmVNaW5pZmllZChzb3VyY2VDb2RlIHx8ICcnKSxcbiAgICAgIGlzSW5Ob2RlTW9kdWxlczogRmlsZUNoYW5nZWRDYWNoZS5pc0luTm9kZU1vZHVsZXMoYWJzb2x1dGVGaWxlUGF0aCksXG4gICAgICBoYXNTb3VyY2VNYXA6IEZpbGVDaGFuZ2VkQ2FjaGUuaGFzU291cmNlTWFwKHNvdXJjZUNvZGUgfHwgJycpLFxuICAgICAgaXNGaWxlQmluYXJ5OiAhIWJpbmFyeURhdGFcbiAgICB9O1xuXG4gICAgdGhpcy5jaGFuZ2VDYWNoZVtjYWNoZUtleV0gPSB7IGN0aW1lLCBzaXplLCBpbmZvIH07XG4gICAgZChgQ2FjaGUgZW50cnkgZm9yICR7Y2FjaGVLZXl9OiAke0pTT04uc3RyaW5naWZ5KHRoaXMuY2hhbmdlQ2FjaGVbY2FjaGVLZXldKX1gKTtcblxuICAgIGlmIChiaW5hcnlEYXRhKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7YmluYXJ5RGF0YX0sIGluZm8pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7c291cmNlQ29kZX0sIGluZm8pO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIFJldHVybnMgZGF0YSB0aGF0IGNhbiBwYXNzZWQgdG8ge0BsaW5rIGxvYWRGcm9tRGF0YX0gdG8gcmVoeWRyYXRlIHRoaXMgY2FjaGUuXG4gICAqXG4gICAqIEByZXR1cm4ge09iamVjdH1cbiAgICovXG4gIGdldFNhdmVkRGF0YSgpIHtcbiAgICByZXR1cm4geyBjaGFuZ2VDYWNoZTogdGhpcy5jaGFuZ2VDYWNoZSwgYXBwUm9vdDogdGhpcy5hcHBSb290IH07XG4gIH1cblxuICAvKipcbiAgICogU2VyaWFsaXplcyB0aGlzIG9iamVjdCdzIGRhdGEgdG8gYSBmaWxlLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZmlsZVBhdGggIFRoZSBwYXRoIHRvIHNhdmUgZGF0YSB0by5cbiAgICpcbiAgICogQHJldHVybiB7UHJvbWlzZX0gQ29tcGxldGlvbi5cbiAgICovXG4gIGFzeW5jIHNhdmUoZmlsZVBhdGgpIHtcbiAgICBsZXQgdG9TYXZlID0gdGhpcy5nZXRTYXZlZERhdGEoKTtcblxuICAgIGxldCBidWYgPSBhd2FpdCBwemxpYi5nemlwKG5ldyBCdWZmZXIoSlNPTi5zdHJpbmdpZnkodG9TYXZlKSkpO1xuICAgIGF3YWl0IHBmcy53cml0ZUZpbGUoZmlsZVBhdGgsIGJ1Zik7XG4gIH1cblxuICBhc3luYyBjYWxjdWxhdGVIYXNoRm9yRmlsZShhYnNvbHV0ZUZpbGVQYXRoKSB7XG4gICAgbGV0IGJ1ZiA9IGF3YWl0IHBmcy5yZWFkRmlsZShhYnNvbHV0ZUZpbGVQYXRoKTtcbiAgICBsZXQgZW5jb2RpbmcgPSBGaWxlQ2hhbmdlZENhY2hlLmRldGVjdEZpbGVFbmNvZGluZyhidWYpO1xuXG4gICAgaWYgKCFlbmNvZGluZykge1xuICAgICAgbGV0IGRpZ2VzdCA9IGNyeXB0by5jcmVhdGVIYXNoKCdzaGExJykudXBkYXRlKGJ1ZikuZGlnZXN0KCdoZXgnKTtcbiAgICAgIHJldHVybiB7IHNvdXJjZUNvZGU6IG51bGwsIGRpZ2VzdCwgYmluYXJ5RGF0YTogYnVmIH07XG4gICAgfVxuXG4gICAgbGV0IHNvdXJjZUNvZGUgPSBhd2FpdCBwZnMucmVhZEZpbGUoYWJzb2x1dGVGaWxlUGF0aCwgZW5jb2RpbmcpO1xuICAgIGxldCBkaWdlc3QgPSBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMScpLnVwZGF0ZShzb3VyY2VDb2RlLCAndXRmOCcpLmRpZ2VzdCgnaGV4Jyk7XG5cbiAgICByZXR1cm4ge3NvdXJjZUNvZGUsIGRpZ2VzdCwgYmluYXJ5RGF0YTogbnVsbCB9O1xuICB9XG5cbiAgZ2V0SGFzaEZvclBhdGhTeW5jKGFic29sdXRlRmlsZVBhdGgpIHtcbiAgICBsZXQgY2FjaGVLZXkgPSBzYW5pdGl6ZUZpbGVQYXRoKGFic29sdXRlRmlsZVBhdGgpO1xuICAgIGlmICh0aGlzLmFwcFJvb3QpIHtcbiAgICAgIGNhY2hlS2V5ID0gY2FjaGVLZXkucmVwbGFjZSh0aGlzLmFwcFJvb3QsICcnKTtcbiAgICB9XG5cbiAgICAvLyBOQjogV2UgZG8gdGhpcyBiZWNhdXNlIHgtcmVxdWlyZSB3aWxsIGluY2x1ZGUgYW4gYWJzb2x1dGUgcGF0aCBmcm9tIHRoZVxuICAgIC8vIG9yaWdpbmFsIGJ1aWx0IGFwcCBhbmQgd2UgbmVlZCB0byBzdGlsbCBncm9rIGl0XG4gICAgaWYgKHRoaXMub3JpZ2luYWxBcHBSb290KSB7XG4gICAgICBjYWNoZUtleSA9IGNhY2hlS2V5LnJlcGxhY2UodGhpcy5vcmlnaW5hbEFwcFJvb3QsICcnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5yZWFsQXBwUm9vdCkge1xuICAgICAgY2FjaGVLZXkgPSBjYWNoZUtleS5yZXBsYWNlKHRoaXMucmVhbEFwcFJvb3QsICcnKTtcbiAgICB9XG5cbiAgICBsZXQgY2FjaGVFbnRyeSA9IHRoaXMuY2hhbmdlQ2FjaGVbY2FjaGVLZXldO1xuXG4gICAgaWYgKHRoaXMuZmFpbE9uQ2FjaGVNaXNzKSB7XG4gICAgICBpZiAoIWNhY2hlRW50cnkpIHtcbiAgICAgICAgZChgVHJpZWQgdG8gcmVhZCBmaWxlIGNhY2hlIGVudHJ5IGZvciAke2Fic29sdXRlRmlsZVBhdGh9YCk7XG4gICAgICAgIGQoYGNhY2hlS2V5OiAke2NhY2hlS2V5fSwgYXBwUm9vdDogJHt0aGlzLmFwcFJvb3R9LCBvcmlnaW5hbEFwcFJvb3Q6ICR7dGhpcy5vcmlnaW5hbEFwcFJvb3R9YCk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNrZWQgZm9yICR7YWJzb2x1dGVGaWxlUGF0aH0gYnV0IGl0IHdhcyBub3QgcHJlY29tcGlsZWQhYCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBjYWNoZUVudHJ5LmluZm87XG4gICAgfVxuXG4gICAgbGV0IHN0YXQgPSBmcy5zdGF0U3luYyhhYnNvbHV0ZUZpbGVQYXRoKTtcbiAgICBsZXQgY3RpbWUgPSBzdGF0LmN0aW1lLmdldFRpbWUoKTtcbiAgICBsZXQgc2l6ZSA9IHN0YXQuc2l6ZTtcbiAgICBpZiAoIXN0YXQgfHwgIXN0YXQuaXNGaWxlKCkpIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc3RhdCAke2Fic29sdXRlRmlsZVBhdGh9YCk7XG5cbiAgICBpZiAoY2FjaGVFbnRyeSkge1xuICAgICAgaWYgKGNhY2hlRW50cnkuY3RpbWUgPj0gY3RpbWUgJiYgY2FjaGVFbnRyeS5zaXplID09PSBzaXplKSB7XG4gICAgICAgIHJldHVybiBjYWNoZUVudHJ5LmluZm87XG4gICAgICB9XG5cbiAgICAgIGQoYEludmFsaWRhdGluZyBjYWNoZSBlbnRyeTogJHtjYWNoZUVudHJ5LmN0aW1lfSA9PT0gJHtjdGltZX0gJiYgJHtjYWNoZUVudHJ5LnNpemV9ID09PSAke3NpemV9YCk7XG4gICAgICBkZWxldGUgdGhpcy5jaGFuZ2VDYWNoZS5jYWNoZUVudHJ5O1xuICAgIH1cblxuICAgIGxldCB7ZGlnZXN0LCBzb3VyY2VDb2RlLCBiaW5hcnlEYXRhfSA9IHRoaXMuY2FsY3VsYXRlSGFzaEZvckZpbGVTeW5jKGFic29sdXRlRmlsZVBhdGgpO1xuXG4gICAgbGV0IGluZm8gPSB7XG4gICAgICBoYXNoOiBkaWdlc3QsXG4gICAgICBpc01pbmlmaWVkOiBGaWxlQ2hhbmdlZENhY2hlLmNvbnRlbnRzQXJlTWluaWZpZWQoc291cmNlQ29kZSB8fCAnJyksXG4gICAgICBpc0luTm9kZU1vZHVsZXM6IEZpbGVDaGFuZ2VkQ2FjaGUuaXNJbk5vZGVNb2R1bGVzKGFic29sdXRlRmlsZVBhdGgpLFxuICAgICAgaGFzU291cmNlTWFwOiBGaWxlQ2hhbmdlZENhY2hlLmhhc1NvdXJjZU1hcChzb3VyY2VDb2RlIHx8ICcnKSxcbiAgICAgIGlzRmlsZUJpbmFyeTogISFiaW5hcnlEYXRhXG4gICAgfTtcblxuICAgIHRoaXMuY2hhbmdlQ2FjaGVbY2FjaGVLZXldID0geyBjdGltZSwgc2l6ZSwgaW5mbyB9O1xuICAgIGQoYENhY2hlIGVudHJ5IGZvciAke2NhY2hlS2V5fTogJHtKU09OLnN0cmluZ2lmeSh0aGlzLmNoYW5nZUNhY2hlW2NhY2hlS2V5XSl9YCk7XG5cbiAgICBpZiAoYmluYXJ5RGF0YSkge1xuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe2JpbmFyeURhdGF9LCBpbmZvKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe3NvdXJjZUNvZGV9LCBpbmZvKTtcbiAgICB9XG4gIH1cblxuICBzYXZlU3luYyhmaWxlUGF0aCkge1xuICAgIGxldCB0b1NhdmUgPSB0aGlzLmdldFNhdmVkRGF0YSgpO1xuXG4gICAgbGV0IGJ1ZiA9IHpsaWIuZ3ppcFN5bmMobmV3IEJ1ZmZlcihKU09OLnN0cmluZ2lmeSh0b1NhdmUpKSk7XG4gICAgZnMud3JpdGVGaWxlU3luYyhmaWxlUGF0aCwgYnVmKTtcbiAgfVxuXG4gIGNhbGN1bGF0ZUhhc2hGb3JGaWxlU3luYyhhYnNvbHV0ZUZpbGVQYXRoKSB7XG4gICAgbGV0IGJ1ZiA9IGZzLnJlYWRGaWxlU3luYyhhYnNvbHV0ZUZpbGVQYXRoKTtcbiAgICBsZXQgZW5jb2RpbmcgPSBGaWxlQ2hhbmdlZENhY2hlLmRldGVjdEZpbGVFbmNvZGluZyhidWYpO1xuXG4gICAgaWYgKCFlbmNvZGluZykge1xuICAgICAgbGV0IGRpZ2VzdCA9IGNyeXB0by5jcmVhdGVIYXNoKCdzaGExJykudXBkYXRlKGJ1ZikuZGlnZXN0KCdoZXgnKTtcbiAgICAgIHJldHVybiB7IHNvdXJjZUNvZGU6IG51bGwsIGRpZ2VzdCwgYmluYXJ5RGF0YTogYnVmfTtcbiAgICB9XG5cbiAgICBsZXQgc291cmNlQ29kZSA9IGZzLnJlYWRGaWxlU3luYyhhYnNvbHV0ZUZpbGVQYXRoLCBlbmNvZGluZyk7XG4gICAgbGV0IGRpZ2VzdCA9IGNyeXB0by5jcmVhdGVIYXNoKCdzaGExJykudXBkYXRlKHNvdXJjZUNvZGUsICd1dGY4JykuZGlnZXN0KCdoZXgnKTtcblxuICAgIHJldHVybiB7c291cmNlQ29kZSwgZGlnZXN0LCBiaW5hcnlEYXRhOiBudWxsfTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgdmlhIHNvbWUgc3RhdGlzdGljcyB3aGV0aGVyIGEgZmlsZSBpcyBsaWtlbHkgdG8gYmUgbWluaWZpZWQuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGF0aWMgY29udGVudHNBcmVNaW5pZmllZChzb3VyY2UpIHtcbiAgICBsZXQgbGVuZ3RoID0gc291cmNlLmxlbmd0aDtcbiAgICBpZiAobGVuZ3RoID4gMTAyNCkgbGVuZ3RoID0gMTAyNDtcblxuICAgIGxldCBuZXdsaW5lQ291bnQgPSAwO1xuXG4gICAgLy8gUm9sbCB0aHJvdWdoIHRoZSBjaGFyYWN0ZXJzIGFuZCBkZXRlcm1pbmUgdGhlIGF2ZXJhZ2UgbGluZSBsZW5ndGhcbiAgICBmb3IobGV0IGk9MDsgaSA8IHNvdXJjZS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHNvdXJjZVtpXSA9PT0gJ1xcbicpIG5ld2xpbmVDb3VudCsrO1xuICAgIH1cblxuICAgIC8vIE5vIE5ld2xpbmVzPyBBbnkgZmlsZSBvdGhlciB0aGFuIGEgc3VwZXIgc21hbGwgb25lIGlzIG1pbmlmaWVkXG4gICAgaWYgKG5ld2xpbmVDb3VudCA9PT0gMCkge1xuICAgICAgcmV0dXJuIChsZW5ndGggPiA4MCk7XG4gICAgfVxuXG4gICAgbGV0IGF2Z0xpbmVMZW5ndGggPSBsZW5ndGggLyBuZXdsaW5lQ291bnQ7XG4gICAgcmV0dXJuIChhdmdMaW5lTGVuZ3RoID4gODApO1xuICB9XG5cblxuICAvKipcbiAgICogRGV0ZXJtaW5lcyB3aGV0aGVyIGEgcGF0aCBpcyBpbiBub2RlX21vZHVsZXMgb3IgdGhlIEVsZWN0cm9uIGluaXQgY29kZVxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc3RhdGljIGlzSW5Ob2RlTW9kdWxlcyhmaWxlUGF0aCkge1xuICAgIHJldHVybiAhIShmaWxlUGF0aC5tYXRjaCgvKG5vZGVfbW9kdWxlc3xib3dlcl9jb21wb25lbnRzKVtcXFxcXFwvXS9pKSB8fCBmaWxlUGF0aC5tYXRjaCgvKGF0b218ZWxlY3Ryb24pXFwuYXNhci8pKTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFJldHVybnMgd2hldGhlciBhIGZpbGUgaGFzIGFuIGlubGluZSBzb3VyY2UgbWFwXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGF0aWMgaGFzU291cmNlTWFwKHNvdXJjZUNvZGUpIHtcbiAgICBjb25zdCB0cmltbWVkID0gc291cmNlQ29kZS50cmltKCk7XG4gICAgcmV0dXJuIHRyaW1tZWQubGFzdEluZGV4T2YoJy8vIyBzb3VyY2VNYXAnKSA+IHRyaW1tZWQubGFzdEluZGV4T2YoJ1xcbicpO1xuICB9XG5cbiAgLyoqXG4gICAqIERldGVybWluZXMgdGhlIGVuY29kaW5nIG9mIGEgZmlsZSBmcm9tIHRoZSB0d28gbW9zdCBjb21tb24gZW5jb2RpbmdzIGJ5IHRyeWluZ1xuICAgKiB0byBkZWNvZGUgaXQgdGhlbiBsb29raW5nIGZvciBlbmNvZGluZyBlcnJvcnNcbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHN0YXRpYyBkZXRlY3RGaWxlRW5jb2RpbmcoYnVmZmVyKSB7XG4gICAgaWYgKGJ1ZmZlci5sZW5ndGggPCAxKSByZXR1cm4gZmFsc2U7XG4gICAgbGV0IGJ1ZiA9IChidWZmZXIubGVuZ3RoIDwgNDA5NiA/IGJ1ZmZlciA6IGJ1ZmZlci5zbGljZSgwLCA0MDk2KSk7XG5cbiAgICBjb25zdCBlbmNvZGluZ3MgPSBbJ3V0ZjgnLCAndXRmMTZsZSddO1xuXG4gICAgbGV0IGVuY29kaW5nID0gZW5jb2RpbmdzLmZpbmQoXG4gICAgICAoeCkgPT4gIUZpbGVDaGFuZ2VkQ2FjaGUuY29udGFpbnNDb250cm9sQ2hhcmFjdGVycyhidWYudG9TdHJpbmcoeCkpKTtcblxuICAgIHJldHVybiBlbmNvZGluZztcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgYSBzdHJpbmcgaXMgbGlrZWx5IHRvIGJlIHBvb3JseSBlbmNvZGVkIGJ5IGxvb2tpbmcgZm9yXG4gICAqIGNvbnRyb2wgY2hhcmFjdGVycyBhYm92ZSBhIGNlcnRhaW4gdGhyZXNob2xkXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGF0aWMgY29udGFpbnNDb250cm9sQ2hhcmFjdGVycyhzdHIpIHtcbiAgICBsZXQgY29udHJvbENvdW50ID0gMDtcbiAgICBsZXQgc3BhY2VDb3VudCA9IDA7XG4gICAgbGV0IHRocmVzaG9sZCA9IDI7XG4gICAgaWYgKHN0ci5sZW5ndGggPiA2NCkgdGhyZXNob2xkID0gNDtcbiAgICBpZiAoc3RyLmxlbmd0aCA+IDUxMikgdGhyZXNob2xkID0gODtcblxuICAgIGZvciAobGV0IGk9MDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IGMgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICAgIGlmIChjID09PSA2NTUzNiB8fCBjIDwgOCkgY29udHJvbENvdW50Kys7XG4gICAgICBpZiAoYyA+IDE0ICYmIGMgPCAzMikgY29udHJvbENvdW50Kys7XG4gICAgICBpZiAoYyA9PT0gMzIpIHNwYWNlQ291bnQrKztcblxuICAgICAgaWYgKGNvbnRyb2xDb3VudCA+IHRocmVzaG9sZCkgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHNwYWNlQ291bnQgPCB0aHJlc2hvbGQpIHJldHVybiB0cnVlO1xuXG4gICAgaWYgKGNvbnRyb2xDb3VudCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiAoY29udHJvbENvdW50IC8gc3RyLmxlbmd0aCkgPCAwLjAyO1xuICB9XG59XG4iXX0=