/* jshint browser:true, globalstrict:true */
/* global angular:true, console:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('dropdown', ['_', function(_)
    {
        function link(scope, element)//, attrs)
        {
            element.addClass('ui dropdown');

            var options = scope.dropdownOptions ? _.clone(scope.dropdownOptions) : {};

            function updateCallbacks()
            {
                var action = scope.dropdownAction;
                if(action)
                {
                    options.action = function(text, value)
                    {
                        try
                        {
                            action({
                                text: text,
                                value: value,
                                dropdown: {
                                    hide: function() { element.dropdown('hide'); }
                                }
                            });
                        }
                        catch(exc)
                        {
                            console.error("dropdown: action(", text, ",", value, ") threw error:", exc);
                        } // end try
                    };
                } // end if

                element.dropdown(options);
            } // end updateCallbacks

            scope.$watch('dropdownAction', updateCallbacks);

            scope.$watchCollection('dropdownOptions', function()
            {
                options = scope.dropdownOptions ? _.clone(scope.dropdownOptions) : {};
                updateCallbacks();
            });
        } // end link

        return {
            restrict: 'E',
            scope: {
                dropdownOptions: '=',
                dropdownAction: '&'
            },
            link: link
        };
    }]);
