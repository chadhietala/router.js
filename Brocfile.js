var compileModules = require('broccoli-compile-modules');
var concat = require('broccoli-concat');
var mergeTrees = require('broccoli-merge-trees');
var Funnel = require('broccoli-funnel');
var jshint = require('broccoli-jshint');

var lib = 'lib';

var RSVP = new Funnel('node_modules/rsvp/lib');
var RouteRecognizer = new Funnel('bower_components/route-recognizer/lib');
var Backburner = new Funnel('bower_components/backburner/lib');
var standaloneDist = mergeTrees([lib, RSVP, RouteRecognizer]);
var testStandalone = mergeTrees([standaloneDist, Backburner]);

var router = compileModules(lib, {
  inputFiles: ['router.umd.js'],
  formatter: 'bundle',
  output: '/router.js'
});

var routerStandalone = compileModules(standaloneDist, {
  inputFiles: ['router-standalone.umd.js'],
  formatter: 'bundle',
  output: '/router-standalone.js'
});

var routerCJS = compileModules(lib, {
  inputFiles: ['router.js', 'router/**/*.js'],
  formatter: 'commonjs',
  output: '/commonjs'
});

function buildTestSuite(lib) {
  var tests = 'test';
  var destination = '/tests';
  var jsHintLib = jshint(lib);
  var jsHintTests = jshint(tests + '/tests');
  var libAndTests = mergeTrees([lib, tests]);

  var testBundle = compileModules(libAndTests, {
    inputFiles: ['router-standalone.umd.js', 'tests/*.js'],
    formatter: 'bundle',
    output: destination + '/router-test-bundle.js'
  });

  var allTests = mergeTrees([jsHintLib, jsHintTests, testBundle]);

  allTests = concat(allTests, {
    inputFiles: ['**/*.js'],
    outputFile: destination + '/router-test-bundle.js'
  });

  var testHarness = new Funnel( tests , {
    files: ['index.html'],
    destDir: destination
  });

  var qunit = new Funnel('bower_components/qunit/qunit', {
    files: ['qunit.js', 'qunit.css'],
    destDir: destination
  });

  return mergeTrees([testBundle, testHarness, qunit]);

}

module.exports = mergeTrees([
  router, routerStandalone, routerCJS, buildTestSuite(testStandalone)
]);
