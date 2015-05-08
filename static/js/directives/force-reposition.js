/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('forceReposition', ['$timeout', function($timeout)
    {
        //HACK: Force this element to actually resize by making a CSS update.
        function link(scope, element)//, attrs)
        {
            scope.$parent.$on('repositioned', forceReposition);
            scope.$parent.$on('windowResized', forceReposition);
            scope.$parent.$on('bgSplitter.resizeFinished', forceReposition);
            scope.$parent.$on('Render', forceReposition);

            var originalDisplay;
            function forceReposition()
            {
                if(originalDisplay !== undefined)
                {
                    return;
                } // end if

                originalDisplay = element.css('display') || '';

                element.css('display', originalDisplay == 'none' ? '' : 'none');

                $timeout(function()
                {
                    element.css('display', originalDisplay);

                    scope.$broadcast('repositioned');
                    originalDisplay = undefined;
                });
            } // end forceReposition
        } // end link

        return {
            restrict: 'C',
            link: link
        };
    }]);
