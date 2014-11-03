/* global angular: true */

angular.module('webPGQ.directives')
    .directive('resultValue', ['$window', '$', 'queueDigest', function($window, $, queueDigest)
    {
        var firstLineRE = /^([^\n]*)\n/;

        var geomFieldNameRE = /geo|shape|wk[bt]|[gk]ml|svg|x3d/i;

        var maybeJSONRE = /^\s*(?:\{[^]*\}|\[[^]*\]|".*"|\d+(?:\.\d*)?|\.\d+|null)\s*$/;
        var maybeEWKTRE = /^\s*(?:SRID\s*=\s*\d+\s*;\s*)?\w+\s*\([^]*\)\s*$/;
        var maybeXMLRE = /^\s*<[a-z!?][^]*>\s*$/i;

        function link(scope, element)//, attrs)
        {
            scope.prettyPrint = true;
            scope.prettyPrintable = false;

            scope.togglePrettyPrint = function()
            {
                scope.prettyPrint = !scope.prettyPrint;
            }; // end scope.togglePrettyPrint

            scope.$watch('resultValue', queueDigest.bind(null, updateFirstLine, 0));
            scope.$watch('resultFieldType', queueDigest.bind(null, updateFirstLine, 0));
            scope.$watch('prettyPrint', queueDigest.bind(null, updateFirstLine, 0));

            function updateFirstLine()
            {
                var value = scope.resultValue;
                var fieldType = scope.resultFieldType, fieldName = scope.resultFieldName;
                var displayValue = value, firstLine = value, language, prettyPrintable;

                switch(fieldType)
                {
                    case 'json':
                        firstLine = JSON.stringify(value);
                        displayValue = JSON.stringify(value, null, scope.prettyPrint ? '\t' : null);
                        language = 'json';
                        /* falls through */
                    case 'text':
                        var match = firstLineRE.exec(firstLine);
                        if(match)
                        {
                            firstLine = match[1];
                        } // end if

                        if(firstLine && firstLine.length > 50)
                        {
                            firstLine = firstLine.slice(0, 50) + '\u2026';
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
                        if(scope.prettyPrint)
                        {
                            displayValue = JSON.stringify(JSON.parse(value), null, '\t');
                        } // end if
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

                scope.prettyPrintable = prettyPrintable;

                if(firstLine != value && firstLine != scope.firstLine)
                {
                    element.addClass(language || 'text');
                    element.addClass('clickable ui dropdown');
                    element.attr('data-content', displayValue);

                    scope.firstLine = firstLine;
                } // end if
            } // end updateFirstLine
        } // end link

        return {
            scope: {
                resultValue: '=',
                resultFieldType: '=',
                resultFieldName: '=',
                aceConfig: '='
            },
            templateUrl: '/js/directives/result-value.html',
            link: link
        };
    }]);
