'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = sanitizeFilePath;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _lruCache = require('lru-cache');

var _lruCache2 = _interopRequireDefault(_lruCache);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const d = require('debug-electron')('electron-compile:sanitize-paths');
const realpathCache = (0, _lruCache2.default)({ max: 32 });

function cachedRealpath(p) {
  let ret = realpathCache.get(p);
  if (ret) return ret;

  ret = _fs2.default.realpathSync(p);
  d(`Cache miss for cachedRealpath: '${ p }' => '${ ret }'`);

  realpathCache.set(p, ret);
  return ret;
}

/**
 * Electron will sometimes hand us paths that don't match the platform if they
 * were derived from a URL (i.e. 'C:/Users/Paul/...'), whereas the cache will have
 * saved paths with backslashes.
 *
 * @private
 */
function sanitizeFilePath(file) {
  if (!file) return file;

  // NB: Some people add symlinks into system directories. node.js will internally
  // call realpath on paths that it finds, which will break our cache resolution.
  // We need to catch this scenario and fix it up. The tricky part is, some parts
  // of Electron will give us the pre-resolved paths, and others will give us the
  // post-resolved one. We need to handle both.

  let realFile = null;
  let parts = file.split(/[\\\/]app.asar[\\\/]/);
  if (!parts[1]) {
    // Not using an ASAR archive
    realFile = cachedRealpath(file);
  } else {
    // We do all this silliness to work around
    // https://github.com/atom/electron/issues/4610
    realFile = `${ cachedRealpath(parts[0]) }/app.asar/${ parts[1] }`;
  }

  return realFile.replace(/[\\\/]/g, '/');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zYW5pdGl6ZS1wYXRocy5qcyJdLCJuYW1lcyI6WyJzYW5pdGl6ZUZpbGVQYXRoIiwiZCIsInJlcXVpcmUiLCJyZWFscGF0aENhY2hlIiwibWF4IiwiY2FjaGVkUmVhbHBhdGgiLCJwIiwicmV0IiwiZ2V0IiwicmVhbHBhdGhTeW5jIiwic2V0IiwiZmlsZSIsInJlYWxGaWxlIiwicGFydHMiLCJzcGxpdCIsInJlcGxhY2UiXSwibWFwcGluZ3MiOiI7Ozs7O2tCQXdCd0JBLGdCOztBQXhCeEI7Ozs7QUFDQTs7Ozs7O0FBRUEsTUFBTUMsSUFBSUMsUUFBUSxnQkFBUixFQUEwQixpQ0FBMUIsQ0FBVjtBQUNBLE1BQU1DLGdCQUFnQix3QkFBUyxFQUFFQyxLQUFLLEVBQVAsRUFBVCxDQUF0Qjs7QUFFQSxTQUFTQyxjQUFULENBQXdCQyxDQUF4QixFQUEyQjtBQUN6QixNQUFJQyxNQUFNSixjQUFjSyxHQUFkLENBQWtCRixDQUFsQixDQUFWO0FBQ0EsTUFBSUMsR0FBSixFQUFTLE9BQU9BLEdBQVA7O0FBRVRBLFFBQU0sYUFBR0UsWUFBSCxDQUFnQkgsQ0FBaEIsQ0FBTjtBQUNBTCxJQUFHLG9DQUFrQ0ssQ0FBRSxXQUFRQyxHQUFJLElBQW5EOztBQUVBSixnQkFBY08sR0FBZCxDQUFrQkosQ0FBbEIsRUFBcUJDLEdBQXJCO0FBQ0EsU0FBT0EsR0FBUDtBQUNEOztBQUVEOzs7Ozs7O0FBT2UsU0FBU1AsZ0JBQVQsQ0FBMEJXLElBQTFCLEVBQWdDO0FBQzdDLE1BQUksQ0FBQ0EsSUFBTCxFQUFXLE9BQU9BLElBQVA7O0FBRVg7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxNQUFJQyxXQUFXLElBQWY7QUFDQSxNQUFJQyxRQUFRRixLQUFLRyxLQUFMLENBQVcsc0JBQVgsQ0FBWjtBQUNBLE1BQUksQ0FBQ0QsTUFBTSxDQUFOLENBQUwsRUFBZTtBQUNiO0FBQ0FELGVBQVdQLGVBQWVNLElBQWYsQ0FBWDtBQUNELEdBSEQsTUFHTztBQUNMO0FBQ0E7QUFDQUMsZUFBWSxJQUFFUCxlQUFlUSxNQUFNLENBQU4sQ0FBZixDQUF5QixlQUFZQSxNQUFNLENBQU4sQ0FBUyxHQUE1RDtBQUNEOztBQUVELFNBQU9ELFNBQVNHLE9BQVQsQ0FBaUIsU0FBakIsRUFBNEIsR0FBNUIsQ0FBUDtBQUNEIiwiZmlsZSI6InNhbml0aXplLXBhdGhzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBMUlVDYWNoZSBmcm9tICdscnUtY2FjaGUnO1xuXG5jb25zdCBkID0gcmVxdWlyZSgnZGVidWctZWxlY3Ryb24nKSgnZWxlY3Ryb24tY29tcGlsZTpzYW5pdGl6ZS1wYXRocycpO1xuY29uc3QgcmVhbHBhdGhDYWNoZSA9IExSVUNhY2hlKHsgbWF4OiAzMiB9KTtcblxuZnVuY3Rpb24gY2FjaGVkUmVhbHBhdGgocCkge1xuICBsZXQgcmV0ID0gcmVhbHBhdGhDYWNoZS5nZXQocCk7XG4gIGlmIChyZXQpIHJldHVybiByZXQ7XG5cbiAgcmV0ID0gZnMucmVhbHBhdGhTeW5jKHApO1xuICBkKGBDYWNoZSBtaXNzIGZvciBjYWNoZWRSZWFscGF0aDogJyR7cH0nID0+ICcke3JldH0nYCk7XG5cbiAgcmVhbHBhdGhDYWNoZS5zZXQocCwgcmV0KTtcbiAgcmV0dXJuIHJldDtcbn1cblxuLyoqXG4gKiBFbGVjdHJvbiB3aWxsIHNvbWV0aW1lcyBoYW5kIHVzIHBhdGhzIHRoYXQgZG9uJ3QgbWF0Y2ggdGhlIHBsYXRmb3JtIGlmIHRoZXlcbiAqIHdlcmUgZGVyaXZlZCBmcm9tIGEgVVJMIChpLmUuICdDOi9Vc2Vycy9QYXVsLy4uLicpLCB3aGVyZWFzIHRoZSBjYWNoZSB3aWxsIGhhdmVcbiAqIHNhdmVkIHBhdGhzIHdpdGggYmFja3NsYXNoZXMuXG4gKlxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2FuaXRpemVGaWxlUGF0aChmaWxlKSB7XG4gIGlmICghZmlsZSkgcmV0dXJuIGZpbGU7XG5cbiAgLy8gTkI6IFNvbWUgcGVvcGxlIGFkZCBzeW1saW5rcyBpbnRvIHN5c3RlbSBkaXJlY3Rvcmllcy4gbm9kZS5qcyB3aWxsIGludGVybmFsbHlcbiAgLy8gY2FsbCByZWFscGF0aCBvbiBwYXRocyB0aGF0IGl0IGZpbmRzLCB3aGljaCB3aWxsIGJyZWFrIG91ciBjYWNoZSByZXNvbHV0aW9uLlxuICAvLyBXZSBuZWVkIHRvIGNhdGNoIHRoaXMgc2NlbmFyaW8gYW5kIGZpeCBpdCB1cC4gVGhlIHRyaWNreSBwYXJ0IGlzLCBzb21lIHBhcnRzXG4gIC8vIG9mIEVsZWN0cm9uIHdpbGwgZ2l2ZSB1cyB0aGUgcHJlLXJlc29sdmVkIHBhdGhzLCBhbmQgb3RoZXJzIHdpbGwgZ2l2ZSB1cyB0aGVcbiAgLy8gcG9zdC1yZXNvbHZlZCBvbmUuIFdlIG5lZWQgdG8gaGFuZGxlIGJvdGguXG5cbiAgbGV0IHJlYWxGaWxlID0gbnVsbDtcbiAgbGV0IHBhcnRzID0gZmlsZS5zcGxpdCgvW1xcXFxcXC9dYXBwLmFzYXJbXFxcXFxcL10vKTtcbiAgaWYgKCFwYXJ0c1sxXSkge1xuICAgIC8vIE5vdCB1c2luZyBhbiBBU0FSIGFyY2hpdmVcbiAgICByZWFsRmlsZSA9IGNhY2hlZFJlYWxwYXRoKGZpbGUpO1xuICB9IGVsc2Uge1xuICAgIC8vIFdlIGRvIGFsbCB0aGlzIHNpbGxpbmVzcyB0byB3b3JrIGFyb3VuZFxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9hdG9tL2VsZWN0cm9uL2lzc3Vlcy80NjEwXG4gICAgcmVhbEZpbGUgPSBgJHtjYWNoZWRSZWFscGF0aChwYXJ0c1swXSl9L2FwcC5hc2FyLyR7cGFydHNbMV19YDtcbiAgfVxuXG4gIHJldHVybiByZWFsRmlsZS5yZXBsYWNlKC9bXFxcXFxcL10vZywgJy8nKTtcbn1cbiJdfQ==