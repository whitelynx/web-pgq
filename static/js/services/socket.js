/* global angular: true */

angular.module('webPGQ.services')
    .service('socket', ['$window', 'promise', function($window, promise)
    {
        var socket = $window.unisocket.connect($window.location.href);

        socket.on('connected', function()
        {
            console.log('socket service connected.');

            socket.send('foo');

            socket.request('bar')
            .then(function()
            {
                console.log('got bar response');
            });
        });

        /*
        var originalRequest = socket.request;
        socket.request = function()
        {
            var args = arguments;
            return promise(function(resolve, reject)
            {
                try
                {
                    originalRequest.apply(this, args)
                        .then(function(responseArgs)
                        {
                            var error = responseArgs[0];
                            if(error)
                            {
                                reject(error);
                            }
                            else
                            {
                                resolve(responseArgs.slice(1));
                            } // end if
                        });
                }
                catch(exc)
                {
                    console.error("FIXME: socket.request() threw an exception:", exc);
                    reject(exc);
                } // end try
            });
        }; // end socket.request override
        */

        return socket;
    }]);
