/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('mapView', ['olData', function(olData)
    {
        function link(scope)//, element, attrs)
        {
            function resizeGeometryMap()
            {
                // Update OpenLayers map.
                olData.getMap().then(function(map)
                {
                    map.updateSize();
                });
            } // end resizeGeometryMap

            scope.$on('windowResized', resizeGeometryMap);
            scope.$on('bgSplitter.resizeFinished', resizeGeometryMap);
        } // end link

        return {
            restrict: 'E',
            scope: {
                center: '=',
                layers: '=',
                filter: '='
            },
            link: link,
            templateUrl: '/js/directives/map-view.html'
        };
    }]);
