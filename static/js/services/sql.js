/* jshint browser:true, globalstrict:true */
/* global angular:true, console:true */
"use strict";

(function()
{

function onOff(value)
{
    return value ? 'on' : 'off';
} // end onOff

var queryID = 0;


angular.module('webPGQ.services')
    .service('sql', ['$exceptionHandler', '_', 'eventEmitter', 'socket', 'logger', 'promise',
    function($exceptionHandler, _, eventEmitter, socket, logger, promise)
    {
        var channel;

        function onSocketConnected()
        {
            socket.channel('sql')
                .then(function(chan)
                {
                    channel = chan;

                    //HACK: Copy/modify options to lengthen the request timeout. (really only needed for queries)
                    channel.options = angular.copy(channel.options);
                    //HACK: Since we can't actually disable the request timeout, we just make it ridiculously long.
                    channel.options.timeout = 1000 * 60 * 60 * 24;

                    channel.on('notice', function(notice)
                    {
                        var truncated = _.trunc(notice.message, {length: 128, separator: /\s+/g});
                        // truncated will start with "notice:", so all we need to do now is uppercase the first letter.
                        logger.info(truncated[0].toUpperCase() + truncated.slice(1), notice, 'sql');

                        sqlService.emit('notice', notice);
                    });

                    channel.on('error', function(error)
                    {
                        logger.error('Error: ' + (error.message || error.name), error, 'sql');

                        sqlService.emit('error', error);
                    });

                    channel.on('disconnected', function()
                    {
                        logger.info('Disconnected from database.', sqlService.connectionInfo.masked, 'sql');
                        delete sqlService.connectionInfo;
                        delete sqlService.serverSettings;

                        sqlService.emit('disconnected');
                    });

                    sqlService.emit('ready');
                });
        } // end onSocketConnected
        socket.on('connected', onSocketConnected);
        socket.on('reconnected', onSocketConnected);

        var explainOptions = {
            VERBOSE: {
                enabled: true,
                description: 'TODO',
                icon: 'bullhorn'
            },
            COSTS: {
                enabled: true,
                description: 'TODO',
                icon: 'dollar'
            },
            BUFFERS: {
                enabled: true,
                description: 'TODO',
                icon: 'tasks'
            },
            TIMING: {
                enabled: true,
                description: 'TODO',
                icon: 'time'
            }
        };


        function ConnectionInfo(data)
        {
            angular.extend(this, data || {});
        } // end ConnectionInfo

        Object.defineProperty(ConnectionInfo.prototype, 'masked', {
            enumerable: false,
            get: function()
            {
                var maskedInfo = angular.extend({}, this);
                if(maskedInfo.password)
                {
                    maskedInfo.password = maskedInfo.password.replace(/./g, '*');
                } // end if
                return maskedInfo;
            } // end get
        });

        ConnectionInfo.prototype.toString = function(pretty)
        {
            return angular.toJson(this.masked, pretty);
        }; // end ConnectionInfo#toString


        var sqlService = {
            explainOptions: explainOptions,

            ConnectionInfo: ConnectionInfo,

            connect: function(connectionInfo, dbName)
            {
                if(!(connectionInfo instanceof ConnectionInfo))
                {
                    connectionInfo = new ConnectionInfo(connectionInfo);
                } // end if

                var dbNameDisplay = dbName ? ' ' + JSON.stringify(dbName) : '';

                logger.debug('Connecting to database' + dbNameDisplay + '...',
                    connectionInfo.masked, 'sql');

                return promise(function(resolve)
                {
                    resolve(channel.request('connect', connectionInfo));
                })
                .then(function(args)
                {
                    sqlService.connectionInfo = connectionInfo;
                    sqlService.serverSettings = args[0];
                    logger.success('Connected to database' + dbNameDisplay + '.', connectionInfo.masked, 'sql');
                    return true;
                })
                .catch(function(error)
                {
                    logger.error('Error connecting to ' + dbNameDisplay + ':', error, 'sql');
                    throw error;
                });
            }, // end connect

            disconnect: function()
            {
                if(!sqlService.connectionInfo)
                {
                    logger.debug('Not connected; ignoring disconnect().', null, 'sql');
                    return;
                } // end if

                logger.debug('Disconnecting...', sqlService.connectionInfo.masked, 'sql');

                return channel.request('disconnect')
                .then(function()
                {
                    return true;
                })
                .catch(function(error)
                {
                    logger.error('Error attempting to disconnect:', error, 'sql');
                    throw error;
                });
            }, // end disconnect

            run: function(queryDef)
            {
                queryDef.queryID = ++queryID;
                logger.debug('Running query #' + queryDef.queryID + ':', queryDef, 'sql');

                return promise(function(resolve)
                {
                    var self = this;

                    function reEmit(eventName)
                    {
                        return function(qID)//, ...
                        {
                            if(qID == queryDef.queryID)
                            {
                                self.emit.apply(self, [eventName].concat(Array.prototype.slice.call(arguments, 1)));
                            } // end if
                        };
                    } // end reEmit

                    var onFields = reEmit('fields');
                    var onRow = reEmit('row');

                    channel.on('fields', onFields);
                    channel.on('row', onRow);

                    resolve(channel.request('query', queryDef)
                        .finally(function()
                        {
                            channel.removeListener('fields', onFields);
                            channel.removeListener('row', onRow);
                        })
                        .spread(function(response)
                        {
                            logger.success('Query #' + queryDef.queryID + ' finished.', response, 'sql');
                            return response;
                        })
                        .catch(function(error)
                        {
                            var msg = 'Error running query #' + queryDef.queryID + ' statement #' +
                                error.statementNum + ': ';

                            if(typeof error == 'string')
                            {
                                error = { message: error };
                            } // end if

                            error.query = queryDef.queries[error.statementNum - 1];

                            logger.error(msg + error.message, error, 'sql');

                            throw error;
                        })
                    );
                });
            }, // end run

            formatExplain: function(explainOptions, analyze)
            {
                console.log("Explaining query" + (analyze ? " with ANALYZE" : ""));
                console.log("explainOptions:", explainOptions);

                return "EXPLAIN(" +
                    ["ANALYZE " + onOff(analyze)]
                        .concat(
                            Object.keys(explainOptions)
                                .map(function(key)
                                {
                                    var value = explainOptions[key].enabled;

                                    if(key == 'TIMING' && sqlService.serverSettings.server_version_num < 90200)
                                    {
                                        // The 'TIMING' option was first available in PostgreSQL 9.2; drop it.
                                        return undefined;
                                    } // end if

                                    if(!analyze && (key == 'BUFFERS' || key == 'TIMING'))
                                    {
                                        // BUFFERS and TIMING are not valid unless using ANALYZE.
                                        value = false;
                                    } // end if

                                    return key + ' ' + onOff(value);
                                })
                                .filter(function(param) { return param; }),
                            "FORMAT JSON"
                        )
                    .join(', ') +
                    ")\n";
            }, // end formatExplain

            explain: function(queryDef, explainOptions, analyze)
            {
                queryDef.text = sqlService.formatExplain(explainOptions, analyze) + queryDef.text;

                return sqlService.run(queryDef);
            } // end explain
        }; // end sqlService

        eventEmitter.inject({prototype: sqlService});
        sqlService.removeListener = sqlService.off;

        return sqlService;
    }]);

})();
