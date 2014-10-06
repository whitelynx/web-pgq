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


function onConnection(client)
{
    //logger.info("Client connected.", logger.dump(client));
    logger.info("Client connected.");

    client
        .on('foo', function()
        {
            logger.info("Got 'foo' from client.");
        })
        .on('bar', function(callback)
        {
            logger.info("Got 'bar' from client; responding.");
            callback('bleh');
        });
} // end onConnection


function sqlChannelHandler(channel)
{
    //logger.info("Client connected to the 'sql' channel.", logger.dump(channel));
    logger.info("Client connected to the 'sql' channel.");
    var connection;

    var onError = channel.emit.bind(channel, 'error');
    var onRow = channel.emit.bind(channel, 'row');

    function disconnectDB()
    {
        if(connection)
        {
            connection.removeListener('error', onError);
            connection.removeListener('row', onRow);

            connection.close();

            connection = undefined;
        } // end if
    } // end disconnectDB

    /**
     * Connect to the given database.
     *
     * @todo Document parameters.
     */
    function onConnect(connectionInfo, callback)
    {
        logger.info("'sql' channel got 'connect': %s", logger.dump(connectionInfo));

        disconnectDB();

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
    } // end onConnect

    /**
     * Execute a query on the current database connection.
     *
     * @fires Connection#row
     *
     * @param {Connection#QueryDef} queryDef - the definition of the query to run
     * @param {function(err, {rows: number, affected: number})} callback - called with an error on failure, or
     *          query statistics on success
     */
    function onQuery(queryDef, callback)
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
    } // end onQuery

    /**
     * Close the current connection.
     *
     * @todo Document parameters.
     */
    function onDisconnect(callback)
    {
        logger.info("'sql' channel got 'disconnect'.");

        disconnectDB();
        callback();
    } // end onDisconnect

    channel
        .on('connect', onConnect)
        .on('query', onQuery)
        .on('disconnect', onDisconnect);

    return true;
} // end sqlChannelHandler


module.exports = {
    attach: function(server)
    {
        new UniSocketServer()
            .attach(server)
            .on('connection', onConnection)
            .channel('sql', sqlChannelHandler);
    } // end attach
};
