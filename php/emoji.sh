#!/usr/bin/env bash
#
real="$(realpath "$0")"
dir="$(dirname "$real")"
php="`which php 2>/dev/null`"

if [[ -z "$php" ]]; then
	echo " >> No \`php\` interpreter found!" >&2
	exit 1
fi

#
$php $dir/emoji.php "$@"

