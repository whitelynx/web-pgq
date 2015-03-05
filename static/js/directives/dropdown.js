/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('dropdown', function()
    {
        function link(scope, element)//, attrs)
        {
            element
                .addClass('ui dropdown')
                .dropdown(scope.dropdownOptions);
        } // end link

        return {
            restrict: 'E',
            scope: {
                dropdownOptions: '='
            },
            link: link
        };
    });
