/* global angular: true */

(function()
{

function onOff(value)
{
    return value ? 'on' : 'off';
} // end onOff

var queryID = 0;


angular.module('webPGQ.services')
    .service('sql', ['$exceptionHandler', 'eventEmitter', 'socket', 'promise',
    function($exceptionHandler, eventEmitter, socket, promise)
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
                        console.log("Got notice:", notice);
                        messages.push({
                            type: 'server',
                            text: notice,
                            segmentClass: 'primary'
                        });

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

        var messages = [];

        var sqlService = {
            explainOptions: explainOptions,
            messages: messages,

            connect: function(connectionInfo)
            {
                console.log("Connecting to:", connectionInfo);

                return promise(function(resolve)
                {
                    console.log("Emitting: 'connect',", connectionInfo);
                    resolve(channel.request('connect', connectionInfo));
                })
                .then(function()
                {
                    messages.push({
                        type: 'client',
                        text: "Connected to " + JSON.stringify(connectionInfo, null, '    '),
                        segmentClass: 'tertiary'
                    });
                    return true;
                });
            }, // end connect

            run: function(queryDef)
            {
                queryDef.queryID = queryID;
                console.log("Running query:", queryDef);

                return promise(function(resolve)
                {
                    var onFields = this.emit.bind(this, 'fields');
                    var onRow = this.emit.bind(this, 'row');

                    channel.on('fields', onFields);
                    channel.on('row', onRow);

                    resolve(channel.request('query', queryDef)
                        .finally(function()
                        {
                            channel.removeListener('fields', onFields);
                            channel.removeListener('row', onRow);
                        })
                        .then(function(response)
                        {
                            console.log("Success!", response);
                            return response;
                        })
                        .catch(function(error)
                        {
                            console.error("Error:", error);
                            messages.push({
                                type: 'server',
                                text: JSON.stringify(error, null, '    '),
                                segmentClass: 'primary inverted red'
                            });
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
                    ") ";
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
