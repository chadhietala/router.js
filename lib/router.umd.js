import Router from './router';

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Router;
} else if (typeof define !== 'undefined' && define.amd) {
  define(function() { return Router; });
} else if (typeof window !== 'undefined') {
  window.Router = Router;
} else if (this) {
  this.Router = Router;
}