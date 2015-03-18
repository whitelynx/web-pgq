/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.filters')
    .filter('formatMS', ['moment', function(moment)
    {
        return function formatMSFilter(input)
        {
            input = parseFloat(input || '');

            var duration = moment.duration(input, 'ms');
            var days = Math.floor(duration.asDays());
            var seconds = duration.asSeconds();
            if(seconds > (60 * 60)) // At least 1 hour
            {
                return duration.format((days == 1) ? "d [day] h:mm:ss" : "d [days] h:mm:ss", 3);
            }
            else if(seconds > 0) // At least 1 second
            {
                return duration.format("m [min] s [sec]", 3);
            }
            else
            {
                return duration.format("S [ms]", 6);
            } // end if
        }; // end formatMSFilter
    }]); // end formatMS
