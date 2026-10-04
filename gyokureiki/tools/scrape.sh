#!/bin/sh
# 玉霊姫版コダマデータを取得（サーバー負荷に配慮して間隔をあける）
mkdir -p k2
for i in $(seq 1 600); do
  [ -s k2/$i.html ] && continue
  curl -sS -A "Mozilla/5.0" "http://www.tohofes.com/data/kodama2.html?check=$i" | iconv -f EUC-JP -t UTF-8 -c > k2/$i.html
  sleep 0.2
done
