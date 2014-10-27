/* global angular: true */

(function()
{

function onOff(value)
{
    return value ? 'on' : 'off';
} // end onOff

var queryID = 0;


angular.module('webPGQ.services')
    .service('sql', ['$exceptionHandler', 'eventEmitter', 'socket', 'logger', 'promise',
    function($exceptionHandler, eventEmitter, socket, logger, promise)
    {
        var channel;

        socket.on('connected', function()
        {
            socket.channel('sql')
                .then(function(chan)
                {
                    channel = chan;

                    channel.on('notice', function(notice)
                    {
                        logger.info('Notice:', notice, 'sql');

                        sqlService.emit.apply(sqlService, ['notice'].concat(Array.slice.call(arguments)));
                    });

                    sqlService.emit('ready');
                });
        });

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

        var sqlService = {
            explainOptions: explainOptions,

            connect: function(connectionInfo)
            {
                logger.debug('Connecting...', connectionInfo, 'sql');

                return promise(function(resolve)
                {
                    resolve(channel.request('connect', connectionInfo));
                })
                .then(function()
                {
                    logger.success('Connected to database.', connectionInfo, 'sql');
                    return true;
                })
                .catch(function(error)
                {
                    logger.error('Error connecting to ' + angular.toJson(connectionInfo) + ':', error, 'sql');
                    throw error;
                });
            }, // end connect

            run: function(queryDef)
            {
                queryDef.queryID = ++queryID;
                logger.debug('Running query #' + queryDef.queryID + ':', queryDef, 'sql');

                return promise(function(resolve)
                {
                    var onFields = this.emit.bind(this, 'fields');

                    var self = this;
                    function onRow(qID, row)
                    {
                        if(qID == queryDef.queryID)
                        {
                            self.emit('row', row);
                        } // end if
                    } // end onRow

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
                            var msg = 'Error running query #' + queryDef.queryID + ': ';
                            if(typeof error == 'string')
                            {
                                logger.error(msg + error, {}, 'sql');
                            }
                            else
                            {
                                logger.error(msg + error.message, error, 'sql');
                            } // end if

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

                                    if(!analyze && (key == 'BUFFERS' || key == 'TIMING'))
                                    {
                                        // BUFFERS and TIMING are not valid unless using ANALYZE.
                                        value = false;
                                    } // end if

                                    return key + ' ' + onOff(value);
                                }),
                            "FORMAT JSON"
                        )
                    .join(', ') +
                    ")\n";
            }, // end formatExplain

            explain: function(queryDef, explainOptions, analyze)
            {
                queryDef.text = this.formatExplain(explainOptions, analyze) + queryDef.text;

                return this.run(queryDef);
            } // end explain
        };

        eventEmitter.inject({prototype: sqlService});
        sqlService.removeListener = sqlService.off;

        return sqlService;
    }]);

})();
