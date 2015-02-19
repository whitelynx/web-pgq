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
            context.addClass('sticky-container');
            var isFixed = false;

            function makeFixed()
            {
                if(isFixed) { return; }

                var contextOffset = context.offset();
                var elementOffset = element.offset();

                placeholder
                    .css({
                        width: element.outerWidth(),
                        height: element.outerHeight(),
                        'margin-top': element.css('margin-top'),
                        'margin-bottom': element.css('margin-bottom')
                    });

                element
                    .css({
                        top: contextOffset.top,
                        left: elementOffset.left,
                        right: elementOffset.left
                    })
                    .addClass('fixed');

                var stickyFixedElems = context.data('stickyFixedElems') || [];

                if(stickyFixedElems.length > 0)
                {
                    stickyFixedElems[stickyFixedElems.length - 1].css({ opacity: 0 });
                } // end if

                stickyFixedElems.push(element);
                context.data('stickyFixedElems', stickyFixedElems);

                // If we are currently set as the context's stickyOpacityElem, unset it.
                unsetStickyOpacityElem();

                isFixed = true;
            } // end makeFixed

            function makeStatic()
            {
                if(!isFixed) { return; }

                var stickyFixedElems = context.data('stickyFixedElems') || [];

                var thisElemIdx = stickyFixedElems.indexOf(element);
                if(thisElemIdx != -1)
                {
                    stickyFixedElems.splice(thisElemIdx, 1); // Remove this element from the stack.
                    context.data('stickyFixedElems', stickyFixedElems);

                    element.css({ opacity: '' });

                    if(thisElemIdx == stickyFixedElems.length && thisElemIdx > 0)
                    {
                        stickyFixedElems[thisElemIdx - 1].css({ opacity: '' });
                    } // end if
                } // end if

                element
                    .css({ top: 0, left: 0, right: '' })
                    .removeClass('fixed');

                placeholder
                    .css({ height: 0, 'margin-top': 0, 'margin-bottom': 0 });

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

                    element.css({ left: context.scrollLeft() });

                    var stickyFixedElems = context.data('stickyFixedElems') || [];

                    if(stickyFixedElems.length > 0)
                    {
                        var lastStickyFixedElem = stickyFixedElems[stickyFixedElems.length - 1];
                        var stickyElemBottom = contextOffset.top + lastStickyFixedElem.outerHeight();

                        if(placeholderOffset.top < stickyElemBottom)
                        {
                            var opacity = (placeholderOffset.top - contextOffset.top) / lastStickyFixedElem.outerHeight();

                            lastStickyFixedElem.css({ opacity: opacity });

                            context.data('stickyOpacityElem', element);

                            // Don't remove us as the stickyOpacityElem; return instead.
                            return;
                        } // end if
                    } // end if
                } // end if

                // If we are currently set as the context's stickyOpacityElem, unset it. (if we should be the current
                // stickyOpacityElem, we should have returned above)
                unsetStickyOpacityElem();
            });

            // If we are currently set as the context's stickyOpacityElem, unset it and schedule opacity update if needed.
            function unsetStickyOpacityElem()
            {
                var stickyOpacityElem = context.data('stickyOpacityElem');
                if(stickyOpacityElem === element)
                {
                    context.removeData('stickyOpacityElem');

                    if(!context.data('stickyOpacityUpdateScheduled'))
                    {
                        window.requestAnimationFrame(updateFixedElemOpacity);
                        context.data('stickyOpacityUpdateScheduled', true);
                    } // end if
                } // end if
            } // end unsetStickyOpacityElem

            function updateFixedElemOpacity()
            {
                context.removeData('stickyOpacityUpdateScheduled');

                if(!context.data('stickyOpacityElem'))
                {
                    var stickyFixedElems = context.data('stickyFixedElems') || [];
                    stickyFixedElems[stickyFixedElems.length - 1].css({ opacity: 1 });
                } // end if
            } // end updateFixedElemOpacity
        } // end link

        return {
            restrict: 'E',
            scope: {
                context: '@',
                pushing: '='
            },
            link: link
        };
    }]);
