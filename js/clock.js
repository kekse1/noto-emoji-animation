#!/usr/bin/env node

const start = new Date();//|| Date.now();

const clock = (_start) => {
	//
	const diff = (Date.now() - (typeof _start === 'number' ? _start : _start.getTime()));

	//

	//
	//setTimeout(clock, (1000 - (Date.now() % 1000)));
};

clock(start);

