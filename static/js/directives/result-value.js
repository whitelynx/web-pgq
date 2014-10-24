/* global angular: true */

angular.module('webPGQ.directives')
    .directive('resultValue', ['$window', '$', 'queueDigest', function($window, $, queueDigest)
    {
        var firstLineRE = /^([^\n]*)\n/;
        var newlineRE = /\n/g;

        var geomFieldNameRE = /geo|shape|wk[bt]|[gk]ml|svg|x3d/i;

        var maybeJSONRE = /^\s*(?:\{[^]*\}|\[[^]*\]|".*"|\d+(?:\.\d*)?|\.\d+|null)\s*$/;
        var maybeEWKTRE = /^\s*(?:SRID\s*=\s*\d+\s*;\s*)?\w+\s*\([^]*\)\s*$/;
        var maybeXMLRE = /^\s*<[a-z!?][^]*>\s*$/i;

        function link(scope, element)//, attrs)
        {
            scope.editorConfig = angular.extend({}, scope.aceConfig || {}, { onLoad: onAceLoad });

            var editor, needsResize = true;

            var dropdownSettings = {
                on: 'hover',
                delay: { show: 10 },
                transition: 'fade',
                onShow: function()
                {
                    $window.setTimeout(function()
                    {
                        if(editor && needsResize)
                        {
                            editor.resize();
                        } // end if
                    }, 0);
                } // end onShow
            }; // end dropdownSettings

            scope.$watch('resultValue', function(value)
            {
                updateFirstLine(value);
            }); // end scope.$watch callback

            scope.$watch('resultFieldType', function()
            {
                updateFirstLine(scope.resultValue);
            }); // end scope.$watch callback

            scope.$watch('firstLine', function()
            {
                $window.setTimeout(function()
                {
                    element.dropdown(dropdownSettings);
                }, 0);
            });

            function onAceLoad(_editor)
            {
                editor = _editor;
                scope.aceConfig.onLoad(editor);

                queueDigest(function()
                {
                    updateFirstLine(scope.resultValue);
                }, 0);
            } // end onAceLoad

            function updateFirstLine(value)
            {
                var fieldType = scope.resultFieldType, fieldName = scope.resultFieldName;
                var displayValue = value, firstLine = value, editorMode;

                switch(fieldType)
                {
                    case 'json':
                        firstLine = JSON.stringify(value);
                        displayValue = JSON.stringify(value, null, '\t');
                        editorMode = 'json';
                        /* falls through */
                    case 'text':
                        var match = firstLineRE.exec(firstLine);
                        if(match)
                        {
                            firstLine = match[1];
                        } // end if

                        if(firstLine.length > 50)
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
                        editorMode = 'json';
                    }
                    else if(maybeEWKTRE.test(value))
                    {
                        // Looks like [E]WKT...
                        //editorMode = 'ewkt';
                        // But, until we write an EWKT mode for Ace...
                        editorMode = 'text';
                    }
                    else if(maybeXMLRE.test(value))
                    {
                        editorMode = 'xml';
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

                if(firstLine != value)
                {
                    element.addClass("hoverable ui dropdown");
                    scope.firstLine = firstLine;
                } // end if

                if(editor)
                {
                    editor.getSession().setMode('ace/mode/' + (editorMode || 'text'));
                    editor.setValue(displayValue);

                    var newlines = displayValue.match(newlineRE) || { length: 0 };
                    var lineCount = Math.max(newlines.length + 1, 20);
                    needsResize = (scope.lineCount != lineCount);
                    scope.lineCount = lineCount;

                    editor.clearSelection();
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
