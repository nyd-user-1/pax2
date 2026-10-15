#!/bin/bash
# End-to-end check on the worker box: start the built app, call the server actions the way the
# browser does (Next-Action header), in a throwaway workspace cookie. Prints what came back.
cd /opt/pax/repo
WS="e2e-$(date +%s)"
PORT=3311
(PORT=$PORT npx next start -p $PORT > /opt/pax/e2e-server.log 2>&1 &) ; sleep 8
M=.next/server/server-reference-manifest.json
id() { node -e "const m=require('./$M');for(const [k,v] of Object.entries(m.node)){if(v.exportedName==='$1'){console.log(k);process.exit(0)}}"; }
call() { # name, page, json-args
  curl -s -X POST "http://127.0.0.1:$PORT$2" -H "Next-Action: $(id $1)" -H "Content-Type: text/plain;charset=UTF-8" -H "Accept: text/x-component" -b "hermes-ws=$WS" --data "$3"
}
echo "== workspace $WS"
echo "== load round 1"; call loadDataset / '["round-1"]' | tail -c 600; echo
echo "== load round 1 again"; call loadDataset / '["round-1"]' | tail -c 400; echo
echo "== board"; curl -s -b "hermes-ws=$WS" "http://127.0.0.1:$PORT/" | grep -o 'Limited evidence\|Not scored\|Highest so far' | sort | uniq -c
echo "== reading coin-ruth"; call requestReading /v/coin-ruth '["coin-ruth"]' | tail -c 3500; echo
echo "== take page"; curl -s -o /dev/null -w "%{http_code}\n" -b "hermes-ws=$WS" "http://127.0.0.1:$PORT/v/coin-ruth"
for p in /method /reviews /scripts /reference /sources /build; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' -b "hermes-ws=$WS" "http://127.0.0.1:$PORT$p")"; done
pkill -f "next start -p $PORT"
grep -i -E "error|fail" /opt/pax/e2e-server.log | head -20
