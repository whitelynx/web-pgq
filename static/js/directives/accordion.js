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
                var accordionOpen = scope.accordionOpen || false;
                element
                    .addClass('ui')
                    .accordion(_.defaults(
                        {
                            onOpen: function()
                            {
                                accordionOpen = true;
                                scope.accordionOpen = true;
                                scope.$apply();

                                if((scope.accordionOptions || {}).onOpen)
                                {
                                    return (scope.accordionOptions || {}).onOpen.apply(this, arguments);
                                } // end if
                            },
                            onClose: function()
                            {
                                accordionOpen = false;
                                scope.accordionOpen = false;
                                scope.$apply();

                                if((scope.accordionOptions || {}).onClose)
                                {
                                    return (scope.accordionOptions || {}).onClose.apply(this, arguments);
                                } // end if
                            },
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

                scope.$watch('accordionOpen', function(isOpen)
                {
                    if(accordionOpen != isOpen)
                    {
                        accordionOpen = isOpen;
                        element.accordion(isOpen ? 'open' : 'close', 0);
                    } // end if
                });
            } // end if
        } // end link

        return {
            restrict: 'E',
            scope: {
                accordionOpen: '=?',
                accordionOptions: '='
            },
            link: link
        };
    }]);
