/* jshint browser:true, globalstrict:true */
/* global angular:true, console:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('inspect', ['RecursionHelper', function(RecursionHelper)
    {
        return {
            restrict: 'A',
            scope: {
                key: '=inspectKey',
                value: '=inspect'
            },
            compile: function(element)
            {
                element.addClass('inspect');
                console.log("inspect:", element);
                return RecursionHelper.compile(element);
            },
            templateUrl: '/js/directives/inspect.html'
        };
    }]);
