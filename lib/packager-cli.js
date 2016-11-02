#!/usr/bin/env node
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.packagerMain = exports.runAsarArchive = exports.packageDirToResourcesDir = undefined;

let packageDirToResourcesDir = exports.packageDirToResourcesDir = (() => {
  var _ref = _asyncToGenerator(function* (packageDir) {
    let appDir = (yield _promise.pfs.readdir(packageDir)).find(function (x) {
      return x.match(/\.app$/i);
    });
    if (appDir) {
      return _path2.default.join(packageDir, appDir, 'Contents', 'Resources', 'app');
    } else {
      return _path2.default.join(packageDir, 'resources', 'app');
    }
  });

  return function packageDirToResourcesDir(_x) {
    return _ref.apply(this, arguments);
  };
})();

let copySmallFile = (() => {
  var _ref2 = _asyncToGenerator(function* (from, to) {
    d(`Copying ${ from } => ${ to }`);

    let buf = yield _promise.pfs.readFile(from);
    yield _promise.pfs.writeFile(to, buf);
  });

  return function copySmallFile(_x2, _x3) {
    return _ref2.apply(this, arguments);
  };
})();

let compileAndShim = (() => {
  var _ref3 = _asyncToGenerator(function* (packageDir) {
    let appDir = yield packageDirToResourcesDir(packageDir);

    d(`Looking in ${ appDir }`);
    for (let entry of yield _promise.pfs.readdir(appDir)) {
      if (entry.match(/^(node_modules|bower_components)$/)) continue;

      let fullPath = _path2.default.join(appDir, entry);
      let stat = yield _promise.pfs.stat(fullPath);

      if (!stat.isDirectory()) continue;

      d(`Executing electron-compile: ${ appDir } => ${ entry }`);
      yield (0, _cli.main)(appDir, [fullPath]);
    }

    d('Copying in es6-shim');
    let packageJson = JSON.parse((yield _promise.pfs.readFile(_path2.default.join(appDir, 'package.json'), 'utf8')));

    let index = packageJson.main || 'index.js';
    packageJson.originalMain = index;
    packageJson.main = 'es6-shim.js';

    yield copySmallFile(_path2.default.join(__dirname, 'es6-shim.js'), _path2.default.join(appDir, 'es6-shim.js'));

    yield _promise.pfs.writeFile(_path2.default.join(appDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  });

  return function compileAndShim(_x4) {
    return _ref3.apply(this, arguments);
  };
})();

let runAsarArchive = exports.runAsarArchive = (() => {
  var _ref4 = _asyncToGenerator(function* (packageDir, asarUnpackDir) {
    let appDir = yield packageDirToResourcesDir(packageDir);

    let asarArgs = ['pack', 'app', 'app.asar'];
    if (asarUnpackDir) {
      asarArgs.push('--unpack-dir', asarUnpackDir);
    }

    var _findExecutableOrGues = findExecutableOrGuess('asar', asarArgs);

    let cmd = _findExecutableOrGues.cmd,
        args = _findExecutableOrGues.args;


    d(`Running ${ cmd } ${ JSON.stringify(args) }`);
    yield (0, _spawnRx.spawnPromise)(cmd, args, { cwd: _path2.default.join(appDir, '..') });
    _rimraf2.default.sync(_path2.default.join(appDir));
  });

  return function runAsarArchive(_x5, _x6) {
    return _ref4.apply(this, arguments);
  };
})();

let packagerMain = exports.packagerMain = (() => {
  var _ref5 = _asyncToGenerator(function* (argv) {
    d(`argv: ${ JSON.stringify(argv) }`);
    argv = argv.splice(2);

    var _splitOutAsarArgument = splitOutAsarArguments(argv);

    let packagerArgs = _splitOutAsarArgument.packagerArgs,
        asarArgs = _splitOutAsarArgument.asarArgs;

    var _findExecutableOrGues2 = findExecutableOrGuess(electronPackager, packagerArgs);

    let cmd = _findExecutableOrGues2.cmd,
        args = _findExecutableOrGues2.args;


    d(`Spawning electron-packager: ${ JSON.stringify(args) }`);
    let packagerOutput = yield (0, _spawnRx.spawnPromise)(cmd, args);
    let packageDirs = parsePackagerOutput(packagerOutput);

    d(`Starting compilation for ${ JSON.stringify(packageDirs) }`);
    for (let packageDir of packageDirs) {
      yield compileAndShim(packageDir);

      if (!asarArgs) continue;

      d('Starting ASAR packaging');
      let asarUnpackDir = null;
      if (asarArgs.length === 2) {
        asarUnpackDir = asarArgs[1];
      }

      yield runAsarArchive(packageDir, asarUnpackDir);
    }
  });

  return function packagerMain(_x7) {
    return _ref5.apply(this, arguments);
  };
})();

exports.splitOutAsarArguments = splitOutAsarArguments;
exports.parsePackagerOutput = parsePackagerOutput;
exports.findExecutableOrGuess = findExecutableOrGuess;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _rimraf = require('rimraf');

var _rimraf2 = _interopRequireDefault(_rimraf);

var _promise = require('./promise');

var _cli = require('./cli');

var _spawnRx = require('spawn-rx');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const d = require('debug-electron')('electron-compile:packager');
const electronPackager = 'electron-packager';

function splitOutAsarArguments(argv) {
  if (argv.find(x => x.match(/^--asar-unpack$/))) {
    throw new Error("electron-compile doesn't support --asar-unpack at the moment, use asar-unpack-dir");
  }

  // Strip --asar altogether
  let ret = argv.filter(x => !x.match(/^--asar/));

  if (ret.length === argv.length) {
    return { packagerArgs: ret, asarArgs: null };
  }

  let indexOfUnpack = ret.findIndex(x => x.match(/^--asar-unpack-dir$/));
  if (indexOfUnpack < 0) {
    return { packagerArgs: ret, asarArgs: [] };
  }

  let unpackArgs = ret.slice(indexOfUnpack, indexOfUnpack + 1);
  let notUnpackArgs = ret.slice(0, indexOfUnpack).concat(ret.slice(indexOfUnpack + 2));

  return { packagerArgs: notUnpackArgs, asarArgs: unpackArgs };
}

function parsePackagerOutput(output) {
  // NB: Yes, this is fragile as fuck. :-/
  console.log(output);
  let lines = output.split('\n');

  let idx = lines.findIndex(x => x.match(/Wrote new app/i));
  if (idx < 1) throw new Error(`Packager output is invalid: ${ output }`);
  lines = lines.splice(idx);

  // Multi-platform case
  if (lines[0].match(/Wrote new apps/)) {
    return lines.splice(1).filter(x => x.length > 1);
  } else {
    return [lines[0].replace(/^.*new app to /, '')];
  }
}

function findExecutableOrGuess(cmdToFind, argsToUse) {
  var _findActualExecutable = (0, _spawnRx.findActualExecutable)(cmdToFind, argsToUse);

  let cmd = _findActualExecutable.cmd,
      args = _findActualExecutable.args;

  if (cmd === electronPackager) {
    d(`Can't find ${ cmdToFind }, falling back to where it should be as a guess!`);
    let cmdSuffix = process.platform === 'win32' ? '.cmd' : '';
    return (0, _spawnRx.findActualExecutable)(_path2.default.resolve(__dirname, '..', '..', '.bin', `${ cmdToFind }${ cmdSuffix }`), argsToUse);
  }

  return { cmd, args };
}

if (process.mainModule === module) {
  packagerMain(process.argv).then(() => process.exit(0)).catch(e => {
    console.error(e.message || e);
    d(e.stack);

    process.exit(-1);
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wYWNrYWdlci1jbGkuanMiXSwibmFtZXMiOlsicGFja2FnZURpciIsImFwcERpciIsInJlYWRkaXIiLCJmaW5kIiwieCIsIm1hdGNoIiwiam9pbiIsInBhY2thZ2VEaXJUb1Jlc291cmNlc0RpciIsImZyb20iLCJ0byIsImQiLCJidWYiLCJyZWFkRmlsZSIsIndyaXRlRmlsZSIsImNvcHlTbWFsbEZpbGUiLCJlbnRyeSIsImZ1bGxQYXRoIiwic3RhdCIsImlzRGlyZWN0b3J5IiwicGFja2FnZUpzb24iLCJKU09OIiwicGFyc2UiLCJpbmRleCIsIm1haW4iLCJvcmlnaW5hbE1haW4iLCJfX2Rpcm5hbWUiLCJzdHJpbmdpZnkiLCJjb21waWxlQW5kU2hpbSIsImFzYXJVbnBhY2tEaXIiLCJhc2FyQXJncyIsInB1c2giLCJmaW5kRXhlY3V0YWJsZU9yR3Vlc3MiLCJjbWQiLCJhcmdzIiwiY3dkIiwic3luYyIsInJ1bkFzYXJBcmNoaXZlIiwiYXJndiIsInNwbGljZSIsInNwbGl0T3V0QXNhckFyZ3VtZW50cyIsInBhY2thZ2VyQXJncyIsImVsZWN0cm9uUGFja2FnZXIiLCJwYWNrYWdlck91dHB1dCIsInBhY2thZ2VEaXJzIiwicGFyc2VQYWNrYWdlck91dHB1dCIsImxlbmd0aCIsInBhY2thZ2VyTWFpbiIsInJlcXVpcmUiLCJFcnJvciIsInJldCIsImZpbHRlciIsImluZGV4T2ZVbnBhY2siLCJmaW5kSW5kZXgiLCJ1bnBhY2tBcmdzIiwic2xpY2UiLCJub3RVbnBhY2tBcmdzIiwiY29uY2F0Iiwib3V0cHV0IiwiY29uc29sZSIsImxvZyIsImxpbmVzIiwic3BsaXQiLCJpZHgiLCJyZXBsYWNlIiwiY21kVG9GaW5kIiwiYXJnc1RvVXNlIiwiY21kU3VmZml4IiwicHJvY2VzcyIsInBsYXRmb3JtIiwicmVzb2x2ZSIsIm1haW5Nb2R1bGUiLCJtb2R1bGUiLCJ0aGVuIiwiZXhpdCIsImNhdGNoIiwiZSIsImVycm9yIiwibWVzc2FnZSIsInN0YWNr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QyxtQ0FBcUJELFNBQXJCLEVBQWdDQyxTQUFoQyxDQURzQzs7QUFBQSxNQUNwRGpDLEdBRG9ELHlCQUNwREEsR0FEb0Q7QUFBQSxNQUMvQ0MsSUFEK0MseUJBQy9DQSxJQUQrQzs7QUFFMUQsTUFBSUQsUUFBUVMsZ0JBQVosRUFBOEI7QUFDNUIvQixNQUFHLGVBQWFzRCxTQUFVLG1EQUExQjtBQUNBLFFBQUlFLFlBQVlDLFFBQVFDLFFBQVIsS0FBcUIsT0FBckIsR0FBK0IsTUFBL0IsR0FBd0MsRUFBeEQ7QUFDQSxXQUFPLG1DQUFxQixlQUFLQyxPQUFMLENBQWE1QyxTQUFiLEVBQXdCLElBQXhCLEVBQThCLElBQTlCLEVBQW9DLE1BQXBDLEVBQTZDLElBQUV1QyxTQUFVLEtBQUVFLFNBQVUsR0FBckUsQ0FBckIsRUFBOEZELFNBQTlGLENBQVA7QUFDRDs7QUFFRCxTQUFPLEVBQUVqQyxHQUFGLEVBQU9DLElBQVAsRUFBUDtBQUNEOztBQTZCRCxJQUFJa0MsUUFBUUcsVUFBUixLQUF1QkMsTUFBM0IsRUFBbUM7QUFDakN6QixlQUFhcUIsUUFBUTlCLElBQXJCLEVBQ0dtQyxJQURILENBQ1EsTUFBTUwsUUFBUU0sSUFBUixDQUFhLENBQWIsQ0FEZCxFQUVHQyxLQUZILENBRVVDLENBQUQsSUFBTztBQUNaakIsWUFBUWtCLEtBQVIsQ0FBY0QsRUFBRUUsT0FBRixJQUFhRixDQUEzQjtBQUNBakUsTUFBRWlFLEVBQUVHLEtBQUo7O0FBRUFYLFlBQVFNLElBQVIsQ0FBYSxDQUFDLENBQWQ7QUFDRCxHQVBIO0FBUUQiLCJmaWxlIjoicGFja2FnZXItY2xpLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5cbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHJpbXJhZiBmcm9tICdyaW1yYWYnO1xuXG5pbXBvcnQge3Bmc30gZnJvbSAnLi9wcm9taXNlJztcbmltcG9ydCB7bWFpbn0gZnJvbSAnLi9jbGknO1xuXG5pbXBvcnQge3NwYXduUHJvbWlzZSwgZmluZEFjdHVhbEV4ZWN1dGFibGV9IGZyb20gJ3NwYXduLXJ4JztcblxuY29uc3QgZCA9IHJlcXVpcmUoJ2RlYnVnLWVsZWN0cm9uJykoJ2VsZWN0cm9uLWNvbXBpbGU6cGFja2FnZXInKTtcbmNvbnN0IGVsZWN0cm9uUGFja2FnZXIgPSAnZWxlY3Ryb24tcGFja2FnZXInO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcGFja2FnZURpclRvUmVzb3VyY2VzRGlyKHBhY2thZ2VEaXIpIHtcbiAgbGV0IGFwcERpciA9IChhd2FpdCBwZnMucmVhZGRpcihwYWNrYWdlRGlyKSkuZmluZCgoeCkgPT4geC5tYXRjaCgvXFwuYXBwJC9pKSk7XG4gIGlmIChhcHBEaXIpIHtcbiAgICByZXR1cm4gcGF0aC5qb2luKHBhY2thZ2VEaXIsIGFwcERpciwgJ0NvbnRlbnRzJywgJ1Jlc291cmNlcycsICdhcHAnKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcGF0aC5qb2luKHBhY2thZ2VEaXIsICdyZXNvdXJjZXMnLCAnYXBwJyk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY29weVNtYWxsRmlsZShmcm9tLCB0bykge1xuICBkKGBDb3B5aW5nICR7ZnJvbX0gPT4gJHt0b31gKTtcblxuICBsZXQgYnVmID0gYXdhaXQgcGZzLnJlYWRGaWxlKGZyb20pO1xuICBhd2FpdCBwZnMud3JpdGVGaWxlKHRvLCBidWYpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3BsaXRPdXRBc2FyQXJndW1lbnRzKGFyZ3YpIHtcbiAgaWYgKGFyZ3YuZmluZCgoeCkgPT4geC5tYXRjaCgvXi0tYXNhci11bnBhY2skLykpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiZWxlY3Ryb24tY29tcGlsZSBkb2Vzbid0IHN1cHBvcnQgLS1hc2FyLXVucGFjayBhdCB0aGUgbW9tZW50LCB1c2UgYXNhci11bnBhY2stZGlyXCIpO1xuICB9XG5cbiAgLy8gU3RyaXAgLS1hc2FyIGFsdG9nZXRoZXJcbiAgbGV0IHJldCA9IGFyZ3YuZmlsdGVyKCh4KSA9PiAheC5tYXRjaCgvXi0tYXNhci8pKTtcblxuICBpZiAocmV0Lmxlbmd0aCA9PT0gYXJndi5sZW5ndGgpIHsgcmV0dXJuIHsgcGFja2FnZXJBcmdzOiByZXQsIGFzYXJBcmdzOiBudWxsIH07IH1cblxuICBsZXQgaW5kZXhPZlVucGFjayA9IHJldC5maW5kSW5kZXgoKHgpID0+IHgubWF0Y2goL14tLWFzYXItdW5wYWNrLWRpciQvKSk7XG4gIGlmIChpbmRleE9mVW5wYWNrIDwgMCkge1xuICAgIHJldHVybiB7IHBhY2thZ2VyQXJnczogcmV0LCBhc2FyQXJnczogW10gfTtcbiAgfVxuXG4gIGxldCB1bnBhY2tBcmdzID0gcmV0LnNsaWNlKGluZGV4T2ZVbnBhY2ssIGluZGV4T2ZVbnBhY2srMSk7XG4gIGxldCBub3RVbnBhY2tBcmdzID0gcmV0LnNsaWNlKDAsIGluZGV4T2ZVbnBhY2spLmNvbmNhdChyZXQuc2xpY2UoaW5kZXhPZlVucGFjaysyKSk7XG5cbiAgcmV0dXJuIHsgcGFja2FnZXJBcmdzOiBub3RVbnBhY2tBcmdzLCBhc2FyQXJnczogdW5wYWNrQXJncyB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQYWNrYWdlck91dHB1dChvdXRwdXQpIHtcbiAgLy8gTkI6IFllcywgdGhpcyBpcyBmcmFnaWxlIGFzIGZ1Y2suIDotL1xuICBjb25zb2xlLmxvZyhvdXRwdXQpO1xuICBsZXQgbGluZXMgPSBvdXRwdXQuc3BsaXQoJ1xcbicpO1xuXG4gIGxldCBpZHggPSBsaW5lcy5maW5kSW5kZXgoKHgpID0+IHgubWF0Y2goL1dyb3RlIG5ldyBhcHAvaSkpO1xuICBpZiAoaWR4IDwgMSkgdGhyb3cgbmV3IEVycm9yKGBQYWNrYWdlciBvdXRwdXQgaXMgaW52YWxpZDogJHtvdXRwdXR9YCk7XG4gIGxpbmVzID0gbGluZXMuc3BsaWNlKGlkeCk7XG5cbiAgLy8gTXVsdGktcGxhdGZvcm0gY2FzZVxuICBpZiAobGluZXNbMF0ubWF0Y2goL1dyb3RlIG5ldyBhcHBzLykpIHtcbiAgICByZXR1cm4gbGluZXMuc3BsaWNlKDEpLmZpbHRlcigoeCkgPT4geC5sZW5ndGggPiAxKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gW2xpbmVzWzBdLnJlcGxhY2UoL14uKm5ldyBhcHAgdG8gLywgJycpXTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjb21waWxlQW5kU2hpbShwYWNrYWdlRGlyKSB7XG4gIGxldCBhcHBEaXIgPSBhd2FpdCBwYWNrYWdlRGlyVG9SZXNvdXJjZXNEaXIocGFja2FnZURpcik7XG5cbiAgZChgTG9va2luZyBpbiAke2FwcERpcn1gKTtcbiAgZm9yIChsZXQgZW50cnkgb2YgYXdhaXQgcGZzLnJlYWRkaXIoYXBwRGlyKSkge1xuICAgIGlmIChlbnRyeS5tYXRjaCgvXihub2RlX21vZHVsZXN8Ym93ZXJfY29tcG9uZW50cykkLykpIGNvbnRpbnVlO1xuXG4gICAgbGV0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGFwcERpciwgZW50cnkpO1xuICAgIGxldCBzdGF0ID0gYXdhaXQgcGZzLnN0YXQoZnVsbFBhdGgpO1xuXG4gICAgaWYgKCFzdGF0LmlzRGlyZWN0b3J5KCkpIGNvbnRpbnVlO1xuXG4gICAgZChgRXhlY3V0aW5nIGVsZWN0cm9uLWNvbXBpbGU6ICR7YXBwRGlyfSA9PiAke2VudHJ5fWApO1xuICAgIGF3YWl0IG1haW4oYXBwRGlyLCBbZnVsbFBhdGhdKTtcbiAgfVxuXG4gIGQoJ0NvcHlpbmcgaW4gZXM2LXNoaW0nKTtcbiAgbGV0IHBhY2thZ2VKc29uID0gSlNPTi5wYXJzZShcbiAgICBhd2FpdCBwZnMucmVhZEZpbGUocGF0aC5qb2luKGFwcERpciwgJ3BhY2thZ2UuanNvbicpLCAndXRmOCcpKTtcblxuICBsZXQgaW5kZXggPSBwYWNrYWdlSnNvbi5tYWluIHx8ICdpbmRleC5qcyc7XG4gIHBhY2thZ2VKc29uLm9yaWdpbmFsTWFpbiA9IGluZGV4O1xuICBwYWNrYWdlSnNvbi5tYWluID0gJ2VzNi1zaGltLmpzJztcblxuICBhd2FpdCBjb3B5U21hbGxGaWxlKFxuICAgIHBhdGguam9pbihfX2Rpcm5hbWUsICdlczYtc2hpbS5qcycpLFxuICAgIHBhdGguam9pbihhcHBEaXIsICdlczYtc2hpbS5qcycpKTtcblxuICBhd2FpdCBwZnMud3JpdGVGaWxlKFxuICAgIHBhdGguam9pbihhcHBEaXIsICdwYWNrYWdlLmpzb24nKSxcbiAgICBKU09OLnN0cmluZ2lmeShwYWNrYWdlSnNvbiwgbnVsbCwgMikpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuQXNhckFyY2hpdmUocGFja2FnZURpciwgYXNhclVucGFja0Rpcikge1xuICBsZXQgYXBwRGlyID0gYXdhaXQgcGFja2FnZURpclRvUmVzb3VyY2VzRGlyKHBhY2thZ2VEaXIpO1xuXG4gIGxldCBhc2FyQXJncyA9IFsncGFjaycsICdhcHAnLCAnYXBwLmFzYXInXTtcbiAgaWYgKGFzYXJVbnBhY2tEaXIpIHtcbiAgICBhc2FyQXJncy5wdXNoKCctLXVucGFjay1kaXInLCBhc2FyVW5wYWNrRGlyKTtcbiAgfVxuXG4gIGxldCB7IGNtZCwgYXJncyB9ID0gZmluZEV4ZWN1dGFibGVPckd1ZXNzKCdhc2FyJywgYXNhckFyZ3MpO1xuXG4gIGQoYFJ1bm5pbmcgJHtjbWR9ICR7SlNPTi5zdHJpbmdpZnkoYXJncyl9YCk7XG4gIGF3YWl0IHNwYXduUHJvbWlzZShjbWQsIGFyZ3MsIHsgY3dkOiBwYXRoLmpvaW4oYXBwRGlyLCAnLi4nKSB9KTtcbiAgcmltcmFmLnN5bmMocGF0aC5qb2luKGFwcERpcikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmluZEV4ZWN1dGFibGVPckd1ZXNzKGNtZFRvRmluZCwgYXJnc1RvVXNlKSB7XG4gIGxldCB7IGNtZCwgYXJncyB9ID0gZmluZEFjdHVhbEV4ZWN1dGFibGUoY21kVG9GaW5kLCBhcmdzVG9Vc2UpO1xuICBpZiAoY21kID09PSBlbGVjdHJvblBhY2thZ2VyKSB7XG4gICAgZChgQ2FuJ3QgZmluZCAke2NtZFRvRmluZH0sIGZhbGxpbmcgYmFjayB0byB3aGVyZSBpdCBzaG91bGQgYmUgYXMgYSBndWVzcyFgKTtcbiAgICBsZXQgY21kU3VmZml4ID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICcuY21kJyA6ICcnO1xuICAgIHJldHVybiBmaW5kQWN0dWFsRXhlY3V0YWJsZShwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAnLmJpbicsIGAke2NtZFRvRmluZH0ke2NtZFN1ZmZpeH1gKSwgYXJnc1RvVXNlKTtcbiAgfVxuXG4gIHJldHVybiB7IGNtZCwgYXJncyB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcGFja2FnZXJNYWluKGFyZ3YpIHtcbiAgZChgYXJndjogJHtKU09OLnN0cmluZ2lmeShhcmd2KX1gKTtcbiAgYXJndiA9IGFyZ3Yuc3BsaWNlKDIpO1xuXG4gIGxldCB7IHBhY2thZ2VyQXJncywgYXNhckFyZ3MgfSA9IHNwbGl0T3V0QXNhckFyZ3VtZW50cyhhcmd2KTtcbiAgbGV0IHsgY21kLCBhcmdzIH0gPSBmaW5kRXhlY3V0YWJsZU9yR3Vlc3MoZWxlY3Ryb25QYWNrYWdlciwgcGFja2FnZXJBcmdzKTtcblxuICBkKGBTcGF3bmluZyBlbGVjdHJvbi1wYWNrYWdlcjogJHtKU09OLnN0cmluZ2lmeShhcmdzKX1gKTtcbiAgbGV0IHBhY2thZ2VyT3V0cHV0ID0gYXdhaXQgc3Bhd25Qcm9taXNlKGNtZCwgYXJncyk7XG4gIGxldCBwYWNrYWdlRGlycyA9IHBhcnNlUGFja2FnZXJPdXRwdXQocGFja2FnZXJPdXRwdXQpO1xuXG4gIGQoYFN0YXJ0aW5nIGNvbXBpbGF0aW9uIGZvciAke0pTT04uc3RyaW5naWZ5KHBhY2thZ2VEaXJzKX1gKTtcbiAgZm9yIChsZXQgcGFja2FnZURpciBvZiBwYWNrYWdlRGlycykge1xuICAgIGF3YWl0IGNvbXBpbGVBbmRTaGltKHBhY2thZ2VEaXIpO1xuXG4gICAgaWYgKCFhc2FyQXJncykgY29udGludWU7XG5cbiAgICBkKCdTdGFydGluZyBBU0FSIHBhY2thZ2luZycpO1xuICAgIGxldCBhc2FyVW5wYWNrRGlyID0gbnVsbDtcbiAgICBpZiAoYXNhckFyZ3MubGVuZ3RoID09PSAyKSB7XG4gICAgICBhc2FyVW5wYWNrRGlyID0gYXNhckFyZ3NbMV07XG4gICAgfVxuXG4gICAgYXdhaXQgcnVuQXNhckFyY2hpdmUocGFja2FnZURpciwgYXNhclVucGFja0Rpcik7XG4gIH1cbn1cblxuaWYgKHByb2Nlc3MubWFpbk1vZHVsZSA9PT0gbW9kdWxlKSB7XG4gIHBhY2thZ2VyTWFpbihwcm9jZXNzLmFyZ3YpXG4gICAgLnRoZW4oKCkgPT4gcHJvY2Vzcy5leGl0KDApKVxuICAgIC5jYXRjaCgoZSkgPT4ge1xuICAgICAgY29uc29sZS5lcnJvcihlLm1lc3NhZ2UgfHwgZSk7XG4gICAgICBkKGUuc3RhY2spO1xuXG4gICAgICBwcm9jZXNzLmV4aXQoLTEpO1xuICAgIH0pO1xufVxuIl19