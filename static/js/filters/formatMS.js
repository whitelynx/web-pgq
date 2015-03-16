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
            var seconds = Math.floor(duration.asSeconds());
            if(seconds > 60)
            {
                return duration.format((days == 1) ? "d [day] h:mm:ss" : "d [days] h:mm:ss", 6);
            }
            else if(seconds > 0)
            {
                return duration.format((seconds == 1) ? "s [second]" : "s [seconds]", 6);
            }
            else
            {
                return duration.format("S [ms]", 6);
            } // end if
        }; // end formatMSFilter
    }]); // end formatMS
