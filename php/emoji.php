<?php

//
// Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
// v1.1.0
//
//
// new plan: just relay to google, no own download! ;-)
//

namespace kekse\emoji;

//
function filterTag($_string)
{
	$l = strlen($_string);
	
	if($l > 224)
	{
		return '';
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
		else if($byte === 95 || $byte === 45 || $byte === 32 || $byte === 43)
		{
			$add = chr($byte);
		}
		else
		{
			$add = '';
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
	
	return $result;
}

//
namespace kekse\emoji\noto;

//
const REF = (__DIR__ . '/emoji.ref.json');
const TYPES = array('utf', 'webp', 'lottie', 'json', 'gif', 'code', 'test');

function error($_text, $_exit = 1)
{
	return output($_text, getType('txt'), $_exit);
}

function httpError($_url, $_exit = 2)
{
	$code = http_response_code();
	$text = http_response_message();
	$result = '[' . $code . '] ' . ($text ? $text : 'Error');
	return output($result, 'text/plain;charset=utf-8', $_exit);
}

function output($_data, $_mime, $_exit = 0)
{
	header('Content-Type: ' . $_mime);
	header('Content-Length: ' . strlen($_data));
	echo $_data;

	if($_exit === true)
	{
		$_exit = 0;
	}
	else if(! is_int($_exit))
	{
		return;
	}

	exit(abs($_exit % 256));
}

function getType($_ext)
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
	}
	
	return 'application/octet-stream';
}

//
if(! is_file(REF))
{
	return error('Emoji reference file was not found!', 3);
}

//
function filterType($_string)
{
	$l = strlen($_string);
	
	if($l > 224)
	{
		return '';
	}
	
	$result = '';
	$len = 0;
	$byte;
	$add;
	
	for($i = 0; $i < $l; ++$i)
	{
		if(($byte = chr($_string[$i])) >= 65 && $byte <= 90)
		{
			$add = ord($byte + 32);
		}
		else if($byte >= 97 && $byte <= 122)
		{
			$add = ord($byte);
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

	if(! in_array($result, TYPES))
	{
		$result = '';
	}
		
	return $result;
}

function getParameters()
{
	//
	if(! (isset($_GET['type']) && isset($_GET['tag'])))
	{
		return error('At least one GET parameter is not set [ `type`, `tag` ]!', 4);
	}

	//
	$result = array(
		'tag': \kekse\emoji\filterTag($_GET['tag']),
		'type': filterType($_GET['type'])
	);
	
	if(! ($result['type'] && $result['tag']))
	{
		return error('At least one of your parameters is not valid!', 5);
	}
	
	return $result;
}

function parseJSON($_data)
{
	$result = json_decode($_data, true, 3);
	
	if(! is_array($result))
	{
		return null;
	}
	
	return $result;
}

function requestFile($_path)
{
	$result = file_get_contents($_path);

	if($result === false)
	{
		return null;
	}

	return $result;
}

function relay($_url)
{
	header('Location: ' + $_url);
	exit(0);
}

function findByTag($_tag)
{
die('TODO');
}

//
die('TODO!');

?>
