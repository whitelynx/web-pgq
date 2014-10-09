/* global angular: true, FileReader: true */

angular.module('webPGQ.directives')
    .directive('openFile', function()
    {
        function link(scope, element)//, attrs)
        {
            var input = element.find('input');

            input.click(function(event)
            {
                event.stopPropagation();
            });

            input.change(function()
            {
                var file = this.files[0];
                console.log("Loading file:", file);

                scope.$apply(function() { scope.loading = true; });

                var reader = new FileReader();

                reader.onload = function(ev)
                {
                    scope.$apply(function()
                    {
                        console.log("Loaded file " + file.name + ".");
                        scope.onOpen({file: file, content: ev.target.result});
                        scope.loading = false;
                    });
                }; // end reader.onload

                reader.readAsText(file);
            });

            element.click(function() { input.click(); });
        } // end link

        return {
            restrict: 'E',
            scope: {
                onOpen: '&',
                class: '@'
            },
            replace: true,
            link: link,
            templateUrl: '/js/directives/open-file.html'
        };
    });
