/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

(function()
{
    function _capitalize(input)
    {
        input = input || '';
        if(input.length > 0)
        {
            return input[0].toUpperCase() + input.slice(1);
        } // end if

        return input;
    } // end _capitalize

    angular.module('webPGQ.filters')
        .filter('capitalize', function()
        {
            return _capitalize;
        }) // end capitalize
        .filter('capitalizeWords', function()
        {
            var wordSplitRE = /(\s)\b/g;

            return function(input)
            {
                return input.split(wordSplitRE).map(_capitalize).join('');
            };
        }); // end capitalize
})();
