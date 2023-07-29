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

//
const beautifyJSON = '\t';			// if nothing's here, the resulting .json's will be as 'compact' as possible
const download = true;				// should all the emojis also be downloaded (see `emojiPath` below);
const debug = false;				// will show every download error, instead of just updating the status output
const instantStop = false;			// will stop process on the first download error; otherwise all errors are counted
const connectionLimit = 75;			// maximum concurrent connections to the download server (0 or below => infinite);
const connectionsPerSecond = 25;		// self explaining.. (0 or below => infinite);
const connectionTimeout = 16000;		// the timeout for each http(s) request (defaults to 20 seconds);
const connectionBandwidthPerLink = null;//1024*1024*100;// bytes per second per link (defaults to 10 mib/s);
const connectionBandwidthGlobal = null;//1024*1024*1000;// bytes per second in total, so all links together (defaults to 100 mib/s);
const radix = 10;				// hehe.. BUT: (!==10) won't .toLocaleString(), so w/ thousand dots/commas, etc..
const relativePaths = true;			// affects only the console output, where paths are printed out.
const refreshTime = 96;				// the state screen; to prevent screen flickering in the update-output.
const averageUpdate = 24;			// when to decrement the average values

//
const apiURL = 'https://googlefonts.github.io/noto-emoji-animation/data/api.json';
const imageURL = 'https://fonts.gstatic.com/s/e/notoemoji/latest/';

//
const workingDirectory = process.cwd();
const apiPath = path.join(workingDirectory, path.basename(apiURL));
const base = 'emoji';
const emojiPath = path.join(workingDirectory, base);
const jsonPath = path.join(workingDirectory, base + '.json');
const tagsPath = jsonPath.slice(0, -4) + 'tags.json';
const indexPath = jsonPath.slice(0, -4) + 'index.json';
const eTagIndexPath = path.join(emojiPath, 'emoji.http-e-tags.json');
const errorPath = path.join(workingDirectory, 'error.log');		// may be empty string or no string, to disable logging download errors

//
const VERSION = '2.1.0';

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
console.log('[%s] Index/Download all emojis from Google\'s <https://googlefonts.github.io/noto-emoji-animation/>.' + os.EOL, bold + radix.toString() + reset);
console.warn(os.EOL + os.EOL + 'Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>');
console.info('<https://github.com/kekse1/noto-emoji-animation/>');
console.log('v' + bold + VERSION + reset + os.EOL + os.EOL + os.EOL);

//
var existed = 0;
var updated = 0;
var downloads = 0;
var openFiles = 0;
var finished = 0;
var errors = 0;
var secondConnections = 0;
const queue = [];
var start = null;
var stop = null;
var totalBytes = 0;
const errorLog = ((typeof errorPath === 'string' && errorPath.length > 0) ? [] : null);
var lastUpdate = 0;
var symlinks = 0;
var lastSecond = 0;
const connections = [];
var secondBytes = 0;
var totalPauseTime = 0;
var totalPause = false;
var pausedConnections = 0;
const globalBandwidthLimit = (typeof connectionBandwidthGlobal === 'number' && connectionBandwidthGlobal >= 1);
const perLinkBandwidthLimit = (typeof connectionBandwidthPerLink === 'number' && connectionBandwidthPerLink >= 1);

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

const renderTime = (_time, _ansi = true) => {
	const rendered = parseTime(_time);
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
	
	return result;
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
		result = renderTime(result, _ansi);
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

	if(_really && queue.length > 0)
	{
		console.info(os.EOL + 'Starting the download process.');
		
		if(globalBandwidthLimit)
		{
			console.debug('Connection bandwidth: %s', renderSize(connectionBandwidthGlobal) + ' / second');
		}

		if(perLinkBandwidthLimit)		
		{
			console.debug('  Bandwidth per link: %s', renderSize(connectionBandwidthPerLink) + ' / second');
		}
		
		nextQueueItem();
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

const customOptions = { headers: { 'X-URL': 'https://github.com/kekse1/noto-emoji-animation/' } };

const get = (_url, _file, _links, _eTag, _callback) => {
	const opts = Object.assign({}, customOptions);
	
	if(! ('headers' in opts))
	{
		opts.headers = {};
	}

	if(typeof _eTag === 'string' && _eTag.length > 0)
	{
		opts.headers['If-None-Match'] = '"' + _eTag + '"';
	}

	var result = connections[connections.length] = getRequestFunction(_url)(_url, opts, (_ev) => {
		result.response = _ev;
		_ev.response = _ev;
		return accept(_url, _file, _links, _eTag, _callback, result, _ev); });
	++secondConnections;

	if(result !== null)
	{
		result.on('error', (_ev) => { return error(_ev, _url, _file, _links, _eTag, _callback, result, null); });
		result.on('timeout', () => { return error('timeout', _url, _file, _links, _eTag, _callback, result, null); });
		
		if(typeof connectionTimeout === 'number' && connectionTimeout >= 1)
		{
			result.setTimeout(Math.round(connectionTimeout));
		}
		
		_callback(0, _url, _file, _links, _eTag, _callback, result, null);
	}
	else
	{
		error(true, _url, _file, _links, _eTag, _callback, result, null, false);
	}
	
	return result;
};

const isFinished = () => {
	return (beganDownloads && openFiles <= 0 && connections.length === 0 && (finished + errors) >= downloads && queue.length === 0 && pausedConnections <= 0);
};

const fin = (_error, _url, _file, _links, _eTag, _callback, _request = null, _response = null, _counting = true) => {
	if(_request || _response) for(var i = 0; i < connections.length; ++i)
	{
		if(connections[i] === _request || (connections[i].response && connections[i].response === _response))
		{
			if(connections[i].response && connections[i].response.PAUSED)
			{
				resumeConnections(connections[i]);
			}
			
			connections.splice(i, 1);
			break;
		}
	}

	if(_counting)
	{
		if(_error)
		{
			++errors;
		}
		else
		{
			++finished;
		}
	}
	
	if(isFinished())
	{
		lastUpdate = 0;
	}
	
	_callback(_error, _url, _file, _links, _eTag, _callback, _request, _response);
	return nextQueueItem();
};

const parseHeaders = (_raw_headers) => {
	if(! Array.isArray(_raw_headers))
	{
		return _raw_headers;
	}
	
	const result = Object.create(null);
	
	for(var i = 0; i < _raw_headers.length; i += 2)
	{
		result[_raw_headers[i].toLowerCase()] = _raw_headers[i + 1];
	}

	return result;
};

var lastPauseSeconds = 0;
var totalConnectionTimeout = null;

const pauseConnections = (_seconds, ... _connections) => {
	if(typeof _seconds !== 'number' || _seconds < 1)
	{
		_seconds = lastPauseSeconds;
	}
	else
	{
		_seconds = lastPauseSeconds = Math.round(_seconds);
	}

	if(_connections.length === 0)
	{
		_connection = connections;
		totalPause = true;
	}
	
	var result = 0;
	
	for(var i = 0; i < _connections.length; ++i)
	{
		if(_connections[i].response && !_connections[i].response.PAUSED)
		{
			_connections[i].response.PAUSED = _seconds;
			_connections[i].response.secondBytes = 0;
			_connections[i].response.pause();
			
			_connections[i].response.connectionTimeout = setTimeout(() => {
				return resumeConnections(_connections[i]);
			}, (_seconds * 1000));

			++result;
		}
	}

	//	
	if(result === 0 && totalConnectionTimeout === null)
	{
		totalConnectionTimeout = setTimeout(() => {
			return resumeConnections();
		}, (_seconds * 1000));
	}
	else if(result > 0)
	{
		totalPauseTime += (_seconds * 1000);
	}
	
	pausedConnections += result;
	nextQueueItem();
	return result;
};

const resumeConnections = (... _connections) => {
	if(_connections.length === 0)
	{
		_connections = connections;
	}
	
	if(totalConnectionTimeout !== null)
	{
		clearTimeout(totalConnectionTimeout);
		totalConnectionTimeout = null;
	}
	
	totalPause = false;
	secondBytes = 0;

	var result = 0;
	
	for(var i = 0; i < _connections.length; ++i)
	{
		if(_connections[i].response && _connections[i].response.PAUSED)
		{
			if(_connections[i].response.connectionTimeout)
			{
				clearTimeout(_connections[i].response.connectionTimeout);
				_connections[i].response.connectionTimeout = null;
			}
			
			_connections[i].response.secondBytes = 0;
			_connections[i].response.PAUSED = false;
			_connections[i].response.resume();

			++result;
		}
	}
	
	pausedConnections -= result;
	nextQueueItem();
	return result;
};

const accept = (_url, _file, _links, _eTag, _callback, _request, _response = null) => {
	const p = (_file[0] === '/' ? _file : path.join(emojiPath, _file));
	const headers = parseHeaders(_response.rawHeaders);

	if(_response.statusCode.toString()[0] !== '2' && _response.statusCode !== 304)
	{
		return error('[' + _response.statusCode + '] ' + _response.statusMessage + ': `' + _url + '`', _url, _file, _links, _eTag, _callback, _request, _response);
	}
	else if(fs.existsSync(p))
	{
		++existed;

		if(_eTag && headers['etag'] && headers['etag'] !== '*')
		{
			if(_response.statusCode === 304)
			{
				--downloads;
				return fin(false, _url, _file, _links, _eTag, _callback, _request, _response);
			}
			else
			{
				++updated;
			}
		}
		else if(!isNaN(headers['content-length']))
		{
			const remoteSize = Number(headers['content-length']);
			const localSize = fs.statSync(p, { bigint: false }).size;

			if(localSize > 0 && remoteSize > 0)
			{
				if(localSize === remoteSize)
				{
					--downloads;
					return fin(false, _url, _file, _links, _eTag, _callback, _request, _response);
				}
				else
				{
					++updated;
				}
			}
			else
			{
				++updated;
			}
		}
		else
		{
			++updated;
		}
	}

	if(totalPause && _request)
	{
		pauseConnections(_request);
	}

	var eTag = '';

	if(headers['etag'])
	{
		eTag = eTagIndex[_file] = headers['etag'].slice(1, -1);
	}

	const dir = path.dirname(p);
	
	if(! fs.existsSync(dir))
	{
		fs.mkdirSync(dir, { recursive: true });
	}

	const fd = fs.openSync(p, 'w');
	var downloadSize = 0;
	var ended = false;
	var writing = 0;
	var position = 0;
	++openFiles;
	
	const close = () => {
		fs.closeSync(fd);
		--openFiles;
	};
	
	const end = () => {
		ended = true;
		if(writing > 0) return writing;
		close();
		if(Array.isArray(_links)) makeSymlinks(_links, _file);
		return fin(null, _url, _file, _links, _eTag, _callback, _request, _response);
	};
	
	_response.on('end', end);
	
	_response.on('data', (_chunk) => {
		++writing;

		totalBytes += _chunk.length;
		downloadSize += _chunk.length;

		secondBytes += _chunk.length;
		_response.secondBytes += _chunk.length;

		fs.write(fd, _chunk, 0, _chunk.length, position, (_err, _written, _buffer) => {
			if(--writing <= 0 && ended) return end();
			return _callback(downloadSize, _url, _file, _links, _eTag, _callback, _request, _response);
		});
		
		position += _chunk.length;
		
		if(globalBandwidthLimit && secondBytes >= connectionBandwidthGlobal)
		{
			pauseConnections(secondBytes / connectionBandwidthGlobal);
		}
		
		if(perLinkBandwidthLimit && _response.secondBytes >= connectionBandwidthPerLink)
		{
			pauseConnections(_response.secondBytes / connectionBandwidthPerLink, _response);
		}

		_callback(downloadSize, _url, _file, _links, _eTag, _callback, _request, _response);
	});
	
	_response.on('error', (_error) => {
		ended = true;
		close();
		fs.unlinkSync(p);
		return error(_error, _url, _file, _links, _eTag, _callback, _request, _response);
	});

	_response.on('timeout', () => { return error('timeout', _url, _file, _links, _eTag, _callback, _request, _response); });
	
	if(typeof connectionTimeout === 'number' && connectionTimeout >= 1)
	{
		_response.setTimeout(Math.round(connectionTimeout));
	}
	
	//
	_callback(0, _url, _file, _links, _eTag, _callback, _request, _response);
};

const makeSymlinks = (_links, _target) => {
	if(! Array.isArray(_links)) return -1;
	else if(typeof _target !== 'string' || _target.length === 0) return -2;
	const p = (_target[0] === '/' ? _target : path.join(emojiPath, _target));

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

const error = (_error, _url, _file, _links, _eTag, _callback, _request = null, _response = null, _counting = true) => {
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
	
	return fin(_error, _url, _file, _links, _eTag, _callback, _request, _response, _counting);
};

const enqueue = (_url, _file, _links, _eTag, _callback) => {
	queue.push([ _url, _file, _links, _eTag, _callback ]);
};

const nextQueueItem = () => {
	//
	const now = Date.now();
	var secondDiff = (now - lastSecond);

	//
	if(secondDiff >= 1000 || lastSecond === 0)
	{
		secondConnections = 0;
		lastSecond = now;
		secondDiff = 1000;
	}

	if(queue.length === 0)
	{
		return 0;
	}
	else if(totalPause)
	{
		return 0;
	}
	
	if(typeof connectionsPerSecond === 'number' && connectionsPerSecond >= 1)
	{
		if(secondConnections >= connectionsPerSecond)
		{
			setTimeout(nextQueueItem, secondDiff);
			return false;
		}
	}

	if(typeof connectionLimit === 'number' && connectionLimit >= 1)
	{
		if((connections.length + pauseConnections) >= connectionLimit)
		{
			return false;
		}
	}

	//
	get(... queue.shift());
	return setTimeout(nextQueueItem, 0);
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
	if(beganDownloads && !finishedDownloads) finishDownloads(false);
	if(didJSON) jsonInfo();

	//
	if(_ex instanceof Error) console.dir(_ex);
	
	//
	process.exit(exitCode);
};

const finishDownloads = (_exit = true) => {
	finishedDownloads = true;
	stop = Date.now();

	console.info(os.EOL + os.EOL + os.EOL + 'Finishing downloads, right here, right now..' + os.EOL);
	console.info('     Downloads: %s', render(downloads));
	console.info('      Finished: %s (%s)', render(finished), render(Math.round(finished / downloads * 100, 2) + '%'));
	console.info('          Size: %s', renderSize(totalBytes));
	console.info('          Time: %s', getTime());
	console.info('       Existed: %s', render(existed));
	console.info('       Updated: %s', render(updated));
	console.info('        Errors: %s', render(errors));
	console.info('      Symlinks: %s', render(symlinks));
	console.info('    Pause time: %s', renderTime(totalPauseTime));
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
	
	try
	{
		if((eTagIndexLength = Object.keys(eTagIndex).length) > 0)
		{
			fs.writeFileSync(eTagIndexPath, JSON.stringify(eTagIndex, null, beautifyJSON), { encoding: 'utf8' });
		}
		else
		{
			console.warn(os.EOL + 'The ETag index (`%s`) has not been written; maybe the server doesn\'t send such \'ETag\' headers?', (relativePaths ? path.relative(workingDirectory, eTagIndexPath) : eTagIndexPath));
		}
	}
	catch(_error)
	{
		console.error(os.EOL + 'The ETag index (`%s`) couldn\'t be generated or saved!', (relativePaths ? path.relative(workingDirectory, eTagIndexPath) : eTagIndexPath));
		console.debug('So next time there\'ll be no check for outdated emojis, existing ones will just be omitted..');
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
var tagsLength = -1;
var indexLength = -1;
var eTagIndexLength = -1;
var eTagIndex = {};

//
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
	else if(emojiLength > -1 || tagsLength > -1 || indexLength > -1)
	{
		console.info('JSON data succesfully written:' + os.EOL +
			(eTagIndexLength < 1 ? '' : '     ETag index: `' + bold + (relativePaths ? path.relative(workingDirectory, eTagIndexPath) : eTagIndexPath) + reset + '`' + os.EOL) +
			'         Emojis: `' + bold + (relativePaths ? path.relative(workingDirectory, jsonPath) : jsonPath) + reset + '`' + os.EOL +
			'           List: `' + bold + (relativePaths ? path.relative(workingDirectory, tagsPath) : tagsPath) + reset + '`' + os.EOL +
			'          Index: `' + bold + (relativePaths ? path.relative(workingDirectory, indexPath) : indexPath) + reset + '`' + os.EOL);

		if(emojiLength < 0)
		{
			console.error('Something strange occured with the `%s`!', 'emoji.json');
		}

		if(tagsLength < 0)
		{
			console.error('Something strange with the `%s`!', 'emoji.tags.json');
		}

		if(indexLength < 0)
		{
			console.error('Something weird with the `%s`!', 'emoji.index.json');
		}
	}

	console.log();
	return true;
};

const routine = () => {
	const icons = require(apiPath).icons; //see `apiPath` and `apiURL`.
	const result = {};
	const tags = [];
	const data = [];
	const index = {};
	const eTagIndex = {};
	var dataIndex = 0;
	var tagsIndex = 0;
	const eTagCurrent = (fs.existsSync(eTagIndexPath) ? require(eTagIndexPath) : null);

	for(var i = 0; i < icons.length; ++i)
	{
		//
		const codepoint = icons[i].codepoint.split('_');

		for(var j = 0; j < codepoint.length; ++j)
		{
			codepoint[j] = parseInt(codepoint[j], 16);
		}

		//
		const size = [ 512 ];
		const name = icons[i].codepoint;
		const tag = icons[i].tags;
		const originalTag = [ ... tag ];
		const file = {
			webp: name + '/' + size + '.webp',
			gif: name + '/' + size + '.gif',
			json: name + '/lottie.json' };
		const url = {
			webp: (imageURL + '/' + name + '/' + size + '.webp'),
			gif: (imageURL + '/' + name + '/' + size + '.gif'),
			json: (imageURL + '/' + name + '/lottie.json')
		};
		const links = {};
		const string = String.fromCodePoint(... codepoint);

		//
		for(var j = 0; j < tag.length; ++j)
		{
			var t = tag[j];
			var num = 0;

			while(t in result)
			{
				if(num > 0)
				{
					t = tag[j].slice(0, -1) + '+' + num.toString() + ':';
				}

				++num;
			}
			
			tags[tagsIndex++] = (tag[j] = t).slice(1, -1);
		}

		for(var j = 0; j < tag.length; ++j)
		{
			index[tag[j].slice(1, -1)] = { ... file, codepoint, string, size: [ ... size ] };
		}

		for(const idx in file)
		{
			const eTag = (eTagCurrent === null ? null : eTagCurrent[file[idx]]);
			data[dataIndex++] = [ url[idx], file[idx], [], eTag ];
			links[idx] = [];

			for(var j = 0; j < tag.length; ++j)
			{
				data[dataIndex - 1][2].push(tag[j] + '.' + idx);
				links[idx].push(tag[j] + '.' + idx);
				if(! (tag[j] in links)) links[tag[j]] = {};
				links[tag[j]][idx] = (tag[j] + '.' + idx);
			}
			
			for(var j = 0; j < tag.length; ++j)
			{
				links[tag[j]] = { ... links[tag[j]] };
			}

			links[idx] = [ ... links[idx] ];
			data[dataIndex - 1] = [ ... data[dataIndex - 1] ];
		}
		
		result[name] = { name, size, codepoint, string, tag: [ ... tag ], originalTag, file: { ... file }, /*url: { ... url },*/ links: { ... links } };
		
		for(var j = 0; j < tag.length; ++j)
		{
			result[tag[j]] = { name, size, codepoint, string, tag: [ ... tag ], originalTag, file: { ... file }, /*url: { ... url},*/ links: { ... links } };
		}
	}

	//
	try
	{
		//
		emojiLength = Object.keys(result).length;
		tagsLength = tags.length;
		indexLength = Object.keys(index).length;

		//
		fs.writeFileSync(jsonPath, JSON.stringify(result, null, beautifyJSON), { encoding: 'utf8' });
		fs.writeFileSync(tagsPath, JSON.stringify(tags, null, beautifyJSON), { encoding: 'utf8' });
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
		const high = { connections: 0, openFiles: 0 };
		const max = { connections: 0, openFiles: 0 };
		var updateInterval = null;
		var updateTimeout = null;
		var lastArgs = null;
		var updateCalls = 0;

		const callback = (... _args) => {
			lastArgs = _args;
			
			if(updateTimeout !== null)
			{
				clearTimeout(updateTimeout);
				updateTimeout = null;
			}

			const now = Date.now();
			const diff = (now - lastUpdate);

			if(isFinished())
			{
				lastUpdate = 0;
			}
			else if(diff < refreshTime)
			{
				updateTimeout = setTimeout(() => {
					updateTimeout = null;
					return callback(... lastArgs);
				}, diff);
				return false;
			}
			else
			{
				lastUpdate = now;
			}
			
			return update(... lastArgs);
		};

		const update = (_error, _url, _file, _links, _eTag, _callback, _request = null, _response = null) => {
			//
			if((++updateCalls % averageUpdate) === 0)
			{
				//
				if(--high.connections <= 0)
				{
					high.connections = connections.length;
				}
				
				if(--high.openFiles <= 0)
				{
					high.openFiles = openFiles;
				}
			}
			
			//
			if(connections.length > high.connections)
			{
				high.connections = connections.length;
			}
			
			if(openFiles > high.openFiles)
			{
				high.openFiles = openFiles;
			}

			if(connections.length > max.connections)
			{
				max.connections = connections.length;
			}

			if(openFiles > max.openFiles)
			{
				max.openFiles = openFiles;
			}
			
			//
			process.stdout.write(back);
			console.info(os.EOL + os.EOL + 'Now just wait for all downloads to complete. ...' + os.EOL);

			console.log('\tv' + bold + VERSION + reset + os.EOL);
			console.log('\t\tAny questions? Send me a `mailto:kuchen@kekse.biz`.');
			console.log('\t\t\tAnd visit me at <https://github.com/kekse1/>! :)~' + os.EOL + os.EOL + os.EOL);
			process.stdout.write(
				'          Elapsed Time: ' + getTime() + os.EOL +
				'       Percentage done: ' + render(Math.round((finished + errors) / (downloads + queue.length) * 100)) + '%' + os.EOL + os.EOL +
				'            Open files: ' + render(openFiles) + ' (' + render(high.openFiles) + ' / ' + render(max.openFiles) + ')' + os.EOL +
				'           Connections: ' + render(connections.length) + ' (' + render(high.connections) + ' / ' + render(max.connections) + ')' + os.EOL +
				'       Total Downloads: ' + render(downloads) + os.EOL +
				'              Received: ' + renderSize(totalBytes) + os.EOL +
				'              Finished: ' + render(finished) + os.EOL +
				'             Erroneous: ' + render(errors) + os.EOL +
				'               Pending: ' + render(queue.length) + os.EOL +
				'               Updated: ' + render(updated) + os.EOL + 
				'       Already existed: ' + render(existed) + os.EOL +
				'        Symbolic Links: ' + render(symlinks) + os.EOL + os.EOL);
				
			if(typeof connectionLimit === 'number' && connectionLimit >= 1)
			{
				process.stdout.write('      Connection limit: ' + render(Math.round(connectionLimit)) + os.EOL);
			}
			
			if(typeof connectionsPerSecond === 'number' && connectionsPerSecond >= 1)
			{
				process.stdout.write('  Connections per sec.: ' + render(Math.round(connectionsPerSecond)) + os.EOL);
			}

			if(globalBandwidthLimit || perLinkBandwidthLimit)
			{
				if(globalBandwidthLimit)
				{
					     process.stdout.write('   Connection bandwidth: ' + renderSize(connectionBandwidthGlobal) + ' / second' + os.EOL);
				}
				
				if(perLinkBandwidthLimit)
				{
					     process.stdout.write('         Link bandwidth: ' + renderSize(connectionBandwidthPerLink) + ' / second' + os.EOL);
				}

				process.stdout.write('       Total Pause Time: ' + renderTime(totalPauseTime) + os.EOL);
				process.stdout.write('     Paused Connections: ' + render((totalPause ? connections.length : pausedConnections)) + os.EOL);
			}
			
			process.stdout.write(os.EOL +
				'              Last URL: `' +  bold + (_url || '') + reset + '`' + os.EOL +
				'             Last File: `' + bold + (_file || '') + reset + '`' + os.EOL +
				'             Last ETag: `' + bold + (_eTag || '') + reset + '`' + os.EOL + os.EOL +
				'             Image URL: `' + bold + imageURL + reset + os.EOL + os.EOL);
			process.stdout.write('        Screen updates: ' + render(updateCalls) + ' / ' + renderTime(refreshTime) + os.EOL +
				'  Until average update: ' + render(averageUpdate - (updateCalls % averageUpdate)) + ' / ' + render(averageUpdate) + os.EOL);

			if(isFinished())
			{
				lastUpdate = 0;
				finishDownloads(true);
				if(updateInterval !== null) clearInterval(updateInterval);
				updateInterval = null;
				return null;
			}
			
			//
			return true;
		};
		
		downloads = dataIndex;
		
		for(var i = 0; i < dataIndex; ++i)
		{
			enqueue(... data[i], callback);
		}

		if(dataIndex <= 0)
		{
			if(startDownloads(false))
			{
				return finishDownloads(true);
			}
		}
		else if(startDownloads(true))
		{
			process.stdin.resume();
			updateInterval = setInterval(() => {
				if(lastArgs === null) return;
				return update(... lastArgs);
			}, refreshTime);
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

console.info('The emojis are searched at `%s`.', imageURL);
console.info('The `api.json` is searched at `%s`.', apiURL);
console.log();

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

		get(apiURL, apiPath, null, null, (_error) => {
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

