/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.services')
    .service('graph', ['_', 'dagreD3', function(_, dagreD3)
    {
        var edgeWidthKey, maxEdgeWidthValue;
        var edgeLabelTemplate;
        var lastNodeDefID = 0;
        var graph, topNodeID, lastPlans;

        var minEdgeWidth = 1, maxEdgeWidth = 40;
        var edgeWidthRange = maxEdgeWidth - minEdgeWidth;

        var nodeTypeIcons = [
            'Aggregate',
            'Append',
            'Bitmap Heap Scan',
            'Bitmap Index Scan',
            'Function Scan',
            'Hash Anti Join',
            'Hash Join',
            'Hash Setop Except',
            'Hash Setop Intersect',
            'Hash Setop Unknown',
            'Hash',
            'Index Only Scan',
            'Index Scan',
            'Limit',
            'Materialize',
            'Nested Loop',
            'Result',
            'Seq Scan',
            'Sort',
            'Window Agg'
        ];

        var initPlanRefRE = /\$\d+\b/g;
        var nodeRefRE = /\$\d+\b|\((CTE [^)]+|SubPlan \d+)\)/g;

        function getMaxEdgeWidthValue(plan)
        {
            return Math.max.apply(Math,
                [plan[edgeWidthKey] || 0]
                    .concat(
                        _.map(plan.Plans || [], getMaxEdgeWidthValue)
                    )
            );
        } // end getMaxEdgeWidthValue

        function updateEdge(parent, child, edge)
        {
            edge = edge || {};

            edge.label = edgeLabelTemplate({
                parent: parent,
                child: child,
                edgeWidthKey: edgeWidthKey
            }) || '<UNDEFINED>';

            // Calculate the edge size based on percentage of the maximum value of `edgeWidthKey`.
            var edgePercent = maxEdgeWidthValue ? (child[edgeWidthKey] || 0) / maxEdgeWidthValue : 0;
            var edgeSize = (edgePercent * edgeWidthRange) + minEdgeWidth;

            edge.style = 'stroke-width: ' + edgeSize + 'px';

            return edge;
        } // end updateEdge

        var tmplDisplayRE = /\$\{child\['([^']*)'\]\}/g;
        function tmplDisplayReplacement(match, field)
        {
            return '[' + field + ']';
        } // end tmplDisplayReplacement

        function labelTmpl(tmplString)
        {
            var tmpl = _.template(tmplString);
            tmpl.template = tmplString;
            tmpl.display = tmplString.replace(tmplDisplayRE, tmplDisplayReplacement);
            return tmpl;
        } // end labelTmpl

        // Edge label templates, according to edgeWidthKey.
        var defaultEdgeLabel = _.template("${child[edgeWidthKey]}");
        var edgeLabels = {
            'Startup Cost': labelTmpl("${child['Startup Cost']}..${child['Total Cost']}"),
            'Total Cost': labelTmpl("${child['Startup Cost']}..${child['Total Cost']}"),
            'Actual Startup Time': labelTmpl("${child['Actual Startup Time']}..${child['Actual Total Time']}"),
            'Actual Total Time': labelTmpl("${child['Actual Startup Time']}..${child['Actual Total Time']}"),
        };

        function findReferences(node, key, val)
        {
            var match;
            if(key == 'Subplan Name')
            {
                if((match = initPlanRefRE.exec(val)) !== null)
                {
                    node.refName = match[0];
                }
                else
                {
                    node.refName = val;
                } // end if
            }
            else if(key == 'CTE Name')
            {
                node.references.push({name: 'CTE ' + val, field: key});
            }
            else
            {
                while((match = nodeRefRE.exec(val)) !== null)
                {
                    node.references.push({name: match[1] || match[0], field: key});
                } // end while
            } // end if
        } // end findReferences

        var nodeIDsByRef = {};

        var graphService = {
            nodesFromPlan: function(plan)
            {
                var metadata = {};
                var thisNode = {references: []};
                for(var key in plan)
                {
                    if(key != 'Plans')
                    {
                        var val = plan[key];
                        metadata[key] = val;

                        if(Array.isArray(val))
                        {
                            val.forEach(findReferences.bind(null, thisNode, key));
                        }
                        else
                        {
                            findReferences.call(null, thisNode, key, val);
                        } // end if
                    } // end if
                } // end for

                if(thisNode.references.length > 0)
                {
                    // Defer calculating `References` until later, after we've fully populated nodeIDsByRef.
                    var fullRefs;
                    Object.defineProperty(metadata, 'References', {
                        enumerable: true,
                        get: function()
                        {
                            if(!fullRefs)
                            {
                                fullRefs = thisNode.references.map(function(ref)
                                {
                                    ref.id = nodeIDsByRef[ref.name];
                                    return ref;
                                });
                            } // end if
                            return fullRefs;
                        }
                    });
                } // end if

                var useDef;
                if(nodeTypeIcons.indexOf(plan['Node Type']) != -1)
                {
                    useDef = 'node-def-' + (++lastNodeDefID);
                } // end if

                var thisNodeID = graph.addNode(null, {
                    label: plan['Node Type'] + (plan.Strategy ? ' ' + plan.Strategy : ''),
                    metadata: metadata,
                    useDef: useDef,
                    iconURL: 'icons/' + plan['Node Type'] + '.svg'
                });

                if(thisNode.refName)
                {
                    nodeIDsByRef[thisNode.refName] = thisNodeID;
                } // end if

                _.forEach(plan.Plans || [], function(childPlan, idx)
                {
                    var childInfo = graphService.nodesFromPlan(childPlan);

                    graph.addEdge(null, childInfo.id, thisNodeID,
                        updateEdge(plan, childInfo.planNode, { weight: idx === 0 ? 1 : 0 })
                    );
                });

                return {
                    id: thisNodeID,
                    planNode: _.omit(plan, 'Plans')
                };
            }, // end nodesFromPlan

            fromPlan: function(plans, edgeWidthKey_)
            {
                // Create a new directed graph
                graph = new dagreD3.Digraph();
                graph.marginx = 4;
                graph.marginy = 4;

                if(typeof plans == 'string')
                {
                    // PostgreSQL < 9.2 returns JSON plans as strings.
                    plans = JSON.parse(plans);
                } // end if

                lastPlans = plans;

                edgeWidthKey = edgeWidthKey_;
                edgeLabelTemplate = edgeLabels[edgeWidthKey] || defaultEdgeLabel;
                graph.edgeLabelLegend = edgeLabelTemplate.display;

                maxEdgeWidthValue = Math.max.apply(Math,
                    _.map(plans, function(plan) { return getMaxEdgeWidthValue(plan.Plan); })
                );

                var metadata = {};
                metadata['Maximum ' + edgeWidthKey] = maxEdgeWidthValue;
                topNodeID = graph.addNode(null, { label: 'Total', metadata: metadata });

                plans.forEach(function(plan)
                {
                    var childInfo = graphService.nodesFromPlan(plan.Plan);
                    var childData = graph.node(childInfo.id);

                    // Copy top-level plan metadata to the plan's node metadata.
                    _.forOwn(plan, function(value, key)
                    {
                        if(key != 'Plan' && key[0] != '_')
                        {
                            if(childData.metadata[key])
                            {
                                childData.metadata['Plan ' + key] = value;
                            }
                            else
                            {
                                childData.metadata[key] = value;
                            } // end if
                        } // end if
                    });

                    graph.addEdge(null, childInfo.id, topNodeID,
                        updateEdge({}, childInfo.planNode)
                    );
                });

                return graph;
            }, // end fromPlan

            updateEdges: function(edgeWidthKey_)
            {
                if(!graph)
                {
                    return;
                } // end if

                edgeWidthKey = edgeWidthKey_;
                edgeLabelTemplate = edgeLabels[edgeWidthKey] || defaultEdgeLabel;
                graph.edgeLabelLegend = edgeLabelTemplate.display;

                maxEdgeWidthValue = Math.max.apply(Math,
                    _.map(lastPlans, function(plan) { return getMaxEdgeWidthValue(plan.Plan); })
                );

                graph.node(topNodeID).metadata['Maximum ' + edgeWidthKey] = maxEdgeWidthValue;

                graph.eachEdge(function(id, u, v)
                {
                    var edge = graph.edge(id);

                    updateEdge(graph.node(v).metadata, graph.node(u).metadata, edge);
                });

                return graph;
            }, // end updateEdges
        }; // end graphService

        return graphService;
    }]);
