/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.services')
    .service('graph', ['dagreD3', function(dagreD3)
    {
        var maxTotalCost, lastNodeDefID = 0;

        var nodeTypeIcons = [
            'Aggregate',
            'Append',
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
            nodesFromPlan: function(graph, plan)
            {
                maxTotalCost = Math.max(maxTotalCost, plan['Total Cost']);

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

                (plan.Plans || [])
                    .forEach(function(childPlan, idx)
                    {
                        var childInfo = graphService.nodesFromPlan(graph, childPlan);

                        // Calculate an edge size between 1 and 40 pixels, based on percentage of the max total cost.
                        var edgeSize = (childInfo['Total Cost'] / maxTotalCost * 39) + 1;

                        graph.addEdge(null, childInfo.id, thisNodeID, {
                            label: childInfo['Startup Cost'] + '..' + childInfo['Total Cost'],
                            style: 'stroke-width: ' + edgeSize + 'px',
                            weight: idx === 0 ? 1 : 0
                        });
                    });

                return {
                    id: thisNodeID,
                    'Plan Rows': plan['Plan Rows'],
                    'Plan Width': plan['Plan Width'],
                    'Startup Cost': plan['Startup Cost'],
                    'Total Cost': plan['Total Cost'],
                };
            }, // end nodesFromPlan

            fromPlan: function(plans)
            {
                // Create a new directed graph
                var graph = new dagreD3.Digraph();
                graph.marginx = 4;
                graph.marginy = 4;

                maxTotalCost = 0;

                if(typeof plans == 'string')
                {
                    // PostgreSQL < 9.2 returns JSON plans as strings.
                    plans = JSON.parse(plans);
                } // end if

                plans.forEach(function(plan)
                {
                    graphService.nodesFromPlan(graph, plan.Plan);
                });

                return graph;
            } // end graphFromPlan
        }; // end graphService

        return graphService;
    }]);
