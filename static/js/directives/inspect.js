/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('inspect', ['RecursionHelper', 'detect', function(RecursionHelper, detect)
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

                return RecursionHelper.compile(element, function(scope)
                {
                    scope.detect = detect;

                    scope.$watch('value', function(value)
                    {
                        element.toggleClass('multi-line', detect.isMultiLine(value));
                    });
                });
            },
            templateUrl: '/js/directives/inspect.html'
        };
    }]);
