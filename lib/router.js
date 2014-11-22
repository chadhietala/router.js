import Router from './router/router';
import config from './router/config';

function configure (key, value) {
  config[key] = value;
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

export { configure };
export default Router;
