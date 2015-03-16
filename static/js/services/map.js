/* jshint browser:true, globalstrict:true */
/* global angular:true, console:true */
"use strict";

angular.module('webPGQ.services')
    .service('map', ['_', 'eventEmitter', 'ol', 'olData', 'promise', 'queueDigest',
        function(_, eventEmitter, ol, olData, promise, queueDigest)
        {
            var layerCollection;
            var maxUpdateDelay = 200;

            var mapPromise = olData.getMap();
            mapPromise.then(function(map)
            {
                layerCollection = map.getLayers();

                map.addInteraction(new ol.interaction.MouseWheelZoom({ duration: 150 }));


                var defaultSelectedStyle = new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: [0, 0, 0, 0.3], lineDash: [2, 2] }),
                    fill: new ol.style.Fill({ color: [255, 255, 255, 0.1] })
                });
                var hoverSelectedStyle = new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: [0, 0, 0, 0.6], lineDash: [2, 2] }),
                    fill: new ol.style.Fill({ color: [255, 255, 255, 0.3] })
                });

                function makeColorTranslucent(color)
                {
                    color = ol.color.asArray(color);

                    return _.initial(color)
                        .concat(_.last(color) * 0.25);
                } // end makeColorTranslucent

                var select = new ol.interaction.Select({
                    toggleCondition: ol.events.condition.never,
                    multi: true,
                    style: function(feature, resolution)
                    {
                        var featureStyle = feature.getStyle();
                        if(_.isFunction(featureStyle))
                        {
                            featureStyle = featureStyle.call(feature, resolution);
                        } // end if
                        if(!featureStyle)
                        {
                            // Fall back to the layer style, and finally to the default.
                            featureStyle = (feature.getProperties() || {}).layerStyle || {};
                        } // end if

                        var featureStroke, featureFill, featureGeometry, featureImage, featureText, featureZIndex;
                        if(featureStyle.getStroke)
                        {
                            featureStroke = featureStyle.getStroke();
                            featureStroke = {
                                color: [255, 255, 255, 0.6],
                                lineCap: featureStroke.getLineCap(),
                                lineDash: [2, 2],
                                lineJoin: featureStroke.getLineJoin(),
                                miterLimit: featureStroke.getMiterLimit(),
                                width: featureStroke.getWidth()
                            };
                            featureFill = {
                                color: featureStyle.getFill().getColor()
                            };
                            featureGeometry = featureStyle.getGeometry();
                            featureImage = featureStyle.getImage();
                            featureText = featureStyle.getText();
                            featureZIndex = featureStyle.getZIndex();
                        }
                        else
                        {
                            featureStroke = featureStyle.stroke;
                            featureFill = featureStyle.fill;
                            featureGeometry = featureStyle.geometry;
                            featureImage = featureStyle.image;
                            featureText = featureStyle.text;
                            featureZIndex = featureStyle.zIndex;
                        } // end if

                        return [
                            new ol.style.Style({
                                stroke: featureStroke && new ol.style.Stroke({
                                    color: makeColorTranslucent(featureStroke.color),
                                    lineCap: featureStroke.lineCap,
                                    lineDash: [2, 2],
                                    lineJoin: featureStroke.lineJoin,
                                    miterLimit: featureStroke.miterLimit,
                                    width: featureStroke.width
                                }),
                                fill: featureFill && new ol.style.Fill({
                                    color: makeColorTranslucent(featureFill.color)
                                }),
                                geometry: featureGeometry,
                                image: featureImage,
                                text: featureText,
                                zIndex: featureZIndex
                            }),
                            defaultSelectedStyle
                        ];
                    }
                });
                map.addInteraction(select);

                var selectedFeatureCollection = select.getFeatures();

                function getFeatureSortKey(feature)
                {
                    return -(feature.getGeometry().getArea());
                } // end getFeatureSortKey

                function highlightFeature()
                {
                    /* jshint validthis:true */
                    mapService.highlightedFeature = this;
                    map.render();
                } // end highlightFeature

                function unhighlightFeature()
                {
                    /* jshint validthis:true */
                    if(mapService.highlightedFeature === this)
                    {
                        mapService.highlightedFeature = undefined;
                    } // end if
                    map.render();
                } // end unhighlightFeature

                map.on('postcompose', function(event)
                {
                    if(mapService.highlightedFeature)
                    {
                        event.vectorContext.drawFeature(mapService.highlightedFeature, hoverSelectedStyle);
                    } // end if
                }); // end 'postcompose' handler

                selectedFeatureCollection.on('add', function(ev)
                {
                    var selectedFeatureArray = selectedFeatureCollection.getArray();

                    var newFeature = selectedFeatureArray.pop();
                    if(newFeature !== ev.element)
                    {
                        console.warn("Got different feature from the end of selectedFeatures (", newFeature,
                            ") than from the 'add' event! (", ev.element, ")");
                    } // end if

                    // Re-insert the new feature at the correct sorted location.
                    var newFeatureIdx = _.sortedIndex(selectedFeatureArray, newFeature, getFeatureSortKey);

                    selectedFeatureArray.splice(newFeatureIdx, 0, newFeature);

                    queueDigest(function()
                    {
                        mapService.selectedFeatures.splice(newFeatureIdx, 0, newFeature);
                        mapService.selectedFeatureProperties.splice(newFeatureIdx, 0, _.defaults(
                            {
                                __highlight: highlightFeature.bind(newFeature),
                                __unhighlight: unhighlightFeature.bind(newFeature)
                            },
                            newFeature.getProperties()
                        ));

                        if(mapService.selectedFeatures.length !== mapService.selectedFeatureProperties.length)
                        {
                            console.warn("Lengths differ between selectedFeatures (", mapService.selectedFeatures.length,
                                ") and selectedFeatureProperties (", mapService.selectedFeatureProperties.length, ")!");
                        } // end if

                        mapService.emit('selectedLayersChanged', mapService.selectedFeatureProperties);
                    }, maxUpdateDelay);
                }); // end 'add' handler

                selectedFeatureCollection.on('remove', function(ev)
                {
                    queueDigest(function()
                    {
                        var featureIdx = mapService.selectedFeatures.indexOf(ev.element);
                        if(featureIdx == -1)
                        {
                            console.warn("Removed feature is not present in selectedFeatureProperties!", ev.element);
                            console.log("selectedFeatureProperties:", mapService.selectedFeatureProperties);
                        }
                        else
                        {
                            // Remove the feature.
                            mapService.selectedFeatures.splice(featureIdx, 1);
                            mapService.selectedFeatureProperties.splice(featureIdx, 1);

                            mapService.emit('selectedLayersChanged', mapService.selectedFeatureProperties);
                        } // end if
                    }, maxUpdateDelay);
                }); // end 'remove' handler
            }); // end .then

            var lastLayerID = 0;

            var mapService = {
                layers: [],

                selectedFeatures: [],
                selectedFeatureProperties: [],

                highlightedFeature: undefined,

                addLayers: function(layerDefs)
                {
                    return mapPromise.then(function(map)
                    {
                        var idx = -1;
                        return promise(processNextLayerDef);

                        function processNextLayerDef(resolve, reject)
                        {
                            var layerDef = layerDefs[++idx];
                            if(!layerDef) { return resolve(idx); }

                            var layer;
                            var layerID = lastLayerID++;

                            layerDef.toggle = function()
                            {
                                layerDef.active = !layerDef.active;
                            }; // end layerDef.toggle

                            var getExtent = null;
                            Object.defineProperty(layerDef, 'getExtent', {
                                get: function()
                                {
                                    if(layer && (getExtent === null))
                                    {
                                        var source = layer.getSource();
                                        getExtent = source.getExtent ? source.getExtent.bind(source) : undefined;
                                    } // end if

                                    return getExtent;
                                }
                            });

                            layerDef.center = function()
                            {
                                if(layerDef.getExtent)
                                {
                                    map.getView().fitExtent(getExtent(), map.getSize());
                                } // end if
                            }; // end layerDef.center

                            layerDef.layerID = layerID;

                            layerCollection.on('add', onAdd);
                            mapService.layers.push(layerDef);
                            mapService.emit('layersChanged', mapService.layers);

                            function onAdd(ev)
                            {
                                try
                                {
                                    if(!ev.element.get('layerDef'))
                                    {
                                        console.log("Matched layerDef #", layerID, "to layer:", ev.element);
                                        layer = ev.element;
                                        layer.set('layerID', layerID);
                                        layer.set('layerDef', layerDef);
                                        layerCollection.un('add', onAdd);

                                        resolve(promise(processNextLayerDef));
                                    }
                                    else
                                    {
                                        console.log("Layer def #", layerID, "did not match added layer:", ev.element);
                                    } // end if
                                }
                                catch(exc)
                                {
                                    reject(exc);
                                } // end try
                            } // end onAdd
                        } // end processNextLayerDef
                    });
                }, // end addLayers

                removeLayers: function(layerNames, onlyIfHidden)
                {
                    mapService.layers = _.reject(mapService.layers, function(layer)
                    {
                        return _.includes(layerNames, layer.name) && (!onlyIfHidden || !layer.active);
                    });

                    mapService.emit('layersChanged', mapService.layers);
                } // end removeLayers
            }; // end mapService

            eventEmitter.inject({ prototype: mapService });

            return mapService;
        }]);
