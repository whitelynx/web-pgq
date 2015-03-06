/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('saveFile', function()
    {
        function link(scope, element, attrs, ngModel)
        {
            element.addClass("green labeled icon ui button");

            scope.$watch('fileName', function(fileName)
            {
                element.attr('download', fileName);
            });

            element.mouseenter(function()//event)
            {
                element.attr('href', 'data:application/x-sql;charset=utf-8;Content-Disposition:attachment,' +
                    encodeURIComponent(ngModel.$viewValue));
            });
        } // end link

        return {
            restrict: 'A',
            require: '?ngModel',
            scope: {
                fileName: '=saveFile'
            },
            link: link,
            templateUrl: '/js/directives/save-file.html'
        };
    });
