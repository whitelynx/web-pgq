/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('saveFile', function()
    {
        function link(scope, element)//, attrs)
        {
            element.mouseenter(function()//event)
            {
                element.attr('href', 'data:application/x-sql;charset=utf-8;Content-Disposition:attachment,' +
                    encodeURIComponent(scope.ngModel));
            });
        } // end link

        return {
            restrict: 'E',
            scope: {
                ngModel: '=',
                fileName: '=',
                class: '@'
            },
            replace: true,
            link: link,
            templateUrl: '/js/directives/save-file.html'
        };
    });
