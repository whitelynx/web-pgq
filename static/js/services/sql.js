/* global angular: true */

(function()
{

function onOff(value)
{
    return value ? 'on' : 'off';
} // end onOff

function formatExplain(explainOptions, analyze)
{
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
} // end formatExplain

var queryID = 0;


angular.module('webPGQ.services')
    .service('sql', ['$exceptionHandler', 'socket', 'promise', function($exceptionHandler, socket, promise)
    {
        var channel;

        socket.on('connected', function()
        {
            socket.channel('sql')
                .then(function(chan)
                {
                    channel = chan;

                    channel.on('notify', sqlService.emit.bind(sqlService, 'notify'));
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

        function callListener(args, listener)
        {
            try
            {
                listener.apply(this, args);
            }
            catch(exc)
            {
                $exceptionHandler(exc);
            } // end try
        } // end callListener

        function removeListenerFromThis(event, listener)
        {
            var listeners = this[event] = [];

            listeners = listeners.filter(function(l) { return l !== listener; });

            if(listeners.length > 0)
            {
                this[event] = listeners;
            }
            else
            {
                delete this[event];
            } // end if

            return this;
        } // end removeListenerFromThis

        var sqlService = {
            explainOptions: explainOptions,
            messages: messages,

            _onListeners: {__remove: removeListenerFromThis},
            _onceListeners: {__remove: removeListenerFromThis},

            on: function(event, listener)
            {
                var listeners = this._onListeners[event] = this._onListeners[event] || [];
                listeners.push(listener);
                return this;
            }, // end on

            once: function(event, listener)
            {
                var listeners = this._onceListeners[event] = this._onceListeners[event] || [];
                listeners.push(listener);
                return this;
            }, // end once

            removeListener: function(event, listener)
            {
                this._onListeners.__remove(event, listener);
                this._onceListeners.__remove(event, listener);

                return this;
            }, // end removeListener

            emit: function(event)//, ...args)
            {
                var call = callListener.bind(this, arguments);

                (this._onListeners[event] || []).forEach(call);
                (this._onceListeners[event] || []).forEach(call);

                delete this._onceListeners[event];

                return this;
            }, // end once

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

                return promise(function(resolve, reject, notify)
                {
                    function onRow(row)
                    {
                        console.log("Got row; notifying:", row);
                        notify(row);
                    } // end onRow

                    channel.on('row', onRow);

                    resolve(channel.request('query', queryDef)
                        .finally(function()
                        {
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
                        })
                    );
                });
            }, // end run

            explain: function(queryDef, explainOptions, analyze)
            {
                console.log("Explaining query" + (analyze ? " with ANALYZE" : "") + ":", queryDef);
                console.log("explainOptions:", explainOptions);

                queryDef.text = formatExplain(analyze) + queryDef.text;

                return this.run(queryDef);
            } // end explain
        };

        return sqlService;
    }]);

})();
