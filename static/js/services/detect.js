/* jshint browser:true, globalstrict:true */
/* global angular:true */
"use strict";

angular.module('webPGQ.services')
    .service('detect', ['_', function(_)
    {
        var multiLineStringRE = /\n./;

        return {
            contains: _.contains,
            isString: _.isString,
            isArray: _.isArray,
            isObject: _.isObject,
            isPlainObject: _.isPlainObject,
            isEmpty: _.isEmpty,

            isSet: function(val)
            {
                return (val !== undefined) && (val !== null);
            }, // end detect.isSet

            isMultiLine: function(val)
            {
                if(_.isString(val))
                {
                    return multiLineStringRE.test(val);
                }
                else
                {
                    return (_.isArray(val) && val.length > 0) ||
                        (_.isPlainObject(val) && _.keys(val).length > 0);
                } // end if
            }, // end detect.isMultiLine

            typeOf: function(val)
            {
                if(_.isNull(val))
                {
                    return 'null';
                }
                else if(_.isArray(val))
                {
                    return 'array';
                }
                else
                {
                    return typeof val;
                } // end if
            } // end detect.typeOf
        };
    }]);
