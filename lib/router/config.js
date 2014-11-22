var config = {};

config.Promise = function () {
  throw new Error('No Promise constructor provided to router.js. '+ 
                  'Please use router-standalone.umd.js or ' + 
                  'call Router.configure("Promise", myPromiseContructor).');
};

config.RouteRecognizer = function () {
  throw new Error('No RouteRecognizer constructor provided to router.js. '+ 
                  'Please use router-standalone.umd.js or ' + 
                  'call Router.configure("RouteRecognizer", myRouteRecognizer).');
};

export default config;