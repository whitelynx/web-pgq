/* jshint node:true */
"use strict";

var _ = require('lodash');
var UniSocketServer = require('unisocket');

var logging = require('omega-logger');

var sql = require('./sql');


var logger = logging.loggerFor(module);


function errorToJSON(error)
{
    var ret = _.assign({severity: error}, _.pick(error, 'message', 'stack', 'type'), error);
    logger.warn("Returning error message:", logger.dump(ret));
    return ret;
} // end errorToJSON


function onClientConnection(client)
{
    var socket = client.socket._socket;
    logger.info("Client connected from %s:%s.", socket.remoteAddress, socket.remotePort);
} // end onClientConnection


function sqlChannelHandler(channel)
{
    //logger.info("Client connected to the 'sql' channel.", logger.dump(channel));
    logger.info("Client connected to the 'sql' channel.");
    var connection;

    var onError = function(error)
    {
        if(_.isError(error))
        {
            // Convert the error to a plain object with a 'message' attribute.
            error = _.assign(_.pick(error, 'message'), error);
            error.message = error.message || error.toString();
        } // end if

        channel.emit('error', error);
    };
    var onFields = channel.emit.bind(channel, 'fields');
    var onRow = channel.emit.bind(channel, 'row');
    var onNotice = channel.emit.bind(channel, 'notice');

    channel.on('close', function()
    {
        logger.debug("Client disconnected from the 'sql' channel; releasing any DB connections.");

        channel
            .removeListener('connect', handleConnect)
            .removeListener('query', handleQuery)
            .removeListener('disconnect', handleDisconnect);

        disconnectDB();
    });

    function disconnectDB()
    {
        if(connection)
        {
            connection
                .removeListener('error', onError)
                .removeListener('fields', onFields)
                .removeListener('row', onRow)
                .removeListener('notice', onNotice);

            connection.close();

            connection = undefined;
        } // end if
    } // end disconnectDB

    /**
     * Connect to the given database.
     *
     * @todo Document parameters.
     */
    function handleConnect(connectionInfo, callback)
    {
        logger.info("'sql' channel got 'connect': %s", logger.dump(connectionInfo));

        disconnectDB();

        sql.connect(connectionInfo)
            .then(function(conn)
            {
                connection = conn
                    .on('error', onError)
                    .on('fields', onFields)
                    .on('row', onRow)
                    .on('notice', onNotice);

                callback(null, _.assign({server_address: conn.remoteAddress}, conn.settings));
            })
            .catch(function(error)
            {
                logger.warn("Returning error to client:", error);
                callback(errorToJSON(error));
            });
    } // end handleConnect

    /**
     * Execute a query on the current database connection.
     *
     * @fires Connection#row
     *
     * @param {Connection#QueryDef} queryDef - the definition of the query to run
     * @param {function(err, {rows: number, affected: number})} callback - called with an error on failure, or
     *          query statistics on success
     */
    function handleQuery(queryDef, callback)
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
            .nodeify(function()
            {
                try
                {
                    callback.apply(this, arguments);
                }
                catch(exc)
                {
                    logger.error("Error calling unisocket callback: %s", exc.stack || exc);
                } // end try
            });
    } // end handleQuery

    /**
     * Close the current connection.
     *
     * @todo Document parameters.
     */
    function handleDisconnect(callback)
    {
        logger.info("'sql' channel got 'disconnect'.");

        disconnectDB();
        callback();
    } // end handleDisconnect

    channel
        .on('connect', handleConnect)
        .on('query', handleQuery)
        .on('disconnect', handleDisconnect);

    return true;
} // end sqlChannelHandler


module.exports = {
    attach: function(server)
    {
        new UniSocketServer()
            .attach(server)
            .on('connection', onClientConnection)
            .channel('sql', sqlChannelHandler);
    } // end attach
};
