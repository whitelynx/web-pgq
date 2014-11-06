/* global angular: true */

angular.module('webPGQ')
    .controller('MainController', [
        '$scope', '$cookies', '$timeout', '$location', '$window', '$', 'hljs', 'graph', 'keybinding', 'logger', 'queueDigest', 'sql',
        function($scope, $cookies, $timeout, $location, $window, $, hljs, graph, keybinding, logger, queueDigest, sql)
        {
            function applyIfNecessary()
            {
                if($scope.$root.$$phase === null)
                {
                    $scope.$apply();
                } // end if
            } // end applyIfNecessary


            $scope.tabSize = 4;
            $scope.softTabs = true;

            var allEditors = [];

            $scope.$watch('tabSize', function(value)
            {
                allEditors.forEach(function(editor)
                {
                    editor.getSession().setTabSize(value);
                });
            });
            $scope.$watch('softTabs', function(value)
            {
                allEditors.forEach(function(editor)
                {
                    editor.getSession().setUseSoftTabs(value);
                });
            });


            $scope.commonEditorConfig = {
                theme: 'idle_fingers',
                useWrapMode: true,
                onLoad: function(editor)
                {
                    // Options
                    var session = editor.getSession();
                    session.setTabSize($scope.tabSize);
                    session.setUseSoftTabs($scope.softTabs);

                    var editorElem = $(editor.renderer.getContainerElement());
                    var scrollbars = $('.ace_scrollbar', editorElem)
                        .css('overflow', 'hidden');

                    scrollbars.filter('.ace_scrollbar-v')
                        .perfectScrollbar({ suppressScrollX: true, includePadding: true, minScrollbarLength: 12 });
                    scrollbars.filter('.ace_scrollbar-h')
                        .perfectScrollbar({ suppressScrollY: true, includePadding: true, minScrollbarLength: 12 });

                    session.on('change', function()
                    {
                        scrollbars.perfectScrollbar('update');
                    });

                    editorElem.hover(
                        function() { scrollbars.addClass('hover'); },
                        function() { scrollbars.removeClass('hover'); }
                    );

                    allEditors.push(editor);
                    editorElem.on('$destroy', function()
                    {
                        var editorIdx = allEditors.indexOf(editor);
                        allEditors.splice(editorIdx, 1);
                    }); // end '$destroy' handler

                    return { editor: editorElem, scrollbars: scrollbars };
                }
            }; // end $scope.commonEditorConfig

            var mainEditor, mainEditorInfo, mainEditorScrollbars;
            $scope.mainEditorConfig = angular.extend({}, $scope.commonEditorConfig, {
                mode: 'pgsql',
                onLoad: function(editor)
                {
                    mainEditor = editor;
                    var elements = $scope.commonEditorConfig.onLoad(editor);

                    // Options
                    var session = editor.getSession();

                    mainEditorScrollbars = elements.scrollbars;

                    mainEditorInfo = {
                        rows: session.getDocument().getLength(),
                        pos: editor.getCursorPosition(),
                        overwrite: false
                    };

                    session.on('change', function()
                    {
                        mainEditorInfo.rows = session.getDocument().getLength();
                        queueUpdateEditorInfo();
                    });

                    session.on('changeOverwrite', function()
                    {
                        mainEditorInfo.overwrite = session.getOverwrite();
                        queueUpdateEditorInfo();
                    });
                    session.selection.on('changeCursor', function()
                    {
                        mainEditorInfo.pos = editor.getCursorPosition();
                        queueUpdateEditorInfo();
                    });
                },
                require: ['ace/ext/language_tools'],
                advanced: {
                    enableSnippets: true,
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true
                }
            }); // end $scope.mainEditorConfig

            function queueUpdateEditorInfo()
            {
                queueDigest(updateEditorInfo, 0);
            } // end queueUpdateEditorInfo

            function updateEditorInfo()
            {
                $scope.editor = mainEditorInfo;
            } // end updateEditorInfo

            // Connections //
            $scope.connections = JSON.parse($cookies.connections || '{}');
            for(var key in $scope.connections)
            {
                $scope.connections[key] = new sql.ConnectionInfo($scope.connections[key]);
            } // end for

            $scope.$watchCollection('connections', function(value)
            {
                $cookies.connections = JSON.stringify(value);
            });

            $scope.currentConnection = null;

            $scope.editingConnectionIsNew = false;
            $scope.editingConnectionIsValid = true;
            $scope.editingConnectionName = '';
            $scope.editingConnectionNewName = '';
            $scope.editingConnection = new sql.ConnectionInfo();

            var editConnectionDimmer;
            function showEditConnection()
            {
                if(editConnectionDimmer)
                {
                    editConnectionDimmer.dimmer('show');
                } // end if
            } // end showEditConnection

            $scope.addConnection = function()
            {
                $scope.editingConnectionIsNew = true;
                showEditConnection();
            }; // end $scope.addConnection

            $scope.editConnection = function(connectionName, event)
            {
                if(event)
                {
                    event.stopPropagation();
                } // end if

                var connInfo = $scope.connections[connectionName];
                if(!connInfo)
                {
                    logger.error("No connection named:", connectionName);
                    return;
                } // end if

                $scope.editingConnectionIsNew = false;
                $scope.editingConnectionIsValid = true;
                $scope.editingConnectionName = connectionName;
                $scope.editingConnectionNewName = connectionName;
                $scope.editingConnection = new sql.ConnectionInfo(connInfo);
                showEditConnection();
            }; // end $scope.editConnection

            $scope.hideEditConnection = function()
            {
                if(editConnectionDimmer)
                {
                    editConnectionDimmer.dimmer('hide');
                } // end if

                $scope.editConnectionError = undefined;
            }; // end $scope.hideEditConnection

            $scope.saveConnection = function()
            {
                if(!$scope.editingConnectionIsValid)
                {
                    // Don't do anything.
                }
                else if($scope.editingConnectionNewName.length === 0)
                {
                    $scope.editConnectionError = "You must specify a name for the new connection!";
                }
                else
                {
                    if(editConnectionDimmer)
                    {
                        editConnectionDimmer.dimmer('hide');
                    } // end if

                    $scope.editConnectionError = undefined;

                    if($scope.editingConnectionName)
                    {
                        delete $scope.connections[$scope.editingConnectionName];
                    } // end if
                    $scope.connections[$scope.editingConnectionNewName] = $scope.editingConnection;

                    //$scope.editingConnectionIsValid = false;
                    $scope.editingConnectionNewName = '';
                    $scope.editingConnectionName = '';
                    $scope.editingConnection = new sql.ConnectionInfo();
                } // end if

                applyIfNecessary();
            }; // end $scope.saveConnection

            $scope.connect = function(connectionName)
            {
                var connInfo = $scope.connections[connectionName];
                if(!connInfo)
                {
                    logger.error("No connection named:", connectionName);
                    return;
                } // end if

                $scope.connecting = true;
                $scope.connected = false;
                $scope.currentConnection = connectionName;

                return sql.connect(connInfo)
                .then(function()
                {
                    $scope.connecting = false;
                    $scope.connected = true;
                    return true;
                })
                .catch(function()
                {
                    $scope.connecting = false;
                    $scope.currentConnection = null;
                    return false;
                });
            }; // end $scope.connect

            // Queries //
            $scope.queryParams = [];
            $scope.currentFileName = "untitled.sql";

            //$scope.queryText = "SELECT * FROM clu.release LIMIT 10;";
            /*
            $scope.queryText = "SELECT\n\
    db_insureds.bond_id,\n\
    db_insureds.layout_layer_id,\n\
    db_insureds.label_layer_id,\n\
\n\
    GOLayoutPage.rid,\n\
    ST_MakeEnvelope(\n\
        GOLayoutPage.xminwgs84, GOLayoutPage.yminwgs84,\n\
        GOLayoutPage.xmaxwgs84, GOLayoutPage.ymaxwgs84,\n\
        4326\n\
    ) AS pageGeom,\n\
    GOLayoutPage.pageNum,\n\
    GOLayoutPage.pageTitle,\n\
    (\n\
        SELECT dim_county.id\n\
        FROM government.dim_county\n\
        WHERE dim_county.county_code::integer = GOLayoutPage.countyCode\n\
            AND dim_county.state_code::integer = GOLayoutPage.stateCode\n\
        --LIMIT 1\n\
    ) AS countyID,\n\
\n\
    nextval('feature.feature_id_seq') AS feature_id\n\
\n\
FROM db_insureds\n\
    INNER JOIN agrinet_ref.insureds\n\
        ON insureds.bond_id = db_insureds.bond_id\n\
    INNER JOIN db_feature_insured_links\n\
        ON db_feature_insured_links.idInsuredRID = insureds.rid\n\
    INNER JOIN old.GOLayout\n\
        ON GOLayout.goFieldMapRID = db_feature_insured_links.goFieldMapRID\n\
    INNER JOIN old.GOLayoutPage\n\
        ON GOLayoutPage.goLayoutRID = GOLayout.rid\n\
LIMIT 2;";
            //*/
            //*
            $scope.queryText = "SELECT\n\
    work.workID, work.title, work.year,\n\
    character.charName, character.abbrev, character.speechCount,\n\
    count(chapter) AS chapters,\n\
    count(paragraph) AS paragraphs\n\
FROM work\n\
    NATURAL LEFT JOIN chapter\n\
    NATURAL LEFT JOIN paragraph\n\
    NATURAL LEFT JOIN character\n\
GROUP BY\n\
    work.workID, work.title, work.year,\n\
    character.charName, character.abbrev, character.speechCount\n\
LIMIT 2;";
            //*/

            $scope.fileLoaded = function(file, content)
            {
                $scope.queryText = content;
                logger.info("Loaded file " + file.name + ".");
            }; // end $scope.fileLoaded

            $scope.addQueryParam = function()
            {
                console.log("Adding new query param...");
                queueDigest(function()
                {
                    $scope.queryParams.push({value: '', type: 'text'});
                }, maxUpdateDelay)
                .then(function()
                {
                    $timeout(function()
                    {
                        console.log("Query param(s) added, digest done.");
                        $('.ui.dropdown').dropdown();
                        $("#queryParam_" + $scope.queryParams.length).focus();
                    }, 0, false);
                });
            }; // end $scope.addQueryParam

            $scope.removeQueryParam = function(index)
            {
                $scope.queryParams.splice(index, 1);
            }; // end $scope.removeQueryParam

            function getQueryParams()
            {
                return $scope.queryParams.map(function(param)
                {
                    switch(param.type)
                    {
                        case 'integer':
                            return parseInt(param.value, 10);
                        case 'text':
                            return param.value;
                        default:
                            throw new Error("Unrecognized param type " + JSON.stringify(param.type));
                    } // end switch
                });
            } // end getQueryParams

            var queryParamRE = /\$(\d+)/g;
            var commentOrStringRE = /\/\*.*?(?:\n.*?)*?\*\/|--.*$|\$([a-zA-Z_]\w*)?\$.*?\$\1\$|(['"]).*?\2/g;
            function getActiveQuery()
            {
                var activeTextAndStartPos = getActiveQueryText();
                var activeText = activeTextAndStartPos.text, startIndex = activeTextAndStartPos.startIndex;
                var queryParams = getQueryParams();

                var referencedParams = [];

                function processParamsIn(substr)
                {
                    return substr.replace(queryParamRE, function(match, paramIdx)
                    {
                        paramIdx = parseInt(paramIdx, 10);

                        var resultingIdx = referencedParams.indexOf(paramIdx) + 1;
                        if(resultingIdx === 0)
                        {
                            resultingIdx = referencedParams.push(paramIdx);
                        } // end if

                        return '$' + resultingIdx;
                    });
                } // end processParamsIn

                var activeTextParts = [], lastMatchEnd = 0, match;
                while((match = commentOrStringRE.exec(activeText)) !== null)
                {
                    activeTextParts.push(processParamsIn(activeText.slice(lastMatchEnd, match.index)));
                    activeTextParts.push(match[0]);
                    lastMatchEnd = commentOrStringRE.lastIndex;
                } // end while
                activeTextParts.push(processParamsIn(activeText.slice(lastMatchEnd)));

                activeText = activeTextParts.join('');

                return {
                    text: activeText,
                    values: referencedParams.map(function(paramIdx)
                    {
                        return queryParams[paramIdx - 1];
                    }),
                    startIndex: startIndex
                };
            } // end getActiveQuery

            // Options for EXPLAIN and EXPLAIN ANALYZE //
            $scope.explainOptions = sql.explainOptions;
            $scope.explainOptionDescriptions = sql.explainOptionDescriptions;

            // Running queries //
            var maxUpdateDelay = 200;

            var lastRowCount = 0;
            var runSQLCallCount = 0;
            function runSQL(queryDef)
            {
                if($scope.queryRunning)
                {
                    // Ignore calls to runSQL() while another query is running.
                    return;
                } // end if

                var runSQLCall = ++runSQLCallCount;
                console.log("Starting runSQL call #" + runSQLCall);

                var results = {rows: [], noticeMessages: []};

                function queueUpdate(delay)
                {
                    queueDigest(updatePending, delay === undefined ? maxUpdateDelay : delay);
                } // end queueUpdate

                function updatePending()
                {
                    if(results.rows.length != lastRowCount)
                    {
                        $window.setTimeout(updateScrollbars, 0);

                        lastRowCount = results.rows.length;
                    } // end if

                    $scope.results = results;
                } // end updatePending

                function onError(error)
                {
                    console.error("runSQL call #" + runSQLCall + ": Query failed with error:", error);

                    $scope.queryRunning = false;
                    queueUpdate(0);

                    if(error.position)
                    {
                        var pos = mainEditor.getSession().getDocument().indexToPosition(
                            error.position + queryDef.startIndex);

                        mainEditor.moveCursorToPosition(pos);
                    } // end if

                    throw error;
                } // end onError

                function onNotice(noticeMessage)
                {
                    results.noticeMessages.push(noticeMessage);

                    queueUpdate();
                } // end onNotice

                function onFields(fields)
                {
                    results.fields = fields;

                    queueUpdate();
                } // end onFields

                function onRow(row)
                {
                    results.rows.push(row);

                    queueUpdate();
                } // end onRow

                function onEnd(response)
                {
                    console.log("runSQL call #" + runSQLCall + ": Done:", response);

                    sql.removeListener('notice', onNotice);
                    queryPromise.removeListener('fields', onFields);
                    queryPromise.removeListener('row', onRow);

                    for(var key in response)
                    {
                        if(key != 'rows')
                        {
                            results[key] = response[key];
                        } // end if
                    } // end for

                    console.log("runSQL call #" + runSQLCall + ": Complete response:", results);

                    $scope.queryRunning = false;
                    queueUpdate(0);

                    return results;
                } // end onEnd

                $scope.queryRunning = true;
                queueUpdate(0);

                sql.on('notice', onNotice);

                var queryPromise = sql.run(queryDef);

                queryPromise.on('fields', onFields);
                queryPromise.on('row', onRow);

                return queryPromise.then(onEnd, onError);
            } // end runSQL

            function getActiveQueryText()
            {
                var selectionRange = mainEditor.getSelectionRange();
                if(!selectionRange.isEmpty())
                {
                    var session = mainEditor.getSession();
                    return {
                        text: session.getTextRange(selectionRange),
                        startIndex: session.getDocument().positionToIndex(selectionRange.start)
                    };
                }
                else
                {
                    return {
                        text: $scope.queryText,
                        startIndex: 0
                    };
                } // end if
            } // end getActiveQueryText

            $scope.runQuery = function()
            {
                runSQL(getActiveQuery())
                    .then($scope.showResults);
            }; // end $scope.runQuery

            $scope.explainQuery = function(analyze)
            {
                var query = getActiveQuery();
                var explainLine = sql.formatExplain($scope.explainOptions, analyze);
                query.text = explainLine + query.text;
                query.startIndex -= explainLine.length;

                runSQL(query)
                    .then(function(results)
                    {
                        console.log("$scope.explainQuery got results:", results);

                        $scope.graph = results ? graph.fromPlan(results.rows[0][0]) : null;

                        $scope.graphNodes = [];
                        if($scope.graph)
                        {
                            $scope.graphNodes = $scope.graph.nodes()
                                .map(function(id)
                                {
                                    return $scope.graph.node(id);
                                });
                        } // end if
                    })
                    .then($scope.showPlan);
            }; // end $scope.explainQuery

            // Query results //
            $scope.results = {rows: []};

            // Geometry Map //
            $scope.geomMapLayers = {
                openstreetmap: { opacity: 0.9, source: { type: "OSM" } },
                mapbox_geographyclass: { opacity: 0.5, source: { type: 'TileJSON',
                        url: 'http://api.tiles.mapbox.com/v3/mapbox.geography-class.jsonp' } }
            };
            var geomMapExtent = [
                -102.09320068359375,
                33.42456461884056,
                -101.61392211914061,
                33.70777628973998
            ];
            console.log("Calculated center:", {
                lon: (geomMapExtent[2] + geomMapExtent[0]) / 2,
                lat: (geomMapExtent[3] + geomMapExtent[1]) / 2,
                zoom: Math.floor(Math.max(
                    Math.log(360 / (geomMapExtent[2] - geomMapExtent[0])) / Math.LN2,
                    Math.log(360 / (geomMapExtent[3] - geomMapExtent[1])) / Math.LN2
                )) + 1
            });
            $scope.geomMapCenter = {
                lon: -101.85356140136719,
                lat: 33.56617045429027,
                zoom: 4
            };

            // Switching results views //
            $scope.resultsTab = 'Messages';

            $scope.showResults = function() { $scope.resultsTab = 'Results'; };
            $scope.showGeometry = function() { $scope.resultsTab = 'Geometry'; };
            $scope.showPlan = function() { $scope.resultsTab = 'Query Plan'; };
            $scope.showMessages = function() { $scope.resultsTab = 'Messages'; };

            // Query plan view controls //
            $scope.zoomFit = function() { $scope.$broadcast('ZoomFit'); };
            $scope.reRender = function() { $scope.$broadcast('Render'); };

            $scope.isString = function(val) { return typeof val == 'string'; };

            $scope.$watch('resultsTab', function(value)
            {
                // Update the query plan view if necessary whenever it becomes visible.
                if(value == 'Query Plan')
                {
                    $scope.$broadcast('Update');
                } // end if
            }); // end 'resultsTab' watch

            // Logger (also provides banner messages) //
            $scope.logger = logger;

            // URL parameter support //
            var initialURLParams = $location.search();

            // Query text, parameters, etc.
            if(initialURLParams.query) { $scope.queryText = initialURLParams.query; }
            if(initialURLParams.queryParams)
            {
                try
                {
                    $scope.queryParams = JSON.parse(initialURLParams.queryParams);
                }
                catch(exc)
                {
                    logger.error("Couldn't load query parameters from URL!", exc.stack || exc.toString());
                    $scope.queryParams = [];
                } // end try
            }
            if(initialURLParams.fileName) { $scope.currentFileName = initialURLParams.fileName; }

            function getPermalink()
            {
                $location.search({
                    query: $scope.queryText,
                    queryParams: JSON.stringify($scope.queryParams),
                    fileName: $scope.currentFileName,
                    connectionName: $scope.currentConnection
                });
                return $location.absUrl();
            } // end getPermalink

            $('#permalink')
                .popup({
                    on: 'click',
                    position: 'bottom left',
                    transition: 'slide down',
                    html: '<input onclick="this.setSelectionRange(0, this.value.length)">',
                    onCreate: function()
                    {
                        $('input', this).val(getPermalink());
                    }
                });

            // Connection name
            if(initialURLParams.connectionName)
            {
                var connName = initialURLParams.connectionName;

                sql.on('ready', function()
                {
                    $scope.connect(connName);
                });
            } // end if

            var messagesContainer, messagesAtBottom = true;

            logger.on('bannerMessage', function(message)
            {
                if(message.severity == 'error')
                {
                    $scope.showMessages();
                } // end if

                applyIfNecessary();

                $window.setTimeout(function()
                {
                    if(messagesContainer && ($scope.resultsTab != 'Messages' || messagesAtBottom))
                    {
                        messagesContainer.scrollTop(messagesContainer.prop('scrollHeight') -
                            messagesContainer.height());
                    }
                    else
                    {
                        updateScrollbars();
                    } // end if
                }, 0);
            });

            var scrollContainers;
            function updateScrollbars()
            {
                mainEditorScrollbars.perfectScrollbar('update');
                scrollContainers.perfectScrollbar('update');
            } // end updateScrollbars

            // Update scrollbars on resize.
            $($window).resize(updateScrollbars);

            $(function()
            {
                scrollContainers = $('#querySidebar');
                scrollContainers.perfectScrollbar({ suppressScrollX: true, includePadding: true, minScrollbarLength: 12 });

                messagesContainer = $('#messages-dimmer.ui.dimmer > .content');
                messagesContainer.perfectScrollbar({ suppressScrollX: true, includePadding: true, minScrollbarLength: 12 });
                messagesContainer.scroll(function()
                {
                    messagesAtBottom = false;
                    if(messagesContainer.scrollTop() ===
                        (messagesContainer.prop('scrollHeight') - messagesContainer.height()))
                    {
                        messagesAtBottom = true;
                    } // end if
                });

                var resultsContainer = $('#resultsContainer');
                resultsContainer.perfectScrollbar({ minScrollbarLength: 12 });

                scrollContainers = scrollContainers.add(messagesContainer).add(resultsContainer);

                // Update scrollbars 500 milliseconds after page load.
                $window.setTimeout(updateScrollbars, 500);

                editConnectionDimmer = $('#editConnectionDimmer');

                var editConnectionValidationSettings = {
                    inline: true,
                    on: 'blur',
                    rules: {
                        notExistingConnectionName: function(value)
                        {
                            return !$scope.connections[value] || (value == $scope.editingConnectionName);
                        }
                    },
                    //FIXME: These never get called!
                    onSuccess: function()
                    {
                        console.log("Success!");
                        $scope.editingConnectionIsValid = true;
                        applyIfNecessary();
                        return true;
                    },
                    onFailure: function()
                    {
                        console.log("Failure!");
                        $scope.editingConnectionIsValid = false;
                        applyIfNecessary();
                        return false;
                    }
                };
                var editConnectionValidationRules = {
                    connectionName: {
                        identifier: 'connectionName',
                        rules: [
                            { type: 'empty', prompt: 'Please enter a name for the connection' },
                            { type: 'notExistingConnectionName', prompt: 'This connection name is already taken' }
                        ]
                    }
                };
                $('.ui.form', editConnectionDimmer)
                    .form(editConnectionValidationRules, editConnectionValidationSettings);

                $('.ui.hiding.attached.labels')
                    .each(function()
                    {
                        var $this = $(this);
                        $this.parent()
                            .mousemove(function(event)
                            {
                                var bbox = $this.offset();
                                bbox.right = bbox.left + $this.innerWidth();
                                bbox.bottom = bbox.top + $this.innerHeight();

                                if(bbox.left < event.pageX && event.pageX < bbox.right &&
                                    bbox.top < event.pageY && event.pageY < bbox.bottom)
                                {
                                    $this.addClass('hide');
                                }
                                else
                                {
                                    $this.removeClass('hide');
                                } // end if
                            })
                            .mouseleave(function()
                            {
                                $this.removeClass('hide');
                            });
                    });

                // Key bindings //
                function execRun(event)
                {
                    if(!event.shiftKey && !event.metaKey)
                    {
                        $scope.runQuery();
                    } // end if
                } // end execRun

                function execAnalyze(event)
                {
                    if(!event.ctrlKey && !event.metaKey)
                    {
                        $scope.explainQuery(event.shiftKey);
                    } // end if
                } // end execAnalyze

                keybinding.bindKey('F5', {preventDefault: true}, execRun);
                keybinding.bindKey('F7', {preventDefault: true}, execAnalyze);
                keybinding.bindKey('Shift+F7', {preventDefault: true}, execAnalyze);

                // Alternate for "Run" (useful for when the inspector is shown)
                keybinding.bindKey('Alt+R', {preventDefault: true}, execRun);

                // Semantic UI setup //
                $('#settings-button')
                    .popup({
                        inline: true,
                        preserve: true,
                        on: 'click',
                        position: 'bottom left',
                        transition: 'slide down'
                    });

                $('[data-content], [data-html]').popup({ delay: 500 });

                $('.ui.dropdown').dropdown();

                $scope.pageLoaded = true;
            });
        }]);
