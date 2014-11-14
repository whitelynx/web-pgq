/* global angular: true */
"use strict";

angular.module('webPGQ.services')
    .service('await', ['$exceptionHandler', '$q', function($exceptionHandler, $q)
    {
        return function await(func)
        {
            var deferred = $q.defer();

            return {
                trigger: function()
                {
                    try
                    {
                        deferred.resolve(func());
                    }
                    catch(exc)
                    {
                        deferred.reject(exc);
                        $exceptionHandler(exc);
                    } // end try
                }, // end trigger
                promise: deferred.promise
            };
        }; // end await
    }]);
