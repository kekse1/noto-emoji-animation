#!/usr/bin/env node

//
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');

//
// Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
// <https://github.com/kekse1/>
// v1.1.0
//
// Can Index and even download *all* emojis on <https://googlefonts.github.io/noto-emoji-animation/>.
//

//
const beautifyJSON = '\t';	// if nothing's here, the resulting .json's will be as 'compact' as possible
const download = false;		// should all the emojis also be downloaded (see `emojiPath` below)
const debug = false;		// will show every download error, instead of just updating the status output
const instantStop = false;	// will stop process on the first download error; otherwise all errors are counted
const connectionLimit = 20;	// maximum concurrent connections to the download server (0 or below => infinite)
const connectionsPerSecond = 20;// self explaining.. (0 or below => infinite)
const radix = 10;		// hehe..
const relativePaths = true;	// affects only the console output

//
const apiURL = 'https://googlefonts.github.io//noto-emoji-animation/data/api.json';
const imageURL = 'https://fonts.gstatic.com/s/e/notoemoji/latest/';

//
const workingDirectory = process.cwd();
const apiPath = path.join(workingDirectory, path.basename(apiURL));
const base = 'emoji';
const emojiPath = path.join(workingDirectory, base);
const debugMaxFiles = null;

if(fs.existsSync(emojiPath))
{
	console.error('There\'s already a directory `%s`! :/~', (relativePaths ? path.relative(workingDirectory, emojiPath) : emojiPath));
	process.exit(5);
}

const indexPath = path.join(workingDirectory, base + '.index.json');
const jsonPath = path.join(workingDirectory, base + '.json');
const errorPath = path.join(workingDirectory, 'error.log');		// may be empty string or no string, to disable logging download errors

//
Error.stackTraceLimit = Infinity;

//
const esc = String.fromCharCode(27);
const reset = (esc + '[0m');
const bold = (esc + '[1m');
const home = (esc + '[H');
const clearLine = (esc + '[2K');
const clearBelow = (esc + '[0J');
const prev = (esc + '[1F' + clearLine);
const clear = (esc + '[2J' + esc + '[3J');
const back = (esc + home + esc + clear);

//
console.log(os.EOL + os.EOL + os.EOL + '[radix = %s] Index/Download all emojis: <https://googlefonts.github.io/noto-emoji-animation/>.' + os.EOL, bold + radix.toString() + reset);
console.warn(os.EOL + os.EOL + 'Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>');
console.info('<https://github.com/kekse1/>' + os.EOL + os.EOL + os.EOL);

//
var downloads = 0;
var finished = 0;
var errors = 0;
var connections = 0;
var secondConnections = 0;
const queue = [];
var interval = null;
var secondInterval = null;
var start = null;
var stop = null;
var totalBytes = 0;
const errorLog = ((typeof errorPath === 'string' && errorPath.length > 0) ? [] : null);
var remaining = 0;

//
const _round = Math.round;
Reflect.defineProperty(Math, 'round', { value: (_value, _precision = 0) => {
	const coefficient = Math.pow(10, _precision);
	return ((_round(_value * coefficient) / coefficient) || 0);
}});

//
const getTime = (_seconds = false) => {
	if(start === null)
	{
		return 0;
	}
	
	var result;
	
	if(stop === null)
	{
		result = (Date.now() - start);
	}
	else
	{
		result = (stop - start);
	}
	
	if(_seconds)
	{
		result = Math.round(result, 2);
	}
	
	return result;
};

//
const startDownloads = () => {
	if(! download)
	{
		return false;
	}
	else if(beganDownloads)
	{
		console.error('Downloads already started!');
	}
	else
	{
		start = Date.now();
		beganDownloads = true;
	}

	interval = setInterval(tryQueue, 100);
	secondInterval = setInterval(() => {
		secondConnections = 0;
	}, 1000);
	
	return true;
};

const getRequestFunction = (_url) => {
	var result;
	
	if(_url.startsWith('https:'))
	{
		result = https.get;
	}
	else if(_url.startsWith('http:'))
	{
		result = http.get;
	}
	else
	{
		console.error('Invalid protocol in URL `%s`!', bold + _url + reset);

		if(instantStop)
		{
			process.exit(3);
		}

		result = null;
	}
	
	return result;
};

const getLength = (_url, _callback) => {
	return getRequestFunction(_url).get(_url, { method: 'HEAD' }, (_ev) => {
		var res;
		
		if(!isNaN(_e.headers['content-length']))
		{
			res = Number(_e.headers['content-length']);
		}
		else
		{
			res = null;
		}
		
		_ev.destroy();
		return _callback(res, _url);
	});
};

const get = (_url, _path, _links, _callback) => {
	const result = getRequestFunction(_url).get(_url, {}, (_ev) => { return accept(_ev, _url, _path, _links, _callback, result); });

	if(result !== null)
	{
		++connections;
		++secondConnections;
		result.on('error', (_ev) => { return error(_ev, _url, _path, _links, _callback, result) });
	}
	
	return result;
};

const fin = (_error, _url, _path, _links, _callback) => {
	--connections; --remaining; ++finished;

	if(typeof debugMaxFiles === 'number' && debugMaxFiles >= 1 && finished >= debugMaxFiles)
	{
		console.debug(os.EOL + os.EOL + os.EOL + 'Reached/exceeded the `debugMaxFiles` limit = %s, so we stop here ($? = 255)!' + os.EOL,
			bold + debugMaxFiles.toString(radix) + reset);
		process.exit(255)
	}

	_callback(_error, _url, _path, _links, _callback);
	setTimeout(tryQueue, 0);
};

const accept = (_response, _url, _path, _links, _callback, _request) => {
	if(_response.statusCode !== 200)
	{
		return error('[' + _response.statusCode + '] ' + _response.statusMessage + ': `' + _url + '`', _url, _path, _links, _callback, _request);
	}
	
	var downloadSize = 0;
	
	_response.on('end', (_arg) => {
		if(Array.isArray(_links))
		{
			const __base = path.basename(_path);
			const targetDir = emojiPath;
			
			for(var i = 0; i < _links.length; ++i)
			{
				fs.symlinkSync(__base, targetDir + '/' + _links[i]);
			}
		}

		return fin(null, _url, _path, _links, _callback);
	});
	
	_response.on('data', (_chunk) => {
		totalBytes += _chunk.length;
		downloadSize += _chunk.length;
		fs.appendFileSync(_path, _chunk);
		_callback(downloadSize, _url, _path, _links, _callback);
	});
	
	_response.on('error', (_error) => {
		return error(_error, _url, _path, _links, _callback, _request);
	});
};

const error = (_error, _url, _path, _links, _callback, _request) => {
	++errors;

	if(errorLog !== null)
	{
		errorLog.push([ _url, _path, _error ]);
	}

	if(debug)
	{
		console.error('Now we got %s errors!' + os.EOL, bold + errors.toString(radix) + reset);
	}
	
	if(instantStop)
	{
		const txt = (typeof _error === 'string' ? ': ' + _error : '');
		console.error('Error occured (and `instantStop === true`)' + txt);
		if(txt.length === 0) console.dir(_error);
		process.exit(2);
	}
	
	return fin(_error, _url, _path, _links, _callback);
};

const enqueue = (_url, _path, _links, _callback) => {
	queue.push([ _url, _path, _links, _callback ]);
	++remaining;
	return ++downloads;
};

const tryQueue = () => {
	//
	if(queue.length === 0)
	{
		return 0;
	}
	
	//
	if((typeof connectionLimit === 'number' && connectionLimit >= 1) && connections >= connectionLimit)
	{
		return 0;
	}
	
	var diff = 0;
	
	if(typeof connectionsPerSecond === 'number' && connectionsPerSecond >= 1)
	{
		if(typeof connectionLimit === 'number' && connectionLimit >= 1)
		{
			diff = Math.min(queue.length, (connectionLimit - connections), (connectionsPerSecond - secondConnections));
		}
		else
		{
			diff = Math.min(queue.length, (connectionsPerSecond - secondConnections));
		}
	}
	else if(connectionLimit === 'number' && connectionLimit >= 1)
	{
		diff = Math.min(queue.length, (connectionLimit - connections));
	}
	else
	{
		diff = queue.length;
	}

	if(diff <= 0)
	{
		return diff;
	}

	//
	var result = 0;
	
	do
	{
		if(get(... queue.shift()) !== null)
		{
			--diff;
			++result;
		}
	}
	while(diff > 0);

	//	
	return result;
};

//
var didJSON = false;
var beganDownloads = false;
var finishedDownloads = false;

const cleanUp = () => {
	//
	process.off('exit', cleanUp);
	process.off('SIGINT', cleanUp);
	process.off('SIGTERM', cleanUp);

	//
	if(beganDownloads && !finishedDownloads)
	{
		finishDownloads();
	}
	
	if(didJSON)
	{
		jsonInfo();
	}
	
	//
	process.exit();
};

const finishDownloads = () => {
	clearInterval(interval); clearInterval(secondInterval);
	finishedDownloads = true;
	stop = Date.now();

	console.log(os.EOL + os.EOL + os.EOL);
	console.info(os.EOL + os.EOL + 'Finished %s downloads, in %s seconds!' + os.EOL, bold + todo.toString(radix) + reset, bold + getTime(true).toString(radix) + reset);

	if(errors === 0) console.info(bold + 'NO' + reset + ' errors.');
	else
	{
		console.warn(bold + errors.toString(radix) + reset + ' errors.');
		var errorText = '';

		if(errorLog !== null) for(var j = 0; j < errorLog.length; ++j)
		{
			errorText += (errorLog[j][0] + ' => ' +
				errorLog[j][1] + (typeof errorLog[j][2] === 'string' ? ' <= ' + errorLog[j][2] : '') +
					os.EOL);
		}

		fs.writeFileSync(errorPath, errorText, { encoding: 'utf8' });
		console.info('Just wrote the error log file: `%s`', bold + (relativePaths ? path.relative(workingDirectory, errorPath) : errorPath) + reset);
	}

	console.debug(os.EOL + 'Images are here: `%s`!', bold + (relativePaths ? path.relative(workingDirectory, emojiPath) : emojiPath) + reset);
	process.exit(0);
};

process.on('exit', cleanUp);
process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);

//
var jsonError = false;
var jsonShown = false;
var jsonLength = -1;
var indexLength = -1;

const jsonInfo = () => {
	if(jsonShown || !didJSON)
	{
		return false;
	}
	else
	{
		jsonShown = true;
	}

	console.log(os.EOL);

	if(jsonError)
	{
		console.error('Error while trying to write `*.json` (either in FS or JSON conversion)!');
	}
	else if(jsonLength > 0 && indexLength > 0 && jsonLength === indexLength)
	{
		console.info('JSON data succesfully written (with ' + bold + '%s' + reset + ' items each):' + os.EOL +
			'     Emoji data: `' + bold + (relativePaths ? path.relative(workingDirectory, jsonPath) : jsonPath) + reset + '`' + os.EOL +
			'      Tag index: `' + bold + (relativePaths ? path.relative(workingDirectory, indexPath) : indexPath) + reset + '`' + os.EOL, indexLength.toString(radix));
	}

	return true;
};

const routine = () => {
	const icons = require(apiPath).icons; //see `apiPath` and `apiURL`.
	const result = {};
	const index = [];
	const data = [];
	var dataIndex = 0;
	var indexIndex = 0;

	for(var i = 0; i < icons.length; ++i)
	{
		//
		const codepoint = icons[i].codepoint.split('_');

		for(var j = 0; j < codepoint.length; ++j)
		{
			codepoint[j] = parseInt(codepoint[j], 16);
		}

		//
		const size = 512;
		const name = icons[i].codepoint;
		const tags = icons[i].tags;
		const originalTags = [ ... tags ];
		const file = {
			webp: [ name + '.webp', (imageURL + name + '/' + size + '.webp') ],
			gif: [ name + '.gif', (imageURL + name + '/' + size + '.gif') ],
			json: [ name + '.json', (imageURL + name + '/lottie.json') ] };
		const links = {};
		const string = String.fromCodePoint(... codepoint);
		
		//
		index[indexIndex++] = name;

		for(var j = 0; j < tags.length; ++j)
		{
			var tag = tags[j];
			var num = 0;

			while(tag in result)
			{
				if(num > 0)
				{
					tag = tags[j].slice(0, -1) + '+' + num.toString() + ':';
				}

				++num;
			}
			
			index[indexIndex++] = tags[j] = tag;
		}

		for(const idx in file)
		{
			data[dataIndex++] = [ file[idx][0], file[idx][1], [] ];
			links[idx] = [];
			
			for(var j = 0; j < tags.length; ++j)
			{
				data[dataIndex - 1][2].push(tags[j] + '.' + idx);
				links[idx].push(tags[j] + '.' + idx);
				if(! (tags[j] in links)) links[tags[j]] = {};
				links[tags[j]][idx] = (tags[j] + '.' + idx);
			}
			
			for(var j = 0; j < tags.length; ++j)
			{
				links[tags[j]] = { ... links[tags[j]] };
			}

			file[idx] = file[idx][0];
			links[idx] = [ ... links[idx] ];
			data[dataIndex - 1] = [ ... data[dataIndex - 1] ];
		}
		
		result[name] = { tag, size, name, codepoint, string, tags: [ ... tags ], originalTags, file: { ... file }, links: { ... links } };
		
		for(var j = 0; j < tags.length; ++j)
		{
			result[tags[j]] = { tag, size, name, codepoint, string, tags: [ ... tags ], originalTags, file: { ... file }, links: { ... links } };
		}
	}

	//
	try
	{
		//
		jsonLength = Object.keys(result).length;
		indexLength = index.length;

		//
		fs.writeFileSync(jsonPath, JSON.stringify(result, null, beautifyJSON), { encoding: 'utf8' });
		fs.writeFileSync(indexPath, JSON.stringify(index, null, beautifyJSON), { encoding: 'utf8' });

		//
		didJSON = true;
	}
	catch(_error)
	{
		jsonError = true;
	}

	//
	if(download)
	{
		for(var i = 0; i < dataIndex; ++i)
		{
			const __url = data[i][1];
			const __path = path.join(emojiPath, data[i][0]);
			const __links = [ ... data[i][2] ];
			
			enqueue(__url, __path, __links, (_error, _url, _path, _links, _callback) => {
				var ms;
				const s = Math.round((ms = getTime(false)) / 1000, 2).toString(radix);
				ms = ms.toString(radix);

				process.stdout.write(back);
				console.info(os.EOL + os.EOL + 'Now just wait for all %s downloads to complete. ...' + os.EOL, bold + downloads.toString(radix) + reset);
				console.log('\t\tAny questions? Send me a mailto:`kuchen@kekse.biz`.');
				console.log('\t\t\tAnd visit me at <https://github.com/kekse1/>! :)~' + os.EOL + os.EOL + os.EOL);
				process.stdout.write(
					'             Seconds: ' + bold + s + reset + os.EOL +
					'         Miliseconds: ' + bold + ms + reset + os.EOL + os.EOL +
					'         Connections: ' + bold + connections.toString(radix) + reset + os.EOL +
					'     Total Downloads: ' + bold + dataIndex.toString(radix) + reset + os.EOL +
					'      Received Bytes: ' + bold + totalBytes.toString(radix) + reset + os.EOL +
					'            Finished: ' + bold + finished.toString(radix) + reset + os.EOL +
					'           Erroneous: ' + bold + errors.toString(radix) + reset + os.EOL +
					'             Pending: ' + bold + queue.length.toString(radix) + reset + os.EOL +
					'           Remaining: ' + bold + remaining.toString(radix) + reset + os.EOL + os.EOL +
					'            Last URL: `' + _url + '`' + os.EOL +
					'           Last File: `' + (relativePaths ? path.relative(workingDirectory, _path) : _path) + '`' + os.EOL);

				if(remaining <= 0)
				{
					return finishDownloads(true);
				}
			});
		}

		if(startDownloads())
		{
			process.stdin.resume();
		}
		else
		{
			console.warn('Failed to start the download process! JFYI.');
			jsonInfo();
		}
	}
	else
	{
		console.warn('Not going to download everything now! JFYI.');
		jsonInfo();
	}
};

//
const mkEmojiDir = (_bool = !!download) => {
	if(_bool && !fs.existsSync(emojiPath))
	{
		try
		{
			fs.mkdirSync(emojiPath);
			console.info('Just created the emoji directory: `%s`.' + os.EOL, bold + (relativePaths ? path.relative(workingDirectory, emojiPath) : emojiPath) + reset);
		}
		catch(_error)
		{
			console.error(os.EOL + bold + 'FAILED' + reset + ' to create emoji directory: `%s`' + os.EOL, bold + (relativePaths ? path.relative(workingDirectory, emojiPath) : emojiPath) + reset);
			process.exit(6);
		}
	}
};

const justWaitSeconds = 4;
const justWait = (_func, ... _args) => {
	if(typeof _func !== 'function')
	{
		console.error('Nothing left to do (maybe a mistake?).. exiting!');
		process.exit(7);
	}
	else console.warn(os.EOL + os.EOL);

	var timeoutDots = '';
	var timeoutCount = 0;
	const timeoutCb = () => {
		console.warn(prev + '\tJust waiting:  ' + bold + '%s / %s' + reset + '  seconds..  ' + bold + '%s' + reset + '  left! %s ', timeoutCount.toString(radix), justWaitSeconds.toString(radix), (justWaitSeconds - timeoutCount).toString(radix), bold + timeoutDots + reset);
		timeoutDots += '.';
		
		if(timeoutCount++ < justWaitSeconds)
		{
			setTimeout(timeoutCb, 1000);
		}
		else
		{
			_func(... _args);
		}
	};

	timeoutCb();
};

if(fs.existsSync(apiPath))
{
	console.info(os.EOL + 'The `api.js` from Google is already here: `%s`' + os.EOL, bold + (relativePaths ? path.relative(workingDirectory, apiPath) : apiPath) + reset);
	mkEmojiDir(true);
	justWait(routine);
}
else
{
	console.warn(os.EOL + 'You don\'t own the `%s` from Google, so we first have to download it:', bold + 'api.js' + reset);
	console.debug(' Source URL: `%s`', bold + apiURL + reset);
	console.debug('Target path: `%s`' + os.EOL, bold + (relativePaths ? path.relative(workingDirectory, apiPath) : apiPath) + reset);

	justWait(() => {
		console.log(os.EOL + os.EOL);

		get(apiURL, apiPath, null, (_error) => {
			if(typeof _error === 'number')
			{
				process.stdout.write(prev + 'Downloaded: ' + bold + _error.toString(radix) + ' Bytes' + os.EOL);
			}
			else
			{
				if(_error !== null)
				{
					var errText = (typeof _error === 'string' ? ': ' + _error : '');
					console.error('Download ' + bold + 'FAILED' + errText + reset + os.EOL);
					if(errText.length === 0) console.dir(_error);
					console.log(os.EOL);
					process.exit(4);
				}
				else if(download && !fs.existsSync(emojiPath))
				{
					mkEmojiDir(true);
				}

				routine();
			}
		});
	})
}

//

