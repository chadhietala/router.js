import { configure } from './router';
import { Promise } from 'rsvp';
import RouteRecognizer from 'route-recognizer';
import Router from './router';

configure('Promise', Promise);
configure('RouteRecognizer', RouteRecognizer);

export { configure };
export default Router;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Router;
} else if (typeof define !== 'undefined' && define.amd) {
  define(function() { return Router; });
} else if (typeof window !== 'undefined') {
  window.Router = Router;
} else if (this) {
  this.Router = Router;
}