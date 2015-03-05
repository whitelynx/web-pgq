/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('accordion', function()
    {
        function link(scope, element)//, attrs)
        {
            element
                .addClass('ui accordion')
                .accordion(scope.accordionOptions);

        } // end link

        return {
            restrict: 'E',
            scope: {
                accordionOptions: '='
            },
            link: link
        };
    });
