"use strict";

exports.setup = function(base) {
	var rExports = {}, _rExports = {};
	var rest = base.rest;
	var displayError = base.displayError;

	if (!base.isBrowser)
		var async = require('async');
	else
		var async = window.async;

	rExports.setuphistory = function(test) {
		rest = base.rest({
			//log: {level: 4},
			key: base.testVars.testAppId + '.' + base.testVars.testKey0Id + ':' + base.testVars.testKey0.value
		});
		test.done();
	};

	rExports.history_simple = function(test) {
		test.expect(2);
		var testchannel = rest.channels.get('persisted:history_simple');

		/* first, send a number of events to this channel */
		var testMessages = [
			{ name: 'event0',
				data: true },
			{ name: 'event1',
				data: false },
			{ name: 'event2',
				data: 24 },
			{ name: 'event3',
				data: 'this is a string' },
			{ name: 'event4',
				data: [1,2,3] },
			{ name: 'event5',
				data: {one: 1, two: 2, three: 3} },
			{ name: 'event6',
				data: Date.now() }
		];
		var publishTasks = testMessages.map(function(event) {
			return function(publishCb) {
				testchannel.publish(event.name, event.data, publishCb);
			};
		});

		publishTasks.push(function(waitCb) { setTimeout(function() {
			waitCb(null);
		}, 1000); });
		try {
			async.parallel(publishTasks, function(err) {
				if(err) {
					test.ok(false, displayError(err));
					test.done();
					return;
				}

				/* so now the messages are there; try querying the timeline */
				testchannel.history(function(err, messages) {
					//console.log(require('util').inspect(messages));
					if(err) {
						test.ok(false, displayError(err));
						test.done();
						return;
					}
					/* verify all messages are received */
					test.equal(messages.length, testMessages.length, 'Verify correct number of messages found');

					/* verify message ids are unique */
					var ids = {};
					messages.forEach(function(msg) { ids[msg.id] = msg; });
					test.equal(Object.keys(ids).length, testMessages.length, 'Verify correct number of distinct message ids found')
					test.done();
				});
			});
		} catch(e) {
			console.log(e.stack);
		}
	};

	rExports.history_multiple = function(test) {
		test.expect(2);
		var testchannel = rest.channels.get('persisted:history_multiple');

		/* first, send a number of events to this channel */
		var testMessages = [
			{ name: 'event0',
				data: true },
			{ name: 'event1',
				data: false },
			{ name: 'event2',
				data: 24 },
			{ name: 'event3',
				data: 'this is a string' },
			{ name: 'event4',
				data: [1,2,3] },
			{ name: 'event5',
				data: {one: 1, two: 2, three: 3} },
			{ name: 'event6',
				data: Date.now() }
		];
		var publishTasks = [function(publishCb) {
			testchannel.publish(testMessages, publishCb);
		}];

		publishTasks.push(function(waitCb) { setTimeout(function() {
			waitCb(null);
		}, 1000); });
		try {
			async.parallel(publishTasks, function(err) {
				if(err) {
					test.ok(false, displayError(err));
					test.done();
					return;
				}

				/* so now the messages are there; try querying the timeline */
				testchannel.history(function(err, messages) {
					//console.log(require('util').inspect(messages));
					if(err) {
						test.ok(false, displayError(err));
						test.done();
						return;
					}
					/* verify all messages are received */
					test.equal(messages.length, testMessages.length, 'Verify correct number of messages found');

					/* verify message ids are unique */
					var ids = {};
					messages.forEach(function(msg) { ids[msg.id] = msg; });
					test.equal(Object.keys(ids).length, testMessages.length, 'Verify correct number of distinct message ids found')
					test.done();
				});
			});
		} catch(e) {
			console.log(e.stack);
		}
	};

	rExports.history_simple_paginated_b = function(test) {
		var testchannel = rest.channels.get('persisted:history_simple_paginated_b');

		/* first, send a number of events to this channel */
		var testMessages = [
			{ name: 'event0',
				data: true },
			{ name: 'event1',
				data: false },
			{ name: 'event2',
				data: 24 },
			{ name: 'event3',
				data: 'this is a string' },
			{ name: 'event4',
				data: [1,2,3] },
			{ name: 'event5',
				data: {one: 1, two: 2, three: 3} },
			{ name: 'event6',
				data: Date.now() }
		];

		test.expect(4 * testMessages.length);
		var publishTasks = testMessages.map(function(event) {
			return function(publishCb) {
				testchannel.publish(event.name, event.data, publishCb);
			};
		});

		publishTasks.push(function(waitCb) { setTimeout(function() {
			waitCb(null);
		}, 1000); });
		try {
			async.series(publishTasks, function(err) {
				if(err) {
					test.ok(false, displayError(err));
					test.done();
					return;
				}

				/* so now the messages are there; try querying the timeline to get messages one at a time */
				var ids = {};
				var nextParams = {limit: 1, direction: 'backwards'};
				var totalMessagesExpected = testMessages.length;
				testMessages.reverse();
				async.mapSeries(testMessages, function(expectedMessage, cb) {
					testchannel.history(nextParams, function(err, resultPage, relLinks) {
						if(err) {
							cb(err);
							return;
						}
						/* verify expected number of messages in this page */
						test.equal(resultPage.length, 1, 'Verify a single message received');
						var resultMessage = resultPage[0];
						ids[resultMessage.id] = resultMessage;

						/* verify expected message */
						test.equal(expectedMessage.name, resultMessage.name, 'Verify expected name value present');
						test.deepEqual(expectedMessage.data, resultMessage.data, 'Verify expected data value present');

						if(--totalMessagesExpected > 0) {
							nextParams = relLinks.next;
							test.ok(!!nextParams, 'Verify next link is present');
						}
						cb();
					});
				}, function(err) {
					if(err) {
						test.ok(false, displayError(err));
						test.done();
						return;
					}
					/* verify message ids are unique */
					test.equal(Object.keys(ids).length, testMessages.length, 'Verify correct number of distinct message ids found')
					test.done();
				});
			});
		} catch(e) {
			console.log(e.stack);
		}
	};

	rExports.history_simple_paginated_f = function(test) {
		var testchannel = rest.channels.get('persisted:history_simple_paginated_f');

		/* first, send a number of events to this channel */
		var testMessages = [
			{ name: 'event0',
				data: true },
			{ name: 'event1',
				data: false },
			{ name: 'event2',
				data: 24 },
			{ name: 'event3',
				data: 'this is a string' },
			{ name: 'event4',
				data: [1,2,3] },
			{ name: 'event5',
				data: {one: 1, two: 2, three: 3} },
			{ name: 'event6',
				data: Date.now() }
		];

		test.expect(4 * testMessages.length);
		var publishTasks = testMessages.map(function(event) {
			return function(publishCb) {
				testchannel.publish(event.name, event.data, publishCb);
			};
		});

		publishTasks.push(function(waitCb) { setTimeout(function() {
			waitCb(null);
		}, 1000); });
		try {
			async.series(publishTasks, function(err) {
				if(err) {
					test.ok(false, displayError(err));
					test.done();
					return;
				}

				/* so now the messages are there; try querying the timeline to get messages one at a time */
				var ids = {};
				var nextParams = {limit: 1, direction: 'forwards'};
				var totalMessagesExpected = testMessages.length;
				async.mapSeries(testMessages, function(expectedMessage, cb) {
					testchannel.history(nextParams, function(err, resultPage, relLinks) {
						if(err) {
							cb(err);
							return;
						}
						/* verify expected number of messages in this page */
						test.equal(resultPage.length, 1, 'Verify a single message received');
						var resultMessage = resultPage[0];
						ids[resultMessage.id] = resultMessage;

						/* verify expected message */
						test.equal(expectedMessage.name, resultMessage.name, 'Verify expected name value present');
						test.deepEqual(expectedMessage.data, resultMessage.data, 'Verify expected data value present');

						if(--totalMessagesExpected > 0) {
							nextParams = relLinks.next;
							test.ok(!!nextParams, 'Verify next link is present');
						}
						cb();
					});
				}, function(err) {
					if(err) {
						test.ok(false, displayError(err));
						test.done();
						return;
					}
					/* verify message ids are unique */
					test.equal(Object.keys(ids).length, testMessages.length, 'Verify correct number of distinct message ids found')
					test.done();
				});
			});
		} catch(e) {
			console.log(e.stack);
		}
	};

	rExports.history_multiple_paginated_b = function(test) {
		var testchannel = rest.channels.get('persisted:history_multiple_paginated_b');

		/* first, send a number of events to this channel */
		var testMessages = [
			{ name: 'event0',
				data: true },
			{ name: 'event1',
				data: false },
			{ name: 'event2',
				data: 24 },
			{ name: 'event3',
				data: 'this is a string' },
			{ name: 'event4',
				data: [1,2,3] },
			{ name: 'event5',
				data: {one: 1, two: 2, three: 3} },
			{ name: 'event6',
				data: Date.now() }
		];

		test.expect(4 * testMessages.length);
		var publishTasks = [function(publishCb) {
			testchannel.publish(testMessages, publishCb);
		}];

		publishTasks.push(function(waitCb) { setTimeout(function() {
			waitCb(null);
		}, 1000); });
		try {
			async.series(publishTasks, function(err) {
				if(err) {
					test.ok(false, displayError(err));
					test.done();
					return;
				}

				/* so now the messages are there; try querying the timeline to get messages one at a time */
				var ids = {};
				var nextParams = {limit: 1, direction: 'backwards'};
				var totalMessagesExpected = testMessages.length;
				testMessages.reverse();
				async.mapSeries(testMessages, function(expectedMessage, cb) {
					testchannel.history(nextParams, function(err, resultPage, relLinks) {
						if(err) {
							cb(err);
							return;
						}
						/* verify expected number of messages in this page */
						test.equal(resultPage.length, 1, 'Verify a single message received');
						var resultMessage = resultPage[0];
						ids[resultMessage.id] = resultMessage;

						/* verify expected message */
						test.equal(expectedMessage.name, resultMessage.name, 'Verify expected name value present');
						test.deepEqual(expectedMessage.data, resultMessage.data, 'Verify expected data value present');

						if(--totalMessagesExpected > 0) {
							nextParams = relLinks.next;
							test.ok(!!nextParams, 'Verify next link is present');
						}
						cb();
					});
				}, function(err) {
					if(err) {
						test.ok(false, displayError(err));
						test.done();
						return;
					}
					/* verify message ids are unique */
					test.equal(Object.keys(ids).length, testMessages.length, 'Verify correct number of distinct message ids found')
					test.done();
				});
			});
		} catch(e) {
			console.log(e.stack);
		}
	};

	rExports.history_multiple_paginated_f = function(test) {
		var testchannel = rest.channels.get('persisted:history_multiple_paginated_f');

		/* first, send a number of events to this channel */
		var testMessages = [
			{ name: 'event0',
				data: true },
			{ name: 'event1',
				data: false },
			{ name: 'event2',
				data: 24 },
			{ name: 'event3',
				data: 'this is a string' },
			{ name: 'event4',
				data: [1,2,3] },
			{ name: 'event5',
				data: {one: 1, two: 2, three: 3} },
			{ name: 'event6',
				data: Date.now() }
		];

		test.expect(4 * testMessages.length);
		var publishTasks = [function(publishCb) {
			testchannel.publish(testMessages, publishCb);
		}];

		publishTasks.push(function(waitCb) { setTimeout(function() {
			waitCb(null);
		}, 1000); });
		try {
			async.series(publishTasks, function(err) {
				if(err) {
					test.ok(false, displayError(err));
					test.done();
					return;
				}

				/* so now the messages are there; try querying the timeline to get messages one at a time */
				var ids = {};
				var nextParams = {limit: 1, direction: 'forwards'};
				var totalMessagesExpected = testMessages.length;
				async.mapSeries(testMessages, function(expectedMessage, cb) {
					testchannel.history(nextParams, function(err, resultPage, relLinks) {
						if(err) {
							cb(err);
							return;
						}
						/* verify expected number of messages in this page */
						test.equal(resultPage.length, 1, 'Verify a single message received');
						var resultMessage = resultPage[0];
						ids[resultMessage.id] = resultMessage;

						/* verify expected message */
						test.equal(expectedMessage.name, resultMessage.name, 'Verify expected name value present');
						test.deepEqual(expectedMessage.data, resultMessage.data, 'Verify expected data value present');

						if(--totalMessagesExpected > 0) {
							nextParams = relLinks.next;
							test.ok(!!nextParams, 'Verify next link is present');
						}
						cb();
					});
				}, function(err) {
					if(err) {
						test.ok(false, displayError(err));
						test.done();
						return;
					}
					/* verify message ids are unique */
					test.equal(Object.keys(ids).length, testMessages.length, 'Verify correct number of distinct message ids found')
					test.done();
				});
			});
		} catch(e) {
			console.log(e.stack);
		}
	};

	return rExports;
};
