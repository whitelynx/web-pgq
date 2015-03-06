/* jshint browser:true, globalstrict:true */
/* global angular:true, console:true, FileReader: true */
"use strict";

angular.module('webPGQ.directives')
    .directive('openFile', function()
    {
        function link(scope, element)//, attrs)
        {
            element.addClass("clickable teal labeled icon ui button");

            var input = element.find('input');

            input.click(function(event)
            {
                event.stopPropagation();
            });

            input.change(function()
            {
                var file = this.files[0];
                console.log("Loading file:", file);

                scope.$apply(function() { element.addClass("loading"); });

                var reader = new FileReader();

                reader.onload = function(ev)
                {
                    scope.$apply(function()
                    {
                        console.log("Loaded file " + file.name + ".");
                        scope.onOpen({file: file, content: ev.target.result});
                        element.removeClass("loading");
                    });
                }; // end reader.onload

                reader.readAsText(file);
            });

            element.click(function() { input.click(); });
        } // end link

        return {
            restrict: 'A',
            scope: {
                onOpen: '&openFile'
            },
            link: link,
            templateUrl: '/js/directives/open-file.html'
        };
    });
