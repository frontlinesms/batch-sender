var needle = require('needle'),
fs = require('fs'),
_ = require('lodash'),
xmlbuilder = require('xmlbuilder'),
Converter = require("csvtojson").Converter;

var converter = new Converter({});

var splitToChunks = function(array, chunkSize) {
	var range = function(n) {
		return Array.apply(null,Array(n)).map((x,i) => i);
	};
	return range(Math.ceil(array.length/chunkSize)).map((x,i) => array.slice(i*chunkSize,i*chunkSize+chunkSize));
};

var submitChunkAsBulkSms = function(chunk) {
	var root = xmlbuilder.create('message');
	var sms = root.ele('sms');
	sms.ele('source').ele('address').ele('number', {'type': 'abbreviated'}, '8786');
	_(chunk).forEach(function(mobile) {
		sms.ele('destination').ele('address').ele('number', {'type': 'international'}, '+' + mobile);
	});
	sms.ele('rsr', {'type': 'all'});
	sms.ele('ud', {'type': 'text', 'encoding': 'default'}, 'text');
	var xml = root.end({pretty: true});
	needle.post('http://httpbin.org/post', xml, {'headers': {'Content-Type': 'application/xml'} }, function(err, resp) {
		if (!err) {
			console.log(resp.body) ;
		}
		if (err) {
			console.log('neddle error');
		}
	});
};

converter.fromFile("./input.csv",function(err,result){
	var mobiles = _.map(result, 'Mobile Number');
	_(splitToChunks(mobiles, 250)).forEach(function(chunk, index) {
		console.log("processing chunk number " + index);
		submitChunkAsBulkSms(chunk);
	});
});
