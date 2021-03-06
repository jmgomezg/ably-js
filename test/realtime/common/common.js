"use strict";

exports.TestBaseClass = function() {
	if (exports.TestBaseClass.prototype._singletonInstance)
		return exports.TestBaseClass.prototype._singletonInstance;
	exports.TestBaseClass.prototype._singletonInstance = this;
	return this;
};

exports.setup = function() {
	var rExports = exports.TestBaseClass();
	var isBrowser = rExports.isBrowser = (typeof(window) === 'object');

	if (isBrowser) {
		var http = null;
		var Ably = rExports.Ably = window.Ably;
		var Realtime = Ably.Realtime;
		var Rest = Ably.Realtime.super_;

		var wsHost = testVars.realtimeHost || 'sandbox-realtime.ably.io';
		var restHost = testVars.restHost || 'sandbox-rest.ably.io';
		var port = testVars.realtimePort || '80';
		var tlsPort = testVars.realtimeTlsPort || '443';
		var useTls = rExports.useTls = testVars.useTls;

		var httpReq = function(options, callback) {
			var uri = options.scheme + '://' + options.host + ':' + options.port + options.path;
			var xhr = createXHR();
			xhr.open(options.method, uri);
			if (options.headers) {
				for (var h in options.headers) if (h !== 'Content-Length') xhr.setRequestHeader(h, options.headers[h]);
			}
			xhr.onerror = function(err) { callback(err); };
			xhr.onreadystatechange = function() {
				if(xhr.readyState == 4) {
					if (xhr.status >= 300) {
						callback('HTTP request failed '+xhr.status);
						return;
					}
					callback(null, xhr.responseText);
				}
			};
			xhr.send(options.body);
		};
		var toBase64 = Base64.encode;

		var loadTestData = rExports.loadTestData = function(dataPath, callback) {
			var getOptions = {
				host: window.location.hostname,
				port: window.location.port,
				path: '/' + dataPath,
				method: 'GET',
				scheme: window.location.protocol.slice(0, -1),
				headers: { 'Content-Type': 'application/json' }
			};
			httpReq(getOptions, function(err, data) {
				try {
					data = JSON.parse(data);
				} catch(e) {
					callback(e);
					return;
				}
				callback(null, data);
			});
		};

	} else {
		var fs = require('fs');
		var http = require('http');
		var https = require('https');
		var path = require('path');
		var util = require('util');
		var Ably = rExports.Ably = require('../../..');
		var Rest = Ably.Rest;
		var Realtime = Ably.Realtime;

		var wsHost = process.env.WEBSOCKET_ADDRESS || 'sandbox-realtime.ably.io';
		var restHost = process.env.REST_ADDRESS || 'sandbox-rest.ably.io';
		var port = process.env.WEBSOCKET_PORT || '80';
		var tlsPort = process.env.WEBSOCKET_TLS_PORT || '443';
		var useTls = rExports.useTls = true;

		var httpReq = function(options, callback) {
			var body = options.body;
			delete options.body;
			var response = '';
			var request = (options.scheme == 'http' ? http : https).request(options, function (res) {
				res.setEncoding('utf8');
				res.on('data', function (chunk) { response += chunk; });
				res.on('end', function () {
					if (res.statusCode >= 300) {
						callback('Invalid HTTP request: ' + response + '; statusCode = ' + res.statusCode);
					} else {
						//console.log('Teardown response: '+response);
						callback(null, response);
					}
				});
			});
			request.on('error', function (err) { callback(err); });
			request.end(body);
		};
		var toBase64 = function(str) { return (new Buffer(str, 'ascii')).toString('base64'); };

		var loadTestData = rExports.loadTestData = function(dataPath, callback) {
			var resolvedPath = path.resolve(__dirname, '../../..', dataPath);
			fs.readFile(resolvedPath, function(err, data) {
				if(err) {
					callback(err);
					return;
				}
				try {
					data = JSON.parse(data);
				} catch(e) {
					callback(e);
					return;
				}
				callback(null, data);
			});
		};
	}

	var restOpts = {
		tls: useTls, host: restHost, tlsPort: tlsPort //,log:{level:4}
	};
	var realtimeOpts = {
		tls: useTls, wsHost: wsHost, host: restHost, port: port, tlsPort: tlsPort //,log:{level:4}
	};

	function mixin(target, source) {
		source = source || {};
		Object.keys(source).forEach(function(key) {
			target[key] = source[key];
		});
		return target;
	}

	rExports.rest = function(opts) {return new Rest(mixin((opts || {}), restOpts));};
	rExports.realtime = function(opts) {return new Realtime(mixin((opts || {}), realtimeOpts));};

	rExports.containsValue = function(ob, value) {
		for(var key in ob) {
			if(ob[key] == value)
				return true;
		}
		return false;
	};

	rExports.displayError = function(err) {
		if(typeof(err) == 'string')
			return err;

		var result = '';
		if(err.statusCode)
			result += err.statusCode + '; ';
		if(typeof(err.message) == 'string')
			result += err.message;
		if(typeof(err.message) == 'object')
			result += JSON.stringify(err.message);

		return result;
	};

	rExports.testVars = {};

	var createXHR = function() {
		var result = new XMLHttpRequest();
		if ('withCredentials' in result)
			return result;
		if(typeof XDomainRequest !== "undefined")
			return new XDomainRequest();        /* Use IE-specific "CORS" code with XDR */
		return null;
	};

	var _setupTest = function(callback) {
		var appSpec = {
			namespaces: [
				{id: "persisted", persisted: true }
			],
			keys : [
				{}, /* key0 is blanket capability */
				{   /* key1 is specific channel and ops */
					capability: JSON.stringify({ testchannel:['publish'] })
				},
				{   /* key2 is wildcard channel spec */
					capability: JSON.stringify({
						'*':['subscribe'],
						'canpublish:*':['publish'],
						'canpublish:andpresence':['presence', 'publish']
					})
				},
				{   /* key3 is wildcard ops spec */
					capability: JSON.stringify({ 'candoall':['*'] })
				},
				{   /* key4 is multiple resources */
					capability: JSON.stringify({
						channel0:['publish'],
						channel1:['publish'],
						channel2:['publish', 'subscribe'],
						channel3:['subscribe'],
						channel4:['presence', 'publish', 'subscribe'],
						channel5:['presence'],
						channel6:['*']
					})
				},
				{   /* key5 has wildcard clientId */
					privileged: true,
					capability: JSON.stringify({
						channel0:['publish'],
						channel1:['publish'],
						channel2:['publish', 'subscribe'],
						channel3:['subscribe'],
						channel4:['presence', 'publish', 'subscribe'],
						channel5:['presence'],
						channel6:['*']
					})
				}
			]
		};

		var postData = JSON.stringify(appSpec);
		var postOptions = {
			host: restHost, port: tlsPort, path: '/apps', method: 'POST', scheme: 'https',
			headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length },
			body: postData
		};
		httpReq(postOptions, function(err, res) {
			if (err) {
				callback(err);
			} else {
				//console.log('Setup response: '+res);
				if (typeof(res) === 'string') res = JSON.parse(res);
				if (res.keys.length != appSpec.keys.length) {
					callback('Failed to create correct number of keys for app');
				} else if (res.namespaces.length != appSpec.namespaces.length) {
					callback('Failed to create correct number of namespaces for app');
				} else {
					rExports.testVars.testAcct = res.accountId;
					rExports.testVars.testAppId = res.appId;
					for (var i=0; i<res.keys.length; i++) {
						rExports.testVars['testKey'+i] = res.keys[i];
						rExports.testVars['testKey'+i+'Id'] = res.keys[i].id;
						rExports.testVars['testKey'+i+'Value'] = res.keys[i].value;
						rExports.testVars['testKey'+i+'Str'] = res.id + '.' + res.keys[i].id + ':' + res.keys[i].value;
					}
					//console.log('After setup, testVars: '+JSON.stringify(rExports.testVars));
					callback(null);
				}
			}
		});
	};

	var _clearTest = function(callback) {
		var authKey = rExports.testVars.testAppId + '.' + rExports.testVars.testKey0Id + ':' + rExports.testVars.testKey0Value;
		var authHeader = toBase64(authKey);
		var delOptions = {
			host: restHost, port: tlsPort, method: 'DELETE', path: '/apps/' + rExports.testVars.testAppId,
			scheme: 'https', headers: { 'Authorization': 'Basic ' + authHeader }
		};
		httpReq(delOptions, function(err, resp) { callback(err); });
	};

	rExports.setupTest = function(test) {
		/* create a test account, application, and key */
		test.expect(1);
		_setupTest(function(err) {
			if(err) {
				test.ok(false, displayError(err));
				test.done();
				return;
			}
			test.ok(true, 'Created test vars');
			test.done();
		});
	};

	rExports.clearTest = function(test) {
		/* remove test account, application, and key */
		test.expect(1);
		_clearTest(function(err) {
			if(err) {
				test.ok(false, displayError(err));
				test.done();
				return;
			}
			test.ok(true, 'Cleared test vars');
			test.done();
		});
	};

	rExports.addCommonModule = function(addToExports, mod) {
		var rExports = mod.setup(exports);
		for (var ex in rExports)
			addToExports[ex] = rExports[ex];
	};

	return rExports;
};
