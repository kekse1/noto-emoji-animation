#!/usr/bin/env node


var seconds = 0;

const clock = () => {
	//
	
	//

	//
	if(++seconds < 60)
	{
		setTimeout(clock, (1000 - (Date.now() % 1000)));
	}
};

clock();

