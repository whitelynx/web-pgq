/* global angular: true */

angular.module('webPGQ.services')
    .service('promise', ['$exceptionHandler', '$q', function($exceptionHandler, $q)
    {
        return function promise(func)
        {
            var deferred = $q.defer();

            try
            {
                func(deferred.resolve.bind(deferred), deferred.reject.bind(deferred), deferred.notify.bind(deferred));
            }
            catch(exc)
            {
                deferred.reject(exc);
                $exceptionHandler(exc);
            } // end try

            return deferred.promise;
        }; // end promise
    }]);
