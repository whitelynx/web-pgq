/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('resultValue', ['$window', '$', '_', 'hljs', 'queueDigest', function($window, $, _, hljs, queueDigest)
    {
        var prettyPrint = true;

        // Number of pixels to subtract from the available space when setting max width/height of the detail popup.
        var sizeAdjustment = 10;

        var defaultPopupSettings = {
            on: 'click',
            //position: 'top center', //FIXME: If we use 'top center', semantic ONLY checks '* center' positions!
            position: 'top left',
            variation: 'inverted',
            className: { popup: 'code ui popup' },
        };

        var firstLineRE = /^([^\n]*)\n/;
        var firstLineMaxLength = 100;

        var geomFieldNameRE = /geo|shape|wk[bt]|[gk]ml|svg|x3d/i;

        var maybeJSONRE = /^\s*(?:\{[^]*\}|\[[^]*\]|".*"|\d+(?:\.\d*)?|\.\d+|null)\s*$/;
        var maybeEWKTRE = /^\s*(?:SRID\s*=\s*\d+\s*;\s*)?\w+\s*\([^]*\)\s*$/;
        var maybeXMLRE = /^\s*<[a-z!?][^]*>\s*$/i;

        function link(scope, element)//, attrs)
        {
            scope.$watch('resultValue', queueDigest.bind(null, updateFirstLine, 10));
            scope.$watch('resultFieldType', queueDigest.bind(null, updateFirstLine, 10));

            element.attr('data-html', '<div class="wrapper"><pre></pre></div>');

            function updateFirstLine()
            {
                var value = scope.resultValue;
                var fieldType = scope.resultFieldType, fieldName = scope.resultFieldName;
                var displayValue = value, prettyDisplayValue = value, firstLine = value, language, prettyPrintable;

                if(value === null)
                {
                    scope.isNull = true;
                    return;
                } // end if

                switch(fieldType)
                {
                    case 'json':
                        firstLine = displayValue = JSON.stringify(value);
                        prettyDisplayValue = JSON.stringify(value, null, scope.indent || '    ');
                        language = 'json';
                        /* falls through */
                    case 'text':
                        var match = firstLineRE.exec(firstLine);
                        if(match)
                        {
                            firstLine = match[1];
                        } // end if

                        if(firstLine && firstLine.length > firstLineMaxLength)
                        {
                            firstLine = firstLine.slice(0, firstLineMaxLength) + '\u2026';
                        } // end if
                        break;
                    default:
                        // Nothing.
                } // end switch

                var looksLikeGeomField = geomFieldNameRE.test(fieldName);
                if(fieldType == 'text')
                {
                    // Try to detect what sort of data may be in this string.
                    if(maybeJSONRE.test(value))
                    {
                        language = 'json';
                        prettyPrintable = true;
                        prettyDisplayValue = JSON.stringify(JSON.parse(value), null, scope.indent || '    ');
                    }
                    else if(maybeEWKTRE.test(value))
                    {
                        // Looks like [E]WKT...
                        //language = 'ewkt';
                        // But, until we write an EWKT mode for Ace...
                        language = 'text';
                    }
                    else if(maybeXMLRE.test(value))
                    {
                        language = 'xml';
                        /*
                        if(looksLikeGeomField)
                        {
                            // This looks like a geometry field; it may be GML, KML, or X3D.
                        } // end if
                        */
                    }
                    else if(looksLikeGeomField)
                    {
                        // This looks like a geometry field, but doesn't look like JSON, [E]WKT, or XML.
                        // It may be HEX[E]WKB, SVG path, GeoHash, lat/lon text, etc.
                    } // end if
                } // end if

                if(firstLine != value && firstLine != scope.firstLine)
                {
                    element.addClass(language || 'text');

                    if(!element.hasClass('clickable'))
                    {
                        element.addClass('clickable');
                        element.popup(_.defaults({
                            onCreate: function()
                            {
                                var $popup = this;
                                var $wrapper = $popup.children('.wrapper');
                                var $contentPre = $wrapper.children('pre');

                                $contentPre.text(prettyPrint ? prettyDisplayValue : displayValue);

                                var offset = element.offset();
                                var windowWidth = $($window).width(), windowHeight = $($window).height();

                                // Calculate and set max-width and max-height for the popup.
                                var maxWidth = Math.max(
                                    offset.left - sizeAdjustment,
                                    windowWidth - offset.left - element.outerWidth() - sizeAdjustment
                                );
                                var maxHeight = Math.max(
                                    offset.top - sizeAdjustment,
                                    windowHeight - offset.top - element.outerHeight() - sizeAdjustment
                                );

                                $wrapper.css({
                                    'max-width': maxWidth,
                                    'max-height': maxHeight
                                });

                                if(prettyPrintable)
                                {
                                    $wrapper.addClass('pretty-printable');

                                    var $ppToggleBtn = $('<a><i class="sort attributes ascending icon"></i></a>')
                                        .addClass('pretty print ui left corner label')
                                        .attr('title', 'Pretty Print')
                                        .click(function()
                                        {
                                            prettyPrint = !prettyPrint;

                                            updatePrettyPrint($wrapper, $contentPre, $ppToggleBtn);
                                        })
                                        .appendTo($popup);

                                    updatePrettyPrint($wrapper, $contentPre, $ppToggleBtn);
                                }
                                else
                                {
                                    // Highlight the content.
                                    $contentPre.each(function() { hljs.highlightBlock(this); });
                                } // end if

                                // Apply perfectScrollbar.
                                $window.setTimeout(function()
                                {
                                    $wrapper.perfectScrollbar({ includePadding: true, minScrollbarLength: 12 });
                                }, 0);
                            } // end onCreate
                        }, defaultPopupSettings));
                    } // end if

                    scope.firstLine = firstLine;
                } // end if

                function updatePrettyPrint($wrapper, $contentPre, $ppToggleBtn)
                {
                    // Remove the old scrollbar so the popup will resize.
                    $wrapper.perfectScrollbar('destroy');

                    // Set the 'Pretty Print' toggle button's color.
                    $ppToggleBtn
                        .removeClass(prettyPrint ? 'black' : 'green')
                        .addClass(prettyPrint ? 'green' : 'black');

                    // Update the text of the content <pre> element.
                    $contentPre.text(prettyPrint ? prettyDisplayValue : displayValue);

                    // Highlight the content.
                    $contentPre.each(function() { hljs.highlightBlock(this); });

                    // Reposition the popup, in case the size changed.
                    element.popup('event resize');

                    // Re-create the scrollbar.
                    $window.setTimeout(function()
                    {
                        $wrapper.perfectScrollbar({ includePadding: true, minScrollbarLength: 12 });
                    }, 0);
                } // end updatePrettyPrint
            } // end updateFirstLine
        } // end link

        return {
            scope: {
                resultValue: '=',
                resultFieldType: '=',
                resultFieldName: '=',
                indent: '='
            },
            templateUrl: '/js/directives/result-value.html',
            link: link
        };
    }]);
