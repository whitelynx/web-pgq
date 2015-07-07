/* jshint browser:true, globalstrict:true */
/* global angular:true, console:true */
"use strict";

angular.module('webPGQ.directives')
    .directive('dbBrowser', ['_', 'queueDigest', 'sql', function(_, queueDigest, sql)
    {
        var maxUpdateDelay = 200;

        var defaultSchemaObj = { tables: [], functions: [], views: [] };

        function refreshDBList(scope)
        {
            scope.dbInfo.loading = true;
            if(scope.$root.$$phase === null)
            {
                scope.$apply();
            } // end if

            var queryPromise = sql.run({
                queries: [
                    {
                        text: 'select current_database() as "currentDatabase",' +
                            'current_schema() as "currentSchema",' +
                            'array_agg(current_schemas(false)::text) as "schemaSearchPath",' +
                            'array_agg(current_schemas(true)::text) as "schemaSearchPathWithImplicit"',
                        rowMode: ''
                    },
                    { text: 'select * from pg_catalog.pg_database', rowMode: '' }
                ],
                rollback: true
            });

            function onRow(statementNum, row)
            {
                switch(statementNum)
                {
                    case 1:
                        scope.sessionInfo = row;
                        break;
                    case 2:
                        scope.databases[row.datname] = row;
                        break;
                } // end switch
            } // end onRow

            queryPromise.on('row', onRow);

            return queryPromise
                .then(function()
                {
                    console.log("databases:", scope.databases);
                })
                .catch(function()//error
                {
                    scope.dbInfo.outOfDate = true;
                })
                .finally(function()
                {
                    queryPromise.removeListener('row', onRow);
                    scope.dbInfo.loading = false;
                    if(scope.$root.$$phase === null)
                    {
                        scope.$apply();
                    } // end if
                });
        } // end refreshDBList

        function refreshDBInfo(scope, dbName)
        {
            scope.dbInfo.loading = true;
            if(scope.$root.$$phase === null)
            {
                scope.$apply();
            } // end if

            var db = {schemas: {}};
            var allNewObjects = [];

            var queryPromise = sql.run({
                queries: [
                    { text: 'select * from pg_catalog.pg_tables', rowMode: '' },
                    //{ text: 'select p.*, ns.nspname as schemaname ' +
                    //        'from pg_catalog.pg_proc p ' +
                    //        'left join pg_namespace ns on ns.oid = p.pronamespace', rowMode: '' },
                    //{ text: 'select * from pg_catalog.pg_views', rowMode: '' }
                ],
                rollback: true
            });

            function onRow(statementNum, row)
            {
                var schema = db.schemas[row.schemaname];
                if(!schema)
                {
                    schema = db.schemas[row.schemaname] = _.cloneDeep(defaultSchemaObj);
                } // end if

                switch(statementNum)
                {
                    case 1: // pg_tables
                        row.type = 'table';
                        row.icon = 'table';
                        row.name = row.tablename;
                        row.fullName = dbName + '.' + row.schemaname + '.' + row.name;
                        break;
                    case 2: // pg_proc
                        row.type = 'function';
                        row.icon = 'code';
                        row.name = row.proname;
                        row.fullName = dbName + '.' + row.schemaname + '.' + row.name + '(' + row.proargtypes + ')';
                        break;
                    case 3: // pg_views
                        row.type = 'view';
                        row.icon = 'unhide';
                        row.name = row.viewname;
                        row.fullName = dbName + '.' + row.schemaname + '.' + row.name;
                        break;
                } // end switch

                schema[row.type + 's'].push(row);
                allNewObjects.push(row);
            } // end onRow

            queryPromise.on('row', onRow);

            return queryPromise
                .then(function()//results
                {
                    console.log("Done; db =", db);
                    scope.databases[dbName] = db;
                    scope.allObjects.push.apply(scope.allObjects, allNewObjects);
                    scope.allObjects = _.sortByAll(scope.allObjects.concat(allNewObjects), ['user', 'age']);

                    scope.dbInfo.outOfDate = false;
                })
                .catch(function()//error
                {
                    scope.databases[dbName] = {};
                })
                .finally(function()
                {
                    scope.dbInfo.loading = false;
                    if(scope.$root.$$phase === null)
                    {
                        scope.$apply();
                    } // end if
                });
        } // end refreshDBInfo

        function SkipResult()
        {
            Error.call(this);
        } // end SkipResult
        SkipResult.prototype = _.create(Error.prototype, {
            'constructor': SkipResult
        });

        function rawTermToFilter(rawTerm)
        {
            // Check for leading operators.
            var operator = rawTerm[0];
            var term = rawTerm.slice(1);

            switch(operator)
            {
                case '-':
                    return function(v) { if(_.contains(v, term.slice(1))) { throw new SkipResult(); } };
                case '+':
                    return function(v) { if(!_.contains(v, term.slice(1))) { throw new SkipResult(); } };
                case '^':
                    return function(v) { return (v == term) ? 2 : (_.startsWith(v, term) ? 1 : 0); };
            } // end switch

            // No leading operator recognized; check for trailing operators.
            operator = rawTerm[rawTerm.length - 1];
            term = rawTerm.slice(0, -1);

            switch(operator)
            {
                case '$':
                    return function(v) { return (v == term) ? 2 : (_.endsWith(v, term) ? 1 : 0); };
            } // end switch

            // No operator found; use the entire raw term.
            return function(v) { return (v == rawTerm) ? 2 : (_.contains(v, rawTerm) ? 1 : 0); };
        } // end rawTermToFilter

        function filterSearchResult(searchFilters, object)
        {
            try
            {
                var rank = 0;
                _.forEach(searchFilters, function(filter)
                {
                    rank = rank
                        + filter(object.name)
                        + (filter(object.schemaname) / 3);
                });

                if(rank > 0)
                {
                    Object.defineProperty(object, '__searchRank', { value: rank, writable: true, configurable: true });
                    return true;
                } // end if
            }
            catch(exc)
            {
                if(exc instanceof SkipResult)
                {
                    return false;
                }
                else
                {
                    throw exc;
                } // end if
            } // end try
        } // end filterSearchResult

        return {
            restrict: 'E',
            //scope: {},
            link: function(scope, element)//, attrs, contoller, transclude)
            {
                scope.dbInfo = {
                    disabled: true,
                    loading: false,
                    outOfDate: false,
                    visible: false
                };

                scope.databases = {};
                scope.allObjects = [];
                scope.dbInfoSearch = '';
                scope.dbInfoSearchResults = [];

                element.sidebar({
                    transition: 'overlay',
                    mobileTransition: 'overlay',
                    dimPage: false,
                    onChange: function()
                    {
                        queueDigest(function()
                        {
                            scope.dbInfo.visible = element.sidebar('is visible');
                        }, maxUpdateDelay);
                    }
                });

                scope.$on('dbConnectionChanged', function(ev)
                {
                    console.log("Got `dbConnectionChanged` event:", ev);
                    scope.dbInfo.outOfDate = true;

                    refreshDBList(scope)
                        .then(function()
                        {
                            scope.dbInfo.disabled = false;

                            refreshDBInfo(scope, sql.connectionInfo.database);
                        });
                });

                scope.$on('dbConnectionError', function(ev)
                {
                    console.log("Got `dbConnectionError` event:", ev);
                    scope.dbInfo.disabled = true;
                });

                scope.$watch('dbInfoSearch', _.debounce(function(newValue)//, oldValue)
                {
                    console.log("Watch for `dbInfoSearch` got:", newValue);

                    var oldResults = scope.dbInfoSearchResults;
                    scope.dbInfoSearchResults = [];

                    oldResults.map(function(result)
                    {
                        delete result.__searchRank;
                    });

                    if(newValue.length > 3)
                    {
                        var searchFilters = _.map(newValue.split(), rawTermToFilter);

                        scope.dbInfoSearchResults = _.filter(scope.allObjects, filterSearchResult.bind(null, searchFilters));
                    } // end if
                }, 300));
            },
            templateUrl: '/js/directives/dbBrowser.html'
        };
    }]);
