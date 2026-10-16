#!/usr/bin/env bash
# Downloads the self-hosted fonts into fonts/ (the APK must work offline, so
# nothing loads from Google Fonts at runtime).
#
# Material Symbols is subset to the icons listed in ICONS — the full variable
# font is ~3.7 MB. If you use a new icon anywhere (HTML, js/, or a category
# icon), add its name here and re-run:  bash scripts/fetch-fonts.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ICONS="account_balance_wallet,add,arrow_back,arrow_forward,backspace,bolt,calculate,calendar_today,category,check,check_circle,chevron_left,chevron_right,close,delete,directions_car,donut_large,download,edit,error,expand_less,expand_more,favorite,flight,home,info,key_off,label_off,link,local_mall,lock,logout,mail,more_horiz,move_to_inbox,movie,north_east,notifications,payments,pets,radio_button_checked,radio_button_unchecked,receipt_long,refresh,remove,restaurant,rule,school,search,sell,sentiment_calm,shopping_cart,south_east,south_west,sync,undo,visibility,visibility_off,warning,wifi_off"

# A modern browser UA makes Google serve woff2.
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
mkdir -p fonts

# Prints the woff2 URL of the latin block for one family/style/weight.
latin_url() { # css, family, style, weight
  awk -v fam="$2" -v sty="$3" -v wt="$4" '
    /\/\* latin \*\// { inlatin = 1; next }
    /\/\*/ { inlatin = 0 }
    inlatin && $0 ~ "font-family: .?" fam { f = 1 }
    inlatin && f && $0 ~ "font-style: " sty { s = 1 }
    inlatin && f && s && $0 ~ "font-weight: " wt { w = 1 }
    inlatin && f && s && w && /src:/ { match($0, /url\([^)]+\)/); print substr($0, RSTART + 4, RLENGTH - 5); exit }
    /}/ { f = s = w = 0 }
  ' <<<"$1"
}

text_css=$(curl -fsS -A "$UA" "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap")
curl -fsS -o fonts/instrument-serif-regular.woff2 "$(latin_url "$text_css" 'Instrument Serif' normal 400)"
curl -fsS -o fonts/instrument-serif-italic.woff2  "$(latin_url "$text_css" 'Instrument Serif' italic 400)"
curl -fsS -o fonts/ibm-plex-sans.woff2            "$(latin_url "$text_css" 'IBM Plex Sans' normal 400)"  # variable, 400–600
curl -fsS -o fonts/ibm-plex-mono-400.woff2        "$(latin_url "$text_css" 'IBM Plex Mono' normal 400)"
curl -fsS -o fonts/ibm-plex-mono-500.woff2        "$(latin_url "$text_css" 'IBM Plex Mono' normal 500)"

icon_css=$(curl -fsS -A "$UA" "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=$ICONS&display=block")
icon_url=$(grep -o 'url([^)]*)' <<<"$icon_css" | head -1 | sed 's/^url(//; s/)$//')
curl -fsS -o fonts/material-symbols-rounded.woff2 "$icon_url"

ls -l fonts
