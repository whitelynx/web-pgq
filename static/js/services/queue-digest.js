/* global angular: true */

angular.module('webPGQ.services')
    .service('queueDigest', ['$timeout', function($timeout)
    {
        var currentTimer;
        var currentTimerTargetTime;

        function runDigest()
        {
        } // end runDigest

        return function queueDigest(func, maxDelay)
        {
            var targetTime = Date.now() + maxDelay;

            if(currentTimer)
            {
                if(currentTimerTargetTime < targetTime)
                {
                    // Current timer will expire before maxDelay is up; leave that timer alone.
                    return currentTimer.then(func);
                } // end if

                $timeout.cancel(currentTimer);
            } // end if

            currentTimerTargetTime = targetTime;
            currentTimer = $timeout(runDigest, maxDelay);

            return currentTimer.then(func);
        }; // end promise
    }]);
