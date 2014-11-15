var compileModules = require('broccoli-compile-modules');
var mergeTrees = require('broccoli-merge-trees');
var Funnel = require('broccoli-funnel');
var jsHint = require('broccoli-jshint');
var AMDFormatter = require('es6-module-transpiler-amd-formatter');

var availableFormats = [
  {
    formatter: new AMDFormatter(),
    output: '/router.amd.js'
  },
  {
    formatter: 'commonjs',
    output: '/cjs/router.js'
  }
];

/**
 * Picks the vendor files and places them into the root
 * of the virtual tree.
 * @param  {String} packageName
 * @return {Tree}
 */
function pickVendorPackage (packageName) {
  return new Funnel('bower_components/' + packageName + '/lib', {
    exclude: [ new RegExp(/umd/), new RegExp(/calculateVersion/) ],
    destDir: '/'
  });
}

/**
 * These are the 3rd party dependencies that router.js
 * depends on.
 * @type {Object}
 */
var vendoredES6Packages = {
  rsvp: pickVendorPackage('rsvp'),
  backburner: pickVendorPackage('backburner'),
  'route-recognizer': pickVendorPackage('route-recoginizer')
};

function buildDistLibs (lib) {
  return availableFormats.map(function (opts) {
    opts.inputFiles = ['router.js'];
    return compileModules(lib, opts);
  });
}


/**
 * Builds the test suite for the library.
 * @param  {Tree} lib
 * @return {Tree}
 */
function buildTestSuite (lib) {
  var vendorTrees = [];
  var libJsHint = jsHint(lib);
  var qunit = new Funnel('bower_components/qunit/qunit', {
    destDir: '/tests'
  });
  var tests = new Funnel('test/tests');
  var harness = new Funnel('test/', {
    files: ['index.html'],
    destDir: '/tests'
  });
  var testJsHint = jsHint(tests);
  
  for ( var dep in vendoredES6Packages ) {
    vendorTrees.push(vendoredES6Packages[dep]);
  }
  var testBundle = mergeTrees(
    vendorTrees.concat([lib, tests])
  );

  testBundle = compileModules( testBundle, {
    inputFiles: ['router.js', 'index_test.js'],
    formatter: 'bundle',
    output: '/tests/router-test-bundle.js'
  });

  return mergeTrees([testBundle, harness, qunit]);

}

var lib = new Funnel('lib', {
  destDir: '/'
});

var testSuite = buildTestSuite(lib);
var libDist = mergeTrees(buildDistLibs(lib));


module.exports = mergeTrees([testSuite, libDist]);