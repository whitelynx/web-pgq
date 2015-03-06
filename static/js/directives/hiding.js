/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('hiding', function()
    {
        function link(scope, element)//, attrs)
        {
            element.parent()
                .mousemove(function(event)
                {
                    var bbox = element.offset();
                    bbox.right = bbox.left + element.innerWidth();
                    bbox.bottom = bbox.top + element.innerHeight();

                    if(bbox.left < event.pageX && event.pageX < bbox.right &&
                        bbox.top < event.pageY && event.pageY < bbox.bottom)
                    {
                        element.addClass('hide');
                    }
                    else
                    {
                        element.removeClass('hide');
                    } // end if
                })
                .mouseleave(function()
                {
                    element.removeClass('hide');
                });
        } // end link

        return {
            restrict: 'C',
            link: link
        };
    });
