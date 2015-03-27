/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('inspect', ['$sce', '_', 'RecursionHelper', 'detect', function($sce, _, RecursionHelper, detect)
    {
        function hasInspect(value)
        {
            return value && _.isFunction(value.htmlInspect);
        } // end hasInspect

        function htmlInspect(value)
        {
            return $sce.trustAsHtml(value.htmlInspect());
        } // end hasInspect

        function valueType(value)
        {
            if(detect.isArray(value))
            {
                return 'array';
            }
            else if(_.isNumber(value) || _.isString(value) || _.isRegExp(value) ||
                _.isNull(value) || _.isUndefined(value))
            {
                return 'primitive';
            }
            else if(detect.isObject(value))
            {
                return 'object';
            } // end if
        } // end valueType

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
                    scope.hasInspect = hasInspect;
                    scope.htmlInspect = htmlInspect;

                    scope.$watch('value', function(value)
                    {
                        element.toggleClass('multi-line', detect.isMultiLine(value));

                        if(scope.valueType)
                        {
                            element.removeClass(scope.valueType);
                        } // end if
                        scope.valueType = valueType(scope.value);
                        element.addClass(scope.valueType);
                    });
                });
            },
            templateUrl: '/js/directives/inspect.html'
        };
    }]);
