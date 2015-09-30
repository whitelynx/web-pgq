/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

(function()
{
    function link(_, scope, element, attrs)
    {
        function update()
        {
            var popupOpts = _.merge(
                {
                    content: attrs.tooltip,
                    html: attrs.tooltipHtml,
                    title: attrs.tooltipTitle,
                    position: attrs.tooltipPosition,
                    variation: 'small inverted',
                    exclusive: false,
                    delay: {
                        show: 200,
                        hide: 0
                    }
                },
                scope.$eval(attrs.tooltipOptions)
            );

            if(attrs.tooltipHtml && attrs.tooltipTitle)
            {
                // Don't ignore `title` just because `html` was specified.
                popupOpts.html = '<div class="header">' + attrs.tooltipTitle +
                    '</div><div class="content">' + attrs.tooltipHtml + '</div>';
                delete popupOpts.title;
            } // end if

            element.popup(popupOpts);
        } // end update

        element.on('$destroy', function()
        {
            element.popup('destroy');
        });

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
