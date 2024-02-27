#!/bin/sh

tsc --project tsconfig.json
tsc --project tsconfig-debug.json
tsc --project test/tsconfig.json
esbuild --minify < furple.js > furple.min.js
rm furple.js
