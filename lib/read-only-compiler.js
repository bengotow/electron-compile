"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = ReadOnlyCompilerFactory;

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/**
 * ReadOnlyCompiler is a compiler which allows the host to inject all of the compiler
 * metadata information so that {@link CompileCache} et al are able to recreate the
 * hash without having two separate code paths.
 */
function ReadOnlyCompilerFactory(_ref) {
  let name = _ref.name,
      compilerVersion = _ref.compilerVersion,
      compilerOptions = _ref.compilerOptions,
      inputMimeTypes = _ref.inputMimeTypes,
      outputMimeType = _ref.outputMimeType;

  class ReadOnlyCompiler {
    /**
     * Creates a ReadOnlyCompiler instance
     *
     * @private
     */
    constructor() {
      Object.assign(this, { name, compilerVersion, compilerOptions });
    }

    static getInputMimeTypes() {
      return inputMimeTypes;
    }

    static getOutputMimeType() {
      return outputMimeType;
    }

    shouldCompileFile() {
      return _asyncToGenerator(function* () {
        return true;
      })();
    }

    determineDependentFiles() {
      return _asyncToGenerator(function* () {
        return [];
      })();
    }

    compile() {
      return _asyncToGenerator(function* () {
        throw new Error("Read-only compilers can't compile");
      })();
    }

    shouldCompileFileSync() {
      return true;
    }

    determineDependentFilesSync() {
      return [];
    }

    compileSync() {
      throw new Error("Read-only compilers can't compile");
    }

    getCompilerVersion() {
      return this.compilerVersion;
    }
  }

  return new ReadOnlyCompiler();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9yZWFkLW9ubHktY29tcGlsZXIuanMiXSwibmFtZXMiOlsiUmVhZE9ubHlDb21waWxlckZhY3RvcnkiLCJuYW1lIiwiY29tcGlsZXJWZXJzaW9uIiwiY29tcGlsZXJPcHRpb25zIiwiaW5wdXRNaW1lVHlwZXMiLCJvdXRwdXRNaW1lVHlwZSIsIlJlYWRPbmx5Q29tcGlsZXIiLCJjb25zdHJ1Y3RvciIsIk9iamVjdCIsImFzc2lnbiIsImdldElucHV0TWltZVR5cGVzIiwiZ2V0T3V0cHV0TWltZVR5cGUiLCJzaG91bGRDb21waWxlRmlsZSIsImRldGVybWluZURlcGVuZGVudEZpbGVzIiwiY29tcGlsZSIsIkVycm9yIiwic2hvdWxkQ29tcGlsZUZpbGVTeW5jIiwiZGV0ZXJtaW5lRGVwZW5kZW50RmlsZXNTeW5jIiwiY29tcGlsZVN5bmMiLCJnZXRDb21waWxlclZlcnNpb24iXSwibWFwcGluZ3MiOiI7Ozs7O2tCQUt3QkEsdUI7Ozs7QUFMeEI7Ozs7O0FBS2UsU0FBU0EsdUJBQVQsT0FBMkc7QUFBQSxNQUF6RUMsSUFBeUUsUUFBekVBLElBQXlFO0FBQUEsTUFBbkVDLGVBQW1FLFFBQW5FQSxlQUFtRTtBQUFBLE1BQWxEQyxlQUFrRCxRQUFsREEsZUFBa0Q7QUFBQSxNQUFqQ0MsY0FBaUMsUUFBakNBLGNBQWlDO0FBQUEsTUFBakJDLGNBQWlCLFFBQWpCQSxjQUFpQjs7QUFDeEgsUUFBTUMsZ0JBQU4sQ0FBdUI7QUFDckI7Ozs7O0FBS0FDLGtCQUFjO0FBQ1pDLGFBQU9DLE1BQVAsQ0FBYyxJQUFkLEVBQW9CLEVBQUVSLElBQUYsRUFBUUMsZUFBUixFQUF5QkMsZUFBekIsRUFBcEI7QUFDRDs7QUFFRCxXQUFPTyxpQkFBUCxHQUEyQjtBQUN6QixhQUFPTixjQUFQO0FBQ0Q7O0FBRUQsV0FBT08saUJBQVAsR0FBMkI7QUFDekIsYUFBT04sY0FBUDtBQUNEOztBQUVLTyxxQkFBTixHQUEwQjtBQUFBO0FBQ3hCLGVBQU8sSUFBUDtBQUR3QjtBQUV6Qjs7QUFFS0MsMkJBQU4sR0FBZ0M7QUFBQTtBQUM5QixlQUFPLEVBQVA7QUFEOEI7QUFFL0I7O0FBRUtDLFdBQU4sR0FBZ0I7QUFBQTtBQUNkLGNBQU0sSUFBSUMsS0FBSixDQUFVLG1DQUFWLENBQU47QUFEYztBQUVmOztBQUVEQyw0QkFBd0I7QUFDdEIsYUFBTyxJQUFQO0FBQ0Q7O0FBRURDLGtDQUE4QjtBQUM1QixhQUFPLEVBQVA7QUFDRDs7QUFFREMsa0JBQWM7QUFDWixZQUFNLElBQUlILEtBQUosQ0FBVSxtQ0FBVixDQUFOO0FBQ0Q7O0FBRURJLHlCQUFxQjtBQUNuQixhQUFPLEtBQUtqQixlQUFaO0FBQ0Q7QUE1Q29COztBQStDdkIsU0FBTyxJQUFJSSxnQkFBSixFQUFQO0FBQ0QiLCJmaWxlIjoicmVhZC1vbmx5LWNvbXBpbGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZWFkT25seUNvbXBpbGVyIGlzIGEgY29tcGlsZXIgd2hpY2ggYWxsb3dzIHRoZSBob3N0IHRvIGluamVjdCBhbGwgb2YgdGhlIGNvbXBpbGVyXG4gKiBtZXRhZGF0YSBpbmZvcm1hdGlvbiBzbyB0aGF0IHtAbGluayBDb21waWxlQ2FjaGV9IGV0IGFsIGFyZSBhYmxlIHRvIHJlY3JlYXRlIHRoZVxuICogaGFzaCB3aXRob3V0IGhhdmluZyB0d28gc2VwYXJhdGUgY29kZSBwYXRocy5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gUmVhZE9ubHlDb21waWxlckZhY3Rvcnkoe25hbWUsIGNvbXBpbGVyVmVyc2lvbiwgY29tcGlsZXJPcHRpb25zLCBpbnB1dE1pbWVUeXBlcywgb3V0cHV0TWltZVR5cGV9KSB7XG4gIGNsYXNzIFJlYWRPbmx5Q29tcGlsZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBSZWFkT25seUNvbXBpbGVyIGluc3RhbmNlXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLCB7IG5hbWUsIGNvbXBpbGVyVmVyc2lvbiwgY29tcGlsZXJPcHRpb25zIH0pO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXRJbnB1dE1pbWVUeXBlcygpIHtcbiAgICAgIHJldHVybiBpbnB1dE1pbWVUeXBlcztcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0T3V0cHV0TWltZVR5cGUoKSB7XG4gICAgICByZXR1cm4gb3V0cHV0TWltZVR5cGU7XG4gICAgfVxuXG4gICAgYXN5bmMgc2hvdWxkQ29tcGlsZUZpbGUoKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBhc3luYyBkZXRlcm1pbmVEZXBlbmRlbnRGaWxlcygpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBhc3luYyBjb21waWxlKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUmVhZC1vbmx5IGNvbXBpbGVycyBjYW4ndCBjb21waWxlXCIpO1xuICAgIH1cblxuICAgIHNob3VsZENvbXBpbGVGaWxlU3luYygpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGRldGVybWluZURlcGVuZGVudEZpbGVzU3luYygpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb21waWxlU3luYygpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlJlYWQtb25seSBjb21waWxlcnMgY2FuJ3QgY29tcGlsZVwiKTtcbiAgICB9XG5cbiAgICBnZXRDb21waWxlclZlcnNpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb21waWxlclZlcnNpb247XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ldyBSZWFkT25seUNvbXBpbGVyKCk7XG59XG4iXX0=