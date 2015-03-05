/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('accordion', ['_', function(_)
    {
        function link(scope, element)//, attrs)
        {
            var userOnChange = (scope.accordionOptions || {}).onChange;

            element
                .addClass('ui accordion')
                .accordion(_.defaults(
                    {
                        onChange: function()
                        {
                            scope.$emit('contentResized');

                            if(userOnChange)
                            {
                                return userOnChange.apply(this, arguments);
                            } // end if
                        }
                    },
                    scope.accordionOptions
                ));
        } // end link

        return {
            restrict: 'E',
            scope: {
                accordionOptions: '='
            },
            link: link
        };
    }]);
