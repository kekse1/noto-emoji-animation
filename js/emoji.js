#!/usr/bin/env node

//
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const https = require('node:https');
const http = require('node:http');

//
// Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
// <https://github.com/kekse1/noto-emoji-animation/>
//
// Can Index and even download *all* emojis on <https://googlefonts.github.io/noto-emoji-animation/>.
//
// TODO / check for file updates, if some already exists on your disk!
//

//
const beautifyJSON = '\t';	// if nothing's here, the resulting .json's will be as 'compact' as possible
const download = true;		// should all the emojis also be downloaded (see `emojiPath` below)
const debug = false;		// will show every download error, instead of just updating the status output
const instantStop = false;	// will stop process on the first download error; otherwise all errors are counted
const connectionLimit = 30;	// maximum concurrent connections to the download server (0 or below => infinite)
const connectionsPerSecond = 20;// self explaining.. (0 or below => infinite)
const radix = 10;		// hehe..
const relativePaths = true;	// affects only the console output
const refreshTime = 120;	// the state screen; to prevent flickering..

//
const apiURL = 'https://googlefonts.github.io/noto-emoji-animation/data/api.json';
const imageURL = 'https://fonts.gstatic.com/s/e/notoemoji/latest/';
//const apiURL = 'http://localhost/mirror/noto-emoji-animation/api.json';
//const imageURL = 'http://localhost/mirror/noto-emoji-animation/emoji/';

//
const workingDirectory = process.cwd();
const apiPath = path.join(workingDirectory, path.basename(apiURL));
const base = 'emoji';
const emojiPath = path.join(workingDirectory, base);
const jsonPath = path.join(workingDirectory, base + '.json');
const listPath = path.join(workingDirectory, base + '.list.json');
const indexPath = path.join(workingDirectory, base + '.index.json');
const errorPath = path.join(workingDirectory, 'error.log');		// may be empty string or no string, to disable logging download errors

//
const VERSION = '1.11.3';
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
console.log(os.EOL + os.EOL + os.EOL + '[%s] Index/Download all emojis: <https://googlefonts.github.io/noto-emoji-animation/>.' + os.EOL, bold + radix.toString() + reset);
console.warn(os.EOL + os.EOL + 'Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>');
console.info('<https://github.com/kekse1/noto-emoji-animation/>');
console.log('v' + bold + VERSION + reset + os.EOL + os.EOL + os.EOL);

//
var existed = 0;
var checking = 0;
var updated = 0;
var downloads = 0;
var open = 0;
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
var lastUpdate = 0;
var symlinks = 0;

//
const _round = Math.round;
Reflect.defineProperty(Math, 'round', { value: (_value, _precision = 0) => {
	if(typeof _precision !== 'number') return _round(_value);
	else _precision = Math.abs(_round(_precision));
	if(_precision === 0) return _round(_value);
	const coefficient = Math.pow(10, _precision);
	return ((_round(_value * coefficient) / coefficient) || 0);
}});

const render = (_value, _ansi = true) => {
	var result = (radix === 10 ? _value.toLocaleString() : _value.toString(radix));
	if(_ansi) result = bold + result + reset;
	return result;
};

const units = [ 'Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB' ];

const renderSize = (_bytes, _ansi = true, _precision = 2) => {
	var rest = _bytes;
	var index = 0;

	while(rest >= 1024)
	{
		rest /= 1024;
		if(++index >= (units.length - 1)) break;
	}
	
	var result = Math.round(rest, _precision);
	return render(result, _ansi) + ' ' + units[index];
};

const parseTime = (_time) => {
	//
	var ms = 0;
	var s = 0;
	var m = 0;
	var h = 0;
	var d = 0;

	//
	ms = Math.floor(_time % 1000);
	_time /= 1000;
	
	s = Math.floor(_time % 60);
	_time /= 60;

	m = Math.floor(_time % 60);
	_time /= 60;

	h = Math.floor(_time % 24);
	_time /= 24;

	d = Math.floor(_time);

	//
	return { ms, s, m, h, d };
};

const getTime = (_render = true, _ansi = true) => {
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
	
	if(_render === null)
	{
		return result;
	}
	else if(_render)
	{
		const rendered = parseTime(result);
		result = '';
		
		if(rendered.d >= 1)
		{
			result += render(rendered.d, _ansi) + 'd ';
		}
		
		if(rendered.h >= 1)
		{
			result += render(rendered.h, _ansi) + 'h ';
		}
		
		if(rendered.m >= 1)
		{
			result += render(rendered.m, _ansi) + 'm ';
		}
		
		if(rendered.s >= 1)
		{
			result += render(rendered.s, _ansi) + 's ';
		}
		
		result += render(rendered.ms, _ansi) + 'ms ';
		result = result.slice(0, -1);
	}
	else
	{
		result = render(result, _ansi);
	}
	
	return result;
};

//
const startDownloads = (_really = true) => {
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

	if(_really)
	{
		interval = setInterval(tryQueue, 100);
		secondInterval = setInterval(() => {
			secondConnections = 0;
		}, 1000);
	}
	
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

const exists = (_url, _callback, _destroy = true) => {
	return getLength(_url, (_res, _url, _ev, _result) => {
		return _callback((_res !== false), _url, _ev, _result);
	}, _destroy);
};

const customHeaders = { 'X-URL': 'https://github.com/kekse1/noto-emoji-animation/' };

const get = (_url, _file, _links, _callback) => {
	const result = getRequestFunction(_url)(_url, { headers: customHeaders }, (_ev) => {
		return accept(_ev, _url, _file, _links, _callback, result); });

	if(result !== null)
	{
		++connections;
		++secondConnections;
		result.on('error', (_ev) => { return error(_ev, _url, _file, _links, _callback, result) });
	}
	
	return result;
};

const getLength = (_url, _callback, _destroy = true) => {
	const result = getRequestFunction(_url)(_url, { method: 'HEAD', headers: customHeaders }, (_ev) => {
		var res = null;
		
		if(_ev.statusCode !== 200)
		{
			res = false;
		}
		else if(!isNaN(_ev.headers['content-length']))
		{
			res = Number(_ev.headers['content-length']);
		}
		else
		{
			res = true;
		}
		
		if(_destroy) _ev.destroy();
		return _callback(res, _url, _ev, result);//FIXME/
	});
	
	return result;
};

const fin = (_error, _url, _file, _links, _callback, _request = null, _response = null) => {
	--connections; --remaining; ++finished;

	if(remaining <= 0 && open <= 0)
	{
		lastUpdate = 0;
	}
	else
	{
		setTimeout(tryQueue, 0);
	}
	
	_callback(_error, _url, _file, _links, _callback, _request, _response);
};

const accept = (_response, _url, _file, _links, _callback, _request = null) => {
	if(_response.statusCode !== 200)
	{
		return error('[' + _response.statusCode + '] ' + _response.statusMessage + ': `' + _url + '`', _url, _file, _links, _callback, _request, null);
	}
	
	const p = (_file[0] === '/' ? _file : path.join(emojiPath, _file));
	const dir = path.dirname(p);
	
	if(! fs.existsSync(dir))
	{
		fs.mkdirSync(dir, { recursive: true });
	}

	const fd = fs.openSync(p, 'w');
	var downloadSize = 0;
	var ended = false;
	var writing = 0;
	var written = 0;
	++open;
	
	const close = () => {
		fs.closeSync(fd);
		--open;
	};
	
	const end = () => {
		ended = true;
		if(writing > 0) return writing;
		close();
		if(Array.isArray(_links)) makeSymlinks(_links, _file);
		return fin(null, _url, _file, _links, _callback, _request, _response);
	};
	
	_response.on('end', end);
	
	_response.on('data', (_chunk) => {
		totalBytes += _chunk.length;
		downloadSize += _chunk.length;
		++writing;
		fs.write(fd, _chunk, 0, _chunk.length, written, (_err, _written, _buffer) => {
			if(--writing <= 0 && ended) return end();
			return _callback(downloadSize, _url, _file, _links, _callback, _request, _response);
		});
		written += _chunk.length;
		_callback(downloadSize, _url, _file, _links, _callback, _request, _response);
	});
	
	_response.on('error', (_error) => {
		ended = true;
		close();
		fs.unlinkSync(p);
		return error(_error, _url, _file, _links, _callback, _request, _response);
	});

	//TODO/!!
	//_response.on('timeout', () => {
	
	//
	_callback(0, _url, _file, _links, _callback, _request, _response);
};

const makeSymlinks = (_links, _target) => {
	if(! Array.isArray(_links)) return -1;
	else if(typeof _target !== 'string' || _target.length === 0) return -2;
	const p = path.join(emojiPath, _target);

	if(! fs.existsSync(p))
	{
		console.error('Failure (Unexpected): The path `%s` doesn\'t exist! :/', (relativePaths ? path.relative(workingDirectory, p) : p));
		process.exit(8);
	}

	var result = 0;
	var link;
	
	for(var i = 0; i < _links.length; ++i)
	{
		if(typeof _links[i] !== 'string' || _links[i].length === 0) continue;
		link = path.join(emojiPath, _links[i]);
		if(fs.existsSync(link)) continue;
		else fs.symlinkSync(_target, link);
		++result;
	}

	symlinks += result;
	return result;
};

const error = (_error, _url, _file, _links, _callback, _request = null, _response = null) => {
	++errors;

	if(errorLog !== null)
	{
		errorLog.push([ _url, _file, _error ]);
	}

	if(debug)
	{
		console.error('Now we got %s errors!' + os.EOL, render(errors));
	}
	
	if(instantStop)
	{
		const txt = (typeof _error === 'string' ? ': ' + _error : '');
		console.error('Error occured (and `instantStop === true`)' + txt);
		if(txt.length === 0) console.dir(_error);
		process.exit(2);
	}
	
	return fin(_error, _url, _file, _links, _callback, _request, _response);
};

const enqueue = (_url, _file, _links, _callback) => {
	queue.push([ _url, _file, _links, _callback ]);
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

const cleanUp = (_ex, _two) => {
	//
	var exitCode;

	if(typeof _ex === 'number')
	{
		exitCode = Math.abs(Math.floor(_ex));
	}
	else if(typeof _two === 'number')
	{
		exitCode = Math.abs(Math.floor(_two));
	}
	else if(_ex instanceof Error)
	{
		exitCode = 199;
	}
	else
	{
		exitCode = 0;
	}

	//
	process.off('exit', cleanUp);
	process.off('SIGINT', cleanUp);
	process.off('SIGTERM', cleanUp);

	//
	console.log(os.EOL);
	
	//
	if(_ex instanceof Error) console.dir(_ex);
	if(beganDownloads && !finishedDownloads) finishDownloads(false);
	if(didJSON) jsonInfo();
	
	//
	process.exit(exitCode);
};

const finishDownloads = (_exit = true) => {
	clearInterval(interval); clearInterval(secondInterval);
	finishedDownloads = true;
	stop = Date.now();

	console.log(os.EOL + os.EOL + os.EOL);
	console.info('     Downloads: %s', render(downloads));
	console.info('          Size: %s', renderSize(totalBytes));
	console.info('          Time: %s', getTime());
	console.info('      Finished: %s (%s)', render(finished), render(Math.round(finished / downloads * 100, 2) + ' %'));
	console.info('       Existed: %s', render(existed));
	console.info('       Updated: %s', render(updated));
	console.info('        Errors: %s', render(errors));
	console.info(' Tags/Symlinks: %s', render(symlinks));
	console.log();
	
	if(errors === 0) console.info(bold + 'NO' + reset + ' errors.');
	else
	{
		console.warn('%s errors!', render(errors));
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

	console.info(os.EOL + 'Images (with tag symlinks) are here: `%s`', bold + (relativePaths ? path.relative(workingDirectory, emojiPath) : emojiPath) + reset);

	if(_exit) process.exit();
};

process.on('exit', cleanUp);
process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);
process.on('uncaughtException', cleanUp);

//
var jsonError = false;
var jsonShown = false;
var emojiLength = -1;
var listLength = -1;
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
	else if(emojiLength > -1 || listLength > -1 || indexLength > -1)
	{
		console.info('JSON data succesfully written:' + os.EOL +
			'         Emojis: `' + bold + (relativePaths ? path.relative(workingDirectory, jsonPath) : jsonPath) + reset + '`' + os.EOL +
			'           List: `' + bold + (relativePaths ? path.relative(workingDirectory, listPath) : listPath) + reset + '`' + os.EOL +
			'          Index: `' + bold + (relativePaths ? path.relative(workingDirectory, indexPath) : indexPath) + reset);

		if(emojiLength < 0)
		{
			console.error('Something strange occured with the `%s`!', 'emoji.json');
		}

		if(listLength < 0)
		{
			console.error('Something strange with the `%s`!', 'emoji.list.json');
		}

		if(indexLength < 0)
		{
			console.error('Something weird with the `%s`!', 'emoji.index.json');
		}
	}

	return true;
};

const routine = () => {
	const icons = require(apiPath).icons; //see `apiPath` and `apiURL`.
	const result = {};
	const list = [];
	const data = [];
	const index = {};
	var dataIndex = 0;
	var listIndex = 0;

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
			webp: name + '/' + size + '.webp',
			gif: name + '/' + size + '.gif',
			json: name + '/lottie.json' };
		const url = {
			webp: (imageURL + '/' + name + '/' + size + '.webp').split('//').join('/'),
			gif: (imageURL + '/' + name + '/' + size + '.gif').split('//').join('/'),
			json: (imageURL + '/' + name + '/lottie.json').split('//').join('/')
		};
		const links = {};
		const string = String.fromCodePoint(... codepoint);
		
		//
		list[listIndex++] = name;

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
			
			list[listIndex++] = tags[j] = tag;
		}

		for(var j = 0; j < tags.length; ++j)
		{
			index[tags[j]] = { ... url, codepoint, string };
		}

		for(const idx in file)
		{
			data[dataIndex++] = [ url[idx], file[idx], [] ];
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

			links[idx] = [ ... links[idx] ];
			data[dataIndex - 1] = [ ... data[dataIndex - 1] ];
		}
		
		result[name] = { name, size, codepoint, string, tags: [ ... tags ], originalTags, file: { ... file }, url: { ... url }, links: { ... links } };
		
		for(var j = 0; j < tags.length; ++j)
		{
			result[tags[j]] = { name, size, codepoint, string, tags: [ ... tags ], originalTags, file: { ... file }, url: { ... url}, links: { ... links } };
		}
	}

	//
	try
	{
		//
		jsonLength = Object.keys(result).length;
		listLength = list.length;
		indexLength = Object.keys(index).length;

		//
		fs.writeFileSync(jsonPath, JSON.stringify(result, null, beautifyJSON), { encoding: 'utf8' });
		fs.writeFileSync(listPath, JSON.stringify(list, null, beautifyJSON), { encoding: 'utf8' });
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
			if(fs.existsSync(path.join(emojiPath, data[i][1])))
			{
				makeSymlinks(data[i][2], data[i][1]);
				++existed;
				--dataIndex;
				data.splice(i--, 1);
			}
		}

		var timeout = null;
		var lastArgs = null;

		const callback = (... _args) => {
			if(timeout !== null)
			{
				clearTimeout(timeout);
				timeout = null;
			}

			const now = Date.now();
			const diff = (now - lastUpdate);
			lastArgs = _args;

			if(remaining <= 0 && open <= 0)
			{
				lastUpdate = 0;
			}
			else if(diff < refreshTime)
			{
				timeout = setTimeout(() => {
					timeout = null;
					if(lastArgs === null) return false;
					return callback(... lastArgs);
				}, diff + 1);
				return false;
			}
			else
			{
				lastUpdate = now;
			}
			
			return update(... lastArgs);
		};

		const update = (_error, _url, _file, _links, _callback, _request = null, _response = null) => {
			//
			lastArgs = null;

			//
			process.stdout.write(back);
			console.info(os.EOL + os.EOL + 'Now just wait for all %s downloads to complete. ...' + os.EOL, render(downloads));
			console.log('\tv' + bold + VERSION + reset + os.EOL);
			console.log('\t\tAny questions? Send me a `mailto:kuchen@kekse.biz`.');
			console.log('\t\t\tAnd visit me at <https://github.com/kekse1/>! :)~' + os.EOL + os.EOL + os.EOL);
			process.stdout.write(
				'        Elapsed Time: ' + getTime() + os.EOL + os.EOL +
				'          Open files: ' + render(open) + os.EOL +
				'         Connections: ' + render(connections) + os.EOL +
				'     Total Downloads: ' + render(dataIndex) + os.EOL +
				'            Received: ' + renderSize(totalBytes) + os.EOL +
				'            Finished: ' + render(finished) + os.EOL +
				'           Erroneous: ' + render(errors) + os.EOL +
				'             Pending: ' + render(queue.length) + os.EOL +
				'           Remaining: ' + render(remaining) + os.EOL +
				'     Already existed: ' + render(existed) + os.EOL +
				'            Checking: ' + render(checking) + os.EOL +
				'             Updated: ' + render(updated) + os.EOL + 
				'      Symbolic Links: ' + render(symlinks) + os.EOL + os.EOL +
				'            Last URL: `' +  bold + (_url || '') + reset + '`' + os.EOL +
				'           Last File: `' + bold + (_file || '') + reset + '`' + os.EOL);

			if(remaining <= 0 && open <= 0)
			{
				lastUpdate = 0;
				finishDownloads();
				return null;
			}
			
			//
			return true;
		};
		
		for(var i = 0; i < dataIndex; ++i)
		{
			enqueue(... data[i], callback);
		}

		if(dataIndex <= 0)
		{
			if(startDownloads())
			{
				return finishDownloads();
			}
		}
		else if(startDownloads())
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
		console.warn(os.EOL + os.EOL + bold + 'NOT' + reset + ' going to download everything now (see `download` *setting*)!');
		jsonInfo();
	}
};

//
const mkEmojiDirs = (_bool = !!download) => {
	const exists = fs.existsSync(emojiPath);

	if(_bool && !exists)
	{
		try
		{
			fs.mkdirSync(emojiPath, { recursive: true });
			console.info('Just created the emoji directory `%s`.', (relativePaths ? path.relative(workingDirectory, emojiPath) : emojiPath));
		}
		catch(_error)
		{
			console.error(os.EOL + bold + 'FAILED' + reset + ' to create emoji directory `%s`!' + os.EOL, (relativePaths ? path.relative(workingDirectory, emojiPath) : emojiPath));
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
		console.warn(prev + '\tJust waiting:  %s / %s  seconds..  %s  left! %s ', render(timeoutCount), render(justWaitSeconds), render(justWaitSeconds - timeoutCount), timeoutDots);
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
	if(download) mkEmojiDirs(true);
	justWait(routine);
}
else
{
	console.warn(os.EOL + 'You don\'t own the `%s` from Google, so we first have to download it:', bold + 'api.js' + reset);
	console.debug(' Source URL: `%s`', bold + apiURL + reset);
	console.debug('Target path: `%s`' + os.EOL, bold + (relativePaths ? path.relative(workingDirectory, apiPath) : apiPath) + reset);

	justWait(() => {
		console.log(os.EOL + os.EOL);
		console.log();

		get(apiURL, apiPath, null, (_error) => {
			if(typeof _error === 'number')
			{
				process.stdout.write(prev + 'Downloaded: ' + renderSize(_error, true) + os.EOL);
			}
			else if(_error !== null && _error !== false)
			{
				var errText = (typeof _error === 'string' ? ': ' + _error : '');
				console.error('Download ' + bold + 'FAILED' + errText + reset + os.EOL);
				if(errText.length === 0) console.dir(_error);
				console.log(os.EOL);
				process.exit(4);
			}
			else
			{
				if(download)
				{
					mkEmojiDirs(true);
				}

				return justWait(routine);
			}
		});
	})
}

//

