/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

(function()
{
    function link(scope, element, attrs)
    {
        function update()
        {
            element.popup({
                content: attrs.tooltip,
                html: attrs.tooltipHtml,
                title: attrs.tooltipTitle,
                position: attrs.tooltipPosition,
                variation: 'small inverted'
            });
        } // end update

        attrs.$observe('tooltip', update);
        attrs.$observe('tooltipHtml', update);
        attrs.$observe('tooltipTitle', update);
        attrs.$observe('tooltipPosition', update);
        update();
    } // end link

    angular.module('webPGQ.directives')
        .directive('tooltip', function()
        {
            return {
                restrict: 'A',
                link: link
            };
        })
        .directive('tooltipHtml', function()
        {
            return {
                restrict: 'A',
                link: link
            };
        });
})();
