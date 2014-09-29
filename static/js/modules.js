/* global angular: true */

angular.module('webPGQ', ['webPGQ.directives', 'webPGQ.services', 'ui.ace']);
angular.module('webPGQ.services', ['rt.eventemitter']);
angular.module('webPGQ.directives', ['webPGQ.services']);
