/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.filters')
    .filter('inspect', ['_', function(_)
    {
        return function inspectFilter(input)
        {
            if(_.isString(input))
            {
                return input;
            }
            else if(_.isArray(input))
            {
                return JSON.stringify(input, null, (input.length > 0) ? '  ' : undefined);
            }
            else if(_.isPlainObject(input))
            {
                return JSON.stringify(input, null, (_.keys(input).length > 0) ? '  ' : undefined);
            }
            else
            {
                return JSON.stringify(input);
            } // end if
        }; // end inspectFilter
    }]); // end inspect
