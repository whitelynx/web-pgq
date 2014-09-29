/* global $: true, angular: true, d3: true, dagreD3: true */

angular.module('webPGQ.directives')
    .directive('digraph', function($timeout, $window)
    {
        function link(scope, element)//, attrs)
        {
            var gElem = d3.select(element.get(0));
            //var gElem = d3.select(element.get(0)).append("g").attr('transform', 'translate(20,20)');
            //var gElem = d3.select(element.get(0)).append("g").attr('width', '100%').attr('height', '100%');

            var layout = dagreD3.layout()
                .nodeSep(40)
                .rankSep(40)
                .rankDir("RL");

            var zoom = d3.behavior.zoom();

            var renderer = new dagreD3.Renderer()
                .layout(layout)
                .transition(transition)
                .zoom(function (graph, svg)
                {
                    return zoom.on('zoom', function()
                    {
                        svg.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
                    });
                });

            var graph, renderedLayout;
            var needsRender = false, needsZoomFit = false;

            function transition(selection)
            {
                return selection.transition().duration(500);
            } // end transition

            $($window).resize(function() { console.log("Element resized."); scope.$broadcast('Render'); });

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

                    console.log("Graph size, viewport size:", [graphWidth, graphHeight], [width, height]);

                    var zoomScale = Math.min(width / (graphWidth + 80), height / (graphHeight + 40));
                    var translate = [(width - (graphWidth * zoomScale)) / 2, (height - (graphHeight * zoomScale)) / 2];

                    console.log("Zooming to fit graph; translate, zoomScale:", translate, zoomScale);

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
                            console.log("Element is hidden; delaying render.");
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
                            console.log("No graph; not rendering.");
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
    });
