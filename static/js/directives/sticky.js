/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('sticky', ['$window', '$', function($window, $)
    {
        function link(scope, element)//, attrs)
        {
            var placeholder = $('<div></div>')
                .addClass('sticky-placeholder')
                .width(element.width)
                .height(element.height)
                .insertBefore(element);

            var context = $(scope.context);
            var isFixed = false;

            function makeFixed()
            {
                if(isFixed) { return; }

                var contextOffset = context.offset();
                var elementOffset = element.offset();

                placeholder
                    .width(element.outerWidth())
                    .height(element.outerHeight());

                element
                    .css({
                        top: contextOffset.top,
                        left: elementOffset.left,
                        right: elementOffset.left
                    })
                    .addClass('fixed');

                isFixed = true;
            } // end makeFixed

            function makeStatic()
            {
                if(!isFixed) { return; }

                var placeholderOffset = placeholder.offset();

                element
                    .css({ top: placeholderOffset.top, left: placeholderOffset.left, right: '' })
                    .removeClass('fixed');

                placeholder
                    .height(0);

                isFixed = false;
            } // end makeStatic

            makeStatic();

            scope.$on('ResultsTabChanged', function()
            {
                var wasFixed = isFixed;
                makeStatic();

                if(wasFixed)
                {
                    makeFixed();
                } // end if
            });

            context.scroll(function()
            {
                var contextOffset = context.offset();
                var placeholderOffset = placeholder.offset();

                if(placeholderOffset.top < contextOffset.top)
                {
                    makeFixed();
                }
                else
                {
                    makeStatic();
                } // end if
            });
        } // end link

        return {
            restrict: 'E',
            scope: {
                context: '@',
                scrollContext: '@',
                pushing: '='
            },
            link: link
        };
    }]);
