/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.services')
    .service('promise', ['$exceptionHandler', '$q', 'eventEmitter', function($exceptionHandler, $q, eventEmitter)
    {
        function promise(func)
        {
            var deferred = $q.defer();

            eventEmitter.inject({ prototype: deferred.promise });
            deferred.promise.removeListener = deferred.promise.off;

            try
            {
                func.call(deferred.promise, deferred.resolve.bind(deferred), deferred.reject.bind(deferred),
                    deferred.notify.bind(deferred));
            }
            catch(exc)
            {
                deferred.reject(exc);
                $exceptionHandler(exc);
            } // end try

            return deferred.promise;
        } // end promise

        function chainEmit(sourceEmitter, destEmitter)
        {
            var baseEmit = sourceEmitter.emit;

            if(baseEmit)
            {
                sourceEmitter.emit = function()
                {
                    destEmitter.emit.apply(this, arguments);
                    return baseEmit.apply(this, arguments);
                }; // end sourceEmitter.emit
            } // end if
        } // end chainEmit

        promise.all = function(promises)
        {
            var p = $q.all(promises);
            eventEmitter.inject({ prototype: p });

            for(var key in promises)
            {
                chainEmit(promises[key]);
            } // end for

            return p;
        }; // end promise.all

        promise.reject = $q.reject;

        promise.when = function()
        {
            var p = $q.when.apply($q, arguments);
            eventEmitter.inject({ prototype: p });
            return p;
        }; // end promise.when
        promise.resolve = promise.when;

        return promise;
    }]);
