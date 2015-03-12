/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('scrollable', ['$rootScope', '_', function($rootScope, _)
    {
        function link(scope, element)//, attrs)
        {
            element.perfectScrollbar(_.defaults({}, scope.options, $rootScope.scrollableDefaults));

            scope.$on('windowResized', update);
            scope.$on('bgSplitter.resizeFinished', update);
            scope.$parent.$on('contentResized', update);

            function update(ev)
            {
                element.perfectScrollbar('update');

                if(ev.stopPropagation)
                {
                    ev.stopPropagation();
                } // end if
            } // end update
        } // end link

        return {
            restrict: 'A',
            scope: {
                options: '=scrollable'
            },
            link: link
        };
    }]);
