/* global angular: true */

angular.module('webPGQ.services')
    .service('logger', function()
    {
        var showBannersFor = {
            error: true,
            warning: true,
            info: true,
        };

        var icons = {
            error: 'exclamation',
            warning: 'warning',
            info: 'info letter',
        };

        // Banner messages (errors, warnings, etc.) //
        var bannerMessages = [];

        function log(severity, header, detail)
        {
            var bannerMessage;
            if(arguments.length == 1 && typeof header == 'object')
            {
                bannerMessage = header;
                severity = severity || bannerMessage.severity;
            }
            else
            {
                bannerMessage = {header: header, detail: detail};
            } // end if

            bannerMessage.severity = severity;
            bannerMessage.icon = icons[severity];

            var errlog = (
                    severity == 'error' ? console.error :
                        ((severity == 'warn' && console.warn) ? console.warn : console.log)
                    )
                    .bind(console);

            if(bannerMessage.detail)
            {
                bannerMessage.detailType = typeof bannerMessage.detail;

                errlog(severity + ": " + bannerMessage.header + ":", bannerMessage.detail);
            }
            else
            {
                errlog(severity + ": " + bannerMessage.header);
            } // end if

            if(showBannersFor[severity])
            {
                bannerMessages.push(bannerMessage);
            } // end if
        } // end log

        function removeBannerAt(index)
        {
            bannerMessages.splice(index, 1);
        } // end removeBannerAt

        return {
            showBannersFor: showBannersFor,
            icons: icons,
            bannerMessages: bannerMessages,
            log: log,
            removeBannerAt: removeBannerAt,

            debug: log.bind(this, 'debug'),
            info: log.bind(this, 'info'),
            warn: log.bind(this, 'warn'),
            error: log.bind(this, 'error')
        };
    });
