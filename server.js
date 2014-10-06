var http = require('http');

var connect = require('connect');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var favicon = require('serve-favicon');
var logging = require('omega-logger');
var responseTime = require('response-time');
var serveStatic = require('serve-static');
var session = require('cookie-session');

var socket = require('./lib/socket');


// For debugging!
logging.defaultConsoleHandler.level = 'TRACE';

var logger = logging.loggerFor(module);


var sessionOpts = {
    name: 'web-pgq:sess',
    keys: ['asontehusntohir', 'octbxrcao.dri', '38rcbixr', 'opdi9r842d3', 'iu8d98d']
};


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
