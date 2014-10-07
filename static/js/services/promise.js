/* global angular: true */

angular.module('webPGQ.services')
    .service('promise', ['$exceptionHandler', '$q', 'eventEmitter', function($exceptionHandler, $q, eventEmitter)
    {
        return function promise(func)
        {
            var deferred = $q.defer();

            eventEmitter.inject({prototype: deferred.promise});
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
        }; // end promise
    }]);
