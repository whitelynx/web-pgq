var http = require('http');

var _ = require('lodash');
var UniSocketServer = require('unisocket');

var connect = require('connect');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var favicon = require('serve-favicon');
var logging = require('omega-logger');
var responseTime = require('response-time');
var serveStatic = require('serve-static');
var session = require('cookie-session');

var sql = require('./lib/sql');


// For debugging!
logging.defaultConsoleHandler.level = 'TRACE';

var logger = logging.loggerFor(module);


var sessionOpts = {
    name: 'web-pgq:sess',
    keys: ['asontehusntohir', 'octbxrcao.dri', '38rcbixr', 'opdi9r842d3', 'iu8d98d']
};

function errorToJSON(error)
{
    var ret = _.assign({severity: error}, _.pick(error, 'message', 'stack', 'type'), error);
    logger.warn("Returning error message:", logger.dump(ret));
    return ret;
} // end errorToJSON


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

var server = http.createServer(app).listen(3000);

new UniSocketServer()
    .attach(server)
    .on('connection', function()//client)
    {
        //logger.info("Client connected.", logger.dump(client));
        logger.info("Client connected.");
    })
    .channel('sql', function(channel)
    {
        //logger.info("Client connected to the 'sql' channel.", logger.dump(channel));
        logger.info("Client connected to the 'sql' channel.");
        var connection;

        var onError = channel.emit.bind(channel, 'error');
        var onRow = channel.emit.bind(channel, 'row');

        function disconnect()
        {
            if(connection)
            {
                connection.removeListener('error', onError);
                connection.removeListener('row', onRow);

                connection.close();

                connection = undefined;
            } // end if
        } // end disconnect

        channel
            /**
             * Connect to the given database.
             *
             * @todo Document parameters.
             */
            .on('connect', function(connectionInfo, callback)
            {
                logger.info("'sql' channel got 'connect': %s", logger.dump(connectionInfo));

                disconnect();

                sql.connect(connectionInfo)
                    .then(function(conn)
                    {
                        connection = conn;

                        connection.on('error', onError);
                        connection.on('row', onRow);

                        callback();
                    })
                    .catch(function(error)
                    {
                        logger.warn("Returning error to client:", error);
                        callback(errorToJSON(error));
                    });
            }) // end 'connect' handler

            /**
             * Execute a query on the current database connection.
             *
             * @fires Connection#row
             *
             * @param {Connection#QueryDef} queryDef - the definition of the query to run
             * @param {function(err, {rows: number, affected: number)} callback - called with an error on failure, or
             *          query statistics on success
             */
            .on('query', function(queryDef, callback)
            {
                logger.info("'sql' channel got 'query': %s", logger.dump(queryDef));

                if(!connection)
                {
                    return callback({message: "Not connected!", hint: "You need to connect to a database first."});
                } // end if

                connection
                    .query(queryDef)
                    .catch(function(error)
                    {
                        callback(errorToJSON(error));
                    })
                    .nodeify(callback);
            }) // end 'query' handler

            /**
             * Close the current connection.
             *
             * @todo Document parameters.
             */
            .on('disconnect', function(callback)
            {
                logger.info("'sql' channel got 'disconnect'.");

                disconnect();
                callback();
            }); // end 'disconnect' handler

    }); // end 'connection' handler
