/* global angular: true */
"use strict";

angular.module('webPGQ.services')
    .service('keybinding', ['$window', '$document', function($window, $document)
    {
        function defaults(to, from)
        {
            for(var key in from || {})
            {
                if(!to[key])
                {
                    to[key] = from[key];
                } // end if
            } // end for

            return to;
        } // end defaults

        var defaultTarget = $document[0];
        var codePointRE = /^U\+([0-9A-F]+)$/;

        function handleKeyEvent(type, capture, event)
        {
            if(event.repeat) { return true; }

            if(event.key === undefined) { event.key = event.keyIdentifier; }
            var match = codePointRE.exec(event.key);
            if(match)
            {
                event.key = String.fromCharCode(parseInt(match[1], 16));
            } // end if

            var combo = [
                event.metaKey ? 'meta' : undefined,
                event.ctrlKey ? 'ctrl' : undefined,
                event.altKey ? 'alt' : undefined,
                event.shiftKey ? 'shift' : undefined,
                event.key.toLowerCase()
            ];
            event.combo = combo.filter(function(v) { return v; }).join('+');

            var bindingsKey = '__' + type + (capture ? '_capture' : '') + '_bindings__';
            return this[bindingsKey].every(function(binding)
            {
                if(keybindingService.matchesKeyDef(event, binding.keyDef))
                {
                    binding.handler.call(this, event || $window.event);

                    if(binding.preventDefault)
                    {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                    } // end if

                    return false;
                } // end if

                return true;
            });
        } // end handleKeyEvent

        function addKeyEventBinding(target, binding)
        {
            var type = binding.type || 'keydown';
            var bindingsKey = '__' + type + (binding.capture ? '_capture' : '') + '_bindings__';
            if(!target[bindingsKey])
            {
                target[bindingsKey] = [];

                target.addEventListener(
                    type,
                    function(event) { return handleKeyEvent.call(this, type, binding.capture, event); },
                    binding.capture
                );

                if(binding.capture && target == $document[0] && $window.captureEvents)
                {
                    $window.captureEvents($window.Event[type.toUpperCase()]);
                } // end if

                console.log((binding.capture ? "Capturing " : "Listening for ") + JSON.stringify(type) + " events on:",
                    target);
            } // end if

            target[bindingsKey].push(binding);
        } // end addKeyEventBinding

        var keybindingService = {
            functionKey: function(num)
            {
                return {
                    key: 'F' + num,
                    capture: true
                    //isFunctionKey: true,
                    //keyCode: 111 + num
                };
            }, // end functionKey

            matchesKeyDef: function(event, keyDef)
            {
                if(keyDef.combo !== undefined && event.combo !== keyDef.combo) { return false; }
                if(keyDef.isFunctionKey !== undefined && event.isFunctionKey != keyDef.isFunctionKey) { return false; }
                if(keyDef.keyCode !== undefined && event.which !== keyDef.keyCode) { return false; }
                if(keyDef.key !== undefined && event.key !== keyDef.key) { return false; }
                if(keyDef.altKey !== undefined && event.altKey !== keyDef.altKey) { return false; }
                if(keyDef.ctrlKey !== undefined && event.ctrlKey !== keyDef.ctrlKey) { return false; }
                if(keyDef.metaKey !== undefined && event.metaKey !== keyDef.metaKey) { return false; }
                if(keyDef.shiftKey !== undefined && event.shiftKey !== keyDef.shiftKey) { return false; }
                return true;
            }, // end matchesKeyDef

            bindKey: function(keyDef, options, handler)
            {
                if(!handler && typeof options == 'function')
                {
                    handler = options;
                    options = {};
                } // end if

                if(typeof keyDef == 'string')
                {
                    keyDef = {type: 'keydown', combo: keyDef};
                } // end if

                if(typeof keyDef.combo == 'string')
                {
                    keyDef.combo = keyDef.combo.toLowerCase();
                } // end if

                var target = options.target || defaultTarget;
                addKeyEventBinding(target,
                    defaults({
                        keyDef: keyDef,
                        handler: handler
                    }, options)
                );

                console.log("Bound " + JSON.stringify(options.type || 'keydown') + " handler for " +
                    JSON.stringify(keyDef) + " on:", target);
            }, // end bindKey
        };

        return keybindingService;
    }]);
