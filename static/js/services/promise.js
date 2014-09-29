/* global angular: true */

angular.module('webPGQ.services')
    .service('promise', ['$exceptionHandler', '$q', function($exceptionHandler, $q)
    {
        return function promise(func)
        {
            var deferred = $q.defer();

            try
            {
                func(deferred.resolve, deferred.reject, deferred.notify);
            }
            catch(exc)
            {
                deferred.reject(exc);
                $exceptionHandler(exc);
            } // end try

            return deferred.promise;
        }; // end promise
    }]);
