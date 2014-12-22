/* jshint browser:true, globalstrict:true */
/* global angular:true, console:true */
"use strict";

angular.module('webPGQ.services')
    .service('logger', ['eventEmitter', function(eventEmitter)
    {
        var defaultShowBannersFor = {
            error: true,
            warning: true,
            success: true,
            info: true,
            debug: false,
        };

        var icons = {
            sql: 'database',
            connection: 'sitemap',
            web: 'world'
        };

        // Log messages
        var messages = [];

        function log(severity, header, detail, category)
        {
            var message;
            if(arguments.length == 1 && typeof header == 'object')
            {
                message = header;
                severity = severity || message.severity;
            }
            else
            {
                message = {header: header, detail: detail};
            } // end if

            message.time = new Date();
            message.severity = severity;
            message.category = category;
            message.icon = icons[category];

            var errlog = (
                    severity == 'error' ? console.error :
                        ((severity == 'warning' && console.warn) ? console.warn : console.log)
                    )
                    .bind(console);

            if(message.detail)
            {
                message.detailType = typeof message.detail;

                errlog(severity + ": " + message.header, message.detail);
            }
            else
            {
                errlog(severity + ": " + message.header);
            } // end if

            messages.push(message);

            logger.emit('message', message);
            if(logger.showBannersFor[severity])
            {
                logger.emit('bannerMessage', message);
            } // end if
        } // end log

        function removeBannerAt(index)
        {
            //messages.splice(index, 1);
            messages[index].hidden = true;
        } // end removeBannerAt

        var logger = {
            showBannersFor: defaultShowBannersFor,
            icons: icons,
            messages: messages,
            log: log,
            removeBannerAt: removeBannerAt,

            debug: log.bind(this, 'debug'),
            info: log.bind(this, 'info'),
            success: log.bind(this, 'success'),
            warn: log.bind(this, 'warning'),
            error: log.bind(this, 'error')
        };
        eventEmitter.inject({prototype: logger});

        Object.defineProperty(logger, 'bannerMessages', {
            get: function()
            {
                return messages.filter(function(message)
                {
                    return !message.hidden && logger.showBannersFor[message.severity];
                });
            }
        });

        return logger;
    }]);
