#!/bin/sh

tsc --project tsconfig.json && \
esbuild furple.js --define:DEBUG=false --minify --log-level=warning --outfile=furple.min.js && \
rm furple.js

tsc --project tsconfig-debug.json && \
esbuild furple-debug.js --define:DEBUG=true --allow-overwrite --log-level=warning --outfile=furple-debug.js

tsc --project test/tsconfig.json
