/* global angular: true */

angular.module('webPGQ', ['jQuery', 'ui.ace', 'webPGQ.directives', 'webPGQ.services']);
angular.module('webPGQ.services', ['unisocket', 'd3', 'dagreD3', 'rt.eventemitter']);
angular.module('webPGQ.directives', ['webPGQ.services']);
