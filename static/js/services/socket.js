/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.services')
    /*
    .service('socket', ['$window', 'unisocket', function($window, unisocket)
    {
        var loc = $window.location;
        var socket = unisocket.connect(loc.origin + loc.pathname);

        socket.on('connected', function()
        {
            console.log('socket service connected.');
        });

        return socket;
    }]);
    /*/
    .service('socket', ['_', '$http', '$q', '$window', 'logger', function(_, $http, $q, $window, logger)
    {
        var loc = $window.location;
        var url = loc.origin + loc.pathname;

        var eventHandlers = {};
        var responseHandlers = {};
        var lastRequestID = 0;

        var workerFiles = [
            "/js/vendor/unisocket.js",
            "/js/worker/connection.js"
        ];
        var workerPromise = $q.all(workerFiles.map(function(url) { return $http.get(url); }))
            .then(function(files)
            {
                var blobURL = URL.createObjectURL(new Blob(files, { type: 'application/javascript' }));

                var worker = new Worker(blobURL);
                worker.onmessage = function(e)
                {
                    if(e.requestID)
                    {
                        if(!responseHandlers[e.requestID])
                        {
                            logger.error("Got response for request with ID", e.requestID, "but no handler found!");
                        }
                        else
                        {
                            responseHandlers[e.requestID](e);
                        } // end if
                    }
                    else if(e.eventName)
                    {
                        (eventHandlers[e.eventName] || []).forEach(function(handler)
                        {
                            try
                            {
                                handler(e);
                            }
                            catch(exc)
                            {
                                logger.error("Error in handler for", e.eventName, ":", exc.stack || exc.toString());
                            } // try
                        });
                    } // end if
                };

                worker.postMessage({location: url});
                return worker;
            });

        function postMessage()
        {
            var args = arguments;
            workerPromise.then(function(worker)
            {
                worker.postMessage.apply(worker, args);
            });
        } // end postMessage

        function request()
        {
            return $q(function(resolve, reject)
            {
                var requestID = lastRequestID++;
                responseHandlers[requestID] = function(response)
                {
                    delete responseHandlers[requestID];

                    if(response.error)
                    {
                        reject(response.error);
                    }
                    else
                    {
                        resolve(response.result);
                    } // end if
                };
                postMessage.apply(null, arguments);
            });
        } // end request

        return {
            connect: function()
            {
                return request('connect', _.toArray(arguments));
            },
            on: function(eventName, handler)
            {
                eventHandlers[eventName] = eventHandlers[eventName] || [];
                eventHandlers[eventName].push(handler);
            },
            url: url
        };
    }]);
    //*/
