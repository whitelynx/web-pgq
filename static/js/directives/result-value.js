/* global angular: true */

angular.module('webPGQ.directives')
    .directive('resultValue', ['$filter', '$timeout', '$', 'queueDigest', function($filter, $timeout, $, queueDigest)
    {
        var firstLineRE = /^([^\n]*)\n/;

        var dropdownSettings = { on: 'hover', delay: { show: 10 } };

        function link(scope, element)//, attrs)
        {
            console.log("result-value directive link.");
            scope.editorConfig = angular.extend({ mode: 'json' }, scope.aceConfig || {}, {onLoad: onAceLoad});

            var editor;
            scope.$watch('resultValue', function(value)
            {
                updateFirstLine(value);
            }); // end scope.$watch callback

            scope.$watch('resultFieldType', function()
            {
                updateFirstLine(scope.resultValue);
            }); // end scope.$watch callback

            scope.initMenu = function()
            {
                $('.ui.dropdown', element).dropdown(angular.extend(
                    {
                        onShow: function()
                        {
                            if(editor)
                            {
                                editor.resize();
                            } // end if
                        } // end onShow
                    },
                    dropdownSettings
                ));
            };

            function onAceLoad(_editor)
            {
                editor = _editor;
                console.log("ACE editor loaded:", editor);

                // Options
                var session = editor.getSession();
                session.setTabSize(2);
                session.setUseSoftTabs(true);

                var editorElem = $(editor.renderer.getContainerElement());
                var scrollbars = $('.ace_scrollbar', editorElem)
                    .css('overflow', 'hidden');

                scrollbars.filter('.ace_scrollbar-v')
                    .perfectScrollbar({ includePadding: true, minScrollbarLength: 12, suppressScrollX: true });
                scrollbars.filter('.ace_scrollbar-h')
                    .perfectScrollbar({ includePadding: true, minScrollbarLength: 12, suppressScrollY: true });

                session.on('change', function()
                {
                    scrollbars.perfectScrollbar('update');
                });

                editorElem.hover(
                    function() { scrollbars.addClass('hover'); },
                    function() { scrollbars.removeClass('hover'); }
                );

                queueDigest(function()
                {
                    var value = scope.resultValue;
                    editor.setValue($filter('json')(value));
                    updateFirstLine(value);
                }, 0);

                return { editor: editorElem, scrollbars: scrollbars };
            } // end onAceLoad

            function updateFirstLine(value)
            {
                console.log("result-value~updateFirstLine: value =", value);
                console.log("result-value~updateFirstLine: scope.resultFieldType =", scope.resultFieldType);

                var displayValue = value, firstLine = value;

                switch(scope.resultFieldType)
                {
                    case 'json':
                        element.addClass("hoverable ui dropdown");
                        firstLine = JSON.stringify(value);
                        displayValue = $filter('json')(value);
                        /* falls through */
                    case 'string':
                        var match = firstLineRE.exec(firstLine);
                        if(match)
                        {
                            firstLine = match[1];
                        } // end if

                        if(firstLine.length > 50)
                        {
                            firstLine = firstLine.slice(0, 50) + '\u2026';
                        } // end if

                        if(firstLine != value)
                        {
                            scope.firstLine = firstLine;
                        } // end if
                        break;
                    default:
                        // Nothing.
                } // end switch

                if(editor)
                {
                    editor.setValue(displayValue);
                } // end if
            } // end updateFirstLine
        } // end link

        return {
            scope: {
                resultValue: '=',
                resultFieldType: '=',
                aceConfig: '='
            },
            templateUrl: '/js/directives/result-value.html',
            link: link
        };
    }]);
