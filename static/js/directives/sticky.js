/* jshint browser:true, globalstrict:true */
/* global angular:true, console:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('sticky', ['$window', function($window)
    {
        function link(scope, element)//, attrs)
        {
            element.sticky({
                context: scope.context,
                scrollContext: scope.scrollContext,
                pushing: scope.pushing
            });

            scope.$on('ResultsTabChanged', function()
            {
                console.log('sticky got TabChanged; refreshing.');
                $window.setTimeout(function()
                {
                    element.sticky('refresh');
                }, 0);
            });
        } // end link

        return {
            restrict: 'E',
            scope: {
                context: '@',
                scrollContext: '@',
                pushing: '='
            },
            link: link
        };
    }]);
