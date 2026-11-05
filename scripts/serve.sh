#!/bin/sh
# rebuild + (re)start the preview server
cd "$(dirname "$0")/.." || exit 1
bun run build >/tmp/build.log 2>&1 || { tail -30 /tmp/build.log; exit 1; }
pgrep -f "[a]stro.*preview" | xargs -r kill
sleep 0.5
nohup bun run preview --port 4321 >/tmp/preview.log 2>&1 &
sleep 2
