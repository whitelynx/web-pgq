/* global angular: true */

angular.module('webPGQ')
    .controller('MainController', [
        '$scope', '$http', '$timeout', '$location', '$window', '$', 'graph', 'keybinding', 'logger', 'queueDigest', 'sql',
        function($scope, $http, $timeout, $location, $window, $, graph, keybinding, logger, queueDigest, sql)
        {
            var mainEditor;
            $scope.mainEditorConfig = {
                theme: 'idle_fingers',
                mode: 'pgsql',
                useWrapMode: true,
                onLoad: function(_editor)
                {
                    console.log("ACE editor loaded:", _editor);
                    mainEditor = _editor;

                    // Options
                    _editor.setReadOnly(false);

                    var session = _editor.getSession();
                    session.setTabSize(2);
                    session.setUseSoftTabs(true);

                    var scrollbars = $('#editor .ace_scrollbar');

                    scrollbars.css('overflow', 'hidden');

                    scrollbars.filter('.ace_scrollbar-v')
                        .perfectScrollbar({
                            includePadding: true,
                            minScrollbarLength: 12,
                            suppressScrollX: true
                        });
                    scrollbars.filter('.ace_scrollbar-h')
                        .perfectScrollbar({
                            includePadding: true,
                            minScrollbarLength: 12,
                            suppressScrollY: true
                        });

                    $('#editor').hover(
                        function() { scrollbars.addClass('hover'); },
                        function() { scrollbars.removeClass('hover'); }
                    );
                },
                //onChanged: function()//e) { },
                require: ['ace/ext/language_tools'],
                advanced: {
                    enableSnippets: true,
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true
                }
            };

            // Connections //
            //$scope.connections = {};
            $scope.connections = {
                "local": { database: 'shakespeare', host: 'localhost' },
                "pgmapdev1-svr": { database: 'armgis', host: 'pgmapdev1-svr' }
            };
            $scope.currentConnection = null;
            /*
            $scope.connection = {
                user: 'brianc',
                password: 'boom!',
                database: 'test',
                host: 'example.com',
                port: 5313
                //ssl: true
            };
            */

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
                    logger.info("Connected to database " + connectionName + ".");
                    $scope.connecting = false;
                    $scope.connected = true;
                    return true;
                })
                .catch(function(error)
                {
                    logger.error("Error connecting to database: " + error.message, error);
                    $scope.connecting = false;
                    $scope.currentConnection = null;
                    return false;
                });
            };

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
                var activeText = getActiveQueryText();
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
                    })
                };
            } // end getActiveQuery

            // SQL messages //
            $scope.sqlMessages = sql.messages;

            // Options for EXPLAIN and EXPLAIN ANALYZE //
            $scope.explainOptions = sql.explainOptions;
            $scope.explainOptionDescriptions = sql.explainOptionDescriptions;

            // Running queries //
            var maxUpdateDelay = 200;

            var runSQLCallCount = 0;
            function runSQL(queryDef)
            {
                var runSQLCall = ++runSQLCallCount;
                console.log("Starting runSQL call #" + runSQLCall);

                var results = {rows: [], noticeMessages: []};

                function queueUpdate(func)
                {
                    queueDigest(func ? function() { updatePending(); func(); } : updatePending, maxUpdateDelay);
                } // end queueUpdate

                function updatePending()
                {
                    $scope.results = results;
                } // end updatePending

                function onError(error)
                {
                    console.error("runSQL call #" + runSQLCall + ": Query failed with error:", error);

                    if(typeof error == 'string')
                    {
                        logger.error(error);
                    }
                    else
                    {
                        logger.error(error.message, error);
                    } // end if

                    queueDigest(function()
                    {
                        $scope.queryRunning = false;
                        $scope.results = results;

                        $scope.showMessages();

                        if(error.position)
                        {
                            var pos = mainEditor.getSession().getDocument().indexToPosition(error.position);
                            mainEditor.moveCursorToPosition(pos);
                        } // end if
                    }, 0);

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

                function onEnd(args)
                {
                    console.log("runSQL call #" + runSQLCall + ": Done:", args);

                    sql.removeListener('notice', onNotice);
                    queryPromise.removeListener('fields', onFields);
                    queryPromise.removeListener('row', onRow);

                    for(var key in args[0])
                    {
                        if(key != 'rows')
                        {
                            results[key] = args[0][key];
                        } // end if
                    } // end for

                    console.log("runSQL call #" + runSQLCall + ": Complete response:", results);

                    queueDigest(function()
                    {
                        $scope.queryRunning = false;
                        $scope.results = results;
                    }, 0);

                    return results;
                } // end onEnd

                queueDigest(function()
                {
                    $scope.queryRunning = true;
                    $scope.results = results;
                }, 0);

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
                    return mainEditor.getSession().getTextRange(selectionRange);
                }
                else
                {
                    return $scope.queryText;
                } // end if
            } // end getActiveQueryText

            $scope.runQuery = function()
            {
                console.log("$scope.runQuery()", new Error("called from:").stack);

                runSQL(getActiveQuery())
                    .then($scope.showResults);
            }; // end $scope.runQuery

            $scope.explainQuery = function(analyze)
            {
                var query = getActiveQuery();
                query.text = sql.formatExplain($scope.explainOptions, analyze) + query.text;
                runSQL(query)
                    .then(function(results)
                    {
                        console.log("$scope.explainQuery got results:", results);

                        $scope.graph = results ? graph.fromPlan(results.rows[0][0][0].Plan) : null;

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

            // Switching results views //
            $scope.resultsTab = 'Results';

            $scope.showResults = function() { $scope.resultsTab = 'Results'; };
            $scope.showPlan = function() { $scope.resultsTab = 'Query Plan'; };
            $scope.showMessages = function() { $scope.resultsTab = 'Messages'; };

            // Query plan view controls //
            $scope.zoomFit = function() { $scope.$broadcast('ZoomFit'); };
            $scope.reRender = function() { $scope.$broadcast('Render'); };

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

            function updateScrollbars()
            {
                $('#editor .ace_scrollbar').perfectScrollbar('update');
                $('#resultsContainer').perfectScrollbar('update');
                $('#messagesContainer').perfectScrollbar('update');
            } // end updateScrollbars

            // Update scrollbars on resize.
            $($window).resize(updateScrollbars);

            $(function()
            {
                $('#resultsContainer').perfectScrollbar();
                $('#messagesContainer').perfectScrollbar({suppressScrollX: true, includePadding: true});

                // Update scrollbars 1 second after page load.
                $timeout(updateScrollbars, 1000);

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
