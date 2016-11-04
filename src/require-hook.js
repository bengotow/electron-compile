import mimeTypes from './mime-types';

const requirableMimeTypes = [
  'application/javascript',
  'application/json',
];

/**
 * Initializes the node.js hook that allows us to intercept files loaded by
 * node.js and rewrite them. This method along with {@link initializeProtocolHook}
 * are the top-level methods that electron-compile actually uses to intercept
 * code that Electron loads.
 *
 * @param  {CompilerHost} compilerHost  The compiler host to use for compilation.
 */
export default function registerRequireExtension(compilerHost) {
  Object.keys(compilerHost.compilersByMimeType).forEach((inputMimeType) => {
    const compiler = compilerHost.compilersByMimeType[inputMimeType];
    const outputMimeType = compiler.constructor.getOutputMimeType();

    // Only expose extensions to NodeJS if the output of the compiler is
    // supported by NodeJS. This prevents module.resolve from returning
    // `index.less`, for example, and trying to load LESS as JavaScript.
    if (outputMimeType && !requirableMimeTypes.includes(outputMimeType)) {
      return;
    }

    mimeTypes.extensions(inputMimeType).forEach((ext) => {
      require.extensions[`.${ext}`] = (module, filename) => {
        let {code} = compilerHost.compileSync(filename);
        module._compile(code, filename);
      };
    });
  });
}
