/* jshint browser:true, globalstrict:true */
/* global angular:true, console:true */
"use strict";

(function()
{
    function link(_, scope, element, attrs)
    {
        function update()
        {
            var popupOpts = _.assign(
                {
                    content: attrs.tooltip,
                    html: attrs.tooltipHtml,
                    title: attrs.tooltipTitle,
                    position: attrs.tooltipPosition,
                    variation: 'small inverted'
                },
                scope.$eval(attrs.tooltipOptions)
            );

            console.log("tooltip~update(): element =", element, "; element.popup(", popupOpts, ")");

            element.popup(popupOpts);
        } // end update

        attrs.$observe('tooltip', update);
        attrs.$observe('tooltipHtml', update);
        attrs.$observe('tooltipTitle', update);
        attrs.$observe('tooltipPosition', update);
        attrs.$observe('tooltipOptions', update);
        update();
    } // end link

    angular.module('webPGQ.directives')
        .directive('tooltip', ['_', function(_)
        {
            return {
                restrict: 'A',
                link: link.bind(null, _)
            };
        }])
        .directive('tooltipHtml', ['_', function(_)
        {
            return {
                restrict: 'A',
                link: link.bind(null, _)
            };
        }]);
})();
