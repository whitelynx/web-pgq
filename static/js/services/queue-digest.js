/* global angular: true */

angular.module('webPGQ.services')
    .service('queueDigest', ['$exceptionHandler', 'await', '$timeout', function($exceptionHandler, await, $timeout)
    {
        var currentTimer;
        var currentTimerTargetTime;
        var queuedFuncs = [];

        function runDigest()
        {
            var funcs = queuedFuncs;
            queuedFuncs = [];
            currentTimer = undefined;
            currentTimerTargetTime = undefined;

            funcs.forEach(function(call) { call(); });
        } // end runDigest

        return function queueDigest(func, maxDelay)
        {
            maxDelay = maxDelay || 0;

            var wrapped = await(func);

            queuedFuncs.push(wrapped.trigger);

            var targetTime = Date.now() + maxDelay;

            if(currentTimer)
            {
                if(currentTimerTargetTime < targetTime)
                {
                    // Current timer will expire before maxDelay is up; leave that timer alone.
                    return wrapped.promise;
                } // end if

                $timeout.cancel(currentTimer);
            } // end if

            currentTimerTargetTime = targetTime;
            currentTimer = $timeout(runDigest, maxDelay);

            return wrapped.promise;
        }; // end queueDigest
    }]);
