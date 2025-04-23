<?php

/*
 * Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
 * <https://github.com/kekse1/noto-emoji-animation/>
 * v2.4.0
 */

/*
 * v(2.3.2) Last fixes, etc.. best version now.
 * v(2.3.0) last but not least some more improvements and more. now it should work really better at all.
 * v(2.2.4) the '?list' parameter is now also supported in the browser interface. once defined => text/plain;
 * v(2.2.3) the size parameter filter now allows regular non-alpha's.. since maybe we want a 'px' size;
 * (v2.2.2) also '-l / --list' integrated now; plus optional 3rd `?size` argument (@ html);
 * v(2.2.1) fixed the tag filter .. see `util/count-tag-characters.js` (some were not allowed);
 * (v2.2.0) new '-? / --help' and '-t / --types' (getopt) parameters now!
 */
 
/*
 * TODO @ getParameters(): SEARCH function, use GLOBS OR REGEXP!! ;-)
 */

//
namespace kekse;

if(!defined('KEKSE_CLI'))
{
	define('KEKSE_CLI', (php_sapi_name() === 'cli'));
}

define('KEKSE_EMOJI_VERSION', '2.2.2');
define('KEKSE_EMOJI_URL', 'https://fonts.gstatic.com/s/e/notoemoji/latest/');

//
namespace kekse\emoji;

//
const FILTER_TAGS = true;

//
function getTagName($_string, $_url = true)
{
	$_string = urldecode($_string);
	$_string = utf8_decode($_string);

	$l = strlen($_string);
	
	if($l > 255)
	{
		return null;
	}
	
	$result = '';
	$len = 0;
	$byte;
	$add;
	
	if(FILTER_TAGS) for($i = 0; $i < $l; ++$i)
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
		else if($byte === 95 || $byte === 45 || $byte === 32 || $byte === 43 || $byte === 33 || $byte === 32 || $byte === 63 || $byte === 241)
		{
			$add = chr($byte);
		}
		else
		{
			continue;
		}
		
		$result .= $add;
			
		if(($len += strlen($add)) >= 64)
		{
			return null;
		}
	}
	else
	{
		$result = $_string;
		$len = $l;
		
		if($result[0] === ':' && $result[$len - 1] === ':')
		{
			$result = substr($result, 1, -1);
			$len -= 2;
		}
	}

	if($len === 0)
	{
		return null;
	}

	return utf8_encode($result);
}

function output($_data, $_mime = null, $_exit = 0)
{
	if(!is_string($_data)) $_data = 'ERROR';

	if($_exit === true)
	{
		$_exit = 0;
	}
	else if($_exit === null)
	{
		$_exit = rand(1, 255);
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
const TAGS = (__DIR__ . '/emoji.tags.json');
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

function isValidJSONPath($_path, $_error = null)
{
	if($_error === true)
	{
		$_error = 0;
	}
	else if($_error === null)
	{
		$_error = rand(1, 255);
	}
	
	if(!is_string($_path) || $_path === '')
	{
		if(is_int($_error))
		{
			return error('Invalid JSON file path (not a String or Empty)!', $_error);
		}
		
		return false;
	}
	else if(strtolower(substr($_path, -5)) !== '.json')
	{
		if(is_int($_error))
		{
			return error('Invalid JSON file path (doesn\'t end with `.json`)!', $_error);
		}
		
		return false;
	}
	else if(! (is_file($_path) && is_readable($_path)))
	{
		if(is_int($_error))
		{
			$base = basename($_path);
			return error('Your JSON file path (' . $base . ') is not a file or not readable!', $_error);
		}
		
		return false;
	}
	
	return true;
}

//
if(!isValidJSONPath(JSON, false)) return error('Your emoji index file path is invalid (or not a file or not existing)!', 3);

//
function loadTags()
{
	if(!isValidJSONPath(JSON, false))
	{
		return error('Invalid `TAGS` JSON file path configuration!', 240);
	}
	
	return parseJSON(requestFile(TAGS, true), true);
}

//
function filterString($_string, $_empty = true, $_error = true)
{
	if(!is_string($_string))
	{
		if($_error)
		{
			return error('Ain\'t a String!', 91);
		}

		return null;
	}
	
	$_string = trim(urldecode($_string));
	$l = strlen($_string);

	if(!$_empty && $l === 0)
	{
		if($_error)
		{
			return error('String may not be empty!', 92);
		}

		return null;
	}

	if($l > 255)
	{
		if($_error)
		{
			return error('String is too long! Exceeds limit of 224 characters/bytes.', 93);
		}

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
		else if($byte === 32)
		{
			$add = chr($byte);
		}
		else if($byte === 44)
		{
			$add = chr($byte);
		}
		else if($byte === 39)
		{
			$add = '\'';
		}
		else if($byte === 34)
		{
			$add = '\\"';
		}
		else
		{
			continue;
		}

		$result .= $add;

		if(($len += strlen($add)) >= 224)
		{
			if($_error)
			{
				return error('String exceeds length limit', 102);
			}

			return null;
		}
	}

	if($len === 0 && !$_empty)
	{
		if($_error) return error('String may not be empty!', 105);
		return null;
	}

	return $result;
}

function filterType($_string, $_error = true)
{
	if(!is_string($_string))
	{
		if($_error) return error('Type parameter is not a string!', 882);
		return null;
	}
	
	$_string = trim(urldecode($_string));
	$l = strlen($_string);
	
	if($l > 255)
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
			continue;
		}
		
		$result .= $add;
			
		if(($len += strlen($add)) >= 16)
		{
			if($_error)
			{
				return error('Type parameter exceeds length limit!', 99);
			}

			return null;
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
	if(is_int($_size))
	{
		return (string)$_size;
	}
	
	if(!is_string($_size) || $_size === '')
	{
		return null;
	}
	
	$_size = trim(urldecode($_size));
	$l = strlen($_size);
	
	if($l > 255)
	{
		if($_error) return error('Size parameter exceeds string length limit (' . $l . '/224).', 8);
		return null;
	}
	
	$result;
	
	if($_size[0] === '-')
	{
		$result = '-';

		if(($_size = substr($_size, 1)) === '')
		{
			return null;
		}
		
		--$l;
	}
	else
	{
		$result = '';
	}

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
		else if($byte >= 65 && $byte <= 90)
		{
			$result .= chr($byte + 32);
		}
		else if($byte >= 97 && $byte <= 122)
		{
			$result .= chr($byte);
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
	function getHelp($_base)
	{
		$result = 'Syntax: `' . $_base . '` <tag> [ <type> [ <size> ] ] // default type is `test`' . PHP_EOL;
		$result .= "\t\t[ -l / --list ] // Lists all available tags" . PHP_EOL;
		$result .= PHP_EOL . "If a size is defined, it'll force a HTML `<img>` output, instead of pure URL or String" . PHP_EOL;
		$result .= PHP_EOL . getTypes() . PHP_EOL;
		return $result;
	}
	
	function getTypes()
	{
		$result = 'Types:' . PHP_EOL;
		
		/*foreach(TYPES as $type)
		{
			$result .= "\t# `" . $type . '`';
			
			if($type === 'test')
			{
				$result .= ' (default)';
			}
			
			$result .= PHP_EOL;
		}
		
		$result = substr($result, 0, -1);*/

		$result .= "\t# `utf` / `utf8` / `string`" . PHP_EOL;
		$result .= "\t# `webp`" . PHP_EOL;
		$result .= "\t# `lottie` / `json`" . PHP_EOL;
		$result .= "\t# `gif`" . PHP_EOL;
		$result .= "\t# `codepoint` / `codepoints` / `code`" . PHP_EOL;
		$result .= "\t# `test` // default (checks if emoji/tag is avilable)";
		
		return $result;
	}
	
	function getList()
	{
		$result = '';
		$INDEX = loadTags();
		
		foreach($INDEX as $tag)
		{
			$result .= ':' . $tag . ':' . PHP_EOL;
		}
		
		return substr($result, 0, -1);
	}
	
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
		
		$showHelp = false;
		$showTypes = false;
		$showList = false;
		
		for($i = 0; $i < $argc; ++$i)
		{
			if($argv[$i] === '-?' || $argv[$i] === '--help')
			{
				$showHelp = true;
				break;
			}
			else if($argv[$i] === '-t' || $argv[$i] === '--types')
			{
				$showTypes = true;
				break;
			}
			else if($argv[$i] === '-l' || $argv[$i] === '--list')
			{
				$showList = true;
				break;
			}
		}

		if($argc < 2)
		{
			return error(getHelp(basename($argv[0])), 21);
		}
		else if($showHelp)
		{
			return error(getHelp(basename($argv[0])), 0);
		}
		else if($showTypes)
		{
			return \kekse\emoji\output(getTypes(), null, 0);
		}
		else if($showList)
		{
			return \kekse\emoji\output(getList(), null, 0);
		}
		else
		{
			$tag = $argv[1];
			$type = ($argc <= 2 ? 'test' : $argv[2]);
			$size = ($argc <= 3 ? null : $argv[3]);
		}
	}
	else if(isset($_GET['list']))
	{
		return \kekse\emoji\output(getList(), \kekse\emoji\getMimeType('txt'), 0);
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
		return error('The necessary `?tag` parameter has not been set!', 4);
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

		$font;

		if(isset($_GET['font']))
		{
			if($_GET['font'] === '')
			{
				$font = true;
			}
			else
			{
				$font = $_GET['font'];
			}
		}
		else
		{
			$font = false;
		}
	}

	//
	$result = array(
		'tag' => \kekse\emoji\getTagName($tag, $_error),
		'type' => filterType($type, $_error),
		'size' => filterSize($size, $_error),
		'font' => (is_bool($font) ? $font : filterString($font, false, false)));

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

// bewusst ohne ?query- oder #hash-anteil. ;-)
function renderURL($_url)
{
	if(is_string($_url))
	{
		return $_url;
	}

	$result = $_url['scheme'] . '://';
	$result .= $_url['host'];

	if(isset($_url['port']))
	{
		$result .= ':' . $_url['port'];
	}

	return ($result . $_url['path']);
}

function cleanURL($_url)
{
	$_url = parse_url($_url);

	if($_url === false)
	{
		return error('Invalid URL!', 246);
	}

	while(strpos($_url['path'], '//') !== false)
	//while(str_contains($_url['path'], '//'))//not supported below php 8.. ;-/
	{
		$_url['path'] = str_replace('//', '/', $_url['path']);
	}

	return renderURL($_url);
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
		if(!is_string($EMOJI[$PARAMS['type']]) || $EMOJI[$PARAMS['type']] === '') return error('The emoji got no valid item for type `' . $PARAMS['type'] . '` (unexpected)!', 18);
		$url = true;
		$result = $EMOJI[$PARAMS['type']];
		if(!$PARAMS['size']) return relay(cleanURL(KEKSE_EMOJI_URL . '/' . $result), 0);
		break;
}

if($url)
{
	if($PARAMS['size'])
	{
		$attribSize = ''; $styleSize = '';

		if(substr($PARAMS['size'], -2) === 'px')
		{
			$styleSize = $PARAMS['size'];
			$attribSize = substr($PARAMS['size'], 0, -2);
		}
		else if(ctype_digit($PARAMS['size']))
		{
			$styleSize = $PARAMS['size'] . 'px';
			$attribSize = $PARAMS['size'];
		}
		else
		{
			$styleSize = $PARAMS['size'];
			$attribSize = null;
		}

		$result = '<img src="' . cleanURL(KEKSE_EMOJI_URL . '/' . $result) . '" ';
		
		if($attribSize !== null)
		{
			$result .= ' width="' . $attribSize . '" height="' . $attribSize . '" ';
		}
		
		$result .= 'style="width: ' . $styleSize . '; height: ' . $styleSize . ';" />';
	}
	else
	{
		$result = '<img src="' . cleanURL(KEKSE_EMOJI_URL . '/' . $result) . '" />';
	}
	
	\kekse\emoji\output($result, \kekse\emoji\getMimeType('html'), 0);
}
else
{
	if(ctype_digit($PARAMS['size']))
	{
		$PARAMS['size'] .= 'px';
	}

	if(!is_string($PARAMS['font']))
	{
		if($PARAMS['font'])
		{
			$PARAMS['font'] = 'Noto Emoji';
		}
		else
		{
			$PARAMS['font'] = null;
		}
	}

	$orig = $result;
	$result = '<span style="font-size: ' . $PARAMS['size'] . ';';
	if($PARAMS['font']) $result .= ' font-family: ' . $PARAMS['font'] . ';';
	$result .= '">' . $orig . '</span>';
	\kekse\emoji\output($result, \kekse\emoji\getMimeType('html'), 0);
}

//
exit(253);
?>
