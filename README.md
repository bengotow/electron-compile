## electron-compile

electron-compile compiles JS and CSS on the fly with a single call in your app's 'ready' function.

For JavaScript:

* JavaScript ES6/ES7 (via Babel)
* TypeScript
* CoffeeScript

For CSS:

* LESS
* Sass/SCSS

### How does it work?

Put this at the top of your Electron app:

```js
require('electron-compile').init();
```

From then on, you can now simply include files directly in your HTML, no need for cross-compilation:

```html
<head>
  <script src="main.coffee"></script>
  <link rel="stylesheet" type="text/css" href="main.less" />
</head>
```

or just require them in:

```js
require('./mylib')   // mylib.ts
```

### Does this work in node.js / io.js too?

The JavaScript compilers will register with module.register, but CSS of course won't

### Babel keeps running on my ES5 source

Add `'use nobabel';` to the top of your file to opt-out of Babel compilation.

### Hey, why doesn't this work in my main.js file?

Unfortunately, the very first file that you set up electron-compile in must be written in ES5. Of course, you can always make this file exactly two lines, the 'init' statement, then require your real main.js in.

### How do I set up (Babel / LESS / whatever) the way I want?

In order to configure individual compilers, use the `initWithOptions` method:

```js
let babelOpts = {
  stage: 2
};

initWithOptions({
  cacheDir: '/path/to/my/cache',
  compilerOpts: {
    // Compiler options are a map of extension <=> options for compiler
    js: babelOpts
  }
});
```

## How can I precompile my code for release-time?

electron-compile comes with a command-line application to pre-create a cache for you.

```sh
Usage: electron-compile --target [target-path] paths...

Options:
  -t, --target   The target directory to write a cache directory to
  -v, --verbose  Print verbose information
  -h, --help     Show help
```

Once you create a cache folder, pass it in as a parameter to `initForProduction()`. Ship the cache folder with your application, and you won't need to compile the app on first-run:

```js
require('electron-compile').initForProduction('path/to/precompiled/cache/folder');
```

In order to save space in your application, you can also delete `node_modules/electron-compile/node_modules/electron-compilers` in production so that you're not shipping the compiler implementations themselves (~56MB uncompressed).

Compilation also has its own API:

```js
// Public: Compiles a single file given its path.
//
// filePath: The path on disk to the file
// compilers: (optional) - An {Array} of objects conforming to {CompileCache}
//                         that will be tried in-order to compile code. You must
//                         call init() first if this parameter is null.
//
// Returns a {String} with the compiled output, or will throw an {Error} 
// representing the compiler errors encountered.
export function compile(filePath, compilers=null)

// Public: Recursively compiles an entire directory of files.
//
// rootDirectory: The path on disk to the directory of files to compile.
// compilers: (optional) - An {Array} of objects conforming to {CompileCache}
//                         that will be tried in-order to compile code.
//
// Returns nothing.
export function compileAll(rootDirectory, compilers=null)

// Public: Allows you to create new instances of all compilers that are 
// supported by electron-compile and use them directly. Currently supports
// Babel, CoffeeScript, TypeScript, LESS, and Sass/SCSS.
//
// Returns an {Array} of {CompileCache} objects.
export function createAllCompilers()
```
