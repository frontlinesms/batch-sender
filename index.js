var needle = require('needle'),
fs = require('fs'),
_ = require('lodash'),
xmlbuilder = require('xmlbuilder'),
stream = require('stream'),
Converter = require("csvtojson").Converter;

var converter = new Converter({constructResult:false});

//retrieve command line arguments
if(process.argv.length < 6) {
	console.log("Usage : ./run input.csv username password 'text to send'");
	process.exit();
}
var filePath = process.argv[2],
username = process.argv[3],
password = process.argv[4],
textToSend = process.argv[5];

//TODO it seems we dont need this anymore
var splitToChunks = function(array, chunkSize) {
	var range = function(n) {
		return Array.apply(null,Array(n)).map((x,i) => i);
	};
	return range(Math.ceil(array.length/chunkSize)).map((x,i) => array.slice(i*chunkSize,i*chunkSize+chunkSize));
};

var submitChunkAsBulkSms = function(chunk) {
	var root = xmlbuilder.create('message');
	var sms = root.ele('sms', {'type': 'mt'});
	sms.ele('source').ele('address').ele('number', {'type': 'abbreviated'}, '8786');
	_(chunk).forEach(function(mobile) {
		if(!mobile.toString().startsWith("+")) {
			mobile = "+" + mobile;
		}
		sms.ele('destination').ele('address').ele('number', {'type': 'international'}, mobile);
	});
	sms.ele('rsr', {'type': 'all'});
	sms.ele('ud', {'type': 'text', 'encoding': 'default'}, textToSend);
	var xml = root.end({pretty: true});
	var headers = {
		'Content-Type': 'application/xml',
		'Authorization' : 'Basic ' + new Buffer(username + ":" + password).toString("base64")
	};
	needle.post('http://requestb.in/upzopduq', xml, { 'headers': headers }, function(err, resp) {
		if (err) {
			console.log('neddle error');
		}
	});
};

var startTime = Date.now();
var readStream=require("fs").createReadStream(filePath);
converter.setEncoding('utf8');
var batch = [], batchCounter = 0, noMobileCounter = 0, hasMobileCounter = 0;
converter.on('data', function(chunk) {
	var mobile = JSON.parse(chunk)['mobile_number'];
	if(mobile) {
		batch.push(mobile);
		hasMobileCounter++;
		if(batch.length === 250) {
			submitChunkAsBulkSms(batch);
			batch = [];
			batchCounter++;
			if(batchCounter % 100 === 0) {
				console.log(batchCounter + " batches so far");
			}
		}
	}
	else {
		noMobileCounter++;
	}
});
converter.on('end', function() {
	if(batch.length > 0) {
		submitChunkAsBulkSms(batch);
		batch = [];
		batchCounter++;
	}
	console.log('sumbitted total of ' + hasMobileCounter + ' SMS in ' +  batchCounter + ' batches. There were ' + noMobileCounter + ' entries with no mobile number');
	console.log('completed in ' + (Date.now() - startTime)/1000 + ' seconds');
});
readStream.pipe(converter);
