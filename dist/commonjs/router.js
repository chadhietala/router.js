"use strict";
var router$router$$ = require("./router/router"), router$config$$ = require("./router/config");

function configure (key, value) {
  router$config$$.default[key] = value;
}

/* global RSVP, require */
if (typeof RSVP !== 'undefined') {
  configure('Promise', RSVP.Promise);
} else if (typeof require === 'function') {
  try {
    configure('Promise', require('rsvp').Promise);
  } catch (e) {}
}

/* global RouteRecognizer, require */
if (typeof RouteRecognizer !== 'undefined') {
  configure('RouteRecognizer', RouteRecognizer);
} else if (typeof require === 'function') {
  try {
    configure('RouteRecognizer', require('route-recognizer'));
  } catch (e) {}
}

exports["default"] = router$router$$.default;
exports.configure = configure;

//# sourceMappingURL=router.js.map