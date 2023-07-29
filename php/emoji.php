<?php

//
// Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
// <https://github.com/kekse1/noto-emoji-animation/>
// v2.1.0
//

//
namespace kekse;

if(!defined('KEKSE_CLI'))
{
	define('KEKSE_CLI', (php_sapi_name() === 'cli'));
}

define('KEKSE_EMOJI_VERSION', '2.2.0');
define('KEKSE_EMOJI_URL', 'https://fonts.gstatic.com/s/e/notoemoji/latest/');

//
namespace kekse\emoji;

//
function getTag($_string, $_url = true)
{
	$l = strlen($_string);
	
	if($l > 224)
	{
		return null;
	}

	$result = '';
	$len = 0;
	$byte;
	$add;
	
	for($i = 0; $i < $l; ++$i)
	{
		if(($byte = ord($_string[$i])) >= 65 && $byte <= 90)
		{
			$add = chr($byte);
		}
		else if($byte >= 97 && $byte <= 122)
		{
			$add = chr($byte);
		}
		else if($byte >= 48 && $byte <= 57)
		{
			$add = chr($byte);
		}
		else if($byte === 95 || $byte === 45 || $byte === 32 || $byte === 43 || $byte === 33 || $byte === 32)
		{
			$add = chr($byte);
		}
		else
		{
			continue;
		}
		
		if($add !== '')
		{
			$result .= $add;
			
			if(++$len >= 64)
			{
				break;
			}
		}
	}

	if($len === 0)
	{
		return null;
	}
	
	return (':' . $result. ':');
}

function output($_data, $_mime = null, $_exit = 0)
{
	if(!is_string($_data)) $_data = 'ERROR';

	if($_exit === true)
	{
		$_exit = 0;
	}
	else if(! is_int($_exit))
	{
		$_exit = false;
	}
	else
	{
		$_exit = abs($_exit % 256);
	}

	if(KEKSE_CLI)
	{
		if($_exit === false || $_exit === 0) printf($_data . PHP_EOL);
		else fprintf(STDERR, $_data . PHP_EOL);
		if($_exit !== false) exit($_exit);
		return $_data;
	}

	if(!is_string($_mime) || $_mime === '') $_mime = getMimeType('txt');

	header('Content-Type: ' . $_mime);
	header('Content-Length: ' . strlen($_data));

	echo $_data;
	if($_exit !== false) exit($_exit);
	return $_data;
}

function getMimeType($_ext)
{
	if($_ext[0] === '.')
	{
		$_ext = substr($_ext, 1);
	}
	
	switch(strtolower($_ext))
	{
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		case 'json':
			return 'application/json;charset=utf-8';
		case 'txt':
			return 'text/plain;charset=utf-8';
		case 'html':
			return 'text/html;charset=utf-8';
	}
	
	return 'application/octet-stream';
}

//
namespace kekse\emoji\google;

//
const JSON = (__DIR__ . '/emoji.index.json');
const TYPES = array('utf', 'utf8', 'string', 'webp', 'lottie', 'json', 'gif', 'codepoint', 'codepoints', 'code', 'test');
const SEP = ' ';
const YES = '1';
const NO = '0';

//
function error($_text, $_exit = 255)
{
	return \kekse\emoji\output($_text, \kekse\emoji\getMimeType('txt'), $_exit);
}

function httpError($_url, $_exit = 254)
{
	$code = http_response_code();
	$text = http_response_message();
	$result = '[' . $code . '] ' . ($text ? $text : 'Error');
	return error($result, $_exit);
}

//
if(!is_string(JSON) || JSON === '') return error('Invalid emoji index file path!', 3);
else if(! (is_file(JSON) && is_readable(JSON))) return error('Emoji index file `' . (is_string(JSON) ? basename(JSON) : '-') . '` was not found, or it\'s not readable.', 3);

//
function filterType($_string, $_error = true)
{
	$l = strlen($_string);
	
	if($l > 224)
	{
		if($_error) return error('Type parameter exceeds string length limit (' . $l . '/224).', 8);
		return null;
	}
	
	$result = '';
	$len = 0;
	$byte;
	$add;
	
	for($i = 0; $i < $l; ++$i)
	{
		if(($byte = ord($_string[$i])) >= 65 && $byte <= 90)
		{
			$add = chr($byte + 32);
		}
		else if($byte >= 97 && $byte <= 122)
		{
			$add = chr($byte);
		}
		else if($byte >= 48 && $byte <= 57)
		{
			$add = chr($byte);
		}
		else
		{
			$add = '';
			continue;
		}
		
		if($add !== '')
		{
			$result .= $add;
			
			if(++$len >= 16)
			{
				break;
			}
		}
	}

	if($len === 0)
	{
		if($_error) return error('Type parameter got no length after filtering.', 9);
		return null;
	}
	else if(! in_array($result, TYPES))
	{
		if($_error) return error('The type `' . $result . '` is not available.', 10);
		return null;
	}
	else if($result === 'lottie')
	{
		$result = 'json';
	}
	else if($result === 'utf' || $result === 'utf8')
	{
		$result = 'string';
	}
	else if($result === 'code' || $result === 'codepoints')
	{
		$result = 'codepoint';
	}
	
	return $result;
}

function filterSize($_size, $_error = true)
{

	if(!is_string($_size) || $_size === '')
	{
		return null;
	}
	
	$l = strlen($_size);
	
	if($l > 224)
	{
		if($_error) return error('Size parameter exceeds string length limit (' . $l . '/224).', 8);
		return null;
	}
	
	$result = '';
	$len = 0;
	$byte;
	$add;
	
	for($i = 0; $i < $l; ++$i)
	{
		if(($byte = ord($_size[$i])) >= 48 && $byte <= 57)
		{
			$result .= chr($byte);
			++$len;
		}
		else if($len === 0)
		{
			continue;
		}
		else
		{
			break;
		}
	}

	if($len === 0)
	{
		return null;
	}
	
	return $result;
}

function getParameters($_error = true)
{
	//
	$type = null;
	$tag = null;
	$size = null;
	$font = null;
	
	//
	if(KEKSE_CLI)
	{
		$argc = $GLOBALS['argc'];
		$argv = $GLOBALS['argv'];
		
		if(!is_int($argc))
		{
			return error(' >> Invalid environment (CLI mode, but no argument count/vector found)!', 20);
		}
		else if($argc < 2)
		{
			return error('Syntax: `' . basename($argv[0]) . '` <tag> [ <type> ]	// default type is `test`.', 21);
		}
		else
		{
			$tag = $argv[1];
			$type = ($argc <= 2 ? 'test' : $argv[2]);
		}
	}
	else if(isset($_GET['type']) && isset($_GET['tag']))
	{
		$type = $_GET['type'];
		$tag = $_GET['tag'];
	}
	else if(isset($_GET['tag']))
	{
		$tag = $_GET['tag'];
		$type = 'test';
	}
	else if($_error)
	{
		return error('The neccessary `?tag` parameter has not been set!', 4);
	}
	else
	{
		return null;
	}
	
	//
	if(!KEKSE_CLI)
	{
		if(isset($_GET['size']))
		{
			$size = $_GET['size'];
		}
		
		$font = isset($_GET['font']);
	}

	//
	$result = array('tag' => \kekse\emoji\getTag($tag, $_error), 'type' => filterType($type, $_error), 'size' => filterSize($size, $_error), 'font' => $font);

	if(! ($result['type'] && $result['tag']))
	{
		if($_error) return error('At least one of your parameters is not valid.', 5);
		return null;
	}

	return $result;
}

function parseJSON($_data, $_error = true)
{
	if(! (is_string($_data) || $_data === ''))
	{
		if($_error) return error('Input data is not valid, so unable to parse JSON.', 6);
		return null;
	}

	$result = json_decode($_data, true, 4);

	if(! is_array($result))
	{
		if($_error) return error('JSON data is not valid, or not the expected type.', 7);
		return null;
	}
	
	return $result;
}

function requestFile($_path, $_error = true)
{
	$result = file_get_contents($_path);

	if($result === false)
	{
		if($_error) return error('Requested file `' . (is_string($_path) ? basename($_path) : '-') . '` is not available.', 11);
		return null;
	}

	return $result;
}

function relay($_url, $_exit = 0)
{
	if(KEKSE_CLI) return \kekse\emoji\output($_url, false, 0);
	header('Location: ' . $_url);
	if(is_int($_exit)) exit(abs($_exit % 256));
}

function lookUpTag($_tag, $_error = true)
{
	global $REFERENCE;
	
	if($REFERENCE === null)
	{
		if($_error) return error('Emoji index is not available!', 12);
		return null;
	}
	
	if(! isset($REFERENCE[$_tag])) return null;
	return $REFERENCE[$_tag];
}

function getCodePointString($_codepoint, $_error = true)
{
	global $EMOJI;
	
	if($EMOJI === null)
	{
		if($_error) return error('Emoji item not available!', 22);
		return null;
	}
	else if(!is_array($EMOJI['codepoint']))
	{
		if($_error) return error('This emoji got no `codepoint` entry (unexpected)!', 15);
		return null;
	}
	
	$result = '';
	$code = $EMOJI['codepoint'];
	$len = count($code);

	for($i = 0; $i < $len; ++$i)
	{
		$result .= (string)$code[$i] . SEP;
	}

	return substr($result, 0, -strlen(SEP));
}

//
$REFERENCE = parseJSON(requestFile(JSON, true), true);
if($REFERENCE === null) return error('Unable to read/parse the `' . basename(JSON) . '` index JSON file.', 13);
$PARAMS = getParameters(true);
if($PARAMS === null) return error('Parameters are not valid!', 14);
$EMOJI = lookUpTag($PARAMS['tag']);

//
if($PARAMS['type'] === 'test')
{
	if($EMOJI === null) return \kekse\emoji\output(NO, \kekse\emoji\getMimeType('txt'), 0);
	return \kekse\emoji\output(YES, \kekse\emoji\getMimeType('txt'), 0);
}
else if($EMOJI === null)
{
	return error('This emoji is not available at all' . PHP_EOL . 'Just try them out via `?type=test`', 18);
}

$result = '';
$url = false;

switch($PARAMS['type'])
{
	case 'codepoint':
		return \kekse\emoji\output(getCodePointString(true), \kekse\emoji\getMimeType('txt'), 0);
	case 'string':
		if(!is_string($EMOJI['string']) || $EMOJI['string'] === '') return error('This emoji got no valid `string` entry (unexpected)!', 16);
		$result = $EMOJI['string'];
		if(!$PARAMS['size']) return \kekse\emoji\output($result, \kekse\emoji\getMimeType('txt'), 0);
		break;
	default:
		if(! is_string($EMOJI[$PARAMS['type']]) || $EMOJI[$PARAMS['type']] === '') return error('The emoji got no valid item for type `' . $PARAMS['type'] . '` (unexpected)!', 18);
		$url = true;
		$result = $EMOJI[$PARAMS['type']];
		if(!$PARAMS['size']) return relay(KEKSE_EMOJI_URL . '/' . $result, 0);
		break;
}

if($url)
{
	$result = '<img src="' . KEKSE_EMOJI_URL . '/' . $result . '" style="width: ' . $PARAMS['size'] . 'px; height: ' . $PARAMS['size'] . 'px;" />';
	\kekse\emoji\output($result, \kekse\emoji\getMimeType('html'), 0);
}
else
{
	$orig = $result;
	$result = '<span style="font-size: ' . $PARAMS['size'] . ';';
	if($PARAMS['font']) $result .= ' font-family: \'Noto Emoji\';';
	$result .= '">' . $orig . '</span>';
	\kekse\emoji\output($result, \kekse\emoji\getMimeType('html'), 0);
}

//
exit(253);
?>
