const Module = require('module');

if (Array.isArray(Module.builtinModules)) {
  const nodePrefixedBuiltins = Module.builtinModules
    .filter((moduleName) => !moduleName.startsWith('node:'))
    .map((moduleName) => `node:${moduleName}`);

  Module.builtinModules = Array.from(
    new Set([...Module.builtinModules, ...nodePrefixedBuiltins])
  );
}

require('jest/bin/jest');
