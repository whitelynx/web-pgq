/* global angular: true */

angular.module('webPGQ.services')
    .service('socket', ['$window', 'unisocket', function($window, unisocket)
    {
        var loc = $window.location;
        var socket = unisocket.connect(loc.origin + loc.pathname);

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

        return socket;
    }]);
