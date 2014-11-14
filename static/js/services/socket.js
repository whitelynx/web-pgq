/* global angular: true */
"use strict";

angular.module('webPGQ.services')
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
