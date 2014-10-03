/* global angular: true */

angular.module('webPGQ.services')
    .service('graph', ['dagreD3', function(dagreD3)
    {
        var maxTotalCost;

        var graphService = {
            nodesFromPlan: function(graph, plan)
            {
                maxTotalCost = Math.max(maxTotalCost, plan['Total Cost']);

                var thisNodeID = graph.addNode(null, {
                    label: plan['Node Type'] + (plan.Strategy ? ' ' + plan.Strategy : ''),
                });

                (plan.Plans || [])
                    .map(function(childPlan)
                    {
                        return graphService.nodesFromPlan(graph, childPlan);
                    })
                    .forEach(function(childInfo)
                    {
                        // Calculate an edge size of between 1 and 40 pixels, based on percentage of the maximum total cost.
                        var edgeSize = (childInfo['Total Cost'] / maxTotalCost * 39) + 1;
                        console.log('Edge size for child ' + childInfo.id + ': ' + edgeSize + 'px');

                        graph.addEdge(null, childInfo.id, thisNodeID, {
                            label: childInfo['Startup Cost'] + '..' + childInfo['Total Cost'],
                            style: 'stroke-width: ' + edgeSize + 'px',
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

            fromPlan: function(plan)
            {
                // Create a new directed graph
                var graph = new dagreD3.Digraph();

                maxTotalCost = 0;

                graphService.nodesFromPlan(graph, plan);

                return graph;
            } // end graphFromPlan
        }; // end graphService

        return graphService;
    }]);
