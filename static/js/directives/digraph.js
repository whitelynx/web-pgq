/* global angular: true */

angular.module('webPGQ.directives')
    .directive('digraph', ['$timeout', '$window', '$', 'd3', 'dagreD3', function($timeout, $window, $, d3, dagreD3)
    {
        var firstLineRE = /^([^\n]*)\n/;

        var openGroupRE = /[({\[]/g;
        var closeGroupRE = /[)}\]]/g;

        function count(needle, haystack)
        {
            var matches = haystack.match(needle);
            return matches ? matches.length : 0;
        } // end count

        function nesting(preceeding)
        {
            console.log("nesting(" + JSON.stringify(preceeding) + ") ->",
                count(openGroupRE, preceeding) - count(closeGroupRE, preceeding));
            console.log("count(openGroupRE, preceeding):", count(openGroupRE, preceeding));
            console.log("count(closeGroupRE, preceeding):", count(closeGroupRE, preceeding));
            return count(openGroupRE, preceeding) - count(closeGroupRE, preceeding);
        } // end nesting

        function indent(levels)
        {
            var chunks = [];

            for(var i = 0; i < levels; i++)
            {
                chunks.push('  ');
            } // end for

            return chunks.join('');
        } // end indent

        function link(scope, element)//, attrs)
        {
            var gElem = d3.select(element.get(0));

            var layout = dagreD3.layout()
                .nodeSep(50)
                .rankSep(50)
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

            var bboxes = {};

            // Override drawNodes to set up popups and node labels.
            var defaultDrawNodes = renderer.drawNodes();
            renderer.drawNodes(function(g, svg)
            {
                renderer._labelElems = renderer._labelElems || {};
                renderer._labelTransforms = renderer._labelTransforms || {};

                var nodeElems = defaultDrawNodes(g, svg);

                nodeElems
                    .classed('clickable', true)
                    .each(function(u)
                    {
                        bboxes[u] = this.getBBox();

                        var node = g.node(u);
                        var metadata = node.metadata;

                        var nestedDropdownSettings = {
                            on: 'hover',
                            delay: { show: 10 },
                        };

                        var popupSettings = {
                            on: 'click',
                            title: node.label,
                            //preserve: true,
                            position: 'top left',
                            html: '<table class="compact smallest definition ui table">' +
                                Object.keys(metadata)
                                    .filter(function(key)
                                    {
                                        return key != 'References';
                                    })
                                    .map(function(key)
                                    {
                                        var val = metadata[key];
                                        var firstLine, full;

                                        if(Array.isArray(val))
                                        {
                                            switch(val.length)
                                            {
                                                case 0:
                                                    firstLine = '[]';
                                                    break;
                                                case 1:
                                                    firstLine = '[ ' + val[0] + ' ]';
                                                    break;
                                                default:
                                                    firstLine = '[ ' + val[0] + ',';
                                                    full = '[ ' + val.join(',\n  ') + ' ]';
                                            } // end switch
                                        }
                                        else if(typeof val == 'object')
                                        {
                                            firstLine = JSON.stringify(val, null, '  ');
                                        }
                                        else if(typeof val == 'string')
                                        {
                                            // Split on strings first, and don't replace commas inside strings.
                                            var curIndent = 0;
                                            val = val.split(/('[^']*')/g)
                                                .map(function(part, idx)
                                                {
                                                    if(idx % 2 === 0)
                                                    {
                                                        return part.replace(/(?:(,)\s*|\s*(\bAND))/g,
                                                            function(matched, comma, oper, offset)
                                                            {
                                                                var preceeding = part.slice(0, offset);

                                                                return (comma || '') + '\n' +
                                                                    indent(curIndent + nesting(preceeding)) +
                                                                    (oper || '');
                                                            });
                                                    } // end if
                                                    curIndent += nesting(part);
                                                    return part;
                                                })
                                                .join('');

                                            var match = firstLineRE.exec(val);
                                            if(match)
                                            {
                                                firstLine = match[0];
                                                full = val;
                                            }
                                            else
                                            {
                                                firstLine = val;
                                            } // end if
                                        }
                                        else
                                        {
                                            firstLine = val;
                                        } // end if

                                        if(firstLine.length > 50)
                                        {
                                            if(!full)
                                            {
                                                full = firstLine;
                                            } // end if
                                            firstLine = firstLine.slice(0, 50) + '\u2026';
                                        } // end if

                                        var row = '<tr><th>' + key + '</th>';
                                        if(full)
                                        {
                                            row += '<td class="hoverable ui dropdown"><pre class="text"><code>' +
                                                firstLine + '</code></pre><i class="vertical ellipsis icon"></i>' +
                                                '<pre class="overlapping menu"><code>' + full + '</code></pre></td>';
                                        }
                                        else
                                        {
                                            row += '<td><pre><code>' + firstLine + '</code></pre></td>';
                                        } // end if
                                        row += '</tr>';

                                        return row;
                                    })
                                    .join('') +
                                '</table>',
                            className: {
                                popup: 'query-plan info ui popup',
                            },
                            onCreate: function()
                            {
                                $('.ui.dropdown', this).dropdown(nestedDropdownSettings);
                            }
                        };

                        $(this).popup(popupSettings);
                    });

                addLabels(svg, g, 'Alias', {
                    transform: function(g, u)
                    {
                        var value = g.node(u);
                        var bbox = this.getBBox();
                        return 'translate(' + value.x + ',' +
                            (value.y + (bboxes[u].height + bbox.height) / 2 - 1) + ')';
                    },
                    text: function(alias) { return JSON.stringify(alias); }
                });

                addLabels(svg, g, 'Subplan Name', {
                    transform: function(g, u)
                    {
                        var value = g.node(u);
                        var bbox = this.getBBox();
                        return 'translate(' + value.x + ',' +
                            (value.y - (bboxes[u].height + bbox.height) / 2 + 1) + ')';
                    }
                });

                addLabels(svg, g, 'References', {
                    transform: function(g, u)
                    {
                        var value = g.node(u);
                        var bbox = this.getBBox();
                        return 'translate(' + (value.x + (bboxes[u].width + bbox.width) / 2 - 1) + ',' +
                            (value.y + (bboxes[u].height - bbox.height) / 2) + ')';
                    },
                    link: function(ref) { return ref.id; },
                    text: function(ref) { return '\u2192' + ref.name; },
                    fontSize: '12px',
                    marginX: 2, marginY: 1,
                    eachLine: function(line)
                    {
                        d3.select(this).classed('hoverable', true);

                        var popupSettings = {
                            on: 'hover',
                            html: '<div class="content"><b>Referenced by:</b> ' + line.field + '</div>',
                            position: 'top center',
                            variation: 'inverted',
                            className: { popup: 'query-plan ui popup' },
                        };

                        $(this).popup(popupSettings);
                    }
                });

                function addLabels(root, graph, key, options)
                {
                    options = options || {};
                    renderer._labelTransforms[key] = options.transform;
                    var classname = 'label-' + key.replace(/ /g, '-');
                    var groupClassname = 'labels-' + key.replace(/ /g, '-');

                    svg.selectAll('g.' + groupClassname)
                        .data([groupClassname])
                        .enter()
                            .append('g')
                            .attr('class', function(d) { return d; });

                    var labelGroup = svg.select('g.' + groupClassname);

                    function getValue(u)
                    {
                        return graph.node(u).metadata[key];
                    } // end getValue

                    var nodes = graph.nodes().filter(function(u)
                    {
                        return !(graph.hasOwnProperty('children') && graph.children(u).length) && Boolean(getValue(u));
                    });

                    var marginX = options.marginX || 4, marginY = options.marginY || 2;

                    var labelElems = labelGroup
                        .selectAll('g.' + classname)
                        .classed('enter', false)
                        .data(nodes, function(u) { return u; });

                    renderer._labelElems[key] = labelElems;

                    labelElems
                        .enter()
                            .append('g')
                                .style('opacity', 0)
                                .attr('id', function(u) { return classname + u; })
                                .attr('class', classname + ' enter');

                    labelElems.each(function(u)
                    {
                        var label = d3.select(this);

                        var background = label.selectAll('rect')
                            .data([0]);
                        background.enter()
                            .append('rect')
                                .attr('rx', 5)
                                .attr('ry', 5)
                                .attr('opacity', 0.7)
                                .attr('fill', '#ddd');

                        var textGroup = label.selectAll('g.text')
                            .data([0]);
                        textGroup.enter()
                            .append('g')
                                .classed('text', true);

                        var text = textGroup.selectAll('text')
                            .data([0]);
                        text.enter()
                            .append('text')
                                .attr('font-size', options.fontSize || '14px');

                        var lines = getValue(u);
                        if(typeof lines == 'string')
                        {
                            lines = [lines];
                        } // end if

                        var tspans = text.selectAll('tspan')
                            .data(lines);

                        tspans.enter()
                            .append('tspan')
                                .attr('dy', function(line, idx)
                                {
                                    return idx === 0 ? '1em' : '1.5em';
                                })
                                .attr('x', '0');

                        tspans
                            .text(function(line)
                            {
                                if(options.text)
                                {
                                    line = options.text(line);
                                } // end if
                                return line;
                            });

                        if(options.eachLine)
                        {
                            tspans.each(options.eachLine);
                        } // end if

                        var bbox = textGroup.node().getBBox();

                        background
                            .attr('x', - (bbox.width / 2 + marginX))
                            .attr('y', - (bbox.height / 2 + marginY))
                            .attr('width', bbox.width + 2 * marginX)
                            .attr('height', bbox.height + 2 * marginY);

                        var labelBBox = textGroup.node().getBBox();
                        textGroup.attr('transform',
                            'translate(' + (-labelBBox.width / 2) + ',' + (-labelBBox.height / 2) + ')');
                    });

                    labelElems.exit()
                        .style('opacity', 0)
                        .remove();
                } // end addLabels

                return nodeElems;
            });

            var defaultPositionNodes = renderer.positionNodes();
            renderer.positionNodes(function(graph, svgNodes)
            {
                defaultPositionNodes(graph, svgNodes);

                function transform(func)
                {
                    return function(u)
                    {
                        return func.call(this, graph, u);
                    };
                } // end transform

                for(var key in renderer._labelElems)
                {
                    var labelElems = renderer._labelElems[key];

                    labelElems
                        .style('opacity', 1)
                        .attr('transform', transform(renderer._labelTransforms[key]));
                } // end for
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
