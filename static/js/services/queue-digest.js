/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.services')
    .service('queueDigest', [
        '$exceptionHandler', '_', 'await', '$timeout',
        function($exceptionHandler, _, await, $timeout)
        {
            var currentTimer;
            var currentTimerTargetTime;
            var queuedAwaits = [];

            function runDigest()
            {
                var awaits = queuedAwaits;
                queuedAwaits = [];
                currentTimer = undefined;
                currentTimerTargetTime = undefined;

                awaits.forEach(function(queued)
                {
                    delete queued.func.__queueDigest__promise;
                    queued.trigger();
                });
            } // end runDigest

            return function queueDigest(func, maxDelay)
            {
                maxDelay = maxDelay || 0;
                func = func || _.noop;

                var promise;
                if(func.__queueDigest__promise)
                {
                    // The given function has already been registered since the last runDigest().
                    promise = func.__queueDigest__promise;
                }
                else
                {
                    var awaited = await(func);
                    promise = awaited.promise;
                    func.__queueDigest__promise = promise;

                    queuedAwaits.push(awaited);
                } // end if

                var targetTime = Date.now() + maxDelay;

                if(currentTimer)
                {
                    if(currentTimerTargetTime < targetTime)
                    {
                        // Current timer will expire before maxDelay is up; leave that timer alone.
                        return promise;
                    } // end if

                    $timeout.cancel(currentTimer);
                } // end if

                currentTimerTargetTime = targetTime;
                currentTimer = $timeout(runDigest, maxDelay);

                return promise;
            }; // end queueDigest
        }]);
