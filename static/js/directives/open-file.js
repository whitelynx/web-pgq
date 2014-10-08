/* global angular: true, FileReader: true */

angular.module('webPGQ.directives')
    .directive('openFile', function()
    {
        function link(scope, element)//, attrs)
        {
            var input = element.find('input');
            var button = element.find('.ui.button');
            console.log("input:", input);
            console.log("button:", button);

            input.change(function()
            {
                var file = this.files[0];
                console.log("Loading file:", file);

                var reader = new FileReader();

                reader.onload = function(ev)
                {
                    scope.$apply(function()
                    {
                        console.log("Loaded file " + file.name + ".");
                        scope.onOpen({file: file, content: ev.target.result});
                    });
                }; // end reader.onload

                reader.readAsText(file);
            });

            button.click(function() { input.click(); });
        } // end link

        return {
            restrict: 'E',
            scope: {
                onOpen: '&'
            },
            link: link,
            templateUrl: '/js/directives/open-file.html'
        };
    });
