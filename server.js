/* jshint node:true */
"use strict";

var http = require('http');

var _ = require('lodash');
var connect = require('connect');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var favicon = require('serve-favicon');
var logging = require('omega-logger');
var responseTime = require('response-time');
var serveStatic = require('serve-static');
var session = require('cookie-session');

var socket = require('./lib/socket');

// --------------------------------------------------------------------------------------------------------------------

var logger = logging.loggerFor(module);

var sessionOpts = {
    name: 'web-pgq:sess',
    keys: ['asontehusntohir', 'octbxrcao.dri', '38rcbixr', 'opdi9r842d3', 'iu8d98d']
};

// --------------------------------------------------------------------------------------------------------------------
// Error handling

var exitCodes = {
    unhandledException: 0x7F, // 127
    fatalSignalBase: 0x80, // 128; if a fatal signal whose number is N is caught, exit with 128+N
};

process
    .on('uncaughtException', function(error)
    {
        logger.error('Unhandled exception: %s', error.stack || error);
        process.exit(exitCodes.unhandledException);
    })
    .on('exit', function(code)
    {
        var codeDesc = _.findKey(exitCodes, function(val) { return val === code; }) || 'unknown';
        if(code > exitCodes.fatalSignalBase)
        {
            codeDesc = signalNames[code - exitCodes.fatalSignalBase];
        } // end if

        console.log('\x1b[90m== Process exiting with code \x1b[1m%s\x1b[0;90m (0x%s: %s) ==\x1b[m',
            code, code.toString(16), codeDesc);
    });

// List of all signal names (names and numbers from `kill -L`):
var signalNames = {
    1: 'SIGHUP',
    2: 'SIGINT',
    13: 'SIGPIPE',
    15: 'SIGTERM',
};

// List of fatal signals (names and numbers from `kill -L`):
var fatalSignals = {
    'SIGHUP': 1,
    'SIGINT': 2,
    'SIGPIPE': 13,
    'SIGTERM': 15,
};

// Catch fatal signals, and handled them appropriately.
_.forIn(fatalSignals, function logSignalAndExit(sigNum, sigName)
{
    var exitCode = exitCodes.fatalSignalBase + sigNum;

    process.on(sigName, function()
    {
        logger.trace('Got %s; exiting.', sigName);
        process.exit(exitCode);
    });
}); // end logSignalAndExit

// --------------------------------------------------------------------------------------------------------------------
// Server initialization

var app = connect()
    .use(responseTime())
    .use(favicon('static/favicon.ico'))
    .use(serveStatic('static'))
    .use(serveStatic('bower_components'))
    //.use(serveStatic('node_modules/unisocket/static'))
    .use(cookieParser())
    .use(session(sessionOpts))
    .use(bodyParser.urlencoded({ extended: false }))
    .use(bodyParser.json())
    .use(function(req, res)
    {
        res.statusCode = 404;
        res.end("404 Not Found");
    });

var server = http.createServer(app).listen(3000, function()
{
    socket.attach(server);

    var addr = server.address();
    logger.info("Listening on %s:%s", addr.address, addr.port);
});
