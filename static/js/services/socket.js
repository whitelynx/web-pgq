/* global angular: true */

angular.module('webPGQ.services')
    .service('socket', ['$window', 'promise', function($window)//, promise)
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

        return socket;
    }]);
