/* jshint browser:true, globalstrict:true */
/* global angular:true, console:true */
"use strict";

angular.module('webPGQ')
    .controller('MainController', [
        '$scope', '$cookies', '$timeout', '$location', '$window', '$', 'hljs', '_', 'ol', 'olData', 'olHelpers', 'graph', 'keybinding', 'logger', 'promise', 'queueDigest', 'socket', 'sql',
        function($scope, $cookies, $timeout, $location, $window, $, hljs, _, ol, olData, olHelpers, graph, keybinding, logger, promise, queueDigest, socket, sql)
        {
            function applyIfNecessary()
            {
                if($scope.$root.$$phase === null)
                {
                    $scope.$apply();
                } // end if
            } // end applyIfNecessary


            $scope.connected = false;
            $scope.connecting = true;

            $scope.connectSocket = function()
            {
                if($scope.connected)
                {
                    // Already connected to web-pgq server.
                    return promise.resolve(true);
                } // end if

                return socket.connect(socket.url)
                    .then(function()
                    {
                        return true;
                    })
                    .catch(function(error)
                    {
                        logger.error("Error connecting to web-pgq server!", error, 'connection');
                        throw error;
                    });
            }; // end $scope.connectSocket

            function onSocketConnect()
            {
                $scope.connected = true;
                $scope.connecting = false;

                applyIfNecessary();
                console.log("Socket connected.");
            } // end onSocketConnect
            socket.on('connected', onSocketConnect);
            socket.on('reconnected', function()
            {
                logger.success("Reconnected to web-pgq server.", null, 'connection');
                onSocketConnect();
            });

            socket.on('disconnected', function()
            {
                if($scope.connected)
                {
                    logger.warn("Connection to web-pgq server interrupted!", null, 'connection');
                }
                else
                {
                    console.warn("Unable to reconnect to web-pgq server.");
                } // end if

                $scope.connected = false;
                $scope.dbConnected = false;
                $scope.dbConnecting = false;
                $scope.connecting = socket.reconnect;

                applyIfNecessary();
            });
            socket.on('error', function(error)
            {
                logger.error("Error connecting to web-pgq server!", error, 'connection');
            });

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

                    session.setUseWorker(true);

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

            var currentConnectionInfo;
            $scope.currentConnection = null;

            $scope.editingConnection = {
                isNew: false,
                isValid: true,
                name: '',
                newName: '',
                info: new sql.ConnectionInfo()
            };

            var editConnectionDimmer, removeConnectionModal;

            function showEditConnection()
            {
                if(editConnectionDimmer)
                {
                    editConnectionDimmer.dimmer('show');
                } // end if
            } // end showEditConnection

            $scope.addConnection = function()
            {
                $scope.editingConnection.isNew = true;
                showEditConnection();
            }; // end $scope.addConnection

            $scope.showRemoveConnection = function(connectionName, event)
            {
                if(event)
                {
                    event.stopPropagation();
                } // end if

                $scope.connectionToRemove = connectionName;
                applyIfNecessary();

                $window.setTimeout(function()
                {
                    removeConnectionModal.modal('show');
                }, 0);
            }; // end $scope.removeConnection

            $scope.removeConnection = function(event)
            {
                if(event)
                {
                    event.stopPropagation();
                } // end if

                delete $scope.connections[$scope.connectionToRemove];
                delete $scope.connectionToRemove;
                applyIfNecessary();
            }; // end $scope.removeConnection

            $scope.editConnection = function(connectionName, event)
            {
                if(event)
                {
                    event.stopPropagation();
                } // end if

                var connInfo = $scope.connections[connectionName];
                if(!connInfo)
                {
                    logger.error("No connection named " + JSON.stringify(connectionName) + "!", null, 'connection');
                    return;
                } // end if

                $scope.editingConnection.isNew = false;
                $scope.editingConnection.isValid = true;
                $scope.editingConnection.name = connectionName;
                $scope.editingConnection.newName = connectionName;
                $scope.editingConnection.info = new sql.ConnectionInfo(connInfo);
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
                if(!$scope.editingConnection.isValid)
                {
                    // Don't do anything.
                }
                else if($scope.editingConnection.newName.length === 0)
                {
                    $scope.editConnectionError = "You must specify a name for the new connection!";
                }
                else
                {
                    $scope.hideEditConnection();

                    if($scope.editingConnection.name)
                    {
                        delete $scope.connections[$scope.editingConnection.name];
                    } // end if
                    $scope.connections[$scope.editingConnection.newName] = $scope.editingConnection.info;

                    //$scope.editingConnection.isValid = false;
                    $scope.editingConnection.newName = '';
                    $scope.editingConnection.name = '';
                    $scope.editingConnection.info = new sql.ConnectionInfo();
                } // end if

                applyIfNecessary();
            }; // end $scope.saveConnection

            $scope.connectDB = function(connectionName)
            {
                connectionName = connectionName || $scope.currentConnection;

                var connInfo = $scope.connections[connectionName];
                if(!connInfo)
                {
                    var errMsg = "No connection named " + JSON.stringify(connectionName) + "!";
                    logger.error(errMsg, null, 'connection');
                    return promise.reject(new Error(errMsg));
                } // end if

                if($scope.dbConnected && _.isEqual(currentConnectionInfo, connInfo))
                {
                    logger.debug("Already connected to database " + JSON.stringify(connectionName) +
                        "; ignoring connectDB() call.", connInfo.masked, 'connection');
                    return promise.resolve(true);
                } // end if

                $scope.currentConnection = connectionName;
                currentConnectionInfo = connInfo;

                if(!$scope.connected)
                {
                    // Not yet connected to web-pgq server.
                    return promise(function(resolve)
                    {
                        sql.once('connected', function()
                        {
                            resolve(true);
                        });

                        $scope.connectSocket();
                    });
                }
                else
                {
                    return _connectDB();
                } // end if
            }; // end $scope.connectDB

            function _connectDB()
            {
                if(!$scope.currentConnection)
                {
                    return;
                } // end if

                console.log("(re)Connecting to database:", $scope.currentConnection);

                $scope.dbConnected = false;
                $scope.dbConnecting = true;

                return sql.connect(currentConnectionInfo, $scope.currentConnection)
                    .then(function()
                    {
                        $scope.dbConnected = true;
                        $scope.dbConnecting = false;
                        applyIfNecessary();
                        return true;
                    })
                    .catch(function()
                    {
                        $scope.dbConnected = false;
                        $scope.dbConnecting = false;
                        applyIfNecessary();
                        return false;
                    });
            } // end _connectDB

            sql.on('ready', _connectDB);

            // Queries //
            var defaultFilename = "untitled.sql";
            $scope.query = {
                text: '',
                params: [],
                fileName: defaultFilename
            };

            $scope.newFile = function()
            {
                $scope.query.text = '';
                $scope.query.fileName = defaultFilename;
                applyIfNecessary();
            }; // end $scope.newFile

            $scope.fileLoaded = function(file, content)
            {
                $scope.query.text = content;
                logger.info("Loaded file " + file.name + ".");
                applyIfNecessary();
            }; // end $scope.fileLoaded

            $scope.addQueryParam = function()
            {
                console.log("Adding new query param...");
                queueDigest(function()
                {
                    $scope.query.params.push({value: '', type: 'null'});
                }, maxUpdateDelay)
                .then(function()
                {
                    $timeout(function()
                    {
                        console.log("Query param(s) added, digest done.");
                        $('.ui.dropdown').dropdown();
                        $("#queryParam_" + $scope.query.params.length).focus();
                    }, 0, false);
                });
            }; // end $scope.addQueryParam

            $scope.removeQueryParam = function(index)
            {
                $scope.query.params.splice(index, 1);
            }; // end $scope.removeQueryParam

            $scope.displayQueryParamType = function(type)
            {
                switch(type)
                {
                    case 'integer':
                        return 'integer';
                    case 'text':
                        return 'text';
                    case 'null':
                        return 'NULL';
                    default:
                        return 'UNRECOGNIZED TYPE';
                } // end switch
            }; // end $scope.displayQueryParamType

            function getQueryParams()
            {
                return $scope.query.params.map(function(param)
                {
                    switch(param.type)
                    {
                        case 'integer':
                            return parseInt(param.value, 10);
                        case 'text':
                            return param.value;
                        case 'null':
                            return null;
                        default:
                            throw new Error("Unrecognized param type " + JSON.stringify(param.type));
                    } // end switch
                });
            } // end getQueryParams

            var queryParamRE = /\$(\d+)/g;
            var commentOrStringRE = /\/\*.*?(?:\n.*?)*?\*\/|--.*$|\$([a-zA-Z_]\w*)?\$.*?\$\1\$|(['"]).*?\2/g;
            var statementSeparatorRE = /\w*;+\w*/g;
            var whitespaceOnlyRE = /^\w*$/g;
            function getActiveQueries()
            {
                var activeTextAndStartPos = getActiveQueryText();
                var activeText = activeTextAndStartPos.text, startIndex = activeTextAndStartPos.startIndex;
                var queryParams = getQueryParams();

                var queryTextParts = [], referencedParams = [];

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

                var queries = [];
                var lastStmtEnd = 0, lastMatchEnd = 0, match;

                function pushQuery()
                {
                    // We just reached the end of a statement; add it to the queries array, and clear our buffers.
                    var queryText = queryTextParts.join('');
                    if(whitespaceOnlyRE.test(queryText))
                    {
                        // This query chunk only contains whitespace; skip it.
                        return;
                    } // end if

                    queries.push({
                        text: queryText,
                        values: referencedParams.map(function(paramIdx)
                        {
                            return queryParams[paramIdx - 1];
                        }),
                        startIndex: startIndex
                    });
                    console.log("Just pushed query:", queries[queries.length - 1]);

                    queryTextParts = [];
                    referencedParams = [];
                    startIndex = activeTextAndStartPos.startIndex + lastStmtEnd;
                } // end pushQuery

                function processNextQueryChunk(chunk)
                {
                    chunk = processParamsIn(chunk);

                    var lastStmtSepEnd = 0, stmtSepMatch;
                    while((stmtSepMatch = statementSeparatorRE.exec(chunk)) !== null)
                    {
                        queryTextParts.push(chunk.slice(lastStmtSepEnd, stmtSepMatch.index));

                        // Track the end index of the last statement separator in the current chunk.
                        lastStmtSepEnd = statementSeparatorRE.lastIndex;

                        // Track the end index of the last statement in the current active text.
                        lastStmtEnd = lastMatchEnd + lastStmtSepEnd;

                        // Push the query that we just finished processing.
                        pushQuery();
                    } // end while
                } // end processNextQueryChunk

                while((match = commentOrStringRE.exec(activeText)) !== null)
                {
                    // Process the next chunk of query text.
                    processNextQueryChunk(activeText.slice(lastMatchEnd, match.index));

                    // Just push the comment or string, without processing its contents.
                    queryTextParts.push(match[0]);

                    // Track the end of the last match.
                    lastMatchEnd = commentOrStringRE.lastIndex;
                } // end while

                // Process the last chunk of query text.
                processNextQueryChunk(activeText.slice(lastMatchEnd));
                pushQuery();

                return queries;
            } // end getActiveQueries

            function highlightLastExecuted(isExplain)
            {
                var session = mainEditor.getSession();
                if(lastExecutedMarkerID !== undefined)
                {
                    session.removeMarker(lastExecutedMarkerID);
                } // end if
                lastExecutedMarkerID = undefined;

                var class_ = 'last-executed' + (isExplain ? ' explain' : '');
                lastExecutedMarkerID = session.addMarker(lastExecutedRange, class_, 'last-executed');
            } // end highlightLastExecuted

            // Options for EXPLAIN and EXPLAIN ANALYZE //
            $scope.explainOptions = sql.explainOptions;
            $scope.explainOptionDescriptions = sql.explainOptionDescriptions;

            // Running queries //
            var maxUpdateDelay = 200;

            var lastExecutedRange, lastExecutedMarkerID, errorMarkerID, lastErrorLine;
            var lastRowCount = 0;
            var runSQLCallCount = 0;
            function runSQL(queryDef)
            {
                if($scope.query.running)
                {
                    // Ignore calls to runSQL() while another query is running.
                    return;
                } // end if

                if(lastErrorLine !== undefined)
                {
                    mainEditor.getSession().removeGutterDecoration(lastErrorLine, 'error');
                } // end if
                lastErrorLine = undefined;

                if(errorMarkerID !== undefined)
                {
                    mainEditor.getSession().removeMarker(errorMarkerID);
                } // end if
                errorMarkerID = undefined;

                var runSQLCall = ++runSQLCallCount;
                console.log("Starting runSQL call #" + runSQLCall);

                var resultSets = [];
                var currentResultSet;
                var firstResultRow = true;
                var geoJSONColumns = [];

                function queueUpdate(delay)
                {
                    queueDigest(updatePending, delay === undefined ? maxUpdateDelay : delay);
                } // end queueUpdate

                function updatePending()
                {
                    if(currentResultSet && currentResultSet.rows.length != lastRowCount)
                    {
                        $window.setTimeout(updateScrollbars, 0);

                        lastRowCount = currentResultSet.rows.length;
                    } // end if

                    $scope.resultSets = resultSets;

                    if(firstResultRow && lastRowCount > 0)
                    {
                        firstResultRow = false;
                        scrollResultsToTop();
                    } // end if
                } // end updatePending

                function onError(error)
                {
                    console.error("runSQL call #" + runSQLCall + ": Query failed with error:", error);

                    $scope.query.running = false;
                    queueUpdate(0);

                    if(error.position)
                    {
                        var session = mainEditor.getSession();

                        // Subtract 1 since PostgreSQL reports 1-based positions instead of 0-based.
                        var index = parseInt(error.position, 10) - 1 + queryDef.startIndex;

                        var pos = session.getDocument().indexToPosition(index, 0);

                        mainEditor.moveCursorToPosition(pos);
                        mainEditor.clearSelection();

                        var wordRange = session.getWordRange(pos.row, pos.column);

                        var errorRange = mainEditor.selection.getRange().clone();
                        errorRange.start = pos;
                        errorRange.end = {row: pos.row, column: session.getLine(pos.row).length};

                        session.addGutterDecoration(pos.row, 'error');
                        lastErrorLine = pos.row;

                        errorMarkerID = session.addMarker(wordRange, 'error', 'error', true);

                        $window.setTimeout(function()
                        {
                            mainEditor.focus();
                        }, 0);
                    } // end if

                    throw error;
                } // end onError

                function onNotice(noticeMessage)
                {
                    currentResultSet.noticeMessages.push(noticeMessage);

                    queueUpdate();
                } // end onNotice

                function contains(haystack, needle)
                {
                    return (haystack.indexOf(needle) != -1);
                } // end contains

                function onFields(resultSetNum, fields)
                {
                    console.log("Starting result set", resultSetNum);
                    currentResultSet = {rows: [], noticeMessages: [], num: resultSetNum};
                    resultSets.push(currentResultSet);

                    currentResultSet.fields = fields;

                    console.log("Got fields:", fields);
                    var geomFieldLayerNames = [];
                    fields.forEach(function(field, idx)
                    {
                        var nameContains = contains.bind(this, field.name.toLowerCase());

                        if(field.dataType == 'text' &&
                            (nameContains('geojson') || nameContains('geom') || nameContains('shape')))
                        {
                            var layerColor = getUnusedLayerColor();

                            var initialLayerName = queryDef.queryID + '/' + field.name;
                            var layerName = initialLayerName;
                            var uniquenessCounter = 1;
                            while(geomFieldLayerNames.indexOf(layerName) != -1)
                            {
                                layerName = initialLayerName + '#' + (++uniquenessCounter);
                            } // end while

                            geoJSONColumns.push({
                                source: {
                                    type: 'GeoJSON',
                                    geojson: { object: { type: 'FeatureCollection', features: [] }, projection: 'EPSG:3857' }
                                },

                                index: idx,
                                fieldName: field.name,

                                name: layerName,
                                display: field.name +
                                    (uniquenessCounter > 1 ? ' #' + uniquenessCounter : ''),
                                queryID: queryDef.queryID,

                                color: layerColor,
                                htmlColor: colorArrayAlpha(layerColor, 1),
                                style: {
                                    fill: { color: colorArrayAlpha(layerColor, 0.5) },
                                    stroke: { color: colorArrayAlpha(layerColor, 1), width: 2 }
                                }
                            });
                        } // end if
                    });

                    queueUpdate();
                } // end onFields

                function onRow(resultSetNum, row)
                {
                    currentResultSet.rows.push(row);

                    geoJSONColumns.forEach(function(column)
                    {
                        var val = row[column.index];
                        if(val === null)
                        {
                            return;
                        } // end if

                        var parsed;
                        try
                        {
                            parsed = JSON.parse(val);
                        }
                        catch(exc)
                        {
                            console.error('Got exception while parsing possible GeoJSON value in column "' +
                                column.fieldName + '":', exc);
                        } // end try

                        var feature = parsed.type == 'Feature' ? parsed : { type: 'Feature', geometry: parsed };
                        if(parsed.crs)
                        {
                            feature.crs = parsed.crs;
                            delete parsed.crs;

                            if(feature.crs.type == 'name' && feature.crs.properties && feature.crs.properties.name)
                            {
                                column.source.geojson.defaultProjection = feature.crs.properties.name;
                            } // end if
                        } // end if

                        column.source.geojson.object.features.push(feature);
                    });

                    queueUpdate();
                } // end onRow

                function onEnd(response)
                {
                    console.log("runSQL call #" + runSQLCall + ": Done:", response);

                    sql.removeListener('notice', onNotice);
                    queryPromise.removeListener('fields', onFields);
                    queryPromise.removeListener('row', onRow);

                    resultSets.status = response.status;
                    resultSets.totalTimeMS = response.totalTimeMS;
                    resultSets.totalRows = 0;
                    resultSets.totalRowsAffected = 0;

                    _.forEach(response.queryResults, function(results, idx)
                    {
                        _.assign(resultSets[idx], results);

                        resultSets.totalRows += results.rowCount;
                        resultSets.totalRowsAffected += results.affectedRowCount;
                    });

                    _.assign(resultSets, _.omit(response, 'rows', 'queryResults'));

                    console.log("runSQL call #" + runSQLCall + ": Complete response:", resultSets);

                    removeLayers(currentColumnLayerNames, true);
                    addLayers(geoJSONColumns);

                    currentColumnLayerNames = _.pluck(geoJSONColumns, 'name');
                    console.log("Set currentColumnLayerNames to:", currentColumnLayerNames);
                    console.log("...from geoJSONColumns:", geoJSONColumns);

                    $scope.query.running = false;
                    queueUpdate(0);

                    return resultSets;
                } // end onEnd

                $scope.query.running = true;
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

                lastExecutedRange = selectionRange;
                if(selectionRange.isEmpty())
                {
                    lastExecutedRange = lastExecutedRange.clone();

                    var doc = mainEditor.getSession().getDocument();
                    lastExecutedRange.start = doc.indexToPosition(0, 0);
                    lastExecutedRange.end = doc.indexToPosition(0, doc.getLength());
                } // end if

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
                        text: $scope.query.text,
                        startIndex: 0
                    };
                } // end if
            } // end getActiveQueryText

            $scope.runQuery = function()
            {
                var queries = getActiveQueries();
                highlightLastExecuted();

                runSQL({
                    queries: queries,
                    rollback: false
                })
                    .then($scope.showResults);
            }; // end $scope.runQuery

            $scope.testQuery = function()
            {
                var queries = getActiveQueries();
                highlightLastExecuted();

                runSQL({
                    queries: queries,
                    rollback: true
                })
                    .then($scope.showResults);
            }; // end $scope.testQuery

            var planKeyREs = {
                actual: /^Actual /,
                buffer: /^Shared |^Local /,
                io: /^Temp |^I\/O /,
                planned: /^Plan | Cost$/
            };

            $scope.explainQuery = function(analyze)
            {
                var queries = getActiveQueries();
                highlightLastExecuted(true);

                var explainLine = sql.formatExplain($scope.explainOptions, analyze);

                _.forEach(queries, function(query)
                {
                    query.text = explainLine + query.text;
                    query.startIndex -= explainLine.length;
                });

                runSQL({
                    queries: queries,
                    rollback: true
                })
                    .then(function(results)
                    {
                        console.log("$scope.explainQuery got results:", results);

                        var plans = _.reduce(results, function(accum, resultSet)
                        {
                            var rsPlans = resultSet.rows[0][0];

                            // PostgreSQL < 9.2 returns JSON plans as strings.
                            if(_.isString(rsPlans))
                            {
                                rsPlans = JSON.parse(rsPlans);
                            } // end if

                            return accum.concat(rsPlans);
                        }, []);
                        console.log("$scope.explainQuery: plans =", plans);

                        $scope.planKeys = _.union.apply(_,
                            _.map(plans, function(plan)
                            {
                                return _.filter(_.keys(plan.Plan), function(key)
                                {
                                    return _.isNumber(plan.Plan[key]);
                                });
                            })
                        );

                        // Set the line width key to the previously selected one (or one of the fallbacks) according to
                        // which one appears in $scope.planKeys.
                        var lineWidthKeyFallbacks = [
                            $scope.selectedLineWidthKey,
                            'Actual Total Time',
                            'Total Cost',
                            _.first($scope.planKeys)
                        ];
                        $scope.lineWidthKey = _.find(lineWidthKeyFallbacks, function(key)
                        {
                            return _.contains($scope.planKeys, key);
                        });

                        var keys = {
                            planned: [],
                            actual: [],
                            buffer: [],
                            io: [],
                            ungrouped: []
                        };

                        _.forEach($scope.planKeys, function(key)
                        {
                            if(planKeyREs.actual.test(key)) { keys.actual.push(key); }
                            else if(planKeyREs.buffer.test(key)) { keys.buffer.push(key); }
                            else if(planKeyREs.io.test(key)) { keys.io.push(key); }
                            else if(planKeyREs.planned.test(key)) { keys.planned.push(key); }
                            else { keys.ungrouped.push(key); }
                        });

                        $scope.groupedPlanKeys = keys.ungrouped.concat(
                            _.filter(
                                [
                                    { title: 'Planned', keys: keys.planned },
                                    { title: 'Actual', keys: keys.actual },
                                    { title: 'Buffers', keys: keys.buffer },
                                    { title: 'I/O', keys: keys.io }
                                ],
                                function(group)
                                {
                                    return group.keys.length > 0;
                                }
                            )
                        );

                        $scope.graph = graph.fromPlan(plans, $scope.lineWidthKey);

                        if($scope.graph)
                        {
                            $scope.graphNodes = $scope.graph.nodes()
                                .map(function(id)
                                {
                                    return $scope.graph.node(id);
                                });
                        }
                        else
                        {
                            $scope.graphNodes = [];
                        } // end if
                    })
                    .then($scope.showPlan)
                    .then(applyIfNecessary);
            }; // end $scope.explainQuery

            $scope.contains = _.contains;
            $scope.isString = _.isString;

            var multiLineStringRE = /\n./;
            $scope.isMultiLineString = function(val)
            {
                return _.isString(val) && multiLineStringRE.test(val);
            }; // end $scope.isMultiLineString

            $scope.setLineWidthKey = function(key)
            {
                if(_.isString(key))
                {
                    $scope.selectedLineWidthKey = key;
                    $scope.lineWidthKey = key;
                    $scope.graph = graph.updateEdges($scope.lineWidthKey);
                    $scope.reRender();
                } // end if
            }; // end $scope.setLineWidthKey

            // Query results //
            $scope.resultSets = {rows: []};

            // Geometry Map //
            $scope.defaultLayers = [
                { display: 'OpenStreetMap', source: { type: "OSM" }, active: true },
                { display: 'Stamen Terrain', source: { type: "Stamen", layer: "terrain" } }
            ];
            $scope.availableLayers = [];
            var currentColumnLayerNames = [];

            $window.setTimeout(function()
            {
                olData.getLayers().then(function(layers)
                {
                    $scope.availableLayers = [];
                    layers.forEach(function(layer, index)
                    {
                        if($scope.defaultLayers[index])
                        {
                            extendLayer(layer, $scope.defaultLayers[index]);

                            $scope.availableLayers.push(layer);
                        }
                        else
                        {
                            console.log("Couldn't find default layer definition for layer", index);
                        } // end if
                    });

                    olData.setLayers(layers);

                    applyIfNecessary();
                });
            }, 0);

            function colorArrayAlpha(colorArr, a) { return 'rgba(' + colorArr.concat(a).join(',') + ')'; }

            var layerColors = [
                // The "Dark2" color scheme, from matplotlib (matplotlib license)
                // https://github.com/matplotlib/matplotlib/blob/v1.4.2/lib/matplotlib/_cm.py#L661
                [119, 158, 27],
                [2, 95, 217],
                [179, 112, 117],
                [138, 41, 231],
                [30, 166, 102],
                [2, 171, 230],
                [29, 118, 166],
                [102, 102, 102],

                // The "trove" color scheme, from http://colrd.com/palette/19308/ (CC0 license)
                [81, 87, 74],
                [68, 124, 105],
                [116, 196, 147],
                [142, 140, 109],
                [228, 191, 128],
                [233, 215, 142],
                [226, 151, 93],
                [241, 150, 112],
                [225, 101, 82],
                [201, 74, 83],
                [190, 81, 104],
                [163, 73, 116],
                [153, 55, 103],
                [101, 56, 125],
                [78, 36, 114],
                [145, 99, 182],
                [226, 121, 163],
                [224, 89, 139],
                [124, 159, 176],
                [86, 152, 196],
                [154, 191, 136]
            ];

            function getUnusedLayerColor()
            {
                var usedColors = _.pluck($scope.availableLayers, 'color');
                return _.find(layerColors, function(color)
                {
                    return !_.contains(usedColors, color);
                });
            } // end getUnusedLayerColor

            $scope.eatEvent = function(event, nextFunc)//, args...
            {
                if(nextFunc)
                {
                    nextFunc.apply(this, _.rest(arguments, 2));
                } // end if

                event.stopPropagation();
            }; // end $scope.eatEvent

            $scope.centerMapLayer = function(layer)
            {
                if(layer.hasExtent)
                {
                    olData.getMap().then(function(map)
                    {
                        var source = layer.getSource();
                        var extent = source.getExtent();
                        map.getView().fitExtent(extent, map.getSize());
                    });
                } // end if
            }; // end $scope.centerMapLayer

            $scope.toggleMapLayer = function(layer)
            {
                layer.active = !layer.active;

                console.log("Toggled map layer:", layer);
            }; // end $scope.toggleMapLayer

            function extendLayer(layer, layerDef)
            {
                layer.name = layerDef.name;
                layer.display = layerDef.display;
                layer.color = layerDef.color;
                layer.htmlColor = layerDef.htmlColor;
                layer.queryID = layerDef.queryID;

                Object.defineProperty(layer, 'active', {
                    get: function()
                    {
                        return this.getVisible();
                    },
                    set: function(active)
                    {
                        this.setVisible(active);
                    }
                });

                Object.defineProperty(layer, 'hasExtent', {
                    get: function()
                    {
                        return typeof this.getSource().getExtent == 'function';
                    }
                });

                // Since layers default to visible, we need to hide any that aren't marked as active.
                layer.active = Boolean(layerDef.active);

                layer.getSource().on('change', function()
                {
                    $scope.geometryLoading = false;
                    $scope.geometryError = false;

                    olData.getLayers().then(function(layers)
                    {
                        layers.forEach(function(layer)
                        {
                            switch(layer.getSourceState())
                            {
                                case 'loading': $scope.geometryLoading = true; break;
                                case 'error': $scope.geometryError = true; break;
                            } // end switch
                        });

                        applyIfNecessary();
                    });
                });
            } // end extendLayer

            function addLayers(layerDefs)
            {
                console.log("addLayers: arguments =", arguments);
                olData.getMap().then(function(map)
                {
                    olData.getLayers().then(function(layers)
                    {
                        var mapProjection = layers[_.first(_.keys(layers))].projection;

                        _.forEach(layerDefs, function(layerDef)
                        {
                            var layer = olHelpers.createLayer(layerDef, mapProjection);
                            if(olHelpers.isDefined(layer))
                            {
                                extendLayer(layer, layerDef);

                                layers[layerDef.name] = layer;
                                map.addLayer(layer);
                            } // end if
                        });

                        $scope.availableLayers = _.values(layers);
                        olData.setLayers(layers);

                        console.log("setLayers:", layers);
                        console.log("Set availableLayers to:", $scope.availableLayers);
                        applyIfNecessary();
                    });
                });
            } // end addLayers

            function removeLayers(layerNames, onlyIfHidden)
            {
                console.log("removeLayers: arguments =", arguments);
                olData.getMap().then(function(map)
                {
                    olData.getLayers().then(function(layers)
                    {
                        _.forEach(layerNames, function(layerName)
                        {
                            if(olHelpers.isDefined(layers[layerName]))
                            {
                                if(onlyIfHidden && layers[layerName].getVisible())
                                {
                                    // This layer is currently shown, and `onlyIfHidden` is set; don't remove this one.
                                    return;
                                } // end if

                                map.removeLayer(layers[layerName]);
                                delete layers[layerName];
                            } // end if
                        });

                        $scope.availableLayers = _.values(layers);
                        olData.setLayers(layers);

                        console.log("setLayers:", layers);
                        console.log("Set availableLayers to:", $scope.availableLayers);
                        applyIfNecessary();
                    });
                });
            } // end removeLayers

            $scope.geomMapCenter = { lon: 0, lat: 0, zoom: 2 };

            // Switching results views //
            $scope.resultsTab = 'Messages';

            $scope.showResults = function() { $scope.resultsTab = 'Results'; };
            $scope.showGeometry = function() { $scope.resultsTab = 'Geometry'; };
            $scope.showPlan = function() { $scope.resultsTab = 'Query Plan'; };
            $scope.showMessages = function() { $scope.resultsTab = 'Messages'; };

            // Query plan view controls //
            $scope.zoomFit = function() { $scope.$broadcast('ZoomFit'); };
            $scope.reRender = function() { $scope.$broadcast('Render'); };

            var paramsContainer, resultsContainer, messagesContainer;

            var messagesAtBottom = true, ignoreMessagesContainerScroll = false;

            function scrollResultsToTop()
            {
                $window.setTimeout(function()
                {
                    resultsContainer.scrollTop(0);
                }, 0);
            } // end scrollResultsToTop

            function scrollMessagesToBottom()
            {
                $window.setTimeout(function()
                {
                    messagesContainer.scrollTop(messagesContainer.prop('scrollHeight') - messagesContainer.height());
                    messagesAtBottom = true;
                }, 0);
            } // end scrollMessagesToBottom

            $scope.$watch('resultsTab', function(value, oldValue)
            {
                switch(value)
                {
                    case 'Geometry':
                        if(value != oldValue)
                        {
                            // Update OpenLayers map.
                            olData.getMap().then(function(map)
                            {
                                map.updateSize();
                            });
                        } // end if
                        break;

                    case 'Query Plan':
                        // Update the query plan view if necessary whenever it becomes visible.
                        $scope.$broadcast('Update');
                        break;

                    case 'Messages':
                        if(value != oldValue)
                        {
                            // Scroll to the bottom of the Messages tab.
                            scrollMessagesToBottom();
                        } // end if
                        break;
                } // end switch

                $scope.$broadcast('ResultsTabChanged');
            }); // end 'resultsTab' watch

            // Logger (also provides banner messages) //
            $scope.logger = logger;

            // URL parameter support //
            var initialURLParams = $location.search();

            // Query text, parameters, etc.
            if(initialURLParams.query) { $scope.query.text = initialURLParams.query; }
            if(initialURLParams.queryParams)
            {
                try
                {
                    $scope.query.params = JSON.parse(initialURLParams.queryParams);
                }
                catch(exc)
                {
                    logger.error("Couldn't load query parameters from URL!", exc, 'web');
                    $scope.query.params = [];
                } // end try
            }
            if(initialURLParams.fileName) { $scope.query.fileName = initialURLParams.fileName; }

            var setPermalinkDelay = 500;
            var setPermalinkTimerID;

            function setPermalink()
            {
                console.log("setPermalink() called.");
                setPermalinkTimerID = undefined;
                return $location
                    .search({
                        query: $scope.query.text || null,
                        queryParams: $scope.query.params.length > 0 ? JSON.stringify($scope.query.params) : null,
                        fileName: ($scope.query.fileName != defaultFilename) ? $scope.query.fileName : null,
                        connectionName: $scope.currentConnection || null
                    })
                    .replace();
            } // end setPermalink

            function setPermalinkThrottled()
            {
                if(setPermalinkTimerID)
                {
                    $window.clearTimeout(setPermalinkTimerID);
                } // end if
                setPermalinkTimerID = $window.setTimeout(setPermalink, setPermalinkDelay);
            } // end setPermalinkThrottled

            $scope.$watchCollection('query', setPermalinkThrottled);
            $scope.$watchCollection('query.params', setPermalinkThrottled);
            $scope.$watch('currentConnection', setPermalinkThrottled);

            // Connection name
            if(initialURLParams.connectionName)
            {
                $scope.connectDB(initialURLParams.connectionName);
            } // end if

            logger.on('bannerMessage', function(message)
            {
                if(message.severity == 'error')
                {
                    $scope.showMessages();
                } // end if

                applyIfNecessary();

                ignoreMessagesContainerScroll = true;

                $window.setTimeout(function()
                {
                    $('.ui.accordion').accordion('refresh');

                    if(messagesContainer && $scope.resultsTab == 'Messages' && messagesAtBottom)
                    {
                        scrollMessagesToBottom();
                    }
                    else
                    {
                        updateScrollbars();
                    } // end if

                    ignoreMessagesContainerScroll = false;
                }, 0);
            });

            function updateScrollbars()
            {
                mainEditorScrollbars.perfectScrollbar('update');
                paramsContainer.perfectScrollbar('update');
                resultsContainer.perfectScrollbar('update');
                messagesContainer.perfectScrollbar('update');
            } // end updateScrollbars

            $(function()
            {
                var mainSplitterPos = $('#topPane').height();
                var sidebarSplitterPos = $('#editor').width();
                $($window)
                    // Update scrollbars on resize.
                    .resize(updateScrollbars)
                    // If the position of the splitter has changed, update scrollbars, OpenLayers, Ace, etc.
                    .bind('mouseup', function ()
                    {
                        var curMainSplitterPos = $('#topPane').height();
                        var curSidebarSplitterPos = $('#editor').width();

                        if(curMainSplitterPos != mainSplitterPos)
                        {
                            // Update OpenLayers map.
                            olData.getMap().then(function(map)
                            {
                                map.updateSize();
                            });

                            // Re-render the query plan view. (or queue a re-render for the next time it's shown)
                            $scope.$broadcast('Resize');
                        } // end if

                        if(curMainSplitterPos != mainSplitterPos || curSidebarSplitterPos != sidebarSplitterPos)
                        {
                            // Update any Ace editors.
                            allEditors.forEach(function(editor)
                            {
                                editor.resize();
                            });

                            // Update scrollbars.
                            updateScrollbars();
                        } // end if

                        mainSplitterPos = curMainSplitterPos;
                        sidebarSplitterPos = curSidebarSplitterPos;
                    });

                paramsContainer = $('#paramsSection');
                paramsContainer.perfectScrollbar({ suppressScrollX: true, includePadding: true, minScrollbarLength: 12 });

                messagesContainer = $('#messages-dimmer.ui.dimmer > .content');
                messagesContainer.perfectScrollbar({ suppressScrollX: false, includePadding: true, minScrollbarLength: 12 });
                messagesContainer.scroll(function()
                {
                    if($scope.resultsTab != 'Messages' || !ignoreMessagesContainerScroll)
                    {
                        messagesAtBottom = false;
                        if(messagesContainer.scrollTop() >=
                            (messagesContainer.prop('scrollHeight') - messagesContainer.height()))
                        {
                            messagesAtBottom = true;
                        } // end if
                    } // end if
                });

                resultsContainer = $('#resultsContainer');
                resultsContainer.perfectScrollbar({ includePadding: false, minScrollbarLength: 12 });

                // Update scrollbars 500 milliseconds after page load.
                $window.setTimeout(updateScrollbars, 500);

                editConnectionDimmer = $('#editConnectionDimmer');
                removeConnectionModal = $('#removeConnectionModal');
                removeConnectionModal.modal({closable: false});

                var editConnectionValidationSettings = {
                    inline: true,
                    on: 'blur',
                    rules: {
                        notExistingConnectionName: function(value)
                        {
                            return !$scope.connections[value] || (value == $scope.editingConnection.name);
                        }
                    },
                    //FIXME: These never get called!
                    onSuccess: function()
                    {
                        console.log("Success!");
                        $scope.editingConnection.isValid = true;
                        applyIfNecessary();
                        return true;
                    },
                    onFailure: function()
                    {
                        console.log("Failure!");
                        $scope.editingConnection.isValid = false;
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

                function execTest(event)
                {
                    if(!event.ctrlKey && !event.metaKey)
                    {
                        $scope.testQuery();
                    } // end if
                } // end execTest

                function execAnalyze(event)
                {
                    if(!event.ctrlKey && !event.metaKey)
                    {
                        $scope.explainQuery(event.shiftKey);
                    } // end if
                } // end execAnalyze

                keybinding.bindKey('F5', {preventDefault: true}, execRun);
                keybinding.bindKey('Shift+F5', {preventDefault: true}, execTest);
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

                $('#layers-button').dropdown();

                $('[data-content], [data-html]').popup({ delay: 500 });

                $('.ui.dropdown').dropdown();

                $('.ui.accordion').accordion();

                $timeout(function()
                {
                    $scope.pageLoaded = true;
                });
            });
        }]);
