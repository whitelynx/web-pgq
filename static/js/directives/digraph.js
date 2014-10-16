/* global angular: true */

angular.module('webPGQ.directives')
    .directive('digraph', ['$timeout', '$window', '$', 'd3', 'dagreD3', function($timeout, $window, $, d3, dagreD3)
    {
        function link(scope, element)//, attrs)
        {
            var gElem = d3.select(element.get(0));

            var layout = dagreD3.layout()
                .nodeSep(40)
                .rankSep(40)
                .rankDir("RL");

            var zoom = d3.behavior.zoom();

            var renderer = new dagreD3.Renderer()
                .layout(layout)
                .transition(transition)
                .zoom(function(graph, svg)
                {
                    return zoom.on('zoom', function()
                    {
                        svg.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
                    });
                });

            // Override drawNodes to set up the hover.
            var defaultDrawNodes = renderer.drawNodes();

            var bboxes = {};
            renderer.drawNodes(function(g, svg)
            {
                var nodeElems = defaultDrawNodes(g, svg);

                nodeElems
                    .attr("class", function() { return d3.select(this).attr("class") + " clickable"; })
                    .each(function(u)
                    {
                        bboxes[u] = this.getBBox();

                        var node = g.node(u);
                        var metadata = node.metadata;

                        var popupSettings = {
                            on: 'click',
                            title: node.label,
                            //preserve: true,
                            position: 'top left',
                            html: '<table class="compact smallest definition ui table">' +
                                Object.keys(metadata)
                                    .filter(function(key)
                                    {
                                        return key != 'Output';
                                    })
                                    .map(function(key)
                                    {
                                        var val = metadata[key];
                                        if(typeof val == 'string')
                                        {
                                            val = val.replace(/,/g, ',\n');
                                        } // end if

                                        return '<tr><th>' + key + '</th><td><code>' + val + '</code></td></tr>';
                                    })
                                    .join('') +
                                '</table>',
                            className: {
                                popup: 'query-plan ui popup',
                            },
                        };

                        $(this).popup(popupSettings);
                    });

                addLabels(svg, g, 'Alias', function(u) { d3.select(this).attr("dy", bboxes[u].height); });

                addLabels(svg, g, 'Subplan Name', function(u) { d3.select(this).attr("dy", -bboxes[u].height); });

                function addLabels(root, graph, key, pos)
                {
                    var classname = "label-" + key.replace(/ /g, '-');

                    function getValue(u)
                    {
                        return graph.node(u).metadata[key];
                    } // end getValue

                    var nodes = graph.nodes().filter(function(u)
                    {
                        return !(graph.hasOwnProperty("children") && graph.children(u).length && Boolean(getValue(u)));
                    });

                    var labelElems = root
                        .selectAll("g." + classname)
                        .classed("enter", false)
                        .data(
                            nodes.filter(function(u) { return Boolean(getValue(u)); }),
                            function(u) { return u; }
                        );

                    console.log("labelElems:", labelElems);

                    var marginX = 2, marginY = 2;

                    labelElems
                        .enter()
                            .append("g")
                                .style("opacity", 0)
                                .attr("class", classname + " enter")
                                .attr("transform", transform);

                    labelElems.each(function(u)
                    {
                        var label = d3.select(this);
                        var background = label.append("rect");

                        var textGroup = label.append("g");
                        textGroup.append("text")
                            .append("tspan")
                                .attr("dy", "1em")
                                .attr("x", "1")
                                .text(getValue(u));

                        var labelBBox = textGroup.node().getBBox();
                        textGroup.attr("transform",
                            "translate(" + (-labelBBox.width / 2) + "," + (-labelBBox.height / 2) + ")");

                        var bbox = label.node().getBBox();

                        background
                            //.attr("rx", node.rx ? node.rx : 5)
                            //.attr("ry", node.ry ? node.ry : 5)
                            .attr("x", - (bbox.width / 2 + marginX))
                            .attr("y", - (bbox.height / 2 + marginY))
                            .attr("width", bbox.width + 2 * marginX)
                            .attr("height", bbox.height + 2 * marginY)
                            .attr("opacity", 0.5)
                            .attr("fill", "#fff");

                        label.each(pos);
                    });

                    function transform(u)
                    {
                        var value = graph.node(u);
                        return "translate(" + value.x + "," + value.y + ")";
                    } // end transform

                    //transition(labelElems.filter(".enter"))
                    labelElems.filter(".enter")
                        .style("opacity", 1);

                    //transition(labelElems.exit())
                    labelElems.exit()
                        .style("opacity", 0)
                        .remove();
                } // end addLabels

                return nodeElems;
            });

            var defaultPostRender = renderer.postRender();

            renderer.postRender(function(g, svg)
            {
                defaultPostRender(g, svg);

                svg.selectAll("defs marker")
                    .attr("refX", 5)
                    .attr("markerWidth", 2)
                    .attr("markerHeight", 2);
            });


            var graph, renderedLayout;
            var needsRender = false, needsZoomFit = false;

            function transition(selection)
            {
                return selection.transition().duration(500);
            } // end transition

            //angular.element($window).resize(function() { console.log("Element resized."); scope.$broadcast('Render'); });
            angular.element($window).resize(function() { scope.$broadcast('Render'); });

            scope.$on('ZoomFit', function()
            {
                $timeout(function()
                {
                    if(element.is(":hidden"))
                    {
                        needsZoomFit = true;
                        return;
                    } // end if

                    if(!renderedLayout)
                    {
                        console.log("No graph has been rendered; can't fit to viewport.");
                        return;
                    } // end if

                    // Zoom and scale to fit the graph.
                    var graphWidth = renderedLayout.graph().width;
                    var graphHeight = renderedLayout.graph().height;
                    var width = element.innerWidth();
                    var height = element.innerHeight();

                    var zoomScale = Math.min(width / (graphWidth + 80), height / (graphHeight + 40));
                    var translate = [(width - (graphWidth * zoomScale)) / 2, (height - (graphHeight * zoomScale)) / 2];

                    zoom.translate(translate);
                    zoom.scale(zoomScale);

                    zoom.event(transition(gElem));

                    needsZoomFit = false;
                });
            }); // end 'ZoomFit' handler

            scope.$on('Update', function()
            {
                if(needsRender)
                {
                    scope.$broadcast('Render');
                }
                else if(needsZoomFit)
                {
                    scope.$broadcast('ZoomFit');
                } // end if
            }); // end 'Update' handler

            scope.$on('Render', function()
            {
                try
                {
                    $timeout(function()
                    {
                        if(element.is(":hidden"))
                        {
                            //console.log("Element is hidden; delaying render.");
                            needsRender = true;
                            return;
                        }
                        else if(graph)
                        {
                            console.log("Rendering...");
                            renderedLayout = renderer.run(graph, gElem);

                            needsRender = false;
                            needsZoomFit = true;

                            scope.$broadcast('ZoomFit');
                        }
                        else
                        {
                            console.log("No graph; clearing.");

                            gElem.selectAll("g.edgePaths, g.edgeLabels, g.nodes")
                                .text("");
                        } // end if
                    });
                }
                catch(exc)
                {
                    console.error("Error rendering graph:", exc);
                } // end try
            }); // end 'Render' handler

            scope.$watch('graph', function(value)
            {
                graph = value;
                scope.$broadcast('Render');
            }); // end scope.$watch callback
        } // end link

        return {
            scope: {
                graph: '='
            },
            link: link
        };
    }]);
