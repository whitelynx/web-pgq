/* global angular: true */

angular.module('webPGQ.services')
    .service('queueDigest', ['$exceptionHandler', '$q', '$timeout', function($exceptionHandler, $q, $timeout)
    {
        var currentTimer;
        var currentTimerTargetTime;
        var queuedFuncs = [];

        function runDigest()
        {
            var funcs = queuedFuncs;
            queuedFuncs = [];

            funcs.forEach(function(call) { call(); });
        } // end runDigest

        function wrap(func)
        {
            var deferred = $q.defer();

            return {
                call: function()
                {
                    try
                    {
                        deferred.resolve(func());
                    }
                    catch(exc)
                    {
                        deferred.reject();
                        $exceptionHandler(exc);
                    } // end try
                }, // end call
                promise: deferred.promise
            };
        } // end wrap

        return function queueDigest(func, maxDelay)
        {
            var wrapped = wrap(func);

            queuedFuncs.push(wrapped.call);

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
        }; // end promise
    }]);
