#!/usr/bin/env node

//
// Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
//
// Just to count all the used tag characters (to let them fit into the
// `\kekse\emoji\getTag()` function in the `../php/emoji.php` ;)~ ..
//
// Updated 2025-04-23, jfyi.
//

//
const DEFAULT_JSON = 'emoji.tags.json';

//
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

//
const sortAsc = true;

//
var tags;

if(DEFAULT_JSON.startsWith('./'))
{
	tags = path.join(process.cwd(), DEFAULT_JSON);
}
else
{
	tags = path.join(__dirname, DEFAULT_JSON);
}

//
if(!fs.existsSync(tags))
{
	console.error('The `%s` is not located at `%s`!', DEFAULT_JSON, tags);
	process.exit(1);
}
else if(! Array.isArray(tags = require(tags)))
{
	console.error('Erroneous `%s` file (not an Array)', DEFAULT_JSON);
	process.exit(2);
}

if(tags.length === 0)
{
	console.warn('No real emoji tags found in `' + DEFAULT_JSON + '`! :/');
	process.exit(4);
}
else
{
	console.info('Found %d tags in the `' + DEFAULT_JSON + '` (that\'s good for now..).', tags.length);
	console.warn('Now we\'re going to extract and count all the used characters..');
}

const map = new Map();
const countChar = (_char) => {
	var value = 0;
	if(map.has(_char)) value = map.get(_char);
	++value;
	map.set(_char, value);
	return value;
};

for(var i = 0; i < tags.length; ++i)
{
	for(var j = 0; j < tags[i].length; ++j)
	{
		countChar(tags[i][j]);
	}
}

var keys = map.keys();
var result = Object.create(null);
var byte, real;
var maxLen = 0;

for(const k of keys)
{
	if((byte = k.charCodeAt(0)) >= 65 && byte <= 90)
	{
		real = '[A-Z]';
	}
	else if(byte >= 97 && byte <= 122)
	{
		real = '[a-z]';
	}
	else if(byte >= 48 && byte <= 57)
	{
		real = '[0-9]';
	}
	else if(byte < 32 || byte === 127)
	{
		real = '[binary]';
	}
	else
	{
		real = '`' + k + '` (' + byte + ')';
	}

	if(real.length > maxLen)
	{
		maxLen = real.length;
	}

	if(real in result)
	{
		result[real] += map.get(k);
	}
	else
	{
		result[real] = map.get(k);
	}
}

const entries = Object.entries(result).sort((_a, _b) => (sortAsc ? (_b[1] - _a[1]) : (_a[1] - _b[1])));
result = Object.fromEntries(entries);
console.log();

for(const idx in result)
{
	console.log('%s:  %d', idx.padStart(maxLen + 2, ' '), result[idx]);
}

console.log();

