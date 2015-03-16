/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('accordion', ['_', function(_)
    {
        function link(scope, element)//, attrs)
        {
            element.addClass('accordion');

            if(element.parents('.ui.accordion').length === 0)
            {
                element
                    .addClass('ui')
                    .accordion(_.defaults(
                        {
                            onChange: function()
                            {
                                scope.$emit('contentResized');

                                if((scope.accordionOptions || {}).onChange)
                                {
                                    return (scope.accordionOptions || {}).onChange.apply(this, arguments);
                                } // end if
                            }
                        },
                        scope.accordionOptions,
                        { exclusive: false } // By default, allow multiple sibling sections to be open at the same time.
                    ));
            } // end if
        } // end link

        return {
            restrict: 'E',
            scope: {
                accordionOptions: '='
            },
            link: link
        };
    }]);
