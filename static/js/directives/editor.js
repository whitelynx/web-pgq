/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('editor', ['_', 'queueDigest', function(_, queueDigest)
    {
        var defaultEditorConfig = {
            theme: 'idle_fingers',
            useWrapMode: true,
        }; // end defaultEditorConfig

        function defaultOnLoad(editor)
        {
            /* jshint validthis:true */
            var scope = this;

            var editorElem = angular.element(editor.renderer.getContainerElement());
            var scrollbars = angular.element('.ace_scrollbar', editorElem)
            .css('overflow', 'hidden');

            scrollbars.filter('.ace_scrollbar-v')
            .perfectScrollbar({ suppressScrollX: true, includePadding: true, minScrollbarLength: 12 });
            scrollbars.filter('.ace_scrollbar-h')
            .perfectScrollbar({ suppressScrollY: true, includePadding: true, minScrollbarLength: 12 });

            editorElem.hover(
                function() { scrollbars.addClass('hover'); },
                function() { scrollbars.removeClass('hover'); }
            );

            var session = editor.getSession();

            session.on('change', function()
            {
                scrollbars.perfectScrollbar('update');
            });

            session.setTabSize(scope.options.tabSize);
            session.setUseSoftTabs(scope.options.softTabs);
            scope.$watch('options.tabSize', session.setTabSize.bind(session));
            scope.$watch('options.softTabs', session.setUseSoftTabs.bind(session));

            function onResize()
            {
                editor.resize();
                scrollbars.perfectScrollbar('update');
            } // end onResize

            scope.$on('windowResized', onResize);
            scope.$on('bgSplitter.resizeFinished', onResize);

            var editorInfo = {
                rows: session.getDocument().getLength(),
                pos: editor.getCursorPosition(),
                overwrite: false
            };

            function updateEditorInfo()
            {
                scope.editorInfo = editorInfo;
            } // end updateEditorInfo

            session.on('change', function()
            {
                editorInfo.rows = session.getDocument().getLength();
                queueDigest(updateEditorInfo, 0);
            });
            session.on('changeOverwrite', function()
            {
                editorInfo.overwrite = session.getOverwrite();
                queueDigest(updateEditorInfo, 0);
            });
            session.selection.on('changeCursor', function()
            {
                editorInfo.pos = editor.getCursorPosition();
                queueDigest(updateEditorInfo, 0);
            });

            return { editor: editorElem, scrollbars: scrollbars };
        } // end defaultOnLoad

        function controller($scope)
        {
            $scope.editorConfig = _.defaults({}, $scope.options, defaultEditorConfig);

            if($scope.options.onLoad)
            {
                $scope.editorConfig.onLoad = function(editor)
                {
                    var elements = defaultOnLoad.call($scope, editor);

                    $scope.options.onLoad.call($scope, editor, elements);
                }; // end onLoad
            }
            else
            {
                $scope.editorConfig.onLoad = defaultOnLoad.bind($scope);
            } // end if
        } // end controller

        function link(scope, element, attrs, ngModel)
        {
            if(ngModel)
            {
                ngModel.$render = function()
                {
                    scope.model = ngModel.$viewValue;
                };

                scope.$watch('model', function(value)
                {
                    ngModel.$setViewValue(value, 'default');
                });
            } // end if
        } // end link

        return {
            restrict: 'E',
            require: '?ngModel',
            scope: {
                options: '='
            },
            link: link,
            controller: ['$scope', controller],
            templateUrl: '/js/directives/editor.html'
        };
    }]);
