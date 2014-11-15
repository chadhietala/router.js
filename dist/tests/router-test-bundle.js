(function() {
    "use strict";
    function route$recognizer$dsl$$Target(path, matcher, delegate) {
      this.path = path;
      this.matcher = matcher;
      this.delegate = delegate;
    }

    route$recognizer$dsl$$Target.prototype = {
      to: function(target, callback) {
        var delegate = this.delegate;

        if (delegate && delegate.willAddRoute) {
          target = delegate.willAddRoute(this.matcher.target, target);
        }

        this.matcher.add(this.path, target);

        if (callback) {
          if (callback.length === 0) { throw new Error("You must have an argument in the function passed to `to`"); }
          this.matcher.addChild(this.path, target, callback, this.delegate);
        }
        return this;
      }
    };

    function route$recognizer$dsl$$Matcher(target) {
      this.routes = {};
      this.children = {};
      this.target = target;
    }

    route$recognizer$dsl$$Matcher.prototype = {
      add: function(path, handler) {
        this.routes[path] = handler;
      },

      addChild: function(path, target, callback, delegate) {
        var matcher = new route$recognizer$dsl$$Matcher(target);
        this.children[path] = matcher;

        var match = route$recognizer$dsl$$generateMatch(path, matcher, delegate);

        if (delegate && delegate.contextEntered) {
          delegate.contextEntered(target, match);
        }

        callback(match);
      }
    };

    function route$recognizer$dsl$$generateMatch(startingPath, matcher, delegate) {
      return function(path, nestedCallback) {
        var fullPath = startingPath + path;

        if (nestedCallback) {
          nestedCallback(route$recognizer$dsl$$generateMatch(fullPath, matcher, delegate));
        } else {
          return new route$recognizer$dsl$$Target(startingPath + path, matcher, delegate);
        }
      };
    }

    function route$recognizer$dsl$$addRoute(routeArray, path, handler) {
      var len = 0;
      for (var i=0, l=routeArray.length; i<l; i++) {
        len += routeArray[i].path.length;
      }

      path = path.substr(len);
      var route = { path: path, handler: handler };
      routeArray.push(route);
    }

    function route$recognizer$dsl$$eachRoute(baseRoute, matcher, callback, binding) {
      var routes = matcher.routes;

      for (var path in routes) {
        if (routes.hasOwnProperty(path)) {
          var routeArray = baseRoute.slice();
          route$recognizer$dsl$$addRoute(routeArray, path, routes[path]);

          if (matcher.children[path]) {
            route$recognizer$dsl$$eachRoute(routeArray, matcher.children[path], callback, binding);
          } else {
            callback.call(binding, routeArray);
          }
        }
      }
    }

    var route$recognizer$dsl$$default = function(callback, addRouteCallback) {
      var matcher = new route$recognizer$dsl$$Matcher();

      callback(route$recognizer$dsl$$generateMatch("", matcher, this.delegate));

      route$recognizer$dsl$$eachRoute([], matcher, function(route) {
        if (addRouteCallback) { addRouteCallback(this, route); }
        else { this.add(route); }
      }, this);
    };

    var route$recognizer$$specials = [
      '/', '.', '*', '+', '?', '|',
      '(', ')', '[', ']', '{', '}', '\\'
    ];

    var route$recognizer$$escapeRegex = new RegExp('(\\' + route$recognizer$$specials.join('|\\') + ')', 'g');

    function route$recognizer$$isArray(test) {
      return Object.prototype.toString.call(test) === "[object Array]";
    }

    // A Segment represents a segment in the original route description.
    // Each Segment type provides an `eachChar` and `regex` method.
    //
    // The `eachChar` method invokes the callback with one or more character
    // specifications. A character specification consumes one or more input
    // characters.
    //
    // The `regex` method returns a regex fragment for the segment. If the
    // segment is a dynamic of star segment, the regex fragment also includes
    // a capture.
    //
    // A character specification contains:
    //
    // * `validChars`: a String with a list of all valid characters, or
    // * `invalidChars`: a String with a list of all invalid characters
    // * `repeat`: true if the character specification can repeat

    function route$recognizer$$StaticSegment(string) { this.string = string; }
    route$recognizer$$StaticSegment.prototype = {
      eachChar: function(callback) {
        var string = this.string, ch;

        for (var i=0, l=string.length; i<l; i++) {
          ch = string.charAt(i);
          callback({ validChars: ch });
        }
      },

      regex: function() {
        return this.string.replace(route$recognizer$$escapeRegex, '\\$1');
      },

      generate: function() {
        return this.string;
      }
    };

    function route$recognizer$$DynamicSegment(name) { this.name = name; }
    route$recognizer$$DynamicSegment.prototype = {
      eachChar: function(callback) {
        callback({ invalidChars: "/", repeat: true });
      },

      regex: function() {
        return "([^/]+)";
      },

      generate: function(params) {
        return params[this.name];
      }
    };

    function route$recognizer$$StarSegment(name) { this.name = name; }
    route$recognizer$$StarSegment.prototype = {
      eachChar: function(callback) {
        callback({ invalidChars: "", repeat: true });
      },

      regex: function() {
        return "(.+)";
      },

      generate: function(params) {
        return params[this.name];
      }
    };

    function route$recognizer$$EpsilonSegment() {}
    route$recognizer$$EpsilonSegment.prototype = {
      eachChar: function() {},
      regex: function() { return ""; },
      generate: function() { return ""; }
    };

    function route$recognizer$$parse(route, names, types) {
      // normalize route as not starting with a "/". Recognition will
      // also normalize.
      if (route.charAt(0) === "/") { route = route.substr(1); }

      var segments = route.split("/"), results = [];

      for (var i=0, l=segments.length; i<l; i++) {
        var segment = segments[i], match;

        if (match = segment.match(/^:([^\/]+)$/)) {
          results.push(new route$recognizer$$DynamicSegment(match[1]));
          names.push(match[1]);
          types.dynamics++;
        } else if (match = segment.match(/^\*([^\/]+)$/)) {
          results.push(new route$recognizer$$StarSegment(match[1]));
          names.push(match[1]);
          types.stars++;
        } else if(segment === "") {
          results.push(new route$recognizer$$EpsilonSegment());
        } else {
          results.push(new route$recognizer$$StaticSegment(segment));
          types.statics++;
        }
      }

      return results;
    }

    // A State has a character specification and (`charSpec`) and a list of possible
    // subsequent states (`nextStates`).
    //
    // If a State is an accepting state, it will also have several additional
    // properties:
    //
    // * `regex`: A regular expression that is used to extract parameters from paths
    //   that reached this accepting state.
    // * `handlers`: Information on how to convert the list of captures into calls
    //   to registered handlers with the specified parameters
    // * `types`: How many static, dynamic or star segments in this route. Used to
    //   decide which route to use if multiple registered routes match a path.
    //
    // Currently, State is implemented naively by looping over `nextStates` and
    // comparing a character specification against a character. A more efficient
    // implementation would use a hash of keys pointing at one or more next states.

    function route$recognizer$$State(charSpec) {
      this.charSpec = charSpec;
      this.nextStates = [];
    }

    route$recognizer$$State.prototype = {
      get: function(charSpec) {
        var nextStates = this.nextStates;

        for (var i=0, l=nextStates.length; i<l; i++) {
          var child = nextStates[i];

          var isEqual = child.charSpec.validChars === charSpec.validChars;
          isEqual = isEqual && child.charSpec.invalidChars === charSpec.invalidChars;

          if (isEqual) { return child; }
        }
      },

      put: function(charSpec) {
        var state;

        // If the character specification already exists in a child of the current
        // state, just return that state.
        if (state = this.get(charSpec)) { return state; }

        // Make a new state for the character spec
        state = new route$recognizer$$State(charSpec);

        // Insert the new state as a child of the current state
        this.nextStates.push(state);

        // If this character specification repeats, insert the new state as a child
        // of itself. Note that this will not trigger an infinite loop because each
        // transition during recognition consumes a character.
        if (charSpec.repeat) {
          state.nextStates.push(state);
        }

        // Return the new state
        return state;
      },

      // Find a list of child states matching the next character
      match: function(ch) {
        // DEBUG "Processing `" + ch + "`:"
        var nextStates = this.nextStates,
            child, charSpec, chars;

        // DEBUG "  " + debugState(this)
        var returned = [];

        for (var i=0, l=nextStates.length; i<l; i++) {
          child = nextStates[i];

          charSpec = child.charSpec;

          if (typeof (chars = charSpec.validChars) !== 'undefined') {
            if (chars.indexOf(ch) !== -1) { returned.push(child); }
          } else if (typeof (chars = charSpec.invalidChars) !== 'undefined') {
            if (chars.indexOf(ch) === -1) { returned.push(child); }
          }
        }

        return returned;
      }

      /** IF DEBUG
      , debug: function() {
        var charSpec = this.charSpec,
            debug = "[",
            chars = charSpec.validChars || charSpec.invalidChars;

        if (charSpec.invalidChars) { debug += "^"; }
        debug += chars;
        debug += "]";

        if (charSpec.repeat) { debug += "+"; }

        return debug;
      }
      END IF **/
    };

    /** IF DEBUG
    function debug(log) {
      console.log(log);
    }

    function debugState(state) {
      return state.nextStates.map(function(n) {
        if (n.nextStates.length === 0) { return "( " + n.debug() + " [accepting] )"; }
        return "( " + n.debug() + " <then> " + n.nextStates.map(function(s) { return s.debug() }).join(" or ") + " )";
      }).join(", ")
    }
    END IF **/

    // This is a somewhat naive strategy, but should work in a lot of cases
    // A better strategy would properly resolve /posts/:id/new and /posts/edit/:id.
    //
    // This strategy generally prefers more static and less dynamic matching.
    // Specifically, it
    //
    //  * prefers fewer stars to more, then
    //  * prefers using stars for less of the match to more, then
    //  * prefers fewer dynamic segments to more, then
    //  * prefers more static segments to more
    function route$recognizer$$sortSolutions(states) {
      return states.sort(function(a, b) {
        if (a.types.stars !== b.types.stars) { return a.types.stars - b.types.stars; }

        if (a.types.stars) {
          if (a.types.statics !== b.types.statics) { return b.types.statics - a.types.statics; }
          if (a.types.dynamics !== b.types.dynamics) { return b.types.dynamics - a.types.dynamics; }
        }

        if (a.types.dynamics !== b.types.dynamics) { return a.types.dynamics - b.types.dynamics; }
        if (a.types.statics !== b.types.statics) { return b.types.statics - a.types.statics; }

        return 0;
      });
    }

    function route$recognizer$$recognizeChar(states, ch) {
      var nextStates = [];

      for (var i=0, l=states.length; i<l; i++) {
        var state = states[i];

        nextStates = nextStates.concat(state.match(ch));
      }

      return nextStates;
    }

    var route$recognizer$$oCreate = Object.create || function(proto) {
      function F() {}
      F.prototype = proto;
      return new F();
    };

    function route$recognizer$$RecognizeResults(queryParams) {
      this.queryParams = queryParams || {};
    }
    route$recognizer$$RecognizeResults.prototype = route$recognizer$$oCreate({
      splice: Array.prototype.splice,
      slice:  Array.prototype.slice,
      push:   Array.prototype.push,
      length: 0,
      queryParams: null
    });

    function route$recognizer$$findHandler(state, path, queryParams) {
      var handlers = state.handlers, regex = state.regex;
      var captures = path.match(regex), currentCapture = 1;
      var result = new route$recognizer$$RecognizeResults(queryParams);

      for (var i=0, l=handlers.length; i<l; i++) {
        var handler = handlers[i], names = handler.names, params = {};

        for (var j=0, m=names.length; j<m; j++) {
          params[names[j]] = captures[currentCapture++];
        }

        result.push({ handler: handler.handler, params: params, isDynamic: !!names.length });
      }

      return result;
    }

    function route$recognizer$$addSegment(currentState, segment) {
      segment.eachChar(function(ch) {
        var state;

        currentState = currentState.put(ch);
      });

      return currentState;
    }

    // The main interface

    var route$recognizer$$RouteRecognizer = function() {
      this.rootState = new route$recognizer$$State();
      this.names = {};
    };


    route$recognizer$$RouteRecognizer.prototype = {
      add: function(routes, options) {
        var currentState = this.rootState, regex = "^",
            types = { statics: 0, dynamics: 0, stars: 0 },
            handlers = [], allSegments = [], name;

        var isEmpty = true;

        for (var i=0, l=routes.length; i<l; i++) {
          var route = routes[i], names = [];

          var segments = route$recognizer$$parse(route.path, names, types);

          allSegments = allSegments.concat(segments);

          for (var j=0, m=segments.length; j<m; j++) {
            var segment = segments[j];

            if (segment instanceof route$recognizer$$EpsilonSegment) { continue; }

            isEmpty = false;

            // Add a "/" for the new segment
            currentState = currentState.put({ validChars: "/" });
            regex += "/";

            // Add a representation of the segment to the NFA and regex
            currentState = route$recognizer$$addSegment(currentState, segment);
            regex += segment.regex();
          }

          var handler = { handler: route.handler, names: names };
          handlers.push(handler);
        }

        if (isEmpty) {
          currentState = currentState.put({ validChars: "/" });
          regex += "/";
        }

        currentState.handlers = handlers;
        currentState.regex = new RegExp(regex + "$");
        currentState.types = types;

        if (name = options && options.as) {
          this.names[name] = {
            segments: allSegments,
            handlers: handlers
          };
        }
      },

      handlersFor: function(name) {
        var route = this.names[name], result = [];
        if (!route) { throw new Error("There is no route named " + name); }

        for (var i=0, l=route.handlers.length; i<l; i++) {
          result.push(route.handlers[i]);
        }

        return result;
      },

      hasRoute: function(name) {
        return !!this.names[name];
      },

      generate: function(name, params) {
        var route = this.names[name], output = "";
        if (!route) { throw new Error("There is no route named " + name); }

        var segments = route.segments;

        for (var i=0, l=segments.length; i<l; i++) {
          var segment = segments[i];

          if (segment instanceof route$recognizer$$EpsilonSegment) { continue; }

          output += "/";
          output += segment.generate(params);
        }

        if (output.charAt(0) !== '/') { output = '/' + output; }

        if (params && params.queryParams) {
          output += this.generateQueryString(params.queryParams, route.handlers);
        }

        return output;
      },

      generateQueryString: function(params, handlers) {
        var pairs = [];
        var keys = [];
        for(var key in params) {
          if (params.hasOwnProperty(key)) {
            keys.push(key);
          }
        }
        keys.sort();
        for (var i = 0, len = keys.length; i < len; i++) {
          key = keys[i];
          var value = params[key];
          if (value == null) {
            continue;
          }
          var pair = encodeURIComponent(key);
          if (route$recognizer$$isArray(value)) {
            for (var j = 0, l = value.length; j < l; j++) {
              var arrayPair = key + '[]' + '=' + encodeURIComponent(value[j]);
              pairs.push(arrayPair);
            }
          } else {
            pair += "=" + encodeURIComponent(value);
            pairs.push(pair);
          }
        }

        if (pairs.length === 0) { return ''; }

        return "?" + pairs.join("&");
      },

      parseQueryString: function(queryString) {
        var pairs = queryString.split("&"), queryParams = {};
        for(var i=0; i < pairs.length; i++) {
          var pair      = pairs[i].split('='),
              key       = decodeURIComponent(pair[0]),
              keyLength = key.length,
              isArray = false,
              value;
          if (pair.length === 1) {
            value = 'true';
          } else {
            //Handle arrays
            if (keyLength > 2 && key.slice(keyLength -2) === '[]') {
              isArray = true;
              key = key.slice(0, keyLength - 2);
              if(!queryParams[key]) {
                queryParams[key] = [];
              }
            }
            value = pair[1] ? decodeURIComponent(pair[1]) : '';
          }
          if (isArray) {
            queryParams[key].push(value);
          } else {
            queryParams[key] = value;
          }
        }
        return queryParams;
      },

      recognize: function(path) {
        var states = [ this.rootState ],
            pathLen, i, l, queryStart, queryParams = {},
            isSlashDropped = false;

        queryStart = path.indexOf('?');
        if (queryStart !== -1) {
          var queryString = path.substr(queryStart + 1, path.length);
          path = path.substr(0, queryStart);
          queryParams = this.parseQueryString(queryString);
        }

        path = decodeURI(path);

        // DEBUG GROUP path

        if (path.charAt(0) !== "/") { path = "/" + path; }

        pathLen = path.length;
        if (pathLen > 1 && path.charAt(pathLen - 1) === "/") {
          path = path.substr(0, pathLen - 1);
          isSlashDropped = true;
        }

        for (i=0, l=path.length; i<l; i++) {
          states = route$recognizer$$recognizeChar(states, path.charAt(i));
          if (!states.length) { break; }
        }

        // END DEBUG GROUP

        var solutions = [];
        for (i=0, l=states.length; i<l; i++) {
          if (states[i].handlers) { solutions.push(states[i]); }
        }

        states = route$recognizer$$sortSolutions(solutions);

        var state = solutions[0];

        if (state && state.handlers) {
          // if a trailing slash was dropped and a star segment is the last segment
          // specified, put the trailing slash back
          if (isSlashDropped && state.regex.source.slice(-5) === "(.+)$") {
            path = path + "/";
          }
          return route$recognizer$$findHandler(state, path, queryParams);
        }
      }
    };

    route$recognizer$$RouteRecognizer.prototype.map = route$recognizer$dsl$$default;

    var route$recognizer$$default = route$recognizer$$RouteRecognizer;
    function $$rsvp$events$$indexOf(callbacks, callback) {
      for (var i=0, l=callbacks.length; i<l; i++) {
        if (callbacks[i] === callback) { return i; }
      }

      return -1;
    }

    function $$rsvp$events$$callbacksFor(object) {
      var callbacks = object._promiseCallbacks;

      if (!callbacks) {
        callbacks = object._promiseCallbacks = {};
      }

      return callbacks;
    }

    var $$rsvp$events$$default = {

      /**
        `RSVP.EventTarget.mixin` extends an object with EventTarget methods. For
        Example:

        ```javascript
        var object = {};

        RSVP.EventTarget.mixin(object);

        object.on('finished', function(event) {
          // handle event
        });

        object.trigger('finished', { detail: value });
        ```

        `EventTarget.mixin` also works with prototypes:

        ```javascript
        var Person = function() {};
        RSVP.EventTarget.mixin(Person.prototype);

        var yehuda = new Person();
        var tom = new Person();

        yehuda.on('poke', function(event) {
          console.log('Yehuda says OW');
        });

        tom.on('poke', function(event) {
          console.log('Tom says OW');
        });

        yehuda.trigger('poke');
        tom.trigger('poke');
        ```

        @method mixin
        @for RSVP.EventTarget
        @private
        @param {Object} object object to extend with EventTarget methods
      */
      mixin: function(object) {
        object.on = this.on;
        object.off = this.off;
        object.trigger = this.trigger;
        object._promiseCallbacks = undefined;
        return object;
      },

      /**
        Registers a callback to be executed when `eventName` is triggered

        ```javascript
        object.on('event', function(eventInfo){
          // handle the event
        });

        object.trigger('event');
        ```

        @method on
        @for RSVP.EventTarget
        @private
        @param {String} eventName name of the event to listen for
        @param {Function} callback function to be called when the event is triggered.
      */
      on: function(eventName, callback) {
        var allCallbacks = $$rsvp$events$$callbacksFor(this), callbacks;

        callbacks = allCallbacks[eventName];

        if (!callbacks) {
          callbacks = allCallbacks[eventName] = [];
        }

        if ($$rsvp$events$$indexOf(callbacks, callback) === -1) {
          callbacks.push(callback);
        }
      },

      /**
        You can use `off` to stop firing a particular callback for an event:

        ```javascript
        function doStuff() { // do stuff! }
        object.on('stuff', doStuff);

        object.trigger('stuff'); // doStuff will be called

        // Unregister ONLY the doStuff callback
        object.off('stuff', doStuff);
        object.trigger('stuff'); // doStuff will NOT be called
        ```

        If you don't pass a `callback` argument to `off`, ALL callbacks for the
        event will not be executed when the event fires. For example:

        ```javascript
        var callback1 = function(){};
        var callback2 = function(){};

        object.on('stuff', callback1);
        object.on('stuff', callback2);

        object.trigger('stuff'); // callback1 and callback2 will be executed.

        object.off('stuff');
        object.trigger('stuff'); // callback1 and callback2 will not be executed!
        ```

        @method off
        @for RSVP.EventTarget
        @private
        @param {String} eventName event to stop listening to
        @param {Function} callback optional argument. If given, only the function
        given will be removed from the event's callback queue. If no `callback`
        argument is given, all callbacks will be removed from the event's callback
        queue.
      */
      off: function(eventName, callback) {
        var allCallbacks = $$rsvp$events$$callbacksFor(this), callbacks, index;

        if (!callback) {
          allCallbacks[eventName] = [];
          return;
        }

        callbacks = allCallbacks[eventName];

        index = $$rsvp$events$$indexOf(callbacks, callback);

        if (index !== -1) { callbacks.splice(index, 1); }
      },

      /**
        Use `trigger` to fire custom events. For example:

        ```javascript
        object.on('foo', function(){
          console.log('foo event happened!');
        });
        object.trigger('foo');
        // 'foo event happened!' logged to the console
        ```

        You can also pass a value as a second argument to `trigger` that will be
        passed as an argument to all event listeners for the event:

        ```javascript
        object.on('foo', function(value){
          console.log(value.name);
        });

        object.trigger('foo', { name: 'bar' });
        // 'bar' logged to the console
        ```

        @method trigger
        @for RSVP.EventTarget
        @private
        @param {String} eventName name of the event to be triggered
        @param {Any} options optional value to be passed to any event handlers for
        the given `eventName`
      */
      trigger: function(eventName, options) {
        var allCallbacks = $$rsvp$events$$callbacksFor(this), callbacks, callback;

        if (callbacks = allCallbacks[eventName]) {
          // Don't cache the callbacks.length since it may grow
          for (var i=0; i<callbacks.length; i++) {
            callback = callbacks[i];

            callback(options);
          }
        }
      }
    };

    var $$config$$config = {
      instrument: false
    };

    $$rsvp$events$$default.mixin($$config$$config);

    function $$config$$configure(name, value) {
      if (name === 'onerror') {
        // handle for legacy users that expect the actual
        // error to be passed to their function added via
        // `RSVP.configure('onerror', someFunctionHere);`
        $$config$$config.on('error', value);
        return;
      }

      if (arguments.length === 2) {
        $$config$$config[name] = value;
      } else {
        return $$config$$config[name];
      }
    }

    function $$utils1$$objectOrFunction(x) {
      return typeof x === 'function' || (typeof x === 'object' && x !== null);
    }

    function $$utils1$$isFunction(x) {
      return typeof x === 'function';
    }

    function $$utils1$$isMaybeThenable(x) {
      return typeof x === 'object' && x !== null;
    }

    var $$utils1$$_isArray;
    if (!Array.isArray) {
      $$utils1$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      };
    } else {
      $$utils1$$_isArray = Array.isArray;
    }

    var $$utils1$$isArray = $$utils1$$_isArray;

    var $$utils1$$now = Date.now || function() { return new Date().getTime(); };

    function $$utils1$$F() { }

    var $$utils1$$o_create = (Object.create || function (o) {
      if (arguments.length > 1) {
        throw new Error('Second argument not supported');
      }
      if (typeof o !== 'object') {
        throw new TypeError('Argument must be an object');
      }
      $$utils1$$F.prototype = o;
      return new $$utils1$$F();
    });

    var $$instrument$$queue = [];

    function $$instrument$$scheduleFlush() {
      setTimeout(function() {
        var entry;
        for (var i = 0; i < $$instrument$$queue.length; i++) {
          entry = $$instrument$$queue[i];

          var payload = entry.payload;

          payload.guid = payload.key + payload.id;
          payload.childGuid = payload.key + payload.childId;
          if (payload.error) {
            payload.stack = payload.error.stack;
          }

          $$config$$config.trigger(entry.name, entry.payload);
        }
        $$instrument$$queue.length = 0;
      }, 50);
    }

    function $$instrument$$instrument(eventName, promise, child) {
      if (1 === $$instrument$$queue.push({
          name: eventName,
          payload: {
            key: promise._guidKey,
            id:  promise._id,
            eventName: eventName,
            detail: promise._result,
            childId: child && child._id,
            label: promise._label,
            timeStamp: $$utils1$$now(),
            error: $$config$$config["instrument-with-stack"] ? new Error(promise._label) : null
          }})) {
            $$instrument$$scheduleFlush();
          }
      }
    var $$instrument$$default = $$instrument$$instrument;

    function  $$$internal$$withOwnPromise() {
      return new TypeError('A promises callback cannot return that same promise.');
    }

    function $$$internal$$noop() {}

    var $$$internal$$PENDING   = void 0;
    var $$$internal$$FULFILLED = 1;
    var $$$internal$$REJECTED  = 2;

    var $$$internal$$GET_THEN_ERROR = new $$$internal$$ErrorObject();

    function $$$internal$$getThen(promise) {
      try {
        return promise.then;
      } catch(error) {
        $$$internal$$GET_THEN_ERROR.error = error;
        return $$$internal$$GET_THEN_ERROR;
      }
    }

    function $$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
      try {
        then.call(value, fulfillmentHandler, rejectionHandler);
      } catch(e) {
        return e;
      }
    }

    function $$$internal$$handleForeignThenable(promise, thenable, then) {
      $$config$$config.async(function(promise) {
        var sealed = false;
        var error = $$$internal$$tryThen(then, thenable, function(value) {
          if (sealed) { return; }
          sealed = true;
          if (thenable !== value) {
            $$$internal$$resolve(promise, value);
          } else {
            $$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          if (sealed) { return; }
          sealed = true;

          $$$internal$$reject(promise, reason);
        }, 'Settle: ' + (promise._label || ' unknown promise'));

        if (!sealed && error) {
          sealed = true;
          $$$internal$$reject(promise, error);
        }
      }, promise);
    }

    function $$$internal$$handleOwnThenable(promise, thenable) {
      if (thenable._state === $$$internal$$FULFILLED) {
        $$$internal$$fulfill(promise, thenable._result);
      } else if (promise._state === $$$internal$$REJECTED) {
        $$$internal$$reject(promise, thenable._result);
      } else {
        $$$internal$$subscribe(thenable, undefined, function(value) {
          if (thenable !== value) {
            $$$internal$$resolve(promise, value);
          } else {
            $$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          $$$internal$$reject(promise, reason);
        });
      }
    }

    function $$$internal$$handleMaybeThenable(promise, maybeThenable) {
      if (maybeThenable.constructor === promise.constructor) {
        $$$internal$$handleOwnThenable(promise, maybeThenable);
      } else {
        var then = $$$internal$$getThen(maybeThenable);

        if (then === $$$internal$$GET_THEN_ERROR) {
          $$$internal$$reject(promise, $$$internal$$GET_THEN_ERROR.error);
        } else if (then === undefined) {
          $$$internal$$fulfill(promise, maybeThenable);
        } else if ($$utils1$$isFunction(then)) {
          $$$internal$$handleForeignThenable(promise, maybeThenable, then);
        } else {
          $$$internal$$fulfill(promise, maybeThenable);
        }
      }
    }

    function $$$internal$$resolve(promise, value) {
      if (promise === value) {
        $$$internal$$fulfill(promise, value);
      } else if ($$utils1$$objectOrFunction(value)) {
        $$$internal$$handleMaybeThenable(promise, value);
      } else {
        $$$internal$$fulfill(promise, value);
      }
    }

    function $$$internal$$publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._result);
      }

      $$$internal$$publish(promise);
    }

    function $$$internal$$fulfill(promise, value) {
      if (promise._state !== $$$internal$$PENDING) { return; }

      promise._result = value;
      promise._state = $$$internal$$FULFILLED;

      if (promise._subscribers.length === 0) {
        if ($$config$$config.instrument) {
          $$instrument$$default('fulfilled', promise);
        }
      } else {
        $$config$$config.async($$$internal$$publish, promise);
      }
    }

    function $$$internal$$reject(promise, reason) {
      if (promise._state !== $$$internal$$PENDING) { return; }
      promise._state = $$$internal$$REJECTED;
      promise._result = reason;

      $$config$$config.async($$$internal$$publishRejection, promise);
    }

    function $$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + $$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + $$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        $$config$$config.async($$$internal$$publish, parent);
      }
    }

    function $$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if ($$config$$config.instrument) {
        $$instrument$$default(settled === $$$internal$$FULFILLED ? 'fulfilled' : 'rejected', promise);
      }

      if (subscribers.length === 0) { return; }

      var child, callback, detail = promise._result;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        if (child) {
          $$$internal$$invokeCallback(settled, child, callback, detail);
        } else {
          callback(detail);
        }
      }

      promise._subscribers.length = 0;
    }

    function $$$internal$$ErrorObject() {
      this.error = null;
    }

    var $$$internal$$TRY_CATCH_ERROR = new $$$internal$$ErrorObject();

    function $$$internal$$tryCatch(callback, detail) {
      try {
        return callback(detail);
      } catch(e) {
        $$$internal$$TRY_CATCH_ERROR.error = e;
        return $$$internal$$TRY_CATCH_ERROR;
      }
    }

    function $$$internal$$invokeCallback(settled, promise, callback, detail) {
      var hasCallback = $$utils1$$isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        value = $$$internal$$tryCatch(callback, detail);

        if (value === $$$internal$$TRY_CATCH_ERROR) {
          failed = true;
          error = value.error;
          value = null;
        } else {
          succeeded = true;
        }

        if (promise === value) {
          $$$internal$$reject(promise, $$$internal$$withOwnPromise());
          return;
        }

      } else {
        value = detail;
        succeeded = true;
      }

      if (promise._state !== $$$internal$$PENDING) {
        // noop
      } else if (hasCallback && succeeded) {
        $$$internal$$resolve(promise, value);
      } else if (failed) {
        $$$internal$$reject(promise, error);
      } else if (settled === $$$internal$$FULFILLED) {
        $$$internal$$fulfill(promise, value);
      } else if (settled === $$$internal$$REJECTED) {
        $$$internal$$reject(promise, value);
      }
    }

    function $$$internal$$initializePromise(promise, resolver) {
      try {
        resolver(function resolvePromise(value){
          $$$internal$$resolve(promise, value);
        }, function rejectPromise(reason) {
          $$$internal$$reject(promise, reason);
        });
      } catch(e) {
        $$$internal$$reject(promise, e);
      }
    }

    function $$$enumerator$$makeSettledResult(state, position, value) {
      if (state === $$$internal$$FULFILLED) {
        return {
          state: 'fulfilled',
          value: value
        };
      } else {
        return {
          state: 'rejected',
          reason: value
        };
      }
    }

    function $$$enumerator$$Enumerator(Constructor, input, abortOnReject, label) {
      this._instanceConstructor = Constructor;
      this.promise = new Constructor($$$internal$$noop, label);
      this._abortOnReject = abortOnReject;

      if (this._validateInput(input)) {
        this._input     = input;
        this.length     = input.length;
        this._remaining = input.length;

        this._init();

        if (this.length === 0) {
          $$$internal$$fulfill(this.promise, this._result);
        } else {
          this.length = this.length || 0;
          this._enumerate();
          if (this._remaining === 0) {
            $$$internal$$fulfill(this.promise, this._result);
          }
        }
      } else {
        $$$internal$$reject(this.promise, this._validationError());
      }
    }

    $$$enumerator$$Enumerator.prototype._validateInput = function(input) {
      return $$utils1$$isArray(input);
    };

    $$$enumerator$$Enumerator.prototype._validationError = function() {
      return new Error('Array Methods must be provided an Array');
    };

    $$$enumerator$$Enumerator.prototype._init = function() {
      this._result = new Array(this.length);
    };

    var $$$enumerator$$default = $$$enumerator$$Enumerator;

    $$$enumerator$$Enumerator.prototype._enumerate = function() {
      var length  = this.length;
      var promise = this.promise;
      var input   = this._input;

      for (var i = 0; promise._state === $$$internal$$PENDING && i < length; i++) {
        this._eachEntry(input[i], i);
      }
    };

    $$$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
      var c = this._instanceConstructor;
      if ($$utils1$$isMaybeThenable(entry)) {
        if (entry.constructor === c && entry._state !== $$$internal$$PENDING) {
          entry._onerror = null;
          this._settledAt(entry._state, i, entry._result);
        } else {
          this._willSettleAt(c.resolve(entry), i);
        }
      } else {
        this._remaining--;
        this._result[i] = this._makeResult($$$internal$$FULFILLED, i, entry);
      }
    };

    $$$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
      var promise = this.promise;

      if (promise._state === $$$internal$$PENDING) {
        this._remaining--;

        if (this._abortOnReject && state === $$$internal$$REJECTED) {
          $$$internal$$reject(promise, value);
        } else {
          this._result[i] = this._makeResult(state, i, value);
        }
      }

      if (this._remaining === 0) {
        $$$internal$$fulfill(promise, this._result);
      }
    };

    $$$enumerator$$Enumerator.prototype._makeResult = function(state, i, value) {
      return value;
    };

    $$$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      $$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt($$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt($$$internal$$REJECTED, i, reason);
      });
    };
    function $$promise$all$$all(entries, label) {
      return new $$$enumerator$$default(this, entries, true /* abort on reject */, label).promise;
    }
    var $$promise$all$$default = $$promise$all$$all;
    function $$promise$race$$race(entries, label) {
      /*jshint validthis:true */
      var Constructor = this;

      var promise = new Constructor($$$internal$$noop, label);

      if (!$$utils1$$isArray(entries)) {
        $$$internal$$reject(promise, new TypeError('You must pass an array to race.'));
        return promise;
      }

      var length = entries.length;

      function onFulfillment(value) {
        $$$internal$$resolve(promise, value);
      }

      function onRejection(reason) {
        $$$internal$$reject(promise, reason);
      }

      for (var i = 0; promise._state === $$$internal$$PENDING && i < length; i++) {
        $$$internal$$subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
      }

      return promise;
    }
    var $$promise$race$$default = $$promise$race$$race;
    function $$promise$resolve$$resolve(object, label) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      var promise = new Constructor($$$internal$$noop, label);
      $$$internal$$resolve(promise, object);
      return promise;
    }
    var $$promise$resolve$$default = $$promise$resolve$$resolve;
    function $$promise$reject$$reject(reason, label) {
      /*jshint validthis:true */
      var Constructor = this;
      var promise = new Constructor($$$internal$$noop, label);
      $$$internal$$reject(promise, reason);
      return promise;
    }
    var $$promise$reject$$default = $$promise$reject$$reject;

    var rsvp$promise$$guidKey = 'rsvp_' + $$utils1$$now() + '-';
    var rsvp$promise$$counter = 0;

    function rsvp$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function rsvp$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }
    var rsvp$promise$$default = rsvp$promise$$Promise;
    /**
      Promise objects represent the eventual result of an asynchronous operation. The
      primary way of interacting with a promise is through its `then` method, which
      registers callbacks to receive either a promise’s eventual value or the reason
      why the promise cannot be fulfilled.

      Terminology
      -----------

      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
      - `thenable` is an object or function that defines a `then` method.
      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
      - `exception` is a value that is thrown using the throw statement.
      - `reason` is a value that indicates why a promise was rejected.
      - `settled` the final resting state of a promise, fulfilled or rejected.

      A promise can be in one of three states: pending, fulfilled, or rejected.

      Promises that are fulfilled have a fulfillment value and are in the fulfilled
      state.  Promises that are rejected have a rejection reason and are in the
      rejected state.  A fulfillment value is never a thenable.

      Promises can also be said to *resolve* a value.  If this value is also a
      promise, then the original promise's settled state will match the value's
      settled state.  So a promise that *resolves* a promise that rejects will
      itself reject, and a promise that *resolves* a promise that fulfills will
      itself fulfill.


      Basic Usage:
      ------------

      ```js
      var promise = new Promise(function(resolve, reject) {
        // on success
        resolve(value);

        // on failure
        reject(reason);
      });

      promise.then(function(value) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Advanced Usage:
      ---------------

      Promises shine when abstracting away asynchronous interactions such as
      `XMLHttpRequest`s.

      ```js
      function getJSON(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();

          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'json';
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
              }
            }
          };
        });
      }

      getJSON('/posts.json').then(function(json) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Unlike callbacks, promises are great composable primitives.

      ```js
      Promise.all([
        getJSON('/posts'),
        getJSON('/comments')
      ]).then(function(values){
        values[0] // => postsJSON
        values[1] // => commentsJSON

        return values;
      });
      ```

      @class RSVP.Promise
      @param {function} resolver
      @param {String} label optional string for labeling the promise.
      Useful for tooling.
      @constructor
    */
    function rsvp$promise$$Promise(resolver, label) {
      this._id = rsvp$promise$$counter++;
      this._label = label;
      this._state = undefined;
      this._result = undefined;
      this._subscribers = [];

      if ($$config$$config.instrument) {
        $$instrument$$default('created', this);
      }

      if ($$$internal$$noop !== resolver) {
        if (!$$utils1$$isFunction(resolver)) {
          rsvp$promise$$needsResolver();
        }

        if (!(this instanceof rsvp$promise$$Promise)) {
          rsvp$promise$$needsNew();
        }

        $$$internal$$initializePromise(this, resolver);
      }
    }

    // deprecated
    rsvp$promise$$Promise.cast = $$promise$resolve$$default;
    rsvp$promise$$Promise.all = $$promise$all$$default;
    rsvp$promise$$Promise.race = $$promise$race$$default;
    rsvp$promise$$Promise.resolve = $$promise$resolve$$default;
    rsvp$promise$$Promise.reject = $$promise$reject$$default;

    rsvp$promise$$Promise.prototype = {
      constructor: rsvp$promise$$Promise,

      _guidKey: rsvp$promise$$guidKey,

      _onerror: function (reason) {
        $$config$$config.trigger('error', reason);
      },

    /**
      The primary way of interacting with a promise is through its `then` method,
      which registers callbacks to receive either a promise's eventual value or the
      reason why the promise cannot be fulfilled.

      ```js
      findUser().then(function(user){
        // user is available
      }, function(reason){
        // user is unavailable, and you are given the reason why
      });
      ```

      Chaining
      --------

      The return value of `then` is itself a promise.  This second, 'downstream'
      promise is resolved with the return value of the first promise's fulfillment
      or rejection handler, or rejected if the handler throws an exception.

      ```js
      findUser().then(function (user) {
        return user.name;
      }, function (reason) {
        return 'default name';
      }).then(function (userName) {
        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
        // will be `'default name'`
      });

      findUser().then(function (user) {
        throw new Error('Found user, but still unhappy');
      }, function (reason) {
        throw new Error('`findUser` rejected and we're unhappy');
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
      });
      ```
      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

      ```js
      findUser().then(function (user) {
        throw new PedagogicalException('Upstream error');
      }).then(function (value) {
        // never reached
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // The `PedgagocialException` is propagated all the way down to here
      });
      ```

      Assimilation
      ------------

      Sometimes the value you want to propagate to a downstream promise can only be
      retrieved asynchronously. This can be achieved by returning a promise in the
      fulfillment or rejection handler. The downstream promise will then be pending
      until the returned promise is settled. This is called *assimilation*.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // The user's comments are now available
      });
      ```

      If the assimliated promise rejects, then the downstream promise will also reject.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // If `findCommentsByAuthor` fulfills, we'll have the value here
      }, function (reason) {
        // If `findCommentsByAuthor` rejects, we'll have the reason here
      });
      ```

      Simple Example
      --------------

      Synchronous Example

      ```javascript
      var result;

      try {
        result = findResult();
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js
      findResult(function(result, err){
        if (err) {
          // failure
        } else {
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findResult().then(function(result){
        // success
      }, function(reason){
        // failure
      });
      ```

      Advanced Example
      --------------

      Synchronous Example

      ```javascript
      var author, books;

      try {
        author = findAuthor();
        books  = findBooksByAuthor(author);
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js

      function foundBooks(books) {

      }

      function failure(reason) {

      }

      findAuthor(function(author, err){
        if (err) {
          failure(err);
          // failure
        } else {
          try {
            findBoooksByAuthor(author, function(books, err) {
              if (err) {
                failure(err);
              } else {
                try {
                  foundBooks(books);
                } catch(reason) {
                  failure(reason);
                }
              }
            });
          } catch(error) {
            failure(err);
          }
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findAuthor().
        then(findBooksByAuthor).
        then(function(books){
          // found books
      }).catch(function(reason){
        // something went wrong
      });
      ```

      @method then
      @param {Function} onFulfilled
      @param {Function} onRejected
      @param {String} label optional string for labeling the promise.
      Useful for tooling.
      @return {Promise}
    */
      then: function(onFulfillment, onRejection, label) {
        var parent = this;
        var state = parent._state;

        if (state === $$$internal$$FULFILLED && !onFulfillment || state === $$$internal$$REJECTED && !onRejection) {
          if ($$config$$config.instrument) {
            $$instrument$$default('chained', this, this);
          }
          return this;
        }

        parent._onerror = null;

        var child = new this.constructor($$$internal$$noop, label);
        var result = parent._result;

        if ($$config$$config.instrument) {
          $$instrument$$default('chained', parent, child);
        }

        if (state) {
          var callback = arguments[state - 1];
          $$config$$config.async(function(){
            $$$internal$$invokeCallback(state, child, callback, result);
          });
        } else {
          $$$internal$$subscribe(parent, child, onFulfillment, onRejection);
        }

        return child;
      },

    /**
      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
      as the catch block of a try/catch statement.

      ```js
      function findAuthor(){
        throw new Error('couldn't find that author');
      }

      // synchronous
      try {
        findAuthor();
      } catch(reason) {
        // something went wrong
      }

      // async with promises
      findAuthor().catch(function(reason){
        // something went wrong
      });
      ```

      @method catch
      @param {Function} onRejection
      @param {String} label optional string for labeling the promise.
      Useful for tooling.
      @return {Promise}
    */
      'catch': function(onRejection, label) {
        return this.then(null, onRejection, label);
      },

    /**
      `finally` will be invoked regardless of the promise's fate just as native
      try/catch/finally behaves

      Synchronous example:

      ```js
      findAuthor() {
        if (Math.random() > 0.5) {
          throw new Error();
        }
        return new Author();
      }

      try {
        return findAuthor(); // succeed or fail
      } catch(error) {
        return findOtherAuther();
      } finally {
        // always runs
        // doesn't affect the return value
      }
      ```

      Asynchronous example:

      ```js
      findAuthor().catch(function(reason){
        return findOtherAuther();
      }).finally(function(){
        // author was either found, or not
      });
      ```

      @method finally
      @param {Function} callback
      @param {String} label optional string for labeling the promise.
      Useful for tooling.
      @return {Promise}
    */
      'finally': function(callback, label) {
        var constructor = this.constructor;

        return this.then(function(value) {
          return constructor.resolve(callback()).then(function(){
            return value;
          });
        }, function(reason) {
          return constructor.resolve(callback()).then(function(){
            throw reason;
          });
        }, label);
      }
    };
    var $$utils$$slice = Array.prototype.slice;

    var $$utils$$_isArray;
    if (!Array.isArray) {
      $$utils$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === "[object Array]";
      };
    } else {
      $$utils$$_isArray = Array.isArray;
    }

    var $$utils$$isArray = $$utils$$_isArray;

    function $$utils$$merge(hash, other) {
      for (var prop in other) {
        if (other.hasOwnProperty(prop)) { hash[prop] = other[prop]; }
      }
    }

    var $$utils$$oCreate = Object.create || function(proto) {
      function F() {}
      F.prototype = proto;
      return new F();
    };

    function $$utils$$extractQueryParams(array) {
      var len = (array && array.length), head, queryParams;

      if(len && len > 0 && array[len - 1] && array[len - 1].hasOwnProperty('queryParams')) {
        queryParams = array[len - 1].queryParams;
        head = $$utils$$slice.call(array, 0, len - 1);
        return [head, queryParams];
      } else {
        return [array, null];
      }
    }

    /**
      @private

      Coerces query param properties and array elements into strings.
    **/
    function $$utils$$coerceQueryParamsToString(queryParams) {
      for (var key in queryParams) {
        if (typeof queryParams[key] === 'number') {
          queryParams[key] = '' + queryParams[key];
        } else if ($$utils$$isArray(queryParams[key])) {
          for (var i = 0, l = queryParams[key].length; i < l; i++) {
            queryParams[key][i] = '' + queryParams[key][i];
          }
        }
      }
    }
    function $$utils$$log(router, sequence, msg) {
      if (!router.log) { return; }

      if (arguments.length === 3) {
        router.log("Transition #" + sequence + ": " + msg);
      } else {
        msg = sequence;
        router.log(msg);
      }
    }

    function $$utils$$bind(fn, context) {
      var boundArgs = arguments;
      return function(value) {
        var args = $$utils$$slice.call(boundArgs, 2);
        args.push(value);
        return fn.apply(context, args);
      };
    }

    function $$utils$$isParam(object) {
      return (typeof object === "string" || object instanceof String || typeof object === "number" || object instanceof Number);
    }


    function $$utils$$forEach(array, callback) {
      for (var i=0, l=array.length; i<l && false !== callback(array[i]); i++) { }
    }

    function $$utils$$serialize(handler, model, names) {
      var object = {};
      if ($$utils$$isParam(model)) {
        object[names[0]] = model;
        return object;
      }

      // Use custom serialize if it exists.
      if (handler.serialize) {
        return handler.serialize(model, names);
      }

      if (names.length !== 1) { return; }

      var name = names[0];

      if (/_id$/.test(name)) {
        object[name] = model.id;
      } else {
        object[name] = model;
      }
      return object;
    }

    function $$utils$$trigger(router, handlerInfos, ignoreFailure, args) {
      if (router.triggerEvent) {
        router.triggerEvent(handlerInfos, ignoreFailure, args);
        return;
      }

      var name = args.shift();

      if (!handlerInfos) {
        if (ignoreFailure) { return; }
        throw new Error("Could not trigger event '" + name + "'. There are no active handlers");
      }

      var eventWasHandled = false;

      for (var i=handlerInfos.length-1; i>=0; i--) {
        var handlerInfo = handlerInfos[i],
            handler = handlerInfo.handler;

        if (handler.events && handler.events[name]) {
          if (handler.events[name].apply(handler, args) === true) {
            eventWasHandled = true;
          } else {
            return;
          }
        }
      }

      if (!eventWasHandled && !ignoreFailure) {
        throw new Error("Nothing handled the event '" + name + "'.");
      }
    }

    function $$utils$$getChangelist(oldObject, newObject) {
      var key;
      var results = {
        all: {},
        changed: {},
        removed: {}
      };

      $$utils$$merge(results.all, newObject);

      var didChange = false;
      $$utils$$coerceQueryParamsToString(oldObject);
      $$utils$$coerceQueryParamsToString(newObject);

      // Calculate removals
      for (key in oldObject) {
        if (oldObject.hasOwnProperty(key)) {
          if (!newObject.hasOwnProperty(key)) {
            didChange = true;
            results.removed[key] = oldObject[key];
          }
        }
      }

      // Calculate changes
      for (key in newObject) {
        if (newObject.hasOwnProperty(key)) {
          if ($$utils$$isArray(oldObject[key]) && $$utils$$isArray(newObject[key])) {
            if (oldObject[key].length !== newObject[key].length) {
              results.changed[key] = newObject[key];
              didChange = true;
            } else {
              for (var i = 0, l = oldObject[key].length; i < l; i++) {
                if (oldObject[key][i] !== newObject[key][i]) {
                  results.changed[key] = newObject[key];
                  didChange = true;
                }
              }
            }
          }
          else {
            if (oldObject[key] !== newObject[key]) {
              results.changed[key] = newObject[key];
              didChange = true;
            }
          }
        }
      }

      return didChange && results;
    }

    function $$utils$$promiseLabel(label) {
      return 'Router: ' + label;
    }

    function router$handler$info$$HandlerInfo(props) {
      if (props) {
        $$utils$$merge(this, props);
      }
    }

    router$handler$info$$HandlerInfo.prototype = {
      name: null,
      handler: null,
      params: null,
      context: null,

      log: function(payload, message) {
        if (payload.log) {
          payload.log(this.name + ': ' + message);
        }
      },

      promiseLabel: function(label) {
        return $$utils$$promiseLabel("'" + this.name + "' " + label);
      },

      getUnresolved: function() {
        return this;
      },

      resolve: function(async, shouldContinue, payload) {
        var checkForAbort  = $$utils$$bind(this.checkForAbort,      this, shouldContinue),
            beforeModel    = $$utils$$bind(this.runBeforeModelHook, this, async, payload),
            model          = $$utils$$bind(this.getModel,           this, async, payload),
            afterModel     = $$utils$$bind(this.runAfterModelHook,  this, async, payload),
            becomeResolved = $$utils$$bind(this.becomeResolved,     this, payload);

        return rsvp$promise$$default.resolve(undefined, this.promiseLabel("Start handler"))
               .then(checkForAbort, null, this.promiseLabel("Check for abort"))
               .then(beforeModel, null, this.promiseLabel("Before model"))
               .then(checkForAbort, null, this.promiseLabel("Check if aborted during 'beforeModel' hook"))
               .then(model, null, this.promiseLabel("Model"))
               .then(checkForAbort, null, this.promiseLabel("Check if aborted in 'model' hook"))
               .then(afterModel, null, this.promiseLabel("After model"))
               .then(checkForAbort, null, this.promiseLabel("Check if aborted in 'afterModel' hook"))
               .then(becomeResolved, null, this.promiseLabel("Become resolved"));
      },

      runBeforeModelHook: function(async, payload) {
        if (payload.trigger) {
          payload.trigger(true, 'willResolveModel', payload, this.handler);
        }
        return this.runSharedModelHook(async, payload, 'beforeModel', []);
      },

      runAfterModelHook: function(async, payload, resolvedModel) {
        // Stash the resolved model on the payload.
        // This makes it possible for users to swap out
        // the resolved model in afterModel.
        var name = this.name;
        this.stashResolvedModel(payload, resolvedModel);

        return this.runSharedModelHook(async, payload, 'afterModel', [resolvedModel])
                   .then(function() {
                     // Ignore the fulfilled value returned from afterModel.
                     // Return the value stashed in resolvedModels, which
                     // might have been swapped out in afterModel.
                     return payload.resolvedModels[name];
                   }, null, this.promiseLabel("Ignore fulfillment value and return model value"));
      },

      runSharedModelHook: function(async, payload, hookName, args) {
        this.log(payload, "calling " + hookName + " hook");

        if (this.queryParams) {
          args.push(this.queryParams);
        }
        args.push(payload);

        var handler = this.handler;
        return async(function() {
          return handler[hookName] && handler[hookName].apply(handler, args);
        }, this.promiseLabel("Handle " + hookName));
      },

      getModel: function(payload) {
        throw new Error("This should be overridden by a subclass of HandlerInfo");
      },

      checkForAbort: function(shouldContinue, promiseValue) {
        return rsvp$promise$$default.resolve(shouldContinue(), this.promiseLabel("Check for abort")).then(function() {
          // We don't care about shouldContinue's resolve value;
          // pass along the original value passed to this fn.
          return promiseValue;
        }, null, this.promiseLabel("Ignore fulfillment value and continue"));
      },

      stashResolvedModel: function(payload, resolvedModel) {
        payload.resolvedModels = payload.resolvedModels || {};
        payload.resolvedModels[this.name] = resolvedModel;
      },

      becomeResolved: function(payload, resolvedContext) {
        var params = this.params || $$utils$$serialize(this.handler, resolvedContext, this.names);

        if (payload) {
          this.stashResolvedModel(payload, resolvedContext);
          payload.params = payload.params || {};
          payload.params[this.name] = params;
        }

        return new router$handler$info$$ResolvedHandlerInfo({
          context: resolvedContext,
          name: this.name,
          handler: this.handler,
          params: params
        });
      },

      shouldSupercede: function(other) {
        // Prefer this newer handlerInfo over `other` if:
        // 1) The other one doesn't exist
        // 2) The names don't match
        // 3) This handler has a context that doesn't match
        //    the other one (or the other one doesn't have one).
        // 4) This handler has parameters that don't match the other.
        if (!other) { return true; }

        var contextsMatch = (other.context === this.context);
        return other.name !== this.name ||
               (this.hasOwnProperty('context') && !contextsMatch) ||
               (this.hasOwnProperty('params') && !router$handler$info$$paramsMatch(this.params, other.params));
      }
    };

    function router$handler$info$$ResolvedHandlerInfo(props) {
      router$handler$info$$HandlerInfo.call(this, props);
    }

    router$handler$info$$ResolvedHandlerInfo.prototype = $$utils$$oCreate(router$handler$info$$HandlerInfo.prototype);
    router$handler$info$$ResolvedHandlerInfo.prototype.resolve = function(async, shouldContinue, payload) {
      // A ResolvedHandlerInfo just resolved with itself.
      if (payload && payload.resolvedModels) {
        payload.resolvedModels[this.name] = this.context;
      }
      return rsvp$promise$$default.resolve(this, this.promiseLabel("Resolve"));
    };

    router$handler$info$$ResolvedHandlerInfo.prototype.getUnresolved = function() {
      return new router$handler$info$$UnresolvedHandlerInfoByParam({
        name: this.name,
        handler: this.handler,
        params: this.params
      });
    };

    // These are generated by URL transitions and
    // named transitions for non-dynamic route segments.
    function router$handler$info$$UnresolvedHandlerInfoByParam(props) {
      router$handler$info$$HandlerInfo.call(this, props);
      this.params = this.params || {};
    }

    router$handler$info$$UnresolvedHandlerInfoByParam.prototype = $$utils$$oCreate(router$handler$info$$HandlerInfo.prototype);
    router$handler$info$$UnresolvedHandlerInfoByParam.prototype.getModel = function(async, payload) {
      var fullParams = this.params;
      if (payload && payload.queryParams) {
        fullParams = {};
        $$utils$$merge(fullParams, this.params);
        fullParams.queryParams = payload.queryParams;
      }

      var hookName = typeof this.handler.deserialize === 'function' ?
                     'deserialize' : 'model';

      return this.runSharedModelHook(async, payload, hookName, [fullParams]);
    };


    // These are generated only for named transitions
    // with dynamic route segments.
    function router$handler$info$$UnresolvedHandlerInfoByObject(props) {
      router$handler$info$$HandlerInfo.call(this, props);
    }

    router$handler$info$$UnresolvedHandlerInfoByObject.prototype = $$utils$$oCreate(router$handler$info$$HandlerInfo.prototype);
    router$handler$info$$UnresolvedHandlerInfoByObject.prototype.getModel = function(async, payload) {
      this.log(payload, this.name + ": resolving provided model");
      return rsvp$promise$$default.resolve(this.context);
    };

    function router$handler$info$$paramsMatch(a, b) {
      if ((!a) ^ (!b)) {
        // Only one is null.
        return false;
      }

      if (!a) {
        // Both must be null.
        return true;
      }

      // Note: this assumes that both params have the same
      // number of keys, but since we're comparing the
      // same handlers, they should.
      for (var k in a) {
        if (a.hasOwnProperty(k) && a[k] !== b[k]) {
          return false;
        }
      }
      return true;
    }

    function $$transition$state$$TransitionState(other) {
      this.handlerInfos = [];
      this.queryParams = {};
      this.params = {};
    }

    $$transition$state$$TransitionState.prototype = {
      handlerInfos: null,
      queryParams: null,
      params: null,

      promiseLabel: function(label) {
        var targetName = '';
        $$utils$$forEach(this.handlerInfos, function(handlerInfo) {
          if (targetName !== '') {
            targetName += '.';
          }
          targetName += handlerInfo.name;
        });
        return $$utils$$promiseLabel("'" + targetName + "': " + label);
      },

      resolve: function(async, shouldContinue, payload) {
        var self = this;
        // First, calculate params for this state. This is useful
        // information to provide to the various route hooks.
        var params = this.params;
        $$utils$$forEach(this.handlerInfos, function(handlerInfo) {
          params[handlerInfo.name] = handlerInfo.params || {};
        });

        payload = payload || {};
        payload.resolveIndex = 0;

        var currentState = this;
        var wasAborted = false;

        // The prelude RSVP.resolve() asyncs us into the promise land.
        return rsvp$promise$$default.resolve(null, this.promiseLabel("Start transition"))
        .then(resolveOneHandlerInfo, null, this.promiseLabel('Resolve handler'))['catch'](handleError, this.promiseLabel('Handle error'));

        function innerShouldContinue() {
          return rsvp$promise$$default.resolve(shouldContinue(), $$utils$$promiseLabel("Check if should continue"))['catch'](function(reason) {
            // We distinguish between errors that occurred
            // during resolution (e.g. beforeModel/model/afterModel),
            // and aborts due to a rejecting promise from shouldContinue().
            wasAborted = true;
            return rsvp$promise$$default.reject(reason);
          }, $$utils$$promiseLabel("Handle abort"));
        }

        function handleError(error) {
          // This is the only possible
          // reject value of TransitionState#resolve
          var handlerInfos = currentState.handlerInfos;
          var errorHandlerIndex = payload.resolveIndex >= handlerInfos.length ?
                                  handlerInfos.length - 1 : payload.resolveIndex;
          return rsvp$promise$$default.reject({
            error: error,
            handlerWithError: currentState.handlerInfos[errorHandlerIndex].handler,
            wasAborted: wasAborted,
            state: currentState
          });
        }

        function proceed(resolvedHandlerInfo) {
          // Swap the previously unresolved handlerInfo with
          // the resolved handlerInfo
          currentState.handlerInfos[payload.resolveIndex++] = resolvedHandlerInfo;

          // Call the redirect hook. The reason we call it here
          // vs. afterModel is so that redirects into child
          // routes don't re-run the model hooks for this
          // already-resolved route.
          var handler = resolvedHandlerInfo.handler;
          if (handler && handler.redirect) {
            handler.redirect(resolvedHandlerInfo.context, payload);
          }

          // Proceed after ensuring that the redirect hook
          // didn't abort this transition by transitioning elsewhere.
          return innerShouldContinue().then(resolveOneHandlerInfo, null, $$utils$$promiseLabel('Resolve handler'));
        }

        function resolveOneHandlerInfo() {
          if (payload.resolveIndex === currentState.handlerInfos.length) {
            // This is is the only possible
            // fulfill value of TransitionState#resolve
            return {
              error: null,
              state: currentState
            };
          }

          var handlerInfo = currentState.handlerInfos[payload.resolveIndex];

          return handlerInfo.resolve(async, innerShouldContinue, payload)
                            .then(proceed, null, $$utils$$promiseLabel('Proceed'));
        }
      }
    };

    var $$transition$state$$default = $$transition$state$$TransitionState;

    /**
      @private

      A Transition is a thennable (a promise-like object) that represents
      an attempt to transition to another route. It can be aborted, either
      explicitly via `abort` or by attempting another transition while a
      previous one is still underway. An aborted transition can also
      be `retry()`d later.
     */
    function $$transition$$Transition(router, intent, state, error) {
      var transition = this;
      this.state = state || router.state;
      this.intent = intent;
      this.router = router;
      this.data = this.intent && this.intent.data || {};
      this.resolvedModels = {};
      this.queryParams = {};

      if (error) {
        this.promise = rsvp$promise$$default.reject(error);
        return;
      }

      if (state) {
        this.params = state.params;
        this.queryParams = state.queryParams;

        var len = state.handlerInfos.length;
        if (len) {
          this.targetName = state.handlerInfos[state.handlerInfos.length-1].name;
        }

        for (var i = 0; i < len; ++i) {
          var handlerInfo = state.handlerInfos[i];
          if (!(handlerInfo instanceof router$handler$info$$ResolvedHandlerInfo)) {
            break;
          }
          this.pivotHandler = handlerInfo.handler;
        }

        this.sequence = $$transition$$Transition.currentSequence++;
        this.promise = state.resolve(router.async, checkForAbort, this)['catch'](function(result) {
          if (result.wasAborted || transition.isAborted) {
            return rsvp$promise$$default.reject($$transition$$logAbort(transition));
          } else {
            transition.trigger('error', result.error, transition, result.handlerWithError);
            transition.abort();
            return rsvp$promise$$default.reject(result.error);
          }
        }, $$utils$$promiseLabel('Handle Abort'));
      } else {
        this.promise = rsvp$promise$$default.resolve(this.state);
        this.params = {};
      }

      function checkForAbort() {
        if (transition.isAborted) {
          return rsvp$promise$$default.reject(undefined, $$utils$$promiseLabel("Transition aborted - reject"));
        }
      }
    }

    $$transition$$Transition.currentSequence = 0;

    $$transition$$Transition.prototype = {
      targetName: null,
      urlMethod: 'update',
      intent: null,
      params: null,
      pivotHandler: null,
      resolveIndex: 0,
      handlerInfos: null,
      resolvedModels: null,
      isActive: true,
      state: null,

      /**
        @public

        The Transition's internal promise. Calling `.then` on this property
        is that same as calling `.then` on the Transition object itself, but
        this property is exposed for when you want to pass around a
        Transition's promise, but not the Transition object itself, since
        Transition object can be externally `abort`ed, while the promise
        cannot.
       */
      promise: null,

      /**
        @public

        Custom state can be stored on a Transition's `data` object.
        This can be useful for decorating a Transition within an earlier
        hook and shared with a later hook. Properties set on `data` will
        be copied to new transitions generated by calling `retry` on this
        transition.
       */
      data: null,

      /**
        @public

        A standard promise hook that resolves if the transition
        succeeds and rejects if it fails/redirects/aborts.

        Forwards to the internal `promise` property which you can
        use in situations where you want to pass around a thennable,
        but not the Transition itself.

        @param {Function} success
        @param {Function} failure
       */
      then: function(success, failure) {
        return this.promise.then(success, failure);
      },

      /**
        @public

        Aborts the Transition. Note you can also implicitly abort a transition
        by initiating another transition while a previous one is underway.
       */
      abort: function() {
        if (this.isAborted) { return this; }
        $$utils$$log(this.router, this.sequence, this.targetName + ": transition was aborted");
        this.isAborted = true;
        this.isActive = false;
        this.router.activeTransition = null;
        return this;
      },

      /**
        @public

        Retries a previously-aborted transition (making sure to abort the
        transition if it's still active). Returns a new transition that
        represents the new attempt to transition.
       */
      retry: function() {
        // TODO: add tests for merged state retry()s
        this.abort();
        return this.router.transitionByIntent(this.intent, false);
      },

      /**
        @public

        Sets the URL-changing method to be employed at the end of a
        successful transition. By default, a new Transition will just
        use `updateURL`, but passing 'replace' to this method will
        cause the URL to update using 'replaceWith' instead. Omitting
        a parameter will disable the URL change, allowing for transitions
        that don't update the URL at completion (this is also used for
        handleURL, since the URL has already changed before the
        transition took place).

        @param {String} method the type of URL-changing method to use
          at the end of a transition. Accepted values are 'replace',
          falsy values, or any other non-falsy value (which is
          interpreted as an updateURL transition).

        @return {Transition} this transition
       */
      method: function(method) {
        this.urlMethod = method;
        return this;
      },

      /**
        @public

        Fires an event on the current list of resolved/resolving
        handlers within this transition. Useful for firing events
        on route hierarchies that haven't fully been entered yet.

        Note: This method is also aliased as `send`

        @param {Boolean} [ignoreFailure=false] a boolean specifying whether unhandled events throw an error
        @param {String} name the name of the event to fire
       */
      trigger: function (ignoreFailure) {
        var args = $$utils$$slice.call(arguments);
        if (typeof ignoreFailure === 'boolean') {
          args.shift();
        } else {
          // Throw errors on unhandled trigger events by default
          ignoreFailure = false;
        }
        $$utils$$trigger(this.router, this.state.handlerInfos.slice(0, this.resolveIndex + 1), ignoreFailure, args);
      },

      /**
        @public

        Transitions are aborted and their promises rejected
        when redirects occur; this method returns a promise
        that will follow any redirects that occur and fulfill
        with the value fulfilled by any redirecting transitions
        that occur.

        @return {Promise} a promise that fulfills with the same
          value that the final redirecting transition fulfills with
       */
      followRedirects: function() {
        var router = this.router;
        return this.promise['catch'](function(reason) {
          if (router.activeTransition) {
            return router.activeTransition.followRedirects();
          }
          return rsvp$promise$$default.reject(reason);
        });
      },

      toString: function() {
        return "Transition (sequence " + this.sequence + ")";
      },

      /**
        @private
       */
      log: function(message) {
        $$utils$$log(this.router, this.sequence, message);
      }
    };

    // Alias 'trigger' as 'send'
    $$transition$$Transition.prototype.send = $$transition$$Transition.prototype.trigger;

    /**
      @private

      Logs and returns a TransitionAborted error.
     */
    function $$transition$$logAbort(transition) {
      $$utils$$log(transition.router, transition.sequence, "detected abort.");
      return new $$transition$$TransitionAborted();
    }

    function $$transition$$TransitionAborted(message) {
      this.message = (message || "TransitionAborted");
      this.name = "TransitionAborted";
    }

    function router$transition$intent$$TransitionIntent(props) {
      if (props) {
        $$utils$$merge(this, props);
      }
      this.data = this.data || {};
    }

    router$transition$intent$$TransitionIntent.prototype.applyToState = function(oldState) {
      // Default TransitionIntent is a no-op.
      return oldState;
    };

    var router$transition$intent$$default = router$transition$intent$$TransitionIntent;

    function $$transition$intent$named$transition$intent$$NamedTransitionIntent(props) {
      router$transition$intent$$default.call(this, props);
    }

    $$transition$intent$named$transition$intent$$NamedTransitionIntent.prototype = $$utils$$oCreate(router$transition$intent$$default.prototype);
    $$transition$intent$named$transition$intent$$NamedTransitionIntent.prototype.applyToState = function(oldState, recognizer, getHandler, isIntermediate) {

      var partitionedArgs     = $$utils$$extractQueryParams([this.name].concat(this.contexts)),
        pureArgs              = partitionedArgs[0],
        queryParams           = partitionedArgs[1],
        handlers              = recognizer.handlersFor(pureArgs[0]);

      var targetRouteName = handlers[handlers.length-1].handler;

      return this.applyToHandlers(oldState, handlers, getHandler, targetRouteName, isIntermediate);
    };

    $$transition$intent$named$transition$intent$$NamedTransitionIntent.prototype.applyToHandlers = function(oldState, handlers, getHandler, targetRouteName, isIntermediate, checkingIfActive) {

      var i;
      var newState = new $$transition$state$$default();
      var objects = this.contexts.slice(0);

      var invalidateIndex = handlers.length;

      // Pivot handlers are provided for refresh transitions
      if (this.pivotHandler) {
        for (i = 0; i < handlers.length; ++i) {
          if (getHandler(handlers[i].handler) === this.pivotHandler) {
            invalidateIndex = i;
            break;
          }
        }
      }

      var pivotHandlerFound = !this.pivotHandler;

      for (i = handlers.length - 1; i >= 0; --i) {
        var result = handlers[i];
        var name = result.handler;
        var handler = getHandler(name);

        var oldHandlerInfo = oldState.handlerInfos[i];
        var newHandlerInfo = null;

        if (result.names.length > 0) {
          if (i >= invalidateIndex) {
            newHandlerInfo = this.createParamHandlerInfo(name, handler, result.names, objects, oldHandlerInfo);
          } else {
            newHandlerInfo = this.getHandlerInfoForDynamicSegment(name, handler, result.names, objects, oldHandlerInfo, targetRouteName);
          }
        } else {
          // This route has no dynamic segment.
          // Therefore treat as a param-based handlerInfo
          // with empty params. This will cause the `model`
          // hook to be called with empty params, which is desirable.
          newHandlerInfo = this.createParamHandlerInfo(name, handler, result.names, objects, oldHandlerInfo);
        }

        if (checkingIfActive) {
          // If we're performing an isActive check, we want to
          // serialize URL params with the provided context, but
          // ignore mismatches between old and new context.
          newHandlerInfo = newHandlerInfo.becomeResolved(null, newHandlerInfo.context);
          var oldContext = oldHandlerInfo && oldHandlerInfo.context;
          if (result.names.length > 0 && newHandlerInfo.context === oldContext) {
            // If contexts match in isActive test, assume params also match.
            // This allows for flexibility in not requiring that every last
            // handler provide a `serialize` method
            newHandlerInfo.params = oldHandlerInfo && oldHandlerInfo.params;
          }
          newHandlerInfo.context = oldContext;
        }

        var handlerToUse = oldHandlerInfo;
        if (i >= invalidateIndex || newHandlerInfo.shouldSupercede(oldHandlerInfo)) {
          invalidateIndex = Math.min(i, invalidateIndex);
          handlerToUse = newHandlerInfo;
        }

        if (isIntermediate && !checkingIfActive) {
          handlerToUse = handlerToUse.becomeResolved(null, handlerToUse.context);
        }

        newState.handlerInfos.unshift(handlerToUse);
      }

      if (objects.length > 0) {
        throw new Error("More context objects were passed than there are dynamic segments for the route: " + targetRouteName);
      }

      if (!isIntermediate) {
        this.invalidateChildren(newState.handlerInfos, invalidateIndex);
      }

      $$utils$$merge(newState.queryParams, oldState.queryParams);
      $$utils$$merge(newState.queryParams, this.queryParams || {});

      return newState;
    };

    $$transition$intent$named$transition$intent$$NamedTransitionIntent.prototype.invalidateChildren = function(handlerInfos, invalidateIndex) {
      for (var i = invalidateIndex, l = handlerInfos.length; i < l; ++i) {
        var handlerInfo = handlerInfos[i];
        handlerInfos[i] = handlerInfos[i].getUnresolved();
      }
    };

    $$transition$intent$named$transition$intent$$NamedTransitionIntent.prototype.getHandlerInfoForDynamicSegment = function(name, handler, names, objects, oldHandlerInfo, targetRouteName) {

      var numNames = names.length;
      var objectToUse;
      if (objects.length > 0) {

        // Use the objects provided for this transition.
        objectToUse = objects[objects.length - 1];
        if ($$utils$$isParam(objectToUse)) {
          return this.createParamHandlerInfo(name, handler, names, objects, oldHandlerInfo);
        } else {
          objects.pop();
        }
      } else if (oldHandlerInfo && oldHandlerInfo.name === name) {
        // Reuse the matching oldHandlerInfo
        return oldHandlerInfo;
      } else {
        // Ideally we should throw this error to provide maximal
        // information to the user that not enough context objects
        // were provided, but this proves too cumbersome in Ember
        // in cases where inner template helpers are evaluated
        // before parent helpers un-render, in which cases this
        // error somewhat prematurely fires.
        //throw new Error("Not enough context objects were provided to complete a transition to " + targetRouteName + ". Specifically, the " + name + " route needs an object that can be serialized into its dynamic URL segments [" + names.join(', ') + "]");
        return oldHandlerInfo;
      }

      return new router$handler$info$$UnresolvedHandlerInfoByObject({
        name: name,
        handler: handler,
        context: objectToUse,
        names: names
      });
    };

    $$transition$intent$named$transition$intent$$NamedTransitionIntent.prototype.createParamHandlerInfo = function(name, handler, names, objects, oldHandlerInfo) {
      var params = {};

      // Soak up all the provided string/numbers
      var numNames = names.length;
      while (numNames--) {

        // Only use old params if the names match with the new handler
        var oldParams = (oldHandlerInfo && name === oldHandlerInfo.name && oldHandlerInfo.params) || {};

        var peek = objects[objects.length - 1];
        var paramName = names[numNames];
        if ($$utils$$isParam(peek)) {
          params[paramName] = "" + objects.pop();
        } else {
          // If we're here, this means only some of the params
          // were string/number params, so try and use a param
          // value from a previous handler.
          if (oldParams.hasOwnProperty(paramName)) {
            params[paramName] = oldParams[paramName];
          } else {
            throw new Error("You didn't provide enough string/numeric parameters to satisfy all of the dynamic segments for route " + name);
          }
        }
      }

      return new router$handler$info$$UnresolvedHandlerInfoByParam({
        name: name,
        handler: handler,
        params: params
      });
    };

    var $$transition$intent$named$transition$intent$$default = $$transition$intent$named$transition$intent$$NamedTransitionIntent;

    function $$transition$intent$url$transition$intent$$URLTransitionIntent(props) {
      router$transition$intent$$default.call(this, props);
    }

    $$transition$intent$url$transition$intent$$URLTransitionIntent.prototype = $$utils$$oCreate(router$transition$intent$$default.prototype);
    $$transition$intent$url$transition$intent$$URLTransitionIntent.prototype.applyToState = function(oldState, recognizer, getHandler) {
      var newState = new $$transition$state$$default();

      var results = recognizer.recognize(this.url),
          queryParams = {},
          i, len;

      if (!results) {
        throw new $$transition$intent$url$transition$intent$$UnrecognizedURLError(this.url);
      }

      var statesDiffer = false;

      for (i = 0, len = results.length; i < len; ++i) {
        var result = results[i];
        var name = result.handler;
        var handler = getHandler(name);

        if (handler.inaccessibleByURL) {
          throw new $$transition$intent$url$transition$intent$$UnrecognizedURLError(this.url);
        }

        var newHandlerInfo = new router$handler$info$$UnresolvedHandlerInfoByParam({
          name: name,
          handler: handler,
          params: result.params
        });

        var oldHandlerInfo = oldState.handlerInfos[i];
        if (statesDiffer || newHandlerInfo.shouldSupercede(oldHandlerInfo)) {
          statesDiffer = true;
          newState.handlerInfos[i] = newHandlerInfo;
        } else {
          newState.handlerInfos[i] = oldHandlerInfo;
        }
      }

      $$utils$$merge(newState.queryParams, results.queryParams);

      return newState;
    };

    /**
      Promise reject reasons passed to promise rejection
      handlers for failed transitions.
     */
    function $$transition$intent$url$transition$intent$$UnrecognizedURLError(message) {
      this.message = (message || "UnrecognizedURLError");
      this.name = "UnrecognizedURLError";
    }

    var $$transition$intent$url$transition$intent$$default = $$transition$intent$url$transition$intent$$URLTransitionIntent;

    var $$router$router$$pop = Array.prototype.pop;

    function $$router$router$$Router() {
      this.recognizer = new route$recognizer$$default();
      this.reset();
    }

    $$router$router$$Router.prototype = {

      /**
        The main entry point into the router. The API is essentially
        the same as the `map` method in `route-recognizer`.

        This method extracts the String handler at the last `.to()`
        call and uses it as the name of the whole route.

        @param {Function} callback
      */
      map: function(callback) {
        this.recognizer.delegate = this.delegate;

        this.recognizer.map(callback, function(recognizer, routes) {
          for (var i = routes.length - 1, proceed = true; i >= 0 && proceed; --i) {
            var route = routes[i];
            recognizer.add(routes, { as: route.handler });
            proceed = route.path === '/' || route.path === '' || route.handler.slice(-6) === '.index';
          }
        });
      },

      hasRoute: function(route) {
        return this.recognizer.hasRoute(route);
      },

      // NOTE: this doesn't really belong here, but here
      // it shall remain until our ES6 transpiler can
      // handle cyclical deps.
      transitionByIntent: function(intent, isIntermediate) {

        var wasTransitioning = !!this.activeTransition;
        var oldState = wasTransitioning ? this.activeTransition.state : this.state;
        var newTransition;
        var router = this;

        try {
          var newState = intent.applyToState(oldState, this.recognizer, this.getHandler, isIntermediate);

          if ($$router$router$$handlerInfosEqual(newState.handlerInfos, oldState.handlerInfos)) {

            // This is a no-op transition. See if query params changed.
            var queryParamChangelist = $$utils$$getChangelist(oldState.queryParams, newState.queryParams);
            if (queryParamChangelist) {

              // This is a little hacky but we need some way of storing
              // changed query params given that no activeTransition
              // is guaranteed to have occurred.
              this._changedQueryParams = queryParamChangelist.changed;
              for (var k in queryParamChangelist.removed) {
                if (queryParamChangelist.removed.hasOwnProperty(k)) {
                  this._changedQueryParams[k] = null;
                }
              }
              $$utils$$trigger(this, newState.handlerInfos, true, ['queryParamsDidChange', queryParamChangelist.changed, queryParamChangelist.all, queryParamChangelist.removed]);
              this._changedQueryParams = null;

              if (!wasTransitioning && this.activeTransition) {
                // One of the handlers in queryParamsDidChange
                // caused a transition. Just return that transition.
                return this.activeTransition;
              } else {
                // Running queryParamsDidChange didn't change anything.
                // Just update query params and be on our way.

                // We have to return a noop transition that will
                // perform a URL update at the end. This gives
                // the user the ability to set the url update
                // method (default is replaceState).
                newTransition = new $$transition$$Transition(this);

                oldState.queryParams = $$router$router$$finalizeQueryParamChange(this, newState.handlerInfos, newState.queryParams, newTransition);

                newTransition.promise = newTransition.promise.then(function(result) {
                  $$router$router$$updateURL(newTransition, oldState, true);
                  if (router.didTransition) {
                    router.didTransition(router.currentHandlerInfos);
                  }
                  return result;
                }, null, $$utils$$promiseLabel("Transition complete"));
                return newTransition;
              }
            }

            // No-op. No need to create a new transition.
            return new $$transition$$Transition(this);
          }

          if (isIntermediate) {
            $$router$router$$setupContexts(this, newState);
            return;
          }

          // Create a new transition to the destination route.
          newTransition = new $$transition$$Transition(this, intent, newState);

          // Abort and usurp any previously active transition.
          if (this.activeTransition) {
            this.activeTransition.abort();
          }
          this.activeTransition = newTransition;

          // Transition promises by default resolve with resolved state.
          // For our purposes, swap out the promise to resolve
          // after the transition has been finalized.
          newTransition.promise = newTransition.promise.then(function(result) {
            return router.async(function() {
              return $$router$router$$finalizeTransition(newTransition, result.state);
            }, "Finalize transition");
          }, null, $$utils$$promiseLabel("Settle transition promise when transition is finalized"));

          if (!wasTransitioning) {
            $$utils$$trigger(this, this.state.handlerInfos, true, ['willTransition', newTransition]);
          }

          return newTransition;
        } catch(e) {
          return new $$transition$$Transition(this, intent, null, e);
        }
      },

      /**
        Clears the current and target route handlers and triggers exit
        on each of them starting at the leaf and traversing up through
        its ancestors.
      */
      reset: function() {
        if (this.state) {
          $$utils$$forEach(this.state.handlerInfos, function(handlerInfo) {
            var handler = handlerInfo.handler;
            if (handler.exit) {
              handler.exit();
            }
          });
        }

        this.state = new $$transition$state$$default();
        this.currentHandlerInfos = null;
      },

      activeTransition: null,

      /**
        var handler = handlerInfo.handler;
        The entry point for handling a change to the URL (usually
        via the back and forward button).

        Returns an Array of handlers and the parameters associated
        with those parameters.

        @param {String} url a URL to process

        @return {Array} an Array of `[handler, parameter]` tuples
      */
      handleURL: function(url) {
        // Perform a URL-based transition, but don't change
        // the URL afterward, since it already happened.
        var args = $$utils$$slice.call(arguments);
        if (url.charAt(0) !== '/') { args[0] = '/' + url; }

        return $$router$router$$doTransition(this, args).method(null);
      },

      /**
        Hook point for updating the URL.

        @param {String} url a URL to update to
      */
      updateURL: function() {
        throw new Error("updateURL is not implemented");
      },

      /**
        Hook point for replacing the current URL, i.e. with replaceState

        By default this behaves the same as `updateURL`

        @param {String} url a URL to update to
      */
      replaceURL: function(url) {
        this.updateURL(url);
      },

      /**
        Transition into the specified named route.

        If necessary, trigger the exit callback on any handlers
        that are no longer represented by the target route.

        @param {String} name the name of the route
      */
      transitionTo: function(name) {
        return $$router$router$$doTransition(this, arguments);
      },

      intermediateTransitionTo: function(name) {
        $$router$router$$doTransition(this, arguments, true);
      },

      refresh: function(pivotHandler) {


        var state = this.activeTransition ? this.activeTransition.state : this.state;
        var handlerInfos = state.handlerInfos;
        var params = {};
        for (var i = 0, len = handlerInfos.length; i < len; ++i) {
          var handlerInfo = handlerInfos[i];
          params[handlerInfo.name] = handlerInfo.params || {};
        }

        $$utils$$log(this, "Starting a refresh transition");
        var intent = new $$transition$intent$named$transition$intent$$default({
          name: handlerInfos[handlerInfos.length - 1].name,
          pivotHandler: pivotHandler || handlerInfos[0].handler,
          contexts: [], // TODO collect contexts...?
          queryParams: this._changedQueryParams || state.queryParams || {}
        });

        return this.transitionByIntent(intent, false);
      },

      /**
        Identical to `transitionTo` except that the current URL will be replaced
        if possible.

        This method is intended primarily for use with `replaceState`.

        @param {String} name the name of the route
      */
      replaceWith: function(name) {
        return $$router$router$$doTransition(this, arguments).method('replace');
      },

      /**
        Take a named route and context objects and generate a
        URL.

        @param {String} name the name of the route to generate
          a URL for
        @param {...Object} objects a list of objects to serialize

        @return {String} a URL
      */
      generate: function(handlerName) {

        var partitionedArgs = $$utils$$extractQueryParams($$utils$$slice.call(arguments, 1)),
          suppliedParams = partitionedArgs[0],
          queryParams = partitionedArgs[1];

        // Construct a TransitionIntent with the provided params
        // and apply it to the present state of the router.
        var intent = new $$transition$intent$named$transition$intent$$default({ name: handlerName, contexts: suppliedParams });
        var state = intent.applyToState(this.state, this.recognizer, this.getHandler);
        var params = {};

        for (var i = 0, len = state.handlerInfos.length; i < len; ++i) {
          var handlerInfo = state.handlerInfos[i];
          var handlerParams = handlerInfo.params ||
                              $$utils$$serialize(handlerInfo.handler, handlerInfo.context, handlerInfo.names);
          $$utils$$merge(params, handlerParams);
        }
        params.queryParams = queryParams;

        return this.recognizer.generate(handlerName, params);
      },

      isActive: function(handlerName) {

        var partitionedArgs   = $$utils$$extractQueryParams($$utils$$slice.call(arguments, 1)),
            contexts          = partitionedArgs[0],
            queryParams       = partitionedArgs[1],
            activeQueryParams  = this.state.queryParams;

        var targetHandlerInfos = this.state.handlerInfos,
            found = false, names, object, handlerInfo, handlerObj, i, len;

        if (!targetHandlerInfos.length) { return false; }

        var targetHandler = targetHandlerInfos[targetHandlerInfos.length - 1].name;
        var recogHandlers = this.recognizer.handlersFor(targetHandler);

        var index = 0;
        for (len = recogHandlers.length; index < len; ++index) {
          handlerInfo = targetHandlerInfos[index];
          if (handlerInfo.name === handlerName) { break; }
        }

        if (index === recogHandlers.length) {
          // The provided route name isn't even in the route hierarchy.
          return false;
        }

        var state = new $$transition$state$$default();
        state.handlerInfos = targetHandlerInfos.slice(0, index + 1);
        recogHandlers = recogHandlers.slice(0, index + 1);

        var intent = new $$transition$intent$named$transition$intent$$default({
          name: targetHandler,
          contexts: contexts
        });

        var newState = intent.applyToHandlers(state, recogHandlers, this.getHandler, targetHandler, true, true);

        // Get a hash of QPs that will still be active on new route
        var activeQPsOnNewHandler = {};
        $$utils$$merge(activeQPsOnNewHandler, queryParams);
        for (var key in activeQueryParams) {
          if (activeQueryParams.hasOwnProperty(key) &&
              activeQPsOnNewHandler.hasOwnProperty(key)) {
            activeQPsOnNewHandler[key] = activeQueryParams[key];
          }
        }

        return $$router$router$$handlerInfosEqual(newState.handlerInfos, state.handlerInfos) &&
               !$$utils$$getChangelist(activeQPsOnNewHandler, queryParams);
      },

      trigger: function(name) {
        var args = $$utils$$slice.call(arguments);
        $$utils$$trigger(this, this.currentHandlerInfos, false, args);
      },

      /**
        @private

        Pluggable hook for possibly running route hooks
        in a try-catch escaping manner.

        @param {Function} callback the callback that will
                          be asynchronously called

        @return {Promise} a promise that fulfills with the
                          value returned from the callback
       */
      async: function(callback, label) {
        return new rsvp$promise$$default(function(resolve) {
          resolve(callback());
        }, label);
      },

      /**
        Hook point for logging transition status updates.

        @param {String} message The message to log.
      */
      log: null
    };

    /**
      @private

      Takes an Array of `HandlerInfo`s, figures out which ones are
      exiting, entering, or changing contexts, and calls the
      proper handler hooks.

      For example, consider the following tree of handlers. Each handler is
      followed by the URL segment it handles.

      ```
      |~index ("/")
      | |~posts ("/posts")
      | | |-showPost ("/:id")
      | | |-newPost ("/new")
      | | |-editPost ("/edit")
      | |~about ("/about/:id")
      ```

      Consider the following transitions:

      1. A URL transition to `/posts/1`.
         1. Triggers the `*model` callbacks on the
            `index`, `posts`, and `showPost` handlers
         2. Triggers the `enter` callback on the same
         3. Triggers the `setup` callback on the same
      2. A direct transition to `newPost`
         1. Triggers the `exit` callback on `showPost`
         2. Triggers the `enter` callback on `newPost`
         3. Triggers the `setup` callback on `newPost`
      3. A direct transition to `about` with a specified
         context object
         1. Triggers the `exit` callback on `newPost`
            and `posts`
         2. Triggers the `serialize` callback on `about`
         3. Triggers the `enter` callback on `about`
         4. Triggers the `setup` callback on `about`

      @param {Router} transition
      @param {TransitionState} newState
    */
    function $$router$router$$setupContexts(router, newState, transition) {
      var partition = $$router$router$$partitionHandlers(router.state, newState);

      $$utils$$forEach(partition.exited, function(handlerInfo) {
        var handler = handlerInfo.handler;
        delete handler.context;
        if (handler.exit) { handler.exit(); }
      });

      var oldState = router.oldState = router.state;
      router.state = newState;
      var currentHandlerInfos = router.currentHandlerInfos = partition.unchanged.slice();

      try {
        $$utils$$forEach(partition.updatedContext, function(handlerInfo) {
          return $$router$router$$handlerEnteredOrUpdated(currentHandlerInfos, handlerInfo, false, transition);
        });

        $$utils$$forEach(partition.entered, function(handlerInfo) {
          return $$router$router$$handlerEnteredOrUpdated(currentHandlerInfos, handlerInfo, true, transition);
        });
      } catch(e) {
        router.state = oldState;
        router.currentHandlerInfos = oldState.handlerInfos;
        throw e;
      }

      router.state.queryParams = $$router$router$$finalizeQueryParamChange(router, currentHandlerInfos, newState.queryParams, transition);
    }


    /**
      @private

      Helper method used by setupContexts. Handles errors or redirects
      that may happen in enter/setup.
    */
    function $$router$router$$handlerEnteredOrUpdated(currentHandlerInfos, handlerInfo, enter, transition) {

      var handler = handlerInfo.handler,
          context = handlerInfo.context;

      if (enter && handler.enter) { handler.enter(transition); }
      if (transition && transition.isAborted) {
        throw new $$transition$$TransitionAborted();
      }

      handler.context = context;
      if (handler.contextDidChange) { handler.contextDidChange(); }

      if (handler.setup) { handler.setup(context, transition); }
      if (transition && transition.isAborted) {
        throw new $$transition$$TransitionAborted();
      }

      currentHandlerInfos.push(handlerInfo);

      return true;
    }


    /**
      @private

      This function is called when transitioning from one URL to
      another to determine which handlers are no longer active,
      which handlers are newly active, and which handlers remain
      active but have their context changed.

      Take a list of old handlers and new handlers and partition
      them into four buckets:

      * unchanged: the handler was active in both the old and
        new URL, and its context remains the same
      * updated context: the handler was active in both the
        old and new URL, but its context changed. The handler's
        `setup` method, if any, will be called with the new
        context.
      * exited: the handler was active in the old URL, but is
        no longer active.
      * entered: the handler was not active in the old URL, but
        is now active.

      The PartitionedHandlers structure has four fields:

      * `updatedContext`: a list of `HandlerInfo` objects that
        represent handlers that remain active but have a changed
        context
      * `entered`: a list of `HandlerInfo` objects that represent
        handlers that are newly active
      * `exited`: a list of `HandlerInfo` objects that are no
        longer active.
      * `unchanged`: a list of `HanderInfo` objects that remain active.

      @param {Array[HandlerInfo]} oldHandlers a list of the handler
        information for the previous URL (or `[]` if this is the
        first handled transition)
      @param {Array[HandlerInfo]} newHandlers a list of the handler
        information for the new URL

      @return {Partition}
    */
    function $$router$router$$partitionHandlers(oldState, newState) {
      var oldHandlers = oldState.handlerInfos;
      var newHandlers = newState.handlerInfos;

      var handlers = {
            updatedContext: [],
            exited: [],
            entered: [],
            unchanged: []
          };

      var handlerChanged, contextChanged, queryParamsChanged, i, l;

      for (i=0, l=newHandlers.length; i<l; i++) {
        var oldHandler = oldHandlers[i], newHandler = newHandlers[i];

        if (!oldHandler || oldHandler.handler !== newHandler.handler) {
          handlerChanged = true;
        }

        if (handlerChanged) {
          handlers.entered.push(newHandler);
          if (oldHandler) { handlers.exited.unshift(oldHandler); }
        } else if (contextChanged || oldHandler.context !== newHandler.context || queryParamsChanged) {
          contextChanged = true;
          handlers.updatedContext.push(newHandler);
        } else {
          handlers.unchanged.push(oldHandler);
        }
      }

      for (i=newHandlers.length, l=oldHandlers.length; i<l; i++) {
        handlers.exited.unshift(oldHandlers[i]);
      }

      return handlers;
    }

    function $$router$router$$updateURL(transition, state, inputUrl) {
      var urlMethod = transition.urlMethod;

      if (!urlMethod) {
        return;
      }

      var router = transition.router,
          handlerInfos = state.handlerInfos,
          handlerName = handlerInfos[handlerInfos.length - 1].name,
          params = {};

      for (var i = handlerInfos.length - 1; i >= 0; --i) {
        var handlerInfo = handlerInfos[i];
        $$utils$$merge(params, handlerInfo.params);
        if (handlerInfo.handler.inaccessibleByURL) {
          urlMethod = null;
        }
      }

      if (urlMethod) {
        params.queryParams = transition._visibleQueryParams || state.queryParams;
        var url = router.recognizer.generate(handlerName, params);

        if (urlMethod === 'replace') {
          router.replaceURL(url);
        } else {
          router.updateURL(url);
        }
      }
    }

    /**
      @private

      Updates the URL (if necessary) and calls `setupContexts`
      to update the router's array of `currentHandlerInfos`.
     */
    function $$router$router$$finalizeTransition(transition, newState) {

      try {
        $$utils$$log(transition.router, transition.sequence, "Resolved all models on destination route; finalizing transition.");

        var router = transition.router,
            handlerInfos = newState.handlerInfos,
            seq = transition.sequence;

        // Run all the necessary enter/setup/exit hooks
        $$router$router$$setupContexts(router, newState, transition);

        // Check if a redirect occurred in enter/setup
        if (transition.isAborted) {
          // TODO: cleaner way? distinguish b/w targetHandlerInfos?
          router.state.handlerInfos = router.currentHandlerInfos;
          return rsvp$promise$$default.reject($$transition$$logAbort(transition));
        }

        $$router$router$$updateURL(transition, newState, transition.intent.url);

        transition.isActive = false;
        router.activeTransition = null;

        $$utils$$trigger(router, router.currentHandlerInfos, true, ['didTransition']);

        if (router.didTransition) {
          router.didTransition(router.currentHandlerInfos);
        }

        $$utils$$log(router, transition.sequence, "TRANSITION COMPLETE.");

        // Resolve with the final handler.
        return handlerInfos[handlerInfos.length - 1].handler;
      } catch(e) {
        if (!(e instanceof $$transition$$TransitionAborted)) {
          //var erroneousHandler = handlerInfos.pop();
          var infos = transition.state.handlerInfos;
          transition.trigger(true, 'error', e, transition, infos[infos.length-1].handler);
          transition.abort();
        }

        throw e;
      }
    }

    /**
      @private

      Begins and returns a Transition based on the provided
      arguments. Accepts arguments in the form of both URL
      transitions and named transitions.

      @param {Router} router
      @param {Array[Object]} args arguments passed to transitionTo,
        replaceWith, or handleURL
    */
    function $$router$router$$doTransition(router, args, isIntermediate) {
      // Normalize blank transitions to root URL transitions.
      var name = args[0] || '/';

      var lastArg = args[args.length-1];
      var queryParams = {};
      if (lastArg && lastArg.hasOwnProperty('queryParams')) {
        queryParams = $$router$router$$pop.call(args).queryParams;
      }

      var intent;
      if (args.length === 0) {

        $$utils$$log(router, "Updating query params");

        // A query param update is really just a transition
        // into the route you're already on.
        var handlerInfos = router.state.handlerInfos;
        intent = new $$transition$intent$named$transition$intent$$default({
          name: handlerInfos[handlerInfos.length - 1].name,
          contexts: [],
          queryParams: queryParams
        });

      } else if (name.charAt(0) === '/') {

        $$utils$$log(router, "Attempting URL transition to " + name);
        intent = new $$transition$intent$url$transition$intent$$default({ url: name });

      } else {

        $$utils$$log(router, "Attempting transition to " + name);
        intent = new $$transition$intent$named$transition$intent$$default({
          name: args[0],
          contexts: $$utils$$slice.call(args, 1),
          queryParams: queryParams
        });
      }

      return router.transitionByIntent(intent, isIntermediate);
    }

    function $$router$router$$handlerInfosEqual(handlerInfos, otherHandlerInfos) {
      if (handlerInfos.length !== otherHandlerInfos.length) {
        return false;
      }

      for (var i = 0, len = handlerInfos.length; i < len; ++i) {
        if (handlerInfos[i] !== otherHandlerInfos[i]) {
          return false;
        }
      }
      return true;
    }

    function $$router$router$$finalizeQueryParamChange(router, resolvedHandlers, newQueryParams, transition) {
      // We fire a finalizeQueryParamChange event which
      // gives the new route hierarchy a chance to tell
      // us which query params it's consuming and what
      // their final values are. If a query param is
      // no longer consumed in the final route hierarchy,
      // its serialized segment will be removed
      // from the URL.

      for (var k in newQueryParams) {
        if (newQueryParams.hasOwnProperty(k) &&
            newQueryParams[k] === null) {
          delete newQueryParams[k];
        }
      }

      var finalQueryParamsArray = [];
      $$utils$$trigger(router, resolvedHandlers, true, ['finalizeQueryParamChange', newQueryParams, finalQueryParamsArray, transition]);

      if (transition) {
        transition._visibleQueryParams = {};
      }

      var finalQueryParams = {};
      for (var i = 0, len = finalQueryParamsArray.length; i < len; ++i) {
        var qp = finalQueryParamsArray[i];
        finalQueryParams[qp.key] = qp.value;
        if (transition && qp.visible !== false) {
          transition._visibleQueryParams[qp.key] = qp.value;
        }
      }
      return finalQueryParams;
    }

    var $$router$router$$default = $$router$router$$Router;
    var router$$default = $$router$router$$default;
    var backburner$utils$$NUMBER = /\d+/;

    function backburner$utils$$each(collection, callback) {
      for (var i = 0; i < collection.length; i++) {
        callback(collection[i]);
      }
    }

    var backburner$utils$$now = Date.now || function() { return new Date().getTime(); };

    function backburner$utils$$isString(suspect) {
      return typeof suspect === 'string';
    }

    function backburner$utils$$isFunction(suspect) {
      return typeof suspect === 'function';
    }

    function backburner$utils$$isNumber(suspect) {
      return typeof suspect === 'number';
    }

    function backburner$utils$$isCoercableNumber(number) {
      return backburner$utils$$isNumber(number) || backburner$utils$$NUMBER.test(number);
    }

    function backburner$utils$$wrapInTryCatch(func) {
      return function () {
        try {
          return func.apply(this, arguments);
        } catch (e) {
          throw e;
        }
      };
    }


    var backburner$platform$$needsIETryCatchFix = (function(e,x){
      try{ x(); }
      catch(e) { } // jshint ignore:line
      return !!e;
    })();
    function backburner$binary$search$$binarySearch(time, timers) {
      var start = 0;
      var end = timers.length - 2;
      var middle, l;

      while (start < end) {
        // since timers is an array of pairs 'l' will always
        // be an integer
        l = (end - start) / 2;

        // compensate for the index in case even number
        // of pairs inside timers
        middle = start + l - (l % 2);

        if (time >= timers[middle]) {
          start = middle + 2;
        } else {
          end = middle;
        }
      }

      return (time >= timers[start]) ? start + 2 : start;
    }
    var backburner$binary$search$$default = backburner$binary$search$$binarySearch;

    function $$queue$$Queue(name, options, globalOptions) {
      this.name = name;
      this.globalOptions = globalOptions || {};
      this.options = options;
      this._queue = [];
      this.targetQueues = Object.create(null);
      this._queueBeingFlushed = undefined;
    }

    $$queue$$Queue.prototype = {
      push: function(target, method, args, stack) {
        var queue = this._queue;
        queue.push(target, method, args, stack);

        return {
          queue: this,
          target: target,
          method: method
        };
      },

      pushUniqueWithoutGuid: function(target, method, args, stack) {
        var queue = this._queue;

        for (var i = 0, l = queue.length; i < l; i += 4) {
          var currentTarget = queue[i];
          var currentMethod = queue[i+1];

          if (currentTarget === target && currentMethod === method) {
            queue[i+2] = args;  // replace args
            queue[i+3] = stack; // replace stack
            return;
          }
        }

        queue.push(target, method, args, stack);
      },

      targetQueue: function(targetQueue, target, method, args, stack) {
        var queue = this._queue;

        for (var i = 0, l = targetQueue.length; i < l; i += 4) {
          var currentMethod = targetQueue[i];
          var currentIndex  = targetQueue[i + 1];

          if (currentMethod === method) {
            queue[currentIndex + 2] = args;  // replace args
            queue[currentIndex + 3] = stack; // replace stack
            return;
          }
        }

        targetQueue.push(
          method,
          queue.push(target, method, args, stack) - 4
        );
      },

      pushUniqueWithGuid: function(guid, target, method, args, stack) {
        var hasLocalQueue = this.targetQueues[guid];

        if (hasLocalQueue) {
          this.targetQueue(hasLocalQueue, target, method, args, stack);
        } else {
          this.targetQueues[guid] = [
            method,
            this._queue.push(target, method, args, stack) - 4
          ];
        }

        return {
          queue: this,
          target: target,
          method: method
        };
      },

      pushUnique: function(target, method, args, stack) {
        var queue = this._queue, currentTarget, currentMethod, i, l;
        var KEY = this.globalOptions.GUID_KEY;

        if (target && KEY) {
          var guid = target[KEY];
          if (guid) {
            return this.pushUniqueWithGuid(guid, target, method, args, stack);
          }
        }

        this.pushUniqueWithoutGuid(target, method, args, stack);

        return {
          queue: this,
          target: target,
          method: method
        };
      },

      invoke: function(target, method, args, _, _errorRecordedForStack) {
        if (args && args.length > 0) {
          method.apply(target, args);
        } else {
          method.call(target);
        }
      },

      invokeWithOnError: function(target, method, args, onError, errorRecordedForStack) {
        try {
          if (args && args.length > 0) {
            method.apply(target, args);
          } else {
            method.call(target);
          }
        } catch(error) {
          onError(error, errorRecordedForStack);
        }
      },

      flush: function(sync) {
        var queue = this._queue;
        var length = queue.length;

        if (length === 0) {
          return;
        }

        var globalOptions = this.globalOptions;
        var options = this.options;
        var before = options && options.before;
        var after = options && options.after;
        var onError = globalOptions.onError || (globalOptions.onErrorTarget &&
                                                globalOptions.onErrorTarget[globalOptions.onErrorMethod]);
        var target, method, args, errorRecordedForStack;
        var invoke = onError ? this.invokeWithOnError : this.invoke;

        this.targetQueues = Object.create(null);
        var queueItems = this._queueBeingFlushed = this._queue.slice();
        this._queue = [];

        if (before) {
          before();
        }

        for (var i = 0; i < length; i += 4) {
          target                = queueItems[i];
          method                = queueItems[i+1];
          args                  = queueItems[i+2];
          errorRecordedForStack = queueItems[i+3]; // Debugging assistance

          if (backburner$utils$$isString(method)) {
            method = target[method];
          }

          // method could have been nullified / canceled during flush
          if (method) {
            //
            //    ** Attention intrepid developer **
            //
            //    To find out the stack of this task when it was scheduled onto
            //    the run loop, add the following to your app.js:
            //
            //    Ember.run.backburner.DEBUG = true; // NOTE: This slows your app, don't leave it on in production.
            //
            //    Once that is in place, when you are at a breakpoint and navigate
            //    here in the stack explorer, you can look at `errorRecordedForStack.stack`,
            //    which will be the captured stack when this job was scheduled.
            //
            invoke(target, method, args, onError, errorRecordedForStack);
          }
        }

        if (after) {
          after();
        }

        this._queueBeingFlushed = undefined;

        if (sync !== false &&
            this._queue.length > 0) {
          // check if new items have been added
          this.flush(true);
        }
      },

      cancel: function(actionToCancel) {
        var queue = this._queue, currentTarget, currentMethod, i, l;
        var target = actionToCancel.target;
        var method = actionToCancel.method;
        var GUID_KEY = this.globalOptions.GUID_KEY;

        if (GUID_KEY && this.targetQueues && target) {
          var targetQueue = this.targetQueues[target[GUID_KEY]];

          if (targetQueue) {
            for (i = 0, l = targetQueue.length; i < l; i++) {
              if (targetQueue[i] === method) {
                targetQueue.splice(i, 1);
              }
            }
          }
        }

        for (i = 0, l = queue.length; i < l; i += 4) {
          currentTarget = queue[i];
          currentMethod = queue[i+1];

          if (currentTarget === target &&
              currentMethod === method) {
            queue.splice(i, 4);
            return true;
          }
        }

        // if not found in current queue
        // could be in the queue that is being flushed
        queue = this._queueBeingFlushed;

        if (!queue) {
          return;
        }

        for (i = 0, l = queue.length; i < l; i += 4) {
          currentTarget = queue[i];
          currentMethod = queue[i+1];

          if (currentTarget === target &&
              currentMethod === method) {
            // don't mess with array during flush
            // just nullify the method
            queue[i+1] = null;
            return true;
          }
        }
      }
    };

    var $$queue$$default = $$queue$$Queue;

    function backburner$deferred$action$queues$$DeferredActionQueues(queueNames, options) {
      var queues = this.queues = Object.create(null);
      this.queueNames = queueNames = queueNames || [];

      this.options = options;

      backburner$utils$$each(queueNames, function(queueName) {
        queues[queueName] = new $$queue$$default(queueName, options[queueName], options);
      });
    }

    function backburner$deferred$action$queues$$noSuchQueue(name) {
      throw new Error("You attempted to schedule an action in a queue (" + name + ") that doesn't exist");
    }

    backburner$deferred$action$queues$$DeferredActionQueues.prototype = {
      schedule: function(name, target, method, args, onceFlag, stack) {
        var queues = this.queues;
        var queue = queues[name];

        if (!queue) {
          backburner$deferred$action$queues$$noSuchQueue(name);
        }

        if (onceFlag) {
          return queue.pushUnique(target, method, args, stack);
        } else {
          return queue.push(target, method, args, stack);
        }
      },

      flush: function() {
        var queues = this.queues;
        var queueNames = this.queueNames;
        var queueName, queue, queueItems, priorQueueNameIndex;
        var queueNameIndex = 0;
        var numberOfQueues = queueNames.length;
        var options = this.options;

        while (queueNameIndex < numberOfQueues) {
          queueName = queueNames[queueNameIndex];
          queue = queues[queueName];

          var numberOfQueueItems = queue._queue.length;

          if (numberOfQueueItems === 0) {
            queueNameIndex++;
          } else {
            queue.flush(false /* async */);
            queueNameIndex = 0;
          }
        }
      }
    };

    var backburner$deferred$action$queues$$default = backburner$deferred$action$queues$$DeferredActionQueues;

    var backburner$$slice = [].slice;
    var backburner$$pop = [].pop;
    var backburner$$global = this;

    function backburner$$Backburner(queueNames, options) {
      this.queueNames = queueNames;
      this.options = options || {};
      if (!this.options.defaultQueue) {
        this.options.defaultQueue = queueNames[0];
      }
      this.instanceStack = [];
      this._debouncees = [];
      this._throttlers = [];
      this._timers = [];
    }

    backburner$$Backburner.prototype = {
      begin: function() {
        var options = this.options;
        var onBegin = options && options.onBegin;
        var previousInstance = this.currentInstance;

        if (previousInstance) {
          this.instanceStack.push(previousInstance);
        }

        this.currentInstance = new backburner$deferred$action$queues$$default(this.queueNames, options);
        if (onBegin) {
          onBegin(this.currentInstance, previousInstance);
        }
      },

      end: function() {
        var options = this.options;
        var onEnd = options && options.onEnd;
        var currentInstance = this.currentInstance;
        var nextInstance = null;

        // Prevent double-finally bug in Safari 6.0.2 and iOS 6
        // This bug appears to be resolved in Safari 6.0.5 and iOS 7
        var finallyAlreadyCalled = false;
        try {
          currentInstance.flush();
        } finally {
          if (!finallyAlreadyCalled) {
            finallyAlreadyCalled = true;

            this.currentInstance = null;

            if (this.instanceStack.length) {
              nextInstance = this.instanceStack.pop();
              this.currentInstance = nextInstance;
            }

            if (onEnd) {
              onEnd(currentInstance, nextInstance);
            }
          }
        }
      },

      run: function(target, method /*, args */) {
        var onError = backburner$$getOnError(this.options);

        this.begin();

        if (!method) {
          method = target;
          target = null;
        }

        if (backburner$utils$$isString(method)) {
          method = target[method];
        }

        var args = backburner$$slice.call(arguments, 2);

        // guard against Safari 6's double-finally bug
        var didFinally = false;

        if (onError) {
          try {
            return method.apply(target, args);
          } catch(error) {
            onError(error);
          } finally {
            if (!didFinally) {
              didFinally = true;
              this.end();
            }
          }
        } else {
          try {
            return method.apply(target, args);
          } finally {
            if (!didFinally) {
              didFinally = true;
              this.end();
            }
          }
        }
      },

      join: function(target, method /*, args */) {
        if (this.currentInstance) {
          if (!method) {
            method = target;
            target = null;
          }

          if (backburner$utils$$isString(method)) {
            method = target[method];
          }

          return method.apply(target, backburner$$slice.call(arguments, 2));
        } else {
          return this.run.apply(this, arguments);
        }
      },

      defer: function(queueName, target, method /* , args */) {
        if (!method) {
          method = target;
          target = null;
        }

        if (backburner$utils$$isString(method)) {
          method = target[method];
        }

        var stack = this.DEBUG ? new Error() : undefined;
        var length = arguments.length;
        var args;

        if (length > 3) {
          args = new Array(length - 3);
          for (var i = 3; i < length; i++) {
            args[i-3] = arguments[i];
          }
        } else {
          args = undefined;
        }

        if (!this.currentInstance) { backburner$$createAutorun(this); }
        return this.currentInstance.schedule(queueName, target, method, args, false, stack);
      },

      deferOnce: function(queueName, target, method /* , args */) {
        if (!method) {
          method = target;
          target = null;
        }

        if (backburner$utils$$isString(method)) {
          method = target[method];
        }

        var stack = this.DEBUG ? new Error() : undefined;
        var length = arguments.length;
        var args;

        if (length > 3) {
          args = new Array(length - 3);
          for (var i = 3; i < length; i++) {
            args[i-3] = arguments[i];
          }
        } else {
          args = undefined;
        }

        if (!this.currentInstance) {
          backburner$$createAutorun(this);
        }
        return this.currentInstance.schedule(queueName, target, method, args, true, stack);
      },

      setTimeout: function() {
        var l = arguments.length;
        var args = new Array(l);

        for (var x = 0; x < l; x++) {
          args[x] = arguments[x];
        }

        var length = args.length,
            method, wait, target,
            methodOrTarget, methodOrWait, methodOrArgs;

        if (length === 0) {
          return;
        } else if (length === 1) {
          method = args.shift();
          wait = 0;
        } else if (length === 2) {
          methodOrTarget = args[0];
          methodOrWait = args[1];

          if (backburner$utils$$isFunction(methodOrWait) || backburner$utils$$isFunction(methodOrTarget[methodOrWait])) {
            target = args.shift();
            method = args.shift();
            wait = 0;
          } else if (backburner$utils$$isCoercableNumber(methodOrWait)) {
            method = args.shift();
            wait = args.shift();
          } else {
            method = args.shift();
            wait =  0;
          }
        } else {
          var last = args[args.length - 1];

          if (backburner$utils$$isCoercableNumber(last)) {
            wait = args.pop();
          } else {
            wait = 0;
          }

          methodOrTarget = args[0];
          methodOrArgs = args[1];

          if (backburner$utils$$isFunction(methodOrArgs) || (backburner$utils$$isString(methodOrArgs) &&
                                          methodOrTarget !== null &&
                                          methodOrArgs in methodOrTarget)) {
            target = args.shift();
            method = args.shift();
          } else {
            method = args.shift();
          }
        }

        var executeAt = backburner$utils$$now() + parseInt(wait, 10);

        if (backburner$utils$$isString(method)) {
          method = target[method];
        }

        var onError = backburner$$getOnError(this.options);

        function fn() {
          if (onError) {
            try {
              method.apply(target, args);
            } catch (e) {
              onError(e);
            }
          } else {
            method.apply(target, args);
          }
        }

        // find position to insert
        var i = backburner$binary$search$$default(executeAt, this._timers);

        this._timers.splice(i, 0, executeAt, fn);

        backburner$$updateLaterTimer(this, executeAt, wait);

        return fn;
      },

      throttle: function(target, method /* , args, wait, [immediate] */) {
        var backburner = this;
        var args = arguments;
        var immediate = backburner$$pop.call(args);
        var wait, throttler, index, timer;

        if (backburner$utils$$isNumber(immediate) || backburner$utils$$isString(immediate)) {
          wait = immediate;
          immediate = true;
        } else {
          wait = backburner$$pop.call(args);
        }

        wait = parseInt(wait, 10);

        index = backburner$$findThrottler(target, method, this._throttlers);
        if (index > -1) { return this._throttlers[index]; } // throttled

        timer = backburner$$global.setTimeout(function() {
          if (!immediate) {
            backburner.run.apply(backburner, args);
          }
          var index = backburner$$findThrottler(target, method, backburner._throttlers);
          if (index > -1) {
            backburner._throttlers.splice(index, 1);
          }
        }, wait);

        if (immediate) {
          this.run.apply(this, args);
        }

        throttler = [target, method, timer];

        this._throttlers.push(throttler);

        return throttler;
      },

      debounce: function(target, method /* , args, wait, [immediate] */) {
        var backburner = this;
        var args = arguments;
        var immediate = backburner$$pop.call(args);
        var wait, index, debouncee, timer;

        if (backburner$utils$$isNumber(immediate) || backburner$utils$$isString(immediate)) {
          wait = immediate;
          immediate = false;
        } else {
          wait = backburner$$pop.call(args);
        }

        wait = parseInt(wait, 10);
        // Remove debouncee
        index = backburner$$findDebouncee(target, method, this._debouncees);

        if (index > -1) {
          debouncee = this._debouncees[index];
          this._debouncees.splice(index, 1);
          clearTimeout(debouncee[2]);
        }

        timer = backburner$$global.setTimeout(function() {
          if (!immediate) {
            backburner.run.apply(backburner, args);
          }
          var index = backburner$$findDebouncee(target, method, backburner._debouncees);
          if (index > -1) {
            backburner._debouncees.splice(index, 1);
          }
        }, wait);

        if (immediate && index === -1) {
          backburner.run.apply(backburner, args);
        }

        debouncee = [
          target,
          method,
          timer
        ];

        backburner._debouncees.push(debouncee);

        return debouncee;
      },

      cancelTimers: function() {
        var clearItems = function(item) {
          clearTimeout(item[2]);
        };

        backburner$utils$$each(this._throttlers, clearItems);
        this._throttlers = [];

        backburner$utils$$each(this._debouncees, clearItems);
        this._debouncees = [];

        if (this._laterTimer) {
          clearTimeout(this._laterTimer);
          this._laterTimer = null;
        }
        this._timers = [];

        if (this._autorun) {
          clearTimeout(this._autorun);
          this._autorun = null;
        }
      },

      hasTimers: function() {
        return !!this._timers.length || !!this._debouncees.length || !!this._throttlers.length || this._autorun;
      },

      cancel: function(timer) {
        var timerType = typeof timer;

        if (timer && timerType === 'object' && timer.queue && timer.method) { // we're cancelling a deferOnce
          return timer.queue.cancel(timer);
        } else if (timerType === 'function') { // we're cancelling a setTimeout
          for (var i = 0, l = this._timers.length; i < l; i += 2) {
            if (this._timers[i + 1] === timer) {
              this._timers.splice(i, 2); // remove the two elements
              if (i === 0) {
                if (this._laterTimer) { // Active timer? Then clear timer and reset for future timer
                  clearTimeout(this._laterTimer);
                  this._laterTimer = null;
                }
                if (this._timers.length > 0) { // Update to next available timer when available
                  backburner$$updateLaterTimer(this, this._timers[0], this._timers[0] - backburner$utils$$now());
                }
              }
              return true;
            }
          }
        } else if (Object.prototype.toString.call(timer) === "[object Array]"){ // we're cancelling a throttle or debounce
          return this._cancelItem(backburner$$findThrottler, this._throttlers, timer) ||
                   this._cancelItem(backburner$$findDebouncee, this._debouncees, timer);
        } else {
          return; // timer was null or not a timer
        }
      },

      _cancelItem: function(findMethod, array, timer){
        var item, index;

        if (timer.length < 3) { return false; }

        index = findMethod(timer[0], timer[1], array);

        if (index > -1) {

          item = array[index];

          if (item[2] === timer[2]) {
            array.splice(index, 1);
            clearTimeout(timer[2]);
            return true;
          }
        }

        return false;
      }
    };

    backburner$$Backburner.prototype.schedule = backburner$$Backburner.prototype.defer;
    backburner$$Backburner.prototype.scheduleOnce = backburner$$Backburner.prototype.deferOnce;
    backburner$$Backburner.prototype.later = backburner$$Backburner.prototype.setTimeout;

    if (backburner$platform$$needsIETryCatchFix) {
      var backburner$$originalRun = backburner$$Backburner.prototype.run;
      backburner$$Backburner.prototype.run = backburner$utils$$wrapInTryCatch(backburner$$originalRun);

      var backburner$$originalEnd = backburner$$Backburner.prototype.end;
      backburner$$Backburner.prototype.end = backburner$utils$$wrapInTryCatch(backburner$$originalEnd);
    }

    function backburner$$getOnError(options) {
      return options.onError || (options.onErrorTarget && options.onErrorTarget[options.onErrorMethod]);
    }

    function backburner$$createAutorun(backburner) {
      backburner.begin();
      backburner._autorun = backburner$$global.setTimeout(function() {
        backburner._autorun = null;
        backburner.end();
      });
    }

    function backburner$$updateLaterTimer(backburner, executeAt, wait) {
      var n = backburner$utils$$now();
      if (!backburner._laterTimer || executeAt < backburner._laterTimerExpiresAt || backburner._laterTimerExpiresAt < n) {

        if (backburner._laterTimer) {
          // Clear when:
          // - Already expired
          // - New timer is earlier
          clearTimeout(backburner._laterTimer);

          if (backburner._laterTimerExpiresAt < n) { // If timer was never triggered
            // Calculate the left-over wait-time
            wait = Math.max(0, executeAt - n);
          }
        }

        backburner._laterTimer = backburner$$global.setTimeout(function() {
          backburner._laterTimer = null;
          backburner._laterTimerExpiresAt = null;
          backburner$$executeTimers(backburner);
        }, wait);

        backburner._laterTimerExpiresAt = n + wait;
      }
    }

    function backburner$$executeTimers(backburner) {
      var n = backburner$utils$$now();
      var fns, i, l;

      backburner.run(function() {
        i = backburner$binary$search$$default(n, backburner._timers);

        fns = backburner._timers.splice(0, i);

        for (i = 1, l = fns.length; i < l; i += 2) {
          backburner.schedule(backburner.options.defaultQueue, null, fns[i]);
        }
      });

      if (backburner._timers.length) {
        backburner$$updateLaterTimer(backburner, backburner._timers[0], backburner._timers[0] - n);
      }
    }

    function backburner$$findDebouncee(target, method, debouncees) {
      return backburner$$findItem(target, method, debouncees);
    }

    function backburner$$findThrottler(target, method, throttlers) {
      return backburner$$findItem(target, method, throttlers);
    }

    function backburner$$findItem(target, method, collection) {
      var item;
      var index = -1;

      for (var i = 0, l = collection.length; i < l; i++) {
        item = collection[i];
        if (item[0] === target && item[1] === method) {
          index = i;
          break;
        }
      }

      return index;
    }

    var backburner$$default = backburner$$Backburner;

    function $$rsvp$node$$Result() {
      this.value = undefined;
    }

    var $$rsvp$node$$ERROR = new $$rsvp$node$$Result();
    var $$rsvp$node$$GET_THEN_ERROR = new $$rsvp$node$$Result();

    function $$rsvp$node$$getThen(obj) {
      try {
       return obj.then;
      } catch(error) {
        $$rsvp$node$$ERROR.value= error;
        return $$rsvp$node$$ERROR;
      }
    }


    function $$rsvp$node$$tryApply(f, s, a) {
      try {
        f.apply(s, a);
      } catch(error) {
        $$rsvp$node$$ERROR.value = error;
        return $$rsvp$node$$ERROR;
      }
    }

    function $$rsvp$node$$makeObject(_, argumentNames) {
      var obj = {};
      var name;
      var i;
      var length = _.length;
      var args = new Array(length);

      for (var x = 0; x < length; x++) {
        args[x] = _[x];
      }

      for (i = 0; i < argumentNames.length; i++) {
        name = argumentNames[i];
        obj[name] = args[i + 1];
      }

      return obj;
    }

    function $$rsvp$node$$arrayResult(_) {
      var length = _.length;
      var args = new Array(length - 1);

      for (var i = 1; i < length; i++) {
        args[i - 1] = _[i];
      }

      return args;
    }

    function $$rsvp$node$$wrapThenable(then, promise) {
      return {
        then: function(onFulFillment, onRejection) {
          return then.call(promise, onFulFillment, onRejection);
        }
      };
    }

    function $$rsvp$node$$denodeify(nodeFunc, options) {
      var fn = function() {
        var self = this;
        var l = arguments.length;
        var args = new Array(l + 1);
        var arg;
        var promiseInput = false;

        for (var i = 0; i < l; ++i) {
          arg = arguments[i];

          if (!promiseInput) {
            // TODO: clean this up
            promiseInput = $$rsvp$node$$needsPromiseInput(arg);
            if (promiseInput === $$rsvp$node$$GET_THEN_ERROR) {
              var p = new rsvp$promise$$default($$$internal$$noop);
              $$$internal$$reject(p, $$rsvp$node$$GET_THEN_ERROR.value);
              return p;
            } else if (promiseInput && promiseInput !== true) {
              arg = $$rsvp$node$$wrapThenable(promiseInput, arg);
            }
          }
          args[i] = arg;
        }

        var promise = new rsvp$promise$$default($$$internal$$noop);

        args[l] = function(err, val) {
          if (err)
            $$$internal$$reject(promise, err);
          else if (options === undefined)
            $$$internal$$resolve(promise, val);
          else if (options === true)
            $$$internal$$resolve(promise, $$rsvp$node$$arrayResult(arguments));
          else if ($$utils1$$isArray(options))
            $$$internal$$resolve(promise, $$rsvp$node$$makeObject(arguments, options));
          else
            $$$internal$$resolve(promise, val);
        };

        if (promiseInput) {
          return $$rsvp$node$$handlePromiseInput(promise, args, nodeFunc, self);
        } else {
          return $$rsvp$node$$handleValueInput(promise, args, nodeFunc, self);
        }
      };

      fn.__proto__ = nodeFunc;

      return fn;
    }

    var $$rsvp$node$$default = $$rsvp$node$$denodeify;

    function $$rsvp$node$$handleValueInput(promise, args, nodeFunc, self) {
      var result = $$rsvp$node$$tryApply(nodeFunc, self, args);
      if (result === $$rsvp$node$$ERROR) {
        $$$internal$$reject(promise, result.value);
      }
      return promise;
    }

    function $$rsvp$node$$handlePromiseInput(promise, args, nodeFunc, self){
      return rsvp$promise$$default.all(args).then(function(args){
        var result = $$rsvp$node$$tryApply(nodeFunc, self, args);
        if (result === $$rsvp$node$$ERROR) {
          $$$internal$$reject(promise, result.value);
        }
        return promise;
      });
    }

    function $$rsvp$node$$needsPromiseInput(arg) {
      if (arg && typeof arg === 'object') {
        if (arg.constructor === rsvp$promise$$default) {
          return true;
        } else {
          return $$rsvp$node$$getThen(arg);
        }
      } else {
        return false;
      }
    }
    function $$rsvp$all$$all(array, label) {
      return rsvp$promise$$default.all(array, label);
    }
    var $$rsvp$all$$default = $$rsvp$all$$all;

    function $$rsvp$all$settled$$AllSettled(Constructor, entries, label) {
      this._superConstructor(Constructor, entries, false /* don't abort on reject */, label);
    }

    $$rsvp$all$settled$$AllSettled.prototype = $$utils1$$o_create($$$enumerator$$default.prototype);
    $$rsvp$all$settled$$AllSettled.prototype._superConstructor = $$$enumerator$$default;
    $$rsvp$all$settled$$AllSettled.prototype._makeResult = $$$enumerator$$makeSettledResult;
    $$rsvp$all$settled$$AllSettled.prototype._validationError = function() {
      return new Error('allSettled must be called with an array');
    };

    function $$rsvp$all$settled$$allSettled(entries, label) {
      return new $$rsvp$all$settled$$AllSettled(rsvp$promise$$default, entries, label).promise;
    }
    var $$rsvp$all$settled$$default = $$rsvp$all$settled$$allSettled;
    function $$rsvp$race$$race(array, label) {
      return rsvp$promise$$default.race(array, label);
    }
    var $$rsvp$race$$default = $$rsvp$race$$race;

    function $$promise$hash$$PromiseHash(Constructor, object, label) {
      this._superConstructor(Constructor, object, true, label);
    }

    var $$promise$hash$$default = $$promise$hash$$PromiseHash;

    $$promise$hash$$PromiseHash.prototype = $$utils1$$o_create($$$enumerator$$default.prototype);
    $$promise$hash$$PromiseHash.prototype._superConstructor = $$$enumerator$$default;
    $$promise$hash$$PromiseHash.prototype._init = function() {
      this._result = {};
    };

    $$promise$hash$$PromiseHash.prototype._validateInput = function(input) {
      return input && typeof input === 'object';
    };

    $$promise$hash$$PromiseHash.prototype._validationError = function() {
      return new Error('Promise.hash must be called with an object');
    };

    $$promise$hash$$PromiseHash.prototype._enumerate = function() {
      var promise = this.promise;
      var input   = this._input;
      var results = [];

      for (var key in input) {
        if (promise._state === $$$internal$$PENDING && input.hasOwnProperty(key)) {
          results.push({
            position: key,
            entry: input[key]
          });
        }
      }

      var length = results.length;
      this._remaining = length;
      var result;

      for (var i = 0; promise._state === $$$internal$$PENDING && i < length; i++) {
        result = results[i];
        this._eachEntry(result.entry, result.position);
      }
    };
    function $$rsvp$hash$$hash(object, label) {
      return new $$promise$hash$$default(rsvp$promise$$default, object, label).promise;
    }
    var $$rsvp$hash$$default = $$rsvp$hash$$hash;

    function $$rsvp$hash$settled$$HashSettled(Constructor, object, label) {
      this._superConstructor(Constructor, object, false, label);
    }

    $$rsvp$hash$settled$$HashSettled.prototype = $$utils1$$o_create($$promise$hash$$default.prototype);
    $$rsvp$hash$settled$$HashSettled.prototype._superConstructor = $$$enumerator$$default;
    $$rsvp$hash$settled$$HashSettled.prototype._makeResult = $$$enumerator$$makeSettledResult;

    $$rsvp$hash$settled$$HashSettled.prototype._validationError = function() {
      return new Error('hashSettled must be called with an object');
    };

    function $$rsvp$hash$settled$$hashSettled(object, label) {
      return new $$rsvp$hash$settled$$HashSettled(rsvp$promise$$default, object, label).promise;
    }
    var $$rsvp$hash$settled$$default = $$rsvp$hash$settled$$hashSettled;
    function $$rsvp$rethrow$$rethrow(reason) {
      setTimeout(function() {
        throw reason;
      });
      throw reason;
    }
    var $$rsvp$rethrow$$default = $$rsvp$rethrow$$rethrow;
    function $$rsvp$defer$$defer(label) {
      var deferred = { };

      deferred['promise'] = new rsvp$promise$$default(function(resolve, reject) {
        deferred['resolve'] = resolve;
        deferred['reject'] = reject;
      }, label);

      return deferred;
    }
    var $$rsvp$defer$$default = $$rsvp$defer$$defer;
    function $$rsvp$map$$map(promises, mapFn, label) {
      return rsvp$promise$$default.all(promises, label).then(function(values) {
        if (!$$utils1$$isFunction(mapFn)) {
          throw new TypeError("You must pass a function as map's second argument.");
        }

        var length = values.length;
        var results = new Array(length);

        for (var i = 0; i < length; i++) {
          results[i] = mapFn(values[i]);
        }

        return rsvp$promise$$default.all(results, label);
      });
    }
    var $$rsvp$map$$default = $$rsvp$map$$map;
    function $$rsvp$resolve$$resolve(value, label) {
      return rsvp$promise$$default.resolve(value, label);
    }
    var $$rsvp$resolve$$default = $$rsvp$resolve$$resolve;
    function $$rsvp$reject$$reject(reason, label) {
      return rsvp$promise$$default.reject(reason, label);
    }
    var $$rsvp$reject$$default = $$rsvp$reject$$reject;
    function $$rsvp$filter$$filter(promises, filterFn, label) {
      return rsvp$promise$$default.all(promises, label).then(function(values) {
        if (!$$utils1$$isFunction(filterFn)) {
          throw new TypeError("You must pass a function as filter's second argument.");
        }

        var length = values.length;
        var filtered = new Array(length);

        for (var i = 0; i < length; i++) {
          filtered[i] = filterFn(values[i]);
        }

        return rsvp$promise$$default.all(filtered, label).then(function(filtered) {
          var results = new Array(length);
          var newLength = 0;

          for (var i = 0; i < length; i++) {
            if (filtered[i]) {
              results[newLength] = values[i];
              newLength++;
            }
          }

          results.length = newLength;

          return results;
        });
      });
    }
    var $$rsvp$filter$$default = $$rsvp$filter$$filter;
    var $$rsvp$asap$$len = 0;

    function $$rsvp$asap$$asap(callback, arg) {
      $$rsvp$asap$$queue[$$rsvp$asap$$len] = callback;
      $$rsvp$asap$$queue[$$rsvp$asap$$len + 1] = arg;
      $$rsvp$asap$$len += 2;
      if ($$rsvp$asap$$len === 2) {
        // If len is 1, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        $$rsvp$asap$$scheduleFlush();
      }
    }

    var $$rsvp$asap$$default = $$rsvp$asap$$asap;

    var $$rsvp$asap$$browserWindow = (typeof window !== 'undefined') ? window : undefined;
    var $$rsvp$asap$$browserGlobal = $$rsvp$asap$$browserWindow || {};
    var $$rsvp$asap$$BrowserMutationObserver = $$rsvp$asap$$browserGlobal.MutationObserver || $$rsvp$asap$$browserGlobal.WebKitMutationObserver;

    // test for web worker but not in IE10
    var $$rsvp$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' &&
      typeof importScripts !== 'undefined' &&
      typeof MessageChannel !== 'undefined';

    // node
    function $$rsvp$asap$$useNextTick() {
      return function() {
        process.nextTick($$rsvp$asap$$flush);
      };
    }

    // vertx
    function $$rsvp$asap$$useVertxTimer() {
      return function() {
        vertxNext($$rsvp$asap$$flush);
      };
    }

    function $$rsvp$asap$$useMutationObserver() {
      var iterations = 0;
      var observer = new $$rsvp$asap$$BrowserMutationObserver($$rsvp$asap$$flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    // web worker
    function $$rsvp$asap$$useMessageChannel() {
      var channel = new MessageChannel();
      channel.port1.onmessage = $$rsvp$asap$$flush;
      return function () {
        channel.port2.postMessage(0);
      };
    }

    function $$rsvp$asap$$useSetTimeout() {
      return function() {
        setTimeout($$rsvp$asap$$flush, 1);
      };
    }

    var $$rsvp$asap$$queue = new Array(1000);
    function $$rsvp$asap$$flush() {
      for (var i = 0; i < $$rsvp$asap$$len; i+=2) {
        var callback = $$rsvp$asap$$queue[i];
        var arg = $$rsvp$asap$$queue[i+1];

        callback(arg);

        $$rsvp$asap$$queue[i] = undefined;
        $$rsvp$asap$$queue[i+1] = undefined;
      }

      $$rsvp$asap$$len = 0;
    }

    function $$rsvp$asap$$attemptVertex() {
      try {
        var vertx = require('vertx');
        var vertxNext = vertx.runOnLoop || vertx.runOnContext;
        return $$rsvp$asap$$useVertxTimer();
      } catch(e) {
        return $$rsvp$asap$$useSetTimeout();
      }
    }

    var $$rsvp$asap$$scheduleFlush;
    // Decide what async method to use to triggering processing of queued callbacks:
    if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
      $$rsvp$asap$$scheduleFlush = $$rsvp$asap$$useNextTick();
    } else if ($$rsvp$asap$$BrowserMutationObserver) {
      $$rsvp$asap$$scheduleFlush = $$rsvp$asap$$useMutationObserver();
    } else if ($$rsvp$asap$$isWorker) {
      $$rsvp$asap$$scheduleFlush = $$rsvp$asap$$useMessageChannel();
    } else if ($$rsvp$asap$$browserWindow === undefined && typeof require === 'function') {
      $$rsvp$asap$$scheduleFlush = $$rsvp$asap$$attemptVertex();
    } else {
      $$rsvp$asap$$scheduleFlush = $$rsvp$asap$$useSetTimeout();
    }

    // default async is asap;
    $$config$$config.async = $$rsvp$asap$$default;
    var rsvp$$cast = $$rsvp$resolve$$default;
    function rsvp$$async(callback, arg) {
      $$config$$config.async(callback, arg);
    }

    function rsvp$$on() {
      $$config$$config.on.apply($$config$$config, arguments);
    }

    function rsvp$$off() {
      $$config$$config.off.apply($$config$$config, arguments);
    }

    // Set up instrumentation through `window.__PROMISE_INTRUMENTATION__`
    if (typeof window !== 'undefined' && typeof window['__PROMISE_INSTRUMENTATION__'] === 'object') {
      var rsvp$$callbacks = window['__PROMISE_INSTRUMENTATION__'];
      $$config$$configure('instrument', true);
      for (var rsvp$$eventName in rsvp$$callbacks) {
        if (rsvp$$callbacks.hasOwnProperty(rsvp$$eventName)) {
          rsvp$$on(rsvp$$eventName, rsvp$$callbacks[rsvp$$eventName]);
        }
      }
    }

    var $$test_helpers$$slice = Array.prototype.slice;

    QUnit.config.testTimeout = 1000;

    var $$test_helpers$$bb = new backburner$$default(['promises']);
    function $$test_helpers$$customAsync(callback, promise) {
      $$test_helpers$$bb.defer('promises', promise, callback, promise);
    }

    function $$test_helpers$$flushBackburner() {
      $$test_helpers$$bb.end();
      $$test_helpers$$bb.begin();
    }

    function $$test_helpers$$module(name, options) {
      options = options || {};
      QUnit.module(name, {
        setup: function() {
          $$config$$configure('async', $$test_helpers$$customAsync);
          $$test_helpers$$bb.begin();

          if (options.setup) {
            options.setup();
          }
        },
        teardown: function() {
          $$test_helpers$$bb.end();

          if (options.teardown) {
            options.teardown();
          }
        }
      });
    }


    // Helper method that performs a transition and flushes
    // the backburner queue. Helpful for when you want to write
    // tests that avoid .then callbacks.
    function $$test_helpers$$transitionTo(router) {
      router.transitionTo.apply(router, $$test_helpers$$slice.call(arguments, 1));
      $$test_helpers$$flushBackburner();
    }

    function $$test_helpers$$transitionToWithAbort(router) {
      var args = $$test_helpers$$slice.call(arguments, 1);
      router.transitionTo.apply(router, args).then($$test_helpers$$shouldNotHappen, function(reason) {
        equal(reason.name, "TransitionAborted", "transition was redirected/aborted");
      });
      $$test_helpers$$flushBackburner();
    }

    function $$test_helpers$$shouldNotHappen(error) {
      console.error(error.stack);
      ok(false, "this .then handler should not be called");
    }

    function $$test_helpers$$shouldBeTransition (object) {
      ok(object.toString().match(/Transition \(sequence \d+\)/), "Object should be transition");
    }


    $$test_helpers$$module("backburner sanity test");

    test("backburnerized testing works as expected", function() {
      expect(1);
      $$rsvp$resolve$$default("hello").then(function(word) {
        equal(word, "hello", "backburner flush in teardown resolved this promise");
      });
    });

    function $$handler_info_test$$noop() {}

    $$test_helpers$$module("HandlerInfo");

    test("ResolvedHandlerInfos resolve to themselves", function() {
      var handlerInfo = new router$handler$info$$ResolvedHandlerInfo();
      handlerInfo.resolve().then(function(resolvedHandlerInfo) {
        equal(handlerInfo, resolvedHandlerInfo);
      });
    });

    test("UnresolvedHandlerInfoByParam defaults params to {}", function() {
      var handlerInfo = new router$handler$info$$UnresolvedHandlerInfoByParam();
      deepEqual(handlerInfo.params, {});

      var handlerInfo2 = new router$handler$info$$UnresolvedHandlerInfoByParam({ params: { foo: 5 } });
      deepEqual(handlerInfo2.params, { foo: 5 });
    });

    var $$handler_info_test$$async = router$$default.prototype.async;

    test("HandlerInfo can be aborted mid-resolve", function() {

      expect(2);

      var handlerInfo = new router$handler$info$$HandlerInfo({
        name: 'foo',
        handler: {}
      });

      function abortResolve() {
        ok(true, "abort was called");
        return $$rsvp$reject$$default("LOL");
      }

      handlerInfo.resolve($$handler_info_test$$async, abortResolve, {}).catch(function(error) {
        equal(error, "LOL");
      });
    });

    test("HandlerInfo#resolve resolves with a ResolvedHandlerInfo", function() {
      expect(1);

      var handlerInfo = new router$handler$info$$HandlerInfo({
        name: 'foo',
        handler: {},
        params: {},
        getModel: $$handler_info_test$$noop
      });

      handlerInfo.resolve($$handler_info_test$$async, $$handler_info_test$$noop, {}).then(function(resolvedHandlerInfo) {
        return resolvedHandlerInfo.resolve().then(function(previouslyResolvedHandlerInfo) {
          equal(previouslyResolvedHandlerInfo, resolvedHandlerInfo);
        });
      });
    });

    test("HandlerInfo#resolve runs beforeModel hook on handler", function() {

      expect(1);

      var transition = {};

      var handler = {
        beforeModel: function(payload) {
          equal(transition, payload, "beforeModel was called with the payload we passed to resolve()");
        }
      };

      var handlerInfo = new router$handler$info$$HandlerInfo({
        name: 'foo',
        handler: handler
      });

      handlerInfo.resolve($$handler_info_test$$async, $$handler_info_test$$noop, transition);
    });

    test("HandlerInfo#resolve runs getModel hook", function() {

      expect(1);

      var transition = {};

      var handlerInfo = new router$handler$info$$HandlerInfo({
        name: 'foo',
        handler: {},
        getModel: function(_, payload) {
          equal(payload, transition);
        }
      });

      handlerInfo.resolve($$handler_info_test$$async, $$handler_info_test$$noop, transition);
    });

    test("HandlerInfo#resolve runs afterModel hook on handler", function() {

      expect(3);

      var transition = {};
      var model = {};

      var handler = {
        afterModel: function(resolvedModel, payload) {
          equal(resolvedModel, model, "afterModel receives the value resolved by model");
          equal(payload, transition);
          return $$rsvp$resolve$$default(123); // 123 should get ignored
        }
      };

      var handlerInfo = new router$handler$info$$HandlerInfo({
        name: 'foo',
        handler: handler,
        params: {},
        getModel: function() {
          return $$rsvp$resolve$$default(model);
        }
      });

      handlerInfo.resolve($$handler_info_test$$async, $$handler_info_test$$noop, transition).then(function(resolvedHandlerInfo) {
        equal(resolvedHandlerInfo.context, model, "HandlerInfo resolved with correct model");
      });
    });

    test("UnresolvedHandlerInfoByParam gets its model hook called", function() {
      expect(2);

      var transition = {};

      var handler = {
        model: function(params, payload) {
          equal(payload, transition);
          deepEqual(params, { first_name: 'Alex', last_name: 'Matchnerd' });
        }
      };

      var handlerInfo = new router$handler$info$$UnresolvedHandlerInfoByParam({
        name: 'foo',
        handler: handler,
        params: { first_name: 'Alex', last_name: 'Matchnerd' }
      });

      handlerInfo.resolve($$handler_info_test$$async, $$handler_info_test$$noop, transition);
    });

    test("UnresolvedHandlerInfoByObject does NOT get its model hook called", function() {
      expect(1);

      var handler = {
        model: function() {
          ok(false, "I shouldn't be called because I already have a context/model");
        }
      };

      var handlerInfo = new router$handler$info$$UnresolvedHandlerInfoByObject({
        name: 'foo',
        handler: handler,
        names: ['wat'],
        context: $$rsvp$resolve$$default({ name: 'dorkletons' })
      });

      handlerInfo.resolve($$handler_info_test$$async, $$handler_info_test$$noop, {}).then(function(resolvedHandlerInfo) {
        equal(resolvedHandlerInfo.context.name, 'dorkletons');
      });
    });

    var $$query_params_test$$router, $$query_params_test$$url, $$query_params_test$$handlers, $$query_params_test$$expectedUrl, $$query_params_test$$actions;

    $$test_helpers$$module("Query Params", {
      setup: function() {
        $$query_params_test$$handlers = {};
        $$query_params_test$$expectedUrl = null;

        $$query_params_test$$map(function(match) {
          match("/index").to("index");
        });
      }
    });

    function $$query_params_test$$map(fn) {
      $$query_params_test$$router = new router$$default();
      $$query_params_test$$router.map(fn);

      $$query_params_test$$router.getHandler = function(name) {
        return $$query_params_test$$handlers[name] || ($$query_params_test$$handlers[name] = {});
      };

      $$query_params_test$$router.updateURL = function(newUrl) {

        if ($$query_params_test$$expectedUrl) {
          equal(newUrl, $$query_params_test$$expectedUrl, "The url is " + newUrl+ " as expected");
        }

        $$query_params_test$$url = newUrl;
      };
    }

    function $$query_params_test$$enableErrorHandlingDeferredActionQueue() {
      $$query_params_test$$actions = [];
      $$config$$configure('async', function(callback, promise) {
        $$query_params_test$$actions.push({
          callback: callback,
          promise: promise
        });
      });
    }

    test("a change in query params fires a queryParamsDidChange event", function() {
      expect(7);

      var count = 0;
      $$query_params_test$$handlers.index = {
        setup: function() {
          equal(count, 0, "setup should be called exactly once since we're only changing query params after the first transition");
        },
        events: {
          finalizeQueryParamChange: function(params, finalParams) {
            // copy to finalParams to tell the router we're consuming
            // these params.
            finalParams.push({ key: 'foo', value: params.foo });
            finalParams.push({ key: 'bar', value: params.bar });
          },

          queryParamsDidChange: function(changed, all) {
            switch (count) {
              case 0:
                ok(false, "shouldn't fire on first trans");
                break;
              case 1:
                deepEqual(changed, { foo: '5', bar: null });
                deepEqual(all,     { foo: '5' });
                break;
              case 2:
                deepEqual(changed, { bar: '6' });
                deepEqual(all,     { foo: '5', bar: '6' });
                break;
              case 3:
                deepEqual(changed, { foo: '8', bar: '9' });
                deepEqual(all,     { foo: '8', bar: '9' });
                break;
            }
          }
        }
      };

      $$test_helpers$$transitionTo($$query_params_test$$router, '/index');
      count = 1;
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=5');
      count = 2;
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=5&bar=6');
      count = 3;
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=8&bar=9');
    });

    test("a handler can opt into a full-on transition by calling refresh", function() {

      expect(2);

      var count = 0;
      $$query_params_test$$handlers.index = {
        model: function() {
          switch (count) {
            case 0:
              ok(true, "model called at first");
              break;
            case 1:
              ok(true, "model called at second");
              break;
            default:
              ok(false, "shouldn't have been called for " + count);
          }
        },
        events: {
          queryParamsDidChange: function(changed, all) {
            switch (count) {
              case 0:
                ok(false, "shouldn't fire on first trans");
                break;
              case 1:
                $$query_params_test$$router.refresh(this);
                break;
            }
          },
          finalizeQueryParamChange: function(params) {
            // we have to consume each param so that the
            // router doesn't think it lost lost the param.
            delete params.foo;
          }
        }
      };

      $$test_helpers$$transitionTo($$query_params_test$$router, '/index');
      count = 1;
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=5');
    });


    test("at the end of a query param change a finalizeQueryParamChange event is fired", function() {
      expect(5);

      var eventHandled = false;
      var count = 0;
      $$query_params_test$$handlers.index = {
        setup: function() {
          ok(!eventHandled, "setup should happen before eventHandled");
        },
        events: {
          finalizeQueryParamChange: function(all) {
            eventHandled = true;
            switch (count) {
              case 0:
                deepEqual(all, {});
                break;
              case 1:
                deepEqual(all, { foo: '5' });
                break;
              case 2:
                deepEqual(all, { foo: '5', bar: '6' });
                break;
              case 3:
                deepEqual(all, { foo: '8', bar: '9' });
                break;
            }
          }
        }
      };

      $$test_helpers$$transitionTo($$query_params_test$$router, '/index');
      count = 1;
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=5');
      count = 2;
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=5&bar=6');
      count = 3;
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=8&bar=9');
    });

    test("failing to consume QPs in finalize event tells the router it no longer has those params", function() {
      expect(2);

      $$query_params_test$$handlers.index = {
        setup: function() {
          ok(true, "setup was entered");
        }
      };

      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=8&bar=9');

      deepEqual($$query_params_test$$router.state.queryParams, {});
    });

    test("consuming QPs in finalize event tells the router those params are active", function() {
      expect(1);

      $$query_params_test$$handlers.index = {
        events: {
          finalizeQueryParamChange: function(params, finalParams) {
            finalParams.push({ key: 'foo', value: params.foo });
          }
        }
      };

      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=8&bar=9');
      deepEqual($$query_params_test$$router.state.queryParams, { foo: '8' });
    });

    test("can hide query params from URL if they're marked as visible=false in finalizeQueryParamChange", function() {
      expect(2);

      $$query_params_test$$handlers.index = {
        events: {
          finalizeQueryParamChange: function(params, finalParams) {
            finalParams.push({ key: 'foo', value: params.foo, visible: false });
            finalParams.push({ key: 'bar', value: params.bar });
          }
        }
      };

      $$query_params_test$$expectedUrl = '/index?bar=9';
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=8&bar=9');
      deepEqual($$query_params_test$$router.state.queryParams, { foo: '8', bar: '9' });
    });

    test("transitionTo() works with single query param arg", function() {
      expect(2);

      $$query_params_test$$handlers.index = {
        events: {
          finalizeQueryParamChange: function(params, finalParams) {
            finalParams.push({ key: 'foo', value: params.foo });
            finalParams.push({ key: 'bar', value: params.bar });
          }
        }
      };

      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?bar=9&foo=8');
      deepEqual($$query_params_test$$router.state.queryParams, { foo: '8', bar: '9' });

      $$query_params_test$$expectedUrl = '/index?bar=9&foo=123';
      $$test_helpers$$transitionTo($$query_params_test$$router, { queryParams: { foo: '123' }});
    });

    test("handleURL will NOT follow up with a replace URL if query params are already in sync", function() {
      expect(0);

      $$query_params_test$$router.replaceURL = function(url) {
        ok(false, "query params are in sync, this replaceURL shouldn't happen: " + url);
      };

      $$query_params_test$$router.handleURL('/index');
    });

    test("model hook receives queryParams", function() {

      expect(1);

      $$query_params_test$$handlers.index = {
        model: function(params, t) {
          deepEqual(params, { queryParams: { foo: '5' } });
        }
      };

      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=5');
    });

    test("can cause full transition by calling refresh within queryParamsDidChange", function() {

      expect(5);

      var modelCount = 0;
      $$query_params_test$$handlers.index = {
        model: function(params, t) {
          ++modelCount;
          if (modelCount === 1) {
            deepEqual(params, { queryParams: { foo: '5' } });
          } else if (modelCount === 2) {
            deepEqual(params, { queryParams: { foo: '6' } });
          }
        },
        events: {
          queryParamsDidChange: function() {
            $$query_params_test$$router.refresh(this);
          }
        }
      };

      equal(modelCount, 0);
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=5');
      equal(modelCount, 1);
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=6');
      equal(modelCount, 2);
    });

    test("can retry a query-params refresh", function() {

      $$query_params_test$$map(function(match) {
        match("/index").to("index");
        match("/login").to("login");
      });

      expect(8);

      var redirect = false;
      var indexTransition;
      $$query_params_test$$handlers.index = {
        model: function(params, transition) {
          if (redirect) {
            indexTransition = transition;
            $$query_params_test$$router.transitionTo('login');
          }
        },
        setup: function() {
          ok(true, "index#setup");
        },
        events: {
          queryParamsDidChange: function() {
            ok(true, "index#queryParamsDidChange");
            redirect = true;
            $$query_params_test$$router.refresh(this);
          },
          finalizeQueryParamChange: function(params, finalParams) {
            finalParams.foo = params.foo;
            finalParams.push({ key: 'foo', value: params.foo });
          }
        }
      };

      $$query_params_test$$handlers.login = {
        setup: function() {
          ok(true, "login#setup");
        }
      };

      $$query_params_test$$expectedUrl = '/index?foo=abc';
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=abc');
      $$query_params_test$$expectedUrl = '/login';
      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=def');
      $$test_helpers$$flushBackburner();
      redirect = false;
      ok(indexTransition, "index transition was saved");
      indexTransition.retry();
      $$query_params_test$$expectedUrl = '/index?foo=def';
    });

    test("tests whether query params to transitionTo are considered active", function() {
      expect(6);

      $$query_params_test$$handlers.index = {
        events: {
          finalizeQueryParamChange: function(params, finalParams) {
            finalParams.push({ key: 'foo', value: params.foo });
            finalParams.push({ key: 'bar', value: params.bar });
          }
        }
      };

      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo=8&bar=9');
      deepEqual($$query_params_test$$router.state.queryParams, { foo: '8', bar: '9' });
      ok($$query_params_test$$router.isActive('index', { queryParams: {foo: '8', bar: '9' }}), "The index handler is active");
      ok($$query_params_test$$router.isActive('index', { queryParams: {foo: 8, bar: 9 }}), "Works when property is number");
      ok(!$$query_params_test$$router.isActive('index', { queryParams: {foo: '9'}}), "Only supply one changed query param");
      ok(!$$query_params_test$$router.isActive('index', { queryParams: {foo: '8', bar: '10', baz: '11' }}), "A new query param was added");
      ok(!$$query_params_test$$router.isActive('index', { queryParams: {foo: '8', bar: '11', }}), "A query param changed");
    });

    test("tests whether array query params to transitionTo are considered active", function() {
      expect(7);

      $$query_params_test$$handlers.index = {
        events: {
          finalizeQueryParamChange: function(params, finalParams) {
            finalParams.push({ key: 'foo', value: params.foo });
          }
        }
      };

      $$test_helpers$$transitionTo($$query_params_test$$router, '/index?foo[]=1&foo[]=2');
      deepEqual($$query_params_test$$router.state.queryParams, { foo: ['1', '2']});
      ok($$query_params_test$$router.isActive('index', { queryParams: {foo: ['1', '2'] }}), "The index handler is active");
      ok($$query_params_test$$router.isActive('index', { queryParams: {foo: [1, 2] }}), "Works when array has numeric elements");
      ok(!$$query_params_test$$router.isActive('index', { queryParams: {foo: ['2', '1']}}), "Change order");
      ok(!$$query_params_test$$router.isActive('index', { queryParams: {foo: ['1', '2', '3']}}), "Change Length");
      ok(!$$query_params_test$$router.isActive('index', { queryParams: {foo: ['3', '4']}}), "Change Content");
      ok(!$$query_params_test$$router.isActive('index', { queryParams: {foo: []}}), "Empty Array");
    });

    var $$router_test$$router, $$router_test$$url, $$router_test$$handlers, $$router_test$$expectedUrl, $$router_test$$actions;

    $$test_helpers$$module("The router", {
      setup: function() {
        $$router_test$$handlers = {};
        $$router_test$$expectedUrl = null;

        $$router_test$$map(function(match) {
          match("/index").to("index");
          match("/about").to("about");
          match("/faq").to("faq");
          match('/nested').to('nestedParent', function (match) {
            match('/').to('nestedChild');
          });
          match("/posts", function(match) {
            match("/:id").to("showPost");
            match("/on/:date").to("showPostsForDate");
            match("/admin/:id").to("admin", function(match) {
              match("/posts").to("adminPosts");
              match("/posts/:post_id").to("adminPost");
            });
            match("/").to("postIndex", function(match) {
              match("/all").to("showAllPosts");

              // TODO: Support canonical: true
              match("/").to("showAllPosts");
              match("/popular").to("showPopularPosts");
              match("/filter/:filter_id").to("showFilteredPosts");
            });
          });
        });
      }
    });

    function $$router_test$$map(fn) {
      $$router_test$$router = new router$$default();
      $$router_test$$router.map(fn);

      $$router_test$$router.getHandler = function(name) {
        return $$router_test$$handlers[name] || ($$router_test$$handlers[name] = {});
      };

      $$router_test$$router.updateURL = function(newUrl) {

        if ($$router_test$$expectedUrl) {
          equal(newUrl, $$router_test$$expectedUrl, "The url is " + newUrl+ " as expected");
        }

        $$router_test$$url = newUrl;
      };
    }

    function $$router_test$$enableErrorHandlingDeferredActionQueue() {

      $$router_test$$actions = [];
      $$config$$configure('async', function(callback, promise) {
        $$router_test$$actions.push({
          callback: callback,
          promise: promise
        });
      });
    }

    function $$router_test$$flush(expectedError) {
      try {
        while($$router_test$$actions.length) {
          var action = $$router_test$$actions.shift();
          action.callback.call(action.promise, action.promise);
        }
      } catch(e) {
        equal(e, expectedError, "exception thrown from hook wasn't swallowed");
        $$router_test$$actions = [];
      }
    }

    test("Mapping adds named routes to the end", function() {
      $$router_test$$url = $$router_test$$router.recognizer.generate("showPost", { id: 1 });
      equal($$router_test$$url, "/posts/1");

      $$router_test$$url = $$router_test$$router.recognizer.generate("showAllPosts");
      equal($$router_test$$url, "/posts");
    });

    test("Handling an invalid URL returns a rejecting promise", function() {
      $$router_test$$router.handleURL("/unknown").then($$test_helpers$$shouldNotHappen, function(e) {
        equal(e.name, "UnrecognizedURLError", "error.name is UnrecognizedURLError");
      }, $$test_helpers$$shouldNotHappen);
    });

    function $$router_test$$routePath(infos) {
      var path = [];

      for (var i=0, l=infos.length; i<l; i++) {
        path.push(infos[i].name);
      }

      return path.join(".");
    }

    test("Handling a URL triggers model on the handler and passes the result into the setup method", function() {
      expect(4);

      var post = { post: true };
      var posts = { index: true };

      $$router_test$$handlers = {
        showPost: {
          model: function(params) {
            deepEqual(params, { id: "1", queryParams: {} }, "showPost#model called with id 1");
            return post;
          },

          setup: function(object) {
            strictEqual(object, post, "setup was called with expected model");
            equal($$router_test$$handlers.showPost.context, post, "context was properly set on showPost handler");
          }
        }
      };

      $$router_test$$router.didTransition = function(infos) {
        equal($$router_test$$routePath(infos), "showPost");
      };

      $$router_test$$router.handleURL("/posts/1");
    });

    test("isActive should not break on initial intermediate route", function() {
      expect(1);
      $$router_test$$router.intermediateTransitionTo("/posts/admin/1/posts");
      ok($$router_test$$router.isActive('admin', '1'));
    });

    test("Handling a URL passes in query params", function() {
      expect(3);

      var indexHandler = {
        model: function(params, transition) {
          deepEqual(transition.queryParams, { sort: 'date', filter: 'true' });
        },
        events: {
          finalizeQueryParamChange: function(params, finalParams) {
            ok(true, 'finalizeQueryParamChange');
            // need to consume the params so that the router
            // knows that they're active
            finalParams.push({ key: 'sort', value: params.sort });
            finalParams.push({ key: 'filter', value: params.filter });
          }
        }
      };

      $$router_test$$handlers = {
        index: indexHandler
      };

      $$router_test$$router.handleURL("/index?sort=date&filter");
      $$test_helpers$$flushBackburner();
      deepEqual($$router_test$$router.state.queryParams, { sort: 'date', filter: 'true' });
    });

    test("handleURL accepts slash-less URLs", function() {

      $$router_test$$handlers = {
        showAllPosts: {
          setup: function() {
            ok(true, "showAllPosts' setup called");
          }
        }
      };

      $$router_test$$router.handleURL("posts/all");
    });

    test("handleURL accepts query params", function() {
      $$router_test$$handlers = {
        posts: {},
        postIndex: {},
        showAllPosts: {
          setup: function() {
            ok(true, "showAllPosts' setup called");
          }
        }
      };

      $$router_test$$router.handleURL("/posts/all?sort=name&sortDirection=descending");
    });

    test("when transitioning with the same context, setup should only be called once", function() {
      var parentSetupCount = 0,
          childSetupCount = 0;

      var context = { id: 1 };

      $$router_test$$map(function(match) {
        match("/").to('index');
        match("/posts/:id").to('post', function(match) {
          match("/details").to('postDetails');
        });
      });

      $$router_test$$handlers = {
        post: {
          setup: function() {
            parentSetupCount++;
          },

          model: function(params) {
            return params;
          }
        },

        postDetails: {
          setup: function() {
            childSetupCount++;
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, '/');

      equal(parentSetupCount, 0, 'precond - parent not setup');
      equal(childSetupCount, 0, 'precond - parent not setup');

      $$test_helpers$$transitionTo($$router_test$$router, 'postDetails', context);

      equal(parentSetupCount, 1, 'after one transition parent is setup once');
      equal(childSetupCount, 1, 'after one transition child is setup once');

      $$test_helpers$$transitionTo($$router_test$$router, 'postDetails', context);

      equal(parentSetupCount, 1, 'after two transitions, parent is still setup once');
      equal(childSetupCount, 1, 'after two transitions, child is still setup once');
    });

    test("when transitioning to a new parent and child state, the parent's context should be available to the child's model", function() {
      var contexts = [];

      $$router_test$$map(function(match) {
        match("/").to('index');
        match("/posts/:id").to('post', function(match) {
          match("/details").to('postDetails');
        });
      });

      $$router_test$$handlers = {
        post: {
          model: function(params, transition) {
            return contexts.post;
          }
        },

        postDetails: {
          name: 'postDetails',
          afterModel: function(model, transition) {
            contexts.push(transition.resolvedModels.post);
          }
        }
      };

      $$router_test$$router.handleURL('/').then(function() {

        // This is a crucial part of the test
        // In some cases, calling `generate` was preventing `model` from being called
        $$router_test$$router.generate('postDetails', { id: 1 });

        return $$router_test$$router.transitionTo('postDetails', { id: 1 });
      }, $$test_helpers$$shouldNotHappen).then(function() {
        deepEqual(contexts, [{ id: 1 }], 'parent context is available');
      }, $$test_helpers$$shouldNotHappen);
    });


    test("A delegate provided to router.js is passed along to route-recognizer", function() {
      $$router_test$$router = new router$$default();

      $$router_test$$router.delegate = {
        willAddRoute: function(context, route) {
          if (!context) { return route; }

          if (context === 'application') {
            return route;
          }

          return context + "." + route;
        },

        // Test that both delegates work together
        contextEntered: function(name, match) {
          match("/").to("index");
        }
      };

      $$router_test$$router.map(function(match) {
        match("/").to("application", function(match) {
          match("/posts").to("posts", function(match) {
            match("/:post_id").to("post");
          });
        });
      });

      var handlers = [];

      $$router_test$$router.getHandler = function(handler) {
        handlers.push(handler);
        return {};
      };

      $$router_test$$router.handleURL("/posts").then(function() {
        deepEqual(handlers, [ "application", "posts", "posts.index" ]);
      });
    });

    test("handleURL: Handling a nested URL triggers each handler", function() {
      expect(28);

      var posts = [];
      var allPosts = { all: true };
      var popularPosts = { popular: true };
      var amazingPosts = { id: "amazing" };
      var sadPosts = { id: "sad" };

      var counter = 0;

      var postIndexHandler = {
        model: function(params) {
          // this will always get called, since it's at the root
          // of all of the routes tested here
          deepEqual(params, { queryParams: {} }, "params should be empty in postIndexHandler#model");
          return posts;
        },

        setup: function(object) {
          if (counter === 0) {
            equal(postIndexHandler.context, posts, "postIndexHandler context should be set up in postIndexHandler#setup");
            strictEqual(object, posts, "The object passed in to postIndexHandler#setup should be posts");
          } else {
            ok(false, "Should not get here");
          }
        }
      };

      var showAllPostsHandler = {
        model: function(params) {
          if (counter > 0 && counter < 4) {
            equal(postIndexHandler.context, posts, "postIndexHandler context should be set up in showAllPostsHandler#model");
          }

          if (counter < 4) {
            deepEqual(params, { queryParams: {} }, "params should be empty in showAllPostsHandler#model");
            return allPosts;
          } else {
            ok(false, "Should not get here");
          }
        },

        setup: function(object) {
          if (counter === 0) {
            equal(postIndexHandler.context, posts, "postIndexHandler context should be set up in showAllPostsHandler#setup");
            equal(showAllPostsHandler.context, allPosts, "showAllPostsHandler context should be set up in showAllPostsHandler#setup");
            strictEqual(object, allPosts, "The object passed in should be allPosts in showAllPostsHandler#setup");
          } else {
            ok(false, "Should not get here");
          }
        }
      };

      var showPopularPostsHandler = {
        model: function(params) {
          if (counter < 3) {
            ok(false, "Should not get here");
          } else if (counter === 3) {
            equal(postIndexHandler.context, posts, "postIndexHandler context should be set up in showPopularPostsHandler#model");
            deepEqual(params, { queryParams: {} }, "params should be empty in showPopularPostsHandler#serialize");
            return popularPosts;
          } else {
            ok(false, "Should not get here");
          }
        },

        setup: function(object) {
          if (counter === 3) {
            equal(postIndexHandler.context, posts, "postIndexHandler context should be set up in showPopularPostsHandler#setup");
            equal(showPopularPostsHandler.context, popularPosts, "showPopularPostsHandler context should be set up in showPopularPostsHandler#setup");
            strictEqual(object, popularPosts, "The object passed to showPopularPostsHandler#setup should be popular posts");
          } else {
            ok(false, "Should not get here");
          }
        }
      };

      var showFilteredPostsHandler = {
        model: function(params) {
          if (counter < 4) {
            ok(false, "Should not get here");
          } else if (counter === 4) {
            equal(postIndexHandler.context, posts, "postIndexHandler context should be set up in showFilteredPostsHandler#model");
            deepEqual(params, { filter_id: 'amazing', queryParams: {} }, "params should be { filter_id: 'amazing' } in showFilteredPostsHandler#model");
            return amazingPosts;
          } else if (counter === 5) {
            equal(postIndexHandler.context, posts, "postIndexHandler context should be posts in showFilteredPostsHandler#model");
            deepEqual(params, { filter_id: 'sad', queryParams: {} }, "params should be { filter_id: 'sad' } in showFilteredPostsHandler#model");
            return sadPosts;
          } else {
            ok(false, "Should not get here");
          }
        },

        setup: function(object) {
          if (counter === 4) {
            equal(postIndexHandler.context, posts);
            equal(showFilteredPostsHandler.context, amazingPosts);
            strictEqual(object, amazingPosts);
          } else if (counter === 5) {
            equal(postIndexHandler.context, posts);
            equal(showFilteredPostsHandler.context, sadPosts);
            strictEqual(object, sadPosts);
            started = true;
          } else {
            ok(false, "Should not get here");
          }
        }
      };

      var started = false;

      $$router_test$$handlers = {
        postIndex: postIndexHandler,
        showAllPosts: showAllPostsHandler,
        showPopularPosts: showPopularPostsHandler,
        showFilteredPosts: showFilteredPostsHandler
      };

      $$router_test$$router.transitionTo("/posts").then(function() {
        ok(true, "1: Finished, trying /posts/all");
        counter++;
        return $$router_test$$router.transitionTo("/posts/all");
      }, $$test_helpers$$shouldNotHappen).then(function() {
        ok(true, "2: Finished, trying /posts");
        counter++;
        return $$router_test$$router.transitionTo("/posts");
      }, $$test_helpers$$shouldNotHappen).then(function() {
        ok(true, "3: Finished, trying /posts/popular");
        counter++;
        return $$router_test$$router.transitionTo("/posts/popular");
      }, $$test_helpers$$shouldNotHappen).then(function() {
        ok(true, "4: Finished, trying /posts/filter/amazing");
        counter++;
        return $$router_test$$router.transitionTo("/posts/filter/amazing");
      }, $$test_helpers$$shouldNotHappen).then(function() {
        ok(true, "5: Finished, trying /posts/filter/sad");
        counter++;
        return $$router_test$$router.transitionTo("/posts/filter/sad");
      }, $$test_helpers$$shouldNotHappen).then(function() {
        ok(true, "6: Finished!");
      }, $$test_helpers$$shouldNotHappen);
    });

    test("it can handle direct transitions to named routes", function() {
      var posts = [];
      var allPosts = { all: true };
      var popularPosts = { popular: true };
      var amazingPosts = { filter: "amazing" };
      var sadPosts = { filter: "sad" };

      var postIndexHandler = {
        model: function(params) {
          return allPosts;
        },

        serialize: function(object, params) {
          return {};
        },

        setup: function(object) {

        }
      };

      var showAllPostsHandler = {
        model: function(params) {
          //ok(!params, 'params is falsy for non dynamic routes');
          return allPosts;
        },

        serialize: function(object, params) {
          return {};
        },

        setup: function(object) {
          strictEqual(object, allPosts, 'showAllPosts should get correct setup');
        }
      };

      var showPopularPostsHandler = {
        model: function(params) {
          return popularPosts;
        },

        serialize: function(object) {
          return {};
        },

        setup: function(object) {
          strictEqual(object, popularPosts, "showPopularPosts#setup should be called with the deserialized value");
        }
      };

      var showFilteredPostsHandler = {
        model: function(params) {
          if (!params) { return; }
          if (params.filter_id === "amazing") {
            return amazingPosts;
          } else if (params.filter_id === "sad") {
            return sadPosts;
          }
        },

        serialize: function(object, params) {
          deepEqual(params, ['filter_id'], 'showFilteredPosts should get correct serialize');
          return { filter_id: object.filter };
        },

        setup: function(object) {
          if (counter === 2) {
            strictEqual(object, amazingPosts, 'showFilteredPosts should get setup with amazingPosts');
          } else if (counter === 3) {
            strictEqual(object, sadPosts, 'showFilteredPosts should get setup setup with sadPosts');
          }
        }
      };

      $$router_test$$handlers = {
        postIndex: postIndexHandler,
        showAllPosts: showAllPostsHandler,
        showPopularPosts: showPopularPostsHandler,
        showFilteredPosts: showFilteredPostsHandler
      };

      $$router_test$$router.updateURL = function(url) {
        var expected = {
          0: "/posts",
          1: "/posts/popular",
          2: "/posts/filter/amazing",
          3: "/posts/filter/sad",
          4: "/posts"
        };

        equal(url, expected[counter], 'updateURL should be called with correct url');
      };

      var counter = 0;

      $$router_test$$router.handleURL("/posts").then(function() {
        return $$router_test$$router.transitionTo("showAllPosts");
      }, $$test_helpers$$shouldNotHappen).then(function() {
        counter++;
        return $$router_test$$router.transitionTo("showPopularPosts");
      }, $$test_helpers$$shouldNotHappen).then(function() {
        counter++;
        return $$router_test$$router.transitionTo("showFilteredPosts", amazingPosts);
      }, $$test_helpers$$shouldNotHappen).then(function() {
        counter++;
        return $$router_test$$router.transitionTo("showFilteredPosts", sadPosts);
      }, $$test_helpers$$shouldNotHappen).then(function() {
        counter++;
        return $$router_test$$router.transitionTo("showAllPosts");
      }, $$test_helpers$$shouldNotHappen);
    });

    test("replaceWith calls replaceURL", function() {
      var updateCount = 0,
          replaceCount = 0;

      $$router_test$$router.updateURL = function() {
        updateCount++;
      };

      $$router_test$$router.replaceURL = function() {
        replaceCount++;
      };

      $$router_test$$router.handleURL('/posts').then(function(handlerInfos) {
        return $$router_test$$router.replaceWith('about');
      }).then(function() {
        equal(updateCount, 0, "should not call updateURL");
        equal(replaceCount, 1, "should call replaceURL once");
      });
    });


    test("Moving to a new top-level route triggers exit callbacks", function() {
      expect(5);

      var allPosts = { posts: "all" };
      var postsStore = { 1: { id: 1 }, 2: { id: 2 } };
      var currentId, currentPath;

      $$router_test$$handlers = {
        showAllPosts: {
          model: function(params) {
            return allPosts;
          },

          setup: function(posts) {
            equal(posts, allPosts, "The correct context was passed into showAllPostsHandler#setup");
            currentPath = "postIndex.showAllPosts";
          },

          exit: function() {
            ok(true, "Should get here");
          }
        },

        showPost: {
          model: function(params, resolvedModels) {
            return postsStore[params.id];
          },

          serialize: function(post) {
            return { id: post.id };
          },

          setup: function(post) {
            currentPath = "showPost";
            equal(post.id, currentId, "The post id is " + currentId);
          }
        }
      };

      $$router_test$$router.handleURL("/posts").then(function() {
        $$router_test$$expectedUrl = "/posts/1";
        currentId = 1;
        return $$router_test$$router.transitionTo('showPost', postsStore[1]);
      }, $$test_helpers$$shouldNotHappen).then(function() {
        equal($$router_test$$routePath($$router_test$$router.currentHandlerInfos), currentPath);
      }, $$test_helpers$$shouldNotHappen);
    });

    test("pivotHandler is exposed on Transition object", function() {
      expect(3);

      $$router_test$$handlers = {
        showAllPosts: {
          beforeModel: function(transition) {
            ok(!transition.pivotHandler, "First route transition has no pivot route");
          }
        },

        showPopularPosts: {
          beforeModel: function(transition) {
            equal(transition.pivotHandler, $$router_test$$handlers.postIndex, "showAllPosts -> showPopularPosts pivotHandler is postIndex");
          }
        },

        postIndex: {},

        about: {
          beforeModel: function(transition) {
            ok(!transition.pivotHandler, "top-level transition has no pivotHandler");
          }
        }
      };

      $$router_test$$router.handleURL("/posts").then(function() {
        return $$router_test$$router.transitionTo('showPopularPosts');
      }).then(function() {
        return $$router_test$$router.transitionTo('about');
      }).then(start, $$test_helpers$$shouldNotHappen);
    });

    asyncTest("transition.resolvedModels after redirects b/w routes", function() {
      $$router_test$$map(function(match) {
        match("/").to('application', function(match) {
          match("/peter").to('peter');
          match("/wagenet").to('wagenet');
        });
      });

      var app = { app: true },
          redirect = true;

      $$router_test$$handlers = {
        application: {
          model: function(params) {
            ok(true, "application#model");
            return app;
          }
        },

        peter: {
          model: function(params, transition) {
            deepEqual(transition.resolvedModels.application, app, "peter: resolvedModel correctly stored in resolvedModels for parent route");
            $$router_test$$router.transitionTo("wagenet");
          }
        },
        wagenet: {
          model: function(params, transition) {
            deepEqual(transition.resolvedModels.application, app, "wagenet: resolvedModel correctly stored in resolvedModels for parent route");
            start();
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, "/peter");
    });

    test("transition.resolvedModels after redirects within the same route", function() {
      var admin = { admin: true },
          redirect = true;

      $$router_test$$handlers = {
        admin: {
          model: function(params) {
            ok(true, "admin#model");
            return admin;
          }
        },

        adminPosts: {
          model: function(params, transition) {
            deepEqual(transition.resolvedModels.admin, admin, "resolvedModel correctly stored in resolvedModels for parent route");
            if (redirect) {
              redirect = false;
              $$router_test$$router.transitionTo("adminPosts");
            }
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, "/posts/admin/1/posts");
    });

    test("Moving to the same route with a different parent dynamic segment re-runs model", function() {
      var admins = { 1: { id: 1 }, 2: { id: 2 } },
          adminPosts = { 1: { id: 1 }, 2: { id: 2 } },
          adminPostModel = 0;

      $$router_test$$handlers = {
        admin: {
          model: function(params) {
            return this.currentModel = admins[params.id];
          }
        },

        adminPosts: {
          model: function() {
            adminPostModel++;
            return adminPosts[$$router_test$$handlers.admin.currentModel.id];
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, "/posts/admin/1/posts");
      equal($$router_test$$handlers.admin.context, admins[1]);
      equal($$router_test$$handlers.adminPosts.context, adminPosts[1]);

      $$test_helpers$$transitionTo($$router_test$$router, "/posts/admin/2/posts");
      equal($$router_test$$handlers.admin.context, admins[2]);
      equal($$router_test$$handlers.adminPosts.context, adminPosts[2]);
    });

    test("Moving to a sibling route only triggers exit callbacks on the current route (when transitioned internally)", function() {
      expect(8);

      var allPosts = { posts: "all" };
      var postsStore = { 1: { id: 1 }, 2: { id: 2 } };
      var currentId;

      var showAllPostsHandler = {
        model: function(params) {
          return allPosts;
        },

        setup: function(posts) {
          equal(posts, allPosts, "The correct context was passed into showAllPostsHandler#setup");

        },

        enter: function() {
          ok(true, "The sibling handler should be entered");
        },

        exit: function() {
          ok(true, "The sibling handler should be exited");
        }
      };

      var filters = {};

      var showFilteredPostsHandler = {
        enter: function() {
          ok(true, "The new handler was entered");
        },

        exit: function() {
          ok(false, "The new handler should not be exited");
        },

        model: function(params) {
          var id = params.filter_id;
          if (!filters[id]) {
            filters[id] = { id: id };
          }

          return filters[id];
        },

        serialize: function(filter) {
          equal(filter.id, "favorite", "The filter should be 'favorite'");
          return { filter_id: filter.id };
        },

        setup: function(filter) {
          equal(filter.id, "favorite", "showFilteredPostsHandler#setup was called with the favorite filter");
        }
      };

      var postIndexHandler = {
        enter: function() {
          ok(true, "The outer handler was entered only once");
        },

        exit: function() {
          ok(false, "The outer handler was not exited");
        }
      };

      $$router_test$$handlers = {
        postIndex: postIndexHandler,
        showAllPosts: showAllPostsHandler,
        showFilteredPosts: showFilteredPostsHandler
      };

      $$router_test$$router.handleURL("/posts").then(function() {
        $$router_test$$expectedUrl = "/posts/filter/favorite";
        return $$router_test$$router.transitionTo('showFilteredPosts', { id: 'favorite' });
      });
    });

    test("Moving to a sibling route only triggers exit callbacks on the current route (when transitioned via a URL change)", function() {
      expect(7);

      var allPosts = { posts: "all" };
      var postsStore = { 1: { id: 1 }, 2: { id: 2 } };
      var currentId;

      var showAllPostsHandler = {
        model: function(params) {
          return allPosts;
        },

        setup: function(posts) {
          equal(posts, allPosts, "The correct context was passed into showAllPostsHandler#setup");
        },

        enter: function() {
          ok(true, "The sibling handler should be entered");
        },

        exit: function() {
          ok(true, "The sibling handler should be exited");
        }
      };

      var filters = {};

      var showFilteredPostsHandler = {
        enter: function() {
          ok(true, "The new handler was entered");
        },

        exit: function() {
          ok(false, "The new handler should not be exited");
        },

        model: function(params) {
          equal(params.filter_id, "favorite", "The filter should be 'favorite'");

          var id = params.filter_id;
          if (!filters[id]) {
            filters[id] = { id: id };
          }

          return filters[id];
        },

        serialize: function(filter) {
          return { filter_id: filter.id };
        },

        setup: function(filter) {
          equal(filter.id, "favorite", "showFilteredPostsHandler#setup was called with the favorite filter");
        }
      };

      var postIndexHandler = {
        enter: function() {
          ok(true, "The outer handler was entered only once");
        },

        exit: function() {
          ok(false, "The outer handler was not exited");
        }
      };

      $$router_test$$handlers = {
        postIndex: postIndexHandler,
        showAllPosts: showAllPostsHandler,
        showFilteredPosts: showFilteredPostsHandler
      };

      $$router_test$$router.handleURL("/posts");

      $$test_helpers$$flushBackburner();

      $$router_test$$expectedUrl = "/posts/filter/favorite";
      $$router_test$$router.handleURL($$router_test$$expectedUrl);
    });

    test("events can be targeted at the current handler", function() {

      $$router_test$$handlers = {
        showPost: {
          enter: function() {
            ok(true, "The show post handler was entered");
          },

          events: {
            expand: function() {
              equal(this, $$router_test$$handlers.showPost, "The handler is the `this` for the event");
              start();
            }
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, '/posts/1');

      $$router_test$$router.trigger("expand");
    });

    test("event triggering is pluggable", function() {

      $$router_test$$handlers = {
        showPost: {
          enter: function() {
            ok(true, "The show post handler was entered");
          },

          actions: {
            expand: function() {
              equal(this, $$router_test$$handlers.showPost, "The handler is the `this` for the event");
            }
          }
        }
      };
      $$router_test$$router.triggerEvent = function(handlerInfos, ignoreFailure, args) {
        var name = args.shift();

        if (!handlerInfos) {
          if (ignoreFailure) { return; }
          throw new Error("Could not trigger event '" + name + "'. There are no active handlers");
        }

        var eventWasHandled = false;

        for (var i=handlerInfos.length-1; i>=0; i--) {
          var handlerInfo = handlerInfos[i],
              handler = handlerInfo.handler;

          if (handler.actions && handler.actions[name]) {
            if (handler.actions[name].apply(handler, args) === true) {
              eventWasHandled = true;
            } else {
              return;
            }
          }
        }
      };
      $$router_test$$router.handleURL("/posts/1").then(function() {
        $$router_test$$router.trigger("expand");
      });
    });

    test("Unhandled events raise an exception", function() {
      $$router_test$$router.handleURL("/posts/1");

      throws(function() {
        $$router_test$$router.trigger("doesnotexist");
      }, /doesnotexist/);
    });

    test("events can be targeted at a parent handler", function() {
      expect(3);

      $$router_test$$handlers = {
        postIndex: {
          enter: function() {
            ok(true, "The post index handler was entered");
          },

          events: {
            expand: function() {
              equal(this, $$router_test$$handlers.postIndex, "The handler is the `this` in events");
            }
          }
        },
        showAllPosts: {
          enter: function() {
            ok(true, "The show all posts handler was entered");
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, '/posts');
      $$router_test$$router.trigger("expand");
    });

    test("events can bubble up to a parent handler via `return true`", function() {
      expect(4);

      $$router_test$$handlers = {
        postIndex: {
          enter: function() {
            ok(true, "The post index handler was entered");
          },

          events: {
            expand: function() {
              equal(this, $$router_test$$handlers.postIndex, "The handler is the `this` in events");
            }
          }
        },
        showAllPosts: {
          enter: function() {
            ok(true, "The show all posts handler was entered");
          },
          events: {
            expand: function() {
              equal(this, $$router_test$$handlers.showAllPosts, "The handler is the `this` in events");
              return true;
            }
          }
        }
      };

      $$router_test$$router.handleURL("/posts").then(function(result) {
        $$router_test$$router.trigger("expand");
      });

    });

    test("handled-then-bubbled events don't throw an exception if uncaught by parent route", function() {
      expect(3);

      $$router_test$$handlers = {
        postIndex: {
          enter: function() {
            ok(true, "The post index handler was entered");
          }
        },

        showAllPosts: {
          enter: function() {
            ok(true, "The show all posts handler was entered");
          },
          events: {
            expand: function() {
              equal(this, $$router_test$$handlers.showAllPosts, "The handler is the `this` in events");
              return true;
            }
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, "/posts");
      $$router_test$$router.trigger("expand");
    });

    test("events only fire on the closest handler", function() {
      expect(5);

      $$router_test$$handlers = {
        postIndex: {
          enter: function() {
            ok(true, "The post index handler was entered");
          },

          events: {
            expand: function() {
              ok(false, "Should not get to the parent handler");
            }
          }
        },

        showAllPosts: {
          enter: function() {
            ok(true, "The show all posts handler was entered");
          },

          events: {
            expand: function(passedContext1, passedContext2) {
              equal(context1, passedContext1, "A context is passed along");
              equal(context2, passedContext2, "A second context is passed along");
              equal(this, $$router_test$$handlers.showAllPosts, "The handler is passed into events as `this`");
            }
          }
        }
      };

      var context1 = {}, context2 = {};
      $$router_test$$router.handleURL("/posts").then(function(result) {
        $$router_test$$router.trigger("expand", context1, context2);
      });
    });

    test("Date params aren't treated as string/number params", function() {
      expect(1);

      $$router_test$$handlers = {
        showPostsForDate: {
          serialize: function(date) {
            return { date: date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate() };
          },

          model: function(params) {
            ok(false, "model shouldn't be called; the date is the provided model");
          }
        }
      };

      equal($$router_test$$router.generate('showPostsForDate', new Date(1815, 5, 18)), "/posts/on/1815-5-18");
    });

    test("params are known by a transition up front", function() {
      expect(2);

      $$router_test$$handlers = {
        postIndex: {
          model: function(params, transition) {
            deepEqual(transition.params, { postIndex: {}, showFilteredPosts: { filter_id: "sad" } });
          }
        },
        showFilteredPosts: {
          model: function(params, transition) {
            deepEqual(transition.params, { postIndex: {}, showFilteredPosts: { filter_id: "sad" } });
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, '/posts/filter/sad', 'blorg');
    });

    test("transitionTo uses the current context if you are already in a handler with a context that is not changing", function() {
      var admin = { id: 47 },
          adminPost = { id: 74 };

      $$router_test$$handlers = {
        admin: {
          serialize: function(object) {
            equal(object.id, 47, "The object passed to serialize is correct");
            return { id: 47 };
          },

          model: function(params) {
            equal(params.id, 47, "The object passed to serialize is correct");
            return admin;
          }
        },

        adminPost: {
          serialize: function(object) {
            return { post_id: object.id };
          },

          model: function(params) {
            equal(params.id, 74, "The object passed to serialize is correct");
            return adminPost;
          }
        }
      };

      $$router_test$$expectedUrl = '/posts/admin/47/posts/74';
      $$test_helpers$$transitionTo($$router_test$$router, 'adminPost', admin, adminPost);

      $$router_test$$expectedUrl =  '/posts/admin/47/posts/75';
      $$test_helpers$$transitionTo($$router_test$$router, 'adminPost', { id: 75 });
    });

    test("tests whether arguments to transitionTo are considered active", function() {
      var admin = { id: 47 },
          adminPost = { id: 74 },
          posts = {
            1: { id: 1 },
            2: { id: 2 },
            3: { id: 3 }
          };

      var adminHandler = {
        serialize: function(object) {
          return { id: 47 };
        },

        model: function(params) {
          return admin;
        }
      };

      var adminPostHandler = {
        serialize: function(object) {
          return { post_id: object.id };
        },

        model: function(params) {
          return adminPost;
        }
      };

      var showPostHandler = {
        serialize: function(object) {
          return object && { id: object.id } || null;
        },

        model: function(params) {
          return posts[params.id];
        }
      };

      $$router_test$$handlers = {
        admin: adminHandler,
        adminPost: adminPostHandler,
        showPost: showPostHandler
      };

      $$test_helpers$$transitionTo($$router_test$$router, "/posts/1");
      ok($$router_test$$router.isActive('showPost'), "The showPost handler is active");
      ok($$router_test$$router.isActive('showPost', posts[1]), "The showPost handler is active with the appropriate context");
      ok(!$$router_test$$router.isActive('showPost', posts[2]), "The showPost handler is inactive when the context is different");
      ok(!$$router_test$$router.isActive('adminPost'), "The adminPost handler is inactive");
      ok(!$$router_test$$router.isActive('showPost', null), "The showPost handler is inactive with a null context");

      $$test_helpers$$transitionTo($$router_test$$router, 'adminPost', admin, adminPost);
      ok($$router_test$$router.isActive('adminPost'), "The adminPost handler is active");
      ok($$router_test$$router.isActive('adminPost', adminPost), "The adminPost handler is active with the current context");
      ok($$router_test$$router.isActive('adminPost', admin, adminPost), "The adminPost handler is active with the current and parent context");
      ok($$router_test$$router.isActive('admin'), "The admin handler is active");
      ok($$router_test$$router.isActive('admin', admin), "The admin handler is active with its context");
    });

    test("calling generate on a non-dynamic route does not blow away parent contexts", function() {
      $$router_test$$map(function(match) {
        match("/projects").to('projects', function(match) {
          match("/").to('projectsIndex');
          match("/project").to('project', function(match) {
            match("/").to('projectIndex');
          });
        });
      });

      var projects = {};

      $$router_test$$handlers = {
        projects: {
          model: function(){
            return projects;
          }
        }
      };

      $$router_test$$router.handleURL('/projects').then(function(result) {
        equal($$router_test$$handlers.projects.context, projects, 'projects handler has correct context');
        $$router_test$$router.generate('projectIndex');
        equal($$router_test$$handlers.projects.context, projects, 'projects handler retains correct context');
      });
    });

    test("calling transitionTo on a dynamic parent route causes non-dynamic child context to be updated", function() {
      $$router_test$$map(function(match) {
        match("/project/:project_id").to('project', function(match) {
          match("/").to('projectIndex');
        });
      });

      var projectHandler = {
        model: function(params) {
          delete params.queryParams;
          return params;
        }
      };

      var projectIndexHandler = {
        model: function(params, transition) {
          return transition.resolvedModels.project;
        }
      };

      $$router_test$$handlers = {
        project:       projectHandler,
        projectIndex:  projectIndexHandler
      };

      $$test_helpers$$transitionTo($$router_test$$router, '/project/1');
      deepEqual(projectHandler.context, { project_id: '1' }, 'project handler retains correct context');
      deepEqual(projectIndexHandler.context, { project_id: '1' }, 'project index handler has correct context');

      $$router_test$$router.generate('projectIndex', { project_id: '2' });

      deepEqual(projectHandler.context, { project_id: '1' }, 'project handler retains correct context');
      deepEqual(projectIndexHandler.context, { project_id: '1' }, 'project index handler retains correct context');

      $$test_helpers$$transitionTo($$router_test$$router, 'projectIndex', { project_id: '2' });
      deepEqual(projectHandler.context, { project_id: '2' }, 'project handler has updated context');
      deepEqual(projectIndexHandler.context, { project_id: '2' }, 'project index handler has updated context');
    });

    test("reset exits and clears the current and target route handlers", function() {
      var postIndexExited = false;
      var showAllPostsExited = false;

      var postIndexHandler = {
        exit: function() {
          postIndexExited = true;
        }
      };
      var showAllPostsHandler = {
        exit: function() {
          showAllPostsExited = true;
        }
      };
      $$router_test$$handlers = {
        postIndex: postIndexHandler,
        showAllPosts: showAllPostsHandler
      };

      $$test_helpers$$transitionTo($$router_test$$router, "/posts/all");

      $$router_test$$router.reset();
      $$router_test$$router.reset(); // two resets back to back should work

      ok(postIndexExited, "Post index handler did not exit");
      ok(showAllPostsExited, "Show all posts handler did not exit");
      equal($$router_test$$router.currentHandlerInfos, null, "currentHandlerInfos should be null");
      equal($$router_test$$router.targetHandlerInfos, null, "targetHandlerInfos should be null");
    });

    test("any of the model hooks can redirect with or without promise", function() {
      expect(26);
      var setupShouldBeEntered = false;
      var returnPromise = false;
      var redirectTo;
      var shouldFinish;

      function redirectToAbout() {
        if (returnPromise) {
          return $$rsvp$reject$$default().then(null, function() {
            $$router_test$$router.transitionTo(redirectTo);
          });
        } else {
          $$router_test$$router.transitionTo(redirectTo);
        }
      }

      $$router_test$$handlers = {
        index: {
          beforeModel: redirectToAbout,
          model: redirectToAbout,
          afterModel: redirectToAbout,

          setup: function() {
            ok(setupShouldBeEntered, "setup should be entered at this time");
          }
        },

        about: {
          setup: function() {
            ok(true, "about handler's setup function was called");
          }
        },

        borf: {
          setup: function() {
            ok(true, "borf setup entered");
          }
        }
      };

      function testStartup(firstExpectedURL) {
        $$router_test$$map(function(match) {
          match("/").to('index');
          match("/about").to('about');
          match("/foo").to('foo');
          match("/borf").to('borf');
        });

        redirectTo = 'about';

        // Perform a redirect on startup.
        $$router_test$$expectedUrl = firstExpectedURL || '/about';
        $$test_helpers$$transitionTo($$router_test$$router, '/');

        $$router_test$$expectedUrl = '/borf';
        redirectTo = 'borf';

        $$test_helpers$$transitionTo($$router_test$$router, 'index');
      }

      testStartup();

      returnPromise = true;
      testStartup();

      delete $$router_test$$handlers.index.beforeModel;
      returnPromise = false;
      testStartup();

      returnPromise = true;
      testStartup();

      delete $$router_test$$handlers.index.model;
      returnPromise = false;
      testStartup();

      returnPromise = true;
      testStartup();

      delete $$router_test$$handlers.index.afterModel;
      setupShouldBeEntered = true;
      shouldFinish = true;
      testStartup('/');
    });


    test("transitionTo with a promise pauses the transition until resolve, passes resolved context to setup", function() {
      $$router_test$$handlers = {
        index: {},
        showPost: {
          setup: function(context) {
            deepEqual(context, { id: 1 }, "setup receives a resolved context");
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, '/index');

      $$test_helpers$$transitionTo($$router_test$$router, 'showPost', new rsvp$promise$$default(function(resolve, reject) {
        resolve({ id: 1 });
      }));
    });

    test("error handler gets called for errors in validation hooks", function() {
      expect(25);
      var setupShouldBeEntered = false;
      var expectedReason = { reason: 'No funciona, mon frere.' };

      function throwAnError() {
        return $$rsvp$reject$$default(expectedReason);
      }

      $$router_test$$handlers = {
        index: {
          beforeModel: throwAnError,
          model: throwAnError,
          afterModel: throwAnError,

          events: {
            error: function(reason) {
              equal(reason, expectedReason, "the value passed to the error handler is what was 'thrown' from the hook");
            },
          },

          setup: function() {
            ok(setupShouldBeEntered, "setup should be entered at this time");
          }
        },

        about: {
          setup: function() {
            ok(true, "about handler's setup function was called");
          }
        }
      };


      function testStartup() {
        $$router_test$$map(function(match) {
          match("/").to('index');
          match("/about").to('about');
        });

        // Perform a redirect on startup.
        return $$router_test$$router.handleURL('/').then(null, function(reason) {
          equal(reason, expectedReason, "handleURL error reason is what was originally thrown");

          return $$router_test$$router.transitionTo('index').then($$test_helpers$$shouldNotHappen, function(newReason) {
            equal(newReason, expectedReason, "transitionTo error reason is what was originally thrown");
          });
        });
      }

      testStartup().then(function(result) {
        return testStartup();
      }).then(function(result) {
        delete $$router_test$$handlers.index.beforeModel;
        return testStartup();
      }).then(function(result) {
        return testStartup();
      }).then(function(result) {
        delete $$router_test$$handlers.index.model;
        return testStartup();
      }).then(function(result) {
        return testStartup();
      }).then(function(result) {
        delete $$router_test$$handlers.index.afterModel;
        setupShouldBeEntered = true;
        return testStartup();
      }).then(function(result) {
        setTimeout(start, 200);
      }, $$test_helpers$$shouldNotHappen);
    });

    test("Errors shouldn't be handled after proceeding to next child route", function() {

      expect(3);

      $$router_test$$map(function(match) {
        match("/parent").to('parent', function(match) {
          match("/articles").to('articles');
          match("/login").to('login');
        });
      });

      $$router_test$$handlers = {
        articles: {
          beforeModel: function() {
            ok(true, "articles beforeModel was entered");
            return $$rsvp$reject$$default("blorg");
          },
          events: {
            error: function() {
              ok(true, "error handled in articles");
              $$router_test$$router.transitionTo('login');
            }
          }
        },

        login: {
          setup: function() {
            ok(true, 'login#setup');
          }
        },

        parent: {
          events: {
            error: function() {
              ok(false, "handled error shouldn't bubble up to parent route");
            }
          }
        }
      };

      $$router_test$$router.handleURL('/parent/articles');
    });

    asyncTest("Error handling shouldn't trigger for transitions that are already aborted", function() {

      expect(1);

      $$router_test$$map(function(match) {
        match("/slow_failure").to('slow_failure');
        match("/good").to('good');
      });

      $$router_test$$handlers = {
        slow_failure: {
          model: function() {
        return new rsvp$promise$$default(function(res, rej){
          $$router_test$$router.transitionTo('good');
          rej();
          start();
        });
          },
          events: {
            error: function() {
              ok(false, "error handling shouldn't fire");
            }
          }
        },

        good: {
          setup: function() {
            ok(true, 'good#setup');
          }
        },

      };

      $$router_test$$router.handleURL('/slow_failure');
      $$test_helpers$$flushBackburner();
    });


    test("can redirect from error handler", function() {

      expect(4);

      var errorCount = 0;

      $$router_test$$handlers = {
        index: { },

        showPost: {
          model: function() {
            return $$rsvp$reject$$default('borf!');
          },
          events: {
            error: function(e) {
              errorCount++;

              equal(e, 'borf!', "received error thrown from model");

              // Redirect to index.
              $$router_test$$router.transitionTo('index').then(function() {

                if (errorCount === 1) {
                  // transition back here to test transitionTo error handling.

                  return $$router_test$$router.transitionTo('showPost', $$rsvp$reject$$default('borf!')).then($$test_helpers$$shouldNotHappen, function(e) {
                    equal(e, 'borf!', "got thing");
                  });
                }

              }, $$test_helpers$$shouldNotHappen);
            }
          },

          setup: function(context) {
            ok(false, 'should not get here');
          }
        }
      };

      $$router_test$$router.handleURL('/posts/123').then($$test_helpers$$shouldNotHappen, function(reason) {
        equal(reason, 'borf!', 'expected reason received from first failed transition');
      });
    });

    function $$router_test$$assertAbort(e) {
      equal(e.name, "TransitionAborted", "transition was aborted");
    }

    test("can redirect from setup/enter", function() {
      expect(5);

      var count = 0;

      $$router_test$$handlers = {
        index: {
          enter: function() {
            ok(true, "index#enter called");
            $$router_test$$router.transitionTo('about').then(secondAttempt, $$test_helpers$$shouldNotHappen);
          },
          setup: function() {
            ok(true, "index#setup called");
            $$router_test$$router.transitionTo('/about').then(thirdAttempt, $$test_helpers$$shouldNotHappen);
          },
          events: {
            error: function(e) {
              ok(false, "redirects should not call error hook");
            }
          }
        },
        about: {
          setup: function() {
            ok(true, "about#setup was entered");
          }
        }
      };

      $$router_test$$router.handleURL('/index').then($$test_helpers$$shouldNotHappen, $$router_test$$assertAbort);

      function secondAttempt() {
        delete $$router_test$$handlers.index.enter;
        $$router_test$$router.transitionTo('index').then($$test_helpers$$shouldNotHappen, $$router_test$$assertAbort);
      }

      function thirdAttempt() {
        delete $$router_test$$handlers.index.setup;
        $$router_test$$router.transitionTo('index').then(null, $$test_helpers$$shouldNotHappen);
      }
    });


    test("redirecting to self from validation hooks should no-op (and not infinite loop)", function() {

      expect(2);

      var count = 0;

      $$router_test$$handlers = {
        index: {
          afterModel: function() {
            if (count++ > 10) {
              ok(false, 'infinite loop occurring');
            } else {
              ok(count <= 2, 'running index no more than twice');
              $$router_test$$router.transitionTo('index');
            }
          },
          setup: function() {
            ok(true, 'setup was called');
          }
        }
      };

      $$router_test$$router.handleURL('/index');
    });

    test("Transition#method(null) prevents URLs from updating", function() {
      expect(1);

      $$router_test$$handlers = {
        about: {
          setup: function() {
            ok(true, "about#setup was called");
          }
        }
      };

      $$router_test$$router.updateURL = function(newUrl) {
        ok(false, "updateURL shouldn't have been called");
      };

      // Test multiple calls to method in a row.
      $$router_test$$router.handleURL('/index').method(null);
      $$router_test$$router.handleURL('/index').method(null);
      $$test_helpers$$flushBackburner();

      $$router_test$$router.transitionTo('about').method(null);
      $$test_helpers$$flushBackburner();
    });

    asyncTest("redirecting to self from enter hooks should no-op (and not infinite loop)", function() {
      expect(1);

      var count = 0;

      $$router_test$$handlers = {
        index: {
          setup: function() {
            if (count++ > 10) {
              ok(false, 'infinite loop occurring');
            } else {
              ok(true, 'setup was called');
              $$router_test$$router.transitionTo('index');
            }
          }
        }
      };

      $$router_test$$router.handleURL('/index');

      // TODO: use start in .then() handler instead of setTimeout, but CLI
      // test runner doesn't seem to like this.
      setTimeout(start, 500);
    });

    test("redirecting to child handler from validation hooks should no-op (and not infinite loop)", function() {
      expect(4);

      $$router_test$$handlers = {

        postIndex: {
          beforeModel: function() {
            ok(true, 'postIndex beforeModel called');
            $$router_test$$router.transitionTo('showAllPosts');
          }
        },

        showAllPosts: {
          beforeModel: function() {
            ok(true, 'showAllPosts beforeModel called');
          }
        },

        showPopularPosts: {
          beforeModel: function() {
            ok(true, 'showPopularPosts beforeModel called');
          }
        }
      };

      $$router_test$$router.handleURL('/posts/popular').then(function() {
        ok(false, 'redirected handleURL should not succeed');
      }, function() {
        ok(true, 'redirected handleURL should fail');
      });
    });

    function $$router_test$$startUpSetup() {
      $$router_test$$handlers = {
        index: {
          setup: function() {
            ok(true, 'index setup called');
          }
        },
        about: {
          setup: function() {
            ok(true, 'about setup called');
          }
        },
        faq: {
          setup: function() {
            ok(true, 'faq setup called');
          }
        }
      };
    }

    test("transitionTo with named transition can be called at startup", function() {
      expect(2);

      $$router_test$$startUpSetup();

      $$router_test$$router.transitionTo('index').then(function() {
        ok(true, 'success handler called');
        start();
      }, function(e) {
        ok(false, 'failure handle should not be called');
      });
    });

    test("transitionTo with URL transition can be called at startup", function() {
      expect(2);

      $$router_test$$startUpSetup();

      $$router_test$$router.transitionTo('/index').then(function() {
        ok(true, 'success handler called');
        start();
      }, function(e) {
        ok(false, 'failure handle should not be called');
      });
    });

    test("transitions fire a didTransition event on the destination route", function() {

      expect(1);

      $$router_test$$handlers = {
        about: {
          events: {
            didTransition: function() {
              ok(true, "index's didTransition was called");
            }
          }
        }
      };

      $$router_test$$router.handleURL('/index').then(function() {
        $$router_test$$router.transitionTo('about').then(start, $$test_helpers$$shouldNotHappen);
      }, $$test_helpers$$shouldNotHappen);
    });

    test("transitions can be aborted in the willTransition event", function() {

      expect(3);

      $$router_test$$handlers = {
        index: {
          setup: function() {
            ok(true, 'index setup called');
          },
          events: {
            willTransition: function(transition) {
              ok(true, "index's transitionTo was called");
              transition.abort();
            }
          }
        },
        about: {
          setup: function() {
            ok(true, 'about setup called');
          }
        }
      };

      $$router_test$$router.handleURL('/index').then(function() {
        return $$router_test$$router.transitionTo('about').then($$test_helpers$$shouldNotHappen, function(e) {
          equal(e.name, 'TransitionAborted', 'reject object is a TransitionAborted');
        }).then(start);
      });
    });

    test("transitions can redirected in the willTransition event", function() {

      expect(2);

      var destFlag = true;

      $$router_test$$handlers = {
        index: {
          setup: function() {
            ok(true, 'index setup called');
          },
          events: {
            willTransition: function(transition) {
              // Router code must be careful here not to refire
              // `willTransition` when a transition is already
              // underway, else infinite loop.
              var dest = destFlag ? 'about' : 'faq';
              destFlag = !destFlag;
              $$router_test$$router.transitionTo(dest).then(start);
            }
          }
        },
        about: {
          setup: function() {
            ok(true, 'about setup called');
          }
        },
        faq: {
          setup: function() {
            ok(false, 'faq setup should not be called');
          }
        }
      };

      $$router_test$$router.handleURL('/index').then(function() {
        $$router_test$$router.transitionTo('faq');
      });
    });

    test("aborted transitions can be saved and later retried", function() {

      expect(8);

      var shouldPrevent = true,
          lastTransitionEvent,
          transitionToAbout,
          lastTransition;

      $$router_test$$handlers = {
        index: {
          setup: function() {
            ok(true, 'index setup called');
          },
          events: {
            willTransition: function(transition) {
              ok(true, "index's willTransition was called");
              if (shouldPrevent) {
                transition.data.foo = "hello";
                transition.foo = "hello";
                transition.abort();
                lastTransition = transition;
              } else {
                ok(!transition.foo, "no foo property exists on new transition");
                equal(transition.data.foo, "hello", "values stored in data hash of old transition persist when retried");
              }
            }
          }
        },
        about: {
          setup: function() {
            ok(true, 'about setup called');
          }
        }
      };

      $$router_test$$router.handleURL('/index').then(function() {
        $$router_test$$router.transitionTo('about').then($$test_helpers$$shouldNotHappen, function(e) {
          ok(true, 'transition was blocked');
          shouldPrevent = false;
          transitionToAbout = lastTransition;
          return transitionToAbout.retry();
        }).then(function() {
          ok(true, 'transition succeeded via .retry()');
        }, $$test_helpers$$shouldNotHappen);
      });
    });

    test("completed transitions can be saved and later retried", function() {
      expect(3);

      var post = { id: "123" },
          savedTransition;

      $$router_test$$handlers = {
        showPost: {
          afterModel: function(model, transition) {
            equal(model, post, "showPost's afterModel got the expected post model");
            savedTransition = transition;
          }
        },
        index: { },
        about: {
          setup: function() {
            ok(true, "setup was entered");
          }
        }
      };

      $$router_test$$router.handleURL('/index').then(function() {
        return $$router_test$$router.transitionTo('showPost', post);
      }).then(function() {
        return $$router_test$$router.transitionTo('about');
      }).then(function() {
        return savedTransition.retry();
      });
    });




    function $$router_test$$setupAuthenticatedExample() {
      $$router_test$$map(function(match) {
        match("/index").to("index");
        match("/login").to("login");

        match("/admin").to("admin", function(match) {
          match("/about").to("about");
          match("/posts/:post_id").to("adminPost");
        });
      });

      var isLoggedIn = false, lastRedirectedTransition;

      $$router_test$$handlers = {
        index: { },
        login: {
          events: {
            logUserIn: function() {
              isLoggedIn = true;
              lastRedirectedTransition.retry();
            }
          }
        },
        admin: {
          beforeModel: function(transition) {
            lastRedirectedTransition = transition;
            ok(true, 'beforeModel redirect was called');
            if (!isLoggedIn) { $$router_test$$router.transitionTo('login'); }
          }
        },
        about: {
          setup: function() {
            ok(isLoggedIn, 'about was entered only after user logged in');
            start();
          }
        },
        adminPost: {
          model: function(params) {
            deepEqual(params, { post_id: '5', queryParams: {} }, "adminPost received params previous transition attempt");
            return "adminPost";
          },
          setup: function(model) {
            equal(model, "adminPost", "adminPost was entered with correct model");
            start();
          }
        }
      };
    }

    test("authenticated routes: starting on non-auth route", function() {
      expect(8);

      $$router_test$$setupAuthenticatedExample();

      $$test_helpers$$transitionTo($$router_test$$router, '/index');
      $$test_helpers$$transitionToWithAbort($$router_test$$router, 'about');
      $$test_helpers$$transitionToWithAbort($$router_test$$router, 'about');
      $$test_helpers$$transitionToWithAbort($$router_test$$router, '/admin/about');

      // Log in. This will retry the last failed transition to 'about'.
      $$router_test$$router.trigger('logUserIn');
    });

    test("authenticated routes: starting on auth route", function() {
      expect(8);

      $$router_test$$setupAuthenticatedExample();

      $$test_helpers$$transitionToWithAbort($$router_test$$router, '/admin/about');
      $$test_helpers$$transitionToWithAbort($$router_test$$router, '/admin/about');
      $$test_helpers$$transitionToWithAbort($$router_test$$router, 'about');

      // Log in. This will retry the last failed transition to 'about'.
      $$router_test$$router.trigger('logUserIn');
    });

    test("authenticated routes: starting on parameterized auth route", function() {
      expect(5);

      $$router_test$$setupAuthenticatedExample();

      $$test_helpers$$transitionToWithAbort($$router_test$$router, '/admin/posts/5');

      // Log in. This will retry the last failed transition to '/posts/5'.
      $$router_test$$router.trigger('logUserIn');
    });

    asyncTest("An instantly aborted transition fires no hooks", function() {

      var hooksShouldBeCalled = false;

      $$router_test$$handlers = {
        index: {
          beforeModel: function() {
            ok(hooksShouldBeCalled, "index beforeModel hook should be called at this time");
          }
        },
        about: {
          beforeModel: function() {
            ok(hooksShouldBeCalled, "about beforeModel hook should be called at this time");
          },
          setup: function() {
            start();
          }
        }
      };

      $$router_test$$router.transitionTo('index').abort().then($$test_helpers$$shouldNotHappen, function() {
        ok(true, "Failure handler called for index");
        return $$router_test$$router.transitionTo('/index').abort();
      }).then($$test_helpers$$shouldNotHappen, function() {
        ok(true, "Failure handler called for /index");
        hooksShouldBeCalled = true;
        return $$router_test$$router.transitionTo('index');
      }).then(function(result) {
        ok(true, "Success handler called for index");
        hooksShouldBeCalled = false;
        return $$router_test$$router.transitionTo('about').abort();
      }, $$test_helpers$$shouldNotHappen).then($$test_helpers$$shouldNotHappen, function() {
        ok(true, "failure handler called for about");
        return $$router_test$$router.transitionTo('/about').abort();
      }, $$test_helpers$$shouldNotHappen).then($$test_helpers$$shouldNotHappen, function() {
        ok(true, "failure handler called for /about");
        hooksShouldBeCalled = true;
        return $$router_test$$router.transitionTo('/about');
      });
    });

    asyncTest("a successful transition resolves with the target handler", function() {
      // Note: this is extra convenient for Ember where you can all
      // .transitionTo right on the route.

      $$router_test$$handlers = {
        index: { borfIndex: true },
        about: { borfAbout: true }
      };

      $$router_test$$router.handleURL('/index').then(function(result) {
        ok(result.borfIndex, "resolved to index handler");
        return $$router_test$$router.transitionTo('about');
      }, $$test_helpers$$shouldNotHappen).then(function(result) {
        ok(result.borfAbout, "resolved to about handler");
        start();
      });
    });

    asyncTest("transitions have a .promise property", function() {
      $$router_test$$router.handleURL('/index').promise.then(function(result) {
        var promise = $$router_test$$router.transitionTo('about').abort().promise;
        ok(promise, "promise exists on aborted transitions");
        return promise;
      }, $$test_helpers$$shouldNotHappen).then($$test_helpers$$shouldNotHappen, function(result) {
        ok(true, "failure handler called");
        start();
      });
    });

    asyncTest("transitionTo will soak up resolved parent models of active transition", function() {

      var admin = { id: 47 },
          adminPost = { id: 74 },
          adminPosts = [adminPost],
          lastAdminPromise,
          adminSetupShouldBeEntered = false;

      function adminPromise() {
        return lastAdminPromise = new rsvp$promise$$default(function(res) {
          res(admin);
        });
      }

      var adminHandler = {
        serialize: function(object) {
          equal(object.id, 47, "The object passed to serialize is correct");
          return { id: 47 };
        },

        model: function(params) {
          equal(params.id, 47, "The object passed to serialize is correct");
          return admin;
        },

        setup: function(model) {
          ok(adminSetupShouldBeEntered, "adminHandler's setup should be called at this time");
        }
      };

      var adminPostHandler = {
        serialize: function(object) {
          return { post_id: object.id };
        },

        setup: function(model) {
          equal(adminHandler.context, admin, "adminPostHandler receives resolved soaked promise from previous transition");
          start();
        },

        model: function(params) {
          return adminPost;
        }
      };

      var adminPostsHandler = {
        beforeModel: function() {
          adminSetupShouldBeEntered = true;
          $$router_test$$router.transitionTo('adminPost', adminPost);
        }
      };

      var indexHandler = {
        setup: function() {
          ok(true, 'index entered');
        }
      };

      $$router_test$$handlers = {
        index: indexHandler,
        admin: adminHandler,
        adminPost: adminPostHandler,
        adminPosts: adminPostsHandler
      };

      $$router_test$$router.transitionTo('index').then(function(result) {
        $$router_test$$router.transitionTo('adminPosts', adminPromise()).then($$test_helpers$$shouldNotHappen, $$router_test$$assertAbort);
      });
    });

    test("transitionTo will soak up resolved all models of active transition, including present route's resolved model", function() {

      var modelCalled = 0,
          hasRedirected = false;

      $$router_test$$map(function(match) {
        match("/post").to('post', function(match) {
          match("/").to('postIndex');
          match("/new").to('postNew');
        });
      });

      var postHandler = {
        model: function(params) {
          equal(modelCalled++, 0, "postHandler's model should only be called once");
          return { title: 'Hello world' };
        },

        redirect: function(resolvedModel, transition) {
          if (!hasRedirected) {
            hasRedirected = true;
            $$router_test$$router.transitionTo('postNew').then(start, $$test_helpers$$shouldNotHappen);
          }
        }
      };

      $$router_test$$handlers = {
        post: postHandler,
        postIndex: {},
        postNew: {}
      };

      $$router_test$$router.transitionTo('postIndex').then($$test_helpers$$shouldNotHappen, $$router_test$$assertAbort);
    });

    test("can reference leaf '/' route by leaf or parent name", function() {

      var modelCalled = 0,
          hasRedirected = false;

      $$router_test$$map(function(match) {
        match("/").to('app', function(match) {
          match("/").to('index');
          match("/nest").to('nest', function(match) {
            match("/").to('nest.index');
          });
        });
      });

      function assertOnRoute(name) {
        var last = $$router_test$$router.currentHandlerInfos[$$router_test$$router.currentHandlerInfos.length-1];
        equal(last.name, name);
      }

      $$test_helpers$$transitionTo($$router_test$$router, 'app');
      assertOnRoute('index');
      $$test_helpers$$transitionTo($$router_test$$router, 'nest');
      assertOnRoute('nest.index');
      $$test_helpers$$transitionTo($$router_test$$router, 'app');
      assertOnRoute('index');
    });

    test("resolved models can be swapped out within afterModel", function() {

      expect(3);

      var modelPre = {},
          modelPost = {};

      $$router_test$$handlers = {
        index: {
          model: function() {
            return modelPre;
          },
          afterModel: function(resolvedModel, transition) {
            equal(resolvedModel, transition.resolvedModels.index, "passed-in resolved model equals model in transition's hash");
            equal(resolvedModel, modelPre, "passed-in resolved model equals model returned from `model`");
            transition.resolvedModels.index = modelPost;
          },
          setup: function(model) {
            equal(model, modelPost, "the model passed to `setup` is the one substituted in afterModel");
          }
        }
      };

      $$router_test$$router.transitionTo('index');
    });


    test("String/number args in transitionTo are treated as url params", function() {
      expect(11);

      var adminParams = { id: "1" },
          adminModel = { id: "1" },
          adminPostModel = { id: "2" };

      $$router_test$$handlers = {
        admin: {
          model: function(params) {
            delete params.queryParams;
            deepEqual(params, adminParams, "admin handler gets the number passed in via transitionTo, converts to string");
            return adminModel;
          }
        },
        adminPost: {
          model: function(params) {
            delete params.queryParams;
            deepEqual(params, { post_id: "2" }, "adminPost handler gets the string passed in via transitionTo");
            return adminPostModel;
          },
          setup: function() {
            ok(true, "adminPost setup was entered");
          }
        }
      };

      $$router_test$$router.handleURL('/index').then(function() {
        $$router_test$$expectedUrl = "/posts/admin/1/posts/2";
        return $$router_test$$router.transitionTo('adminPost', 1, "2");
      }).then(function() {
        ok($$router_test$$router.isActive('adminPost', 1, "2"), "adminPost is active via params");
        ok($$router_test$$router.isActive('adminPost', 1, adminPostModel), "adminPost is active via contexts");

        adminParams = { id: "0" };
        $$router_test$$expectedUrl = "/posts/admin/0/posts/2";
        return $$router_test$$router.transitionTo('adminPost', 0, "2");
      }).then(function() {
        ok($$router_test$$router.isActive('adminPost', 0, "2"), "adminPost is active via params");
        ok($$router_test$$router.isActive('adminPost', 0, adminPostModel), "adminPost is active via contexts");
      }, $$test_helpers$$shouldNotHappen);
    });

    asyncTest("Transitions returned from beforeModel/model/afterModel hooks aren't treated as pausing promises", function(){

      expect(6);

      $$router_test$$handlers = {
        index: {
          beforeModel: function() {
            ok(true, 'index beforeModel called');
            return $$router_test$$router.transitionTo('index');
          },
          model: function(){
            ok(true, 'index model called');
            return $$router_test$$router.transitionTo('index');
          },
          afterModel: function(){
            ok(true, 'index afterModel called');
            return $$router_test$$router.transitionTo('index');
          }
        }
      };

      function testStartup(){
        $$router_test$$map(function(match) {
          match("/index").to('index');
        });

        return $$router_test$$router.handleURL('/index');
      }

      testStartup().then(function(result) {
        delete $$router_test$$handlers.index.beforeModel;
        return testStartup();
      }).then(function(result) {
        delete $$router_test$$handlers.index.model;
        return testStartup();
      }).then(function(result) {
        delete $$router_test$$handlers.index.afterModel;
        return testStartup();
      }).then(function(result) {
        start();
      });
    });

    /* TODO: revisit this idea
    test("exceptions thrown from model hooks aren't swallowed", function() {
      expect(7);

      enableErrorHandlingDeferredActionQueue();

      var anError = {};
      function throwAnError() {
        throw anError;
      }

      var routeWasEntered = false;

      handlers = {
        index: {
          beforeModel: throwAnError,
          model: throwAnError,
          afterModel: throwAnError,
          setup: function(model) {
            routeWasEntered = true;
          }
        }
      };

      var hooks = ['beforeModel', 'model', 'afterModel'];

      while(hooks.length) {
        var transition = router.transitionTo('index');
        flush(anError);
        transition.abort();
        ok(!routeWasEntered, "route hasn't been entered yet");
        delete handlers.index[hooks.shift()];
      }

      router.transitionTo('index');
      flush(anError);

      ok(routeWasEntered, "route was finally entered");
    });
    */

    test("Transition#followRedirects() returns a promise that fulfills when any redirecting transitions complete", function() {
      expect(3);

      $$router_test$$handlers.about = {
        redirect: function() {
          $$router_test$$router.transitionTo('faq').then(null, $$test_helpers$$shouldNotHappen);
        }
      };

      $$router_test$$router.transitionTo('/index').followRedirects().then(function(handler) {
        equal(handler, $$router_test$$handlers.index, "followRedirects works with non-redirecting transitions");

        return $$router_test$$router.transitionTo('about').followRedirects();
      }).then(function(handler) {
        equal(handler, $$router_test$$handlers.faq, "followRedirects promise resolved with redirected faq handler");

        $$router_test$$handlers.about.beforeModel = function(transition) {
          transition.abort();
        };

        // followRedirects should just reject for non-redirecting transitions.
        return $$router_test$$router.transitionTo('about').followRedirects().then($$test_helpers$$shouldNotHappen, $$router_test$$assertAbort);
      });
    });

    test("Returning a redirecting Transition from a model hook doesn't cause things to explode", function() {
      expect(2);

      $$router_test$$handlers.index = {
        beforeModel: function() {
          return $$router_test$$router.transitionTo('about');
        }
      };

      $$router_test$$handlers.about = {
        setup: function() {
          ok(true, "about#setup was called");
        }
      };

      $$router_test$$router.transitionTo('/index').then(null, $$router_test$$assertAbort);
    });

    test("Generate works w queryparams", function() {
      equal($$router_test$$router.generate('index'), '/index', "just index");
      equal($$router_test$$router.generate('index', { queryParams: { foo: '123' } }), '/index?foo=123', "just index");
      equal($$router_test$$router.generate('index', { queryParams: { foo: '123', bar: '456' } }), '/index?bar=456&foo=123', "just index");
    });

    test("errors in enter/setup hooks fire `error`", function() {
      expect(4);

      var count = 0;

      $$router_test$$handlers = {
        index: {
          enter: function() {
            throw "OMG ENTER";
          },
          setup: function() {
            throw "OMG SETUP";
          },
          events: {
            error: function(e) {
              if (count === 0) {
                equal(e, "OMG ENTER", "enter's throw value passed to error hook");
              } else if(count === 1) {
                equal(e, "OMG SETUP", "setup's throw value passed to error hook");
              } else {
                ok(false, 'should not happen');
              }
            }
          }
        }
      };

      $$router_test$$router.handleURL('/index').then($$test_helpers$$shouldNotHappen, function(reason) {
        equal(reason, "OMG ENTER", "enters's error was propagated");
        count++;
        delete $$router_test$$handlers.index.enter;
        return $$router_test$$router.handleURL('/index');
      }).then($$test_helpers$$shouldNotHappen, function(reason) {
        equal(reason, "OMG SETUP", "setup's error was propagated");
        delete $$router_test$$handlers.index.setup;
      }).then(start, $$test_helpers$$shouldNotHappen);
    });

    test("invalidating parent model with different string/numeric parameters invalidates children", function() {

      $$router_test$$map(function(match) {
        match("/:p").to("parent", function(match) {
          match("/:c").to("child");
        });
      });

      expect(8);

      var count = 0;
      $$router_test$$handlers = {
        parent: {
          model: function(params) {
            ok(true, "parent model called");
            return { id: params.p };
          },
          setup: function(model) {
            if (count === 0) {
              deepEqual(model, { id: '1' });
            } else {
              deepEqual(model, { id: '2' });
            }
          }
        },
        child: {
          model: function(params) {
            ok(true, "child model called");
            return { id: params.c };
          },
          setup: function(model) {
            if (count === 0) {
              deepEqual(model, { id: '1' });
            } else {
              deepEqual(model, { id: '1' });
            }
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, 'child', '1', '1');
      count = 1;
      $$test_helpers$$transitionTo($$router_test$$router, 'child', '2', '1');


    });

    $$test_helpers$$module("Multiple dynamic segments per route");

    test("Multiple string/number params are soaked up", function() {
      expect(3);

      $$router_test$$map(function(match) {
        match("/:foo_id/:bar_id").to("bar");
      });

      $$router_test$$handlers = {
        bar: {
          model: function(params) {
            return {};
          }
        },
      };

      $$router_test$$expectedUrl = '/omg/lol';
      $$test_helpers$$transitionTo($$router_test$$router, 'bar', 'omg', 'lol');

      $$router_test$$expectedUrl = '/omg/heehee';
      $$test_helpers$$transitionTo($$router_test$$router, 'bar', 'heehee');

      $$router_test$$expectedUrl = '/lol/no';
      $$test_helpers$$transitionTo($$router_test$$router, 'bar', 'lol', 'no');
    });

    $$test_helpers$$module("isActive", {
      setup: function() {
        $$router_test$$handlers = {
          parent: {
            serialize: function(obj) {
              return {
                one: obj.one,
                two: obj.two,
              };
            }
          },
          child: {
            serialize: function(obj) {
              return {
                three: obj.three,
                four: obj.four,
              };
            }
          }
        };

        $$router_test$$map(function(match) {
          match("/:one/:two").to("parent", function(match) {
            match("/:three/:four").to("child");
          });
        });

        $$router_test$$expectedUrl = null;

        $$test_helpers$$transitionTo($$router_test$$router, 'child', 'a', 'b', 'c', 'd');
      }
    });

    test("isActive supports multiple soaked up string/number params (via params)", function() {

      ok($$router_test$$router.isActive('child'), "child");
      ok($$router_test$$router.isActive('parent'), "parent");

      ok($$router_test$$router.isActive('child', 'd'), "child d");
      ok($$router_test$$router.isActive('child', 'c', 'd'), "child c d");
      ok($$router_test$$router.isActive('child', 'b', 'c', 'd'), "child b c d");
      ok($$router_test$$router.isActive('child', 'a', 'b', 'c', 'd'), "child a b c d");

      ok(!$$router_test$$router.isActive('child', 'e'), "!child e");
      ok(!$$router_test$$router.isActive('child', 'c', 'e'), "!child c e");
      ok(!$$router_test$$router.isActive('child', 'e', 'd'), "!child e d");
      ok(!$$router_test$$router.isActive('child', 'x', 'x'), "!child x x");
      ok(!$$router_test$$router.isActive('child', 'b', 'c', 'e'), "!child b c e");
      ok(!$$router_test$$router.isActive('child', 'b', 'e', 'd'), "child b e d");
      ok(!$$router_test$$router.isActive('child', 'e', 'c', 'd'), "child e c d");
      ok(!$$router_test$$router.isActive('child', 'a', 'b', 'c', 'e'), "child a b c e");
      ok(!$$router_test$$router.isActive('child', 'a', 'b', 'e', 'd'), "child a b e d");
      ok(!$$router_test$$router.isActive('child', 'a', 'e', 'c', 'd'), "child a e c d");
      ok(!$$router_test$$router.isActive('child', 'e', 'b', 'c', 'd'), "child e b c d");

      ok($$router_test$$router.isActive('parent', 'b'), "parent b");
      ok($$router_test$$router.isActive('parent', 'a', 'b'), "parent a b");

      ok(!$$router_test$$router.isActive('parent', 'c'), "!parent c");
      ok(!$$router_test$$router.isActive('parent', 'a', 'c'), "!parent a c");
      ok(!$$router_test$$router.isActive('parent', 'c', 'b'), "!parent c b");
      ok(!$$router_test$$router.isActive('parent', 'c', 't'), "!parent c t");
    });

    test("isActive supports multiple soaked up string/number params (via serialized objects)", function() {

      ok($$router_test$$router.isActive('child',  { three: 'c', four: 'd' }), "child(3:c, 4:d)");
      ok(!$$router_test$$router.isActive('child', { three: 'e', four: 'd' }), "!child(3:e, 4:d)");
      ok(!$$router_test$$router.isActive('child', { three: 'c', four: 'e' }), "!child(3:c, 4:e)");
      ok(!$$router_test$$router.isActive('child', { three: 'c' }), "!child(3:c)");
      ok(!$$router_test$$router.isActive('child', { four: 'd' }), "!child(4:d)");
      ok(!$$router_test$$router.isActive('child', {}), "!child({})");

      ok($$router_test$$router.isActive('parent',  { one: 'a', two: 'b' }), "parent(1:a, 2:b)");
      ok(!$$router_test$$router.isActive('parent', { one: 'e', two: 'b' }), "!parent(1:e, 2:b)");
      ok(!$$router_test$$router.isActive('parent', { one: 'a', two: 'e' }), "!parent(1:a, 2:e)");
      ok(!$$router_test$$router.isActive('parent', { one: 'a' }), "!parent(1:a)");
      ok(!$$router_test$$router.isActive('parent', { two: 'b' }), "!parent(2:b)");

      ok($$router_test$$router.isActive('child', { one: 'a', two: 'b' }, { three: 'c', four: 'd' }), "child(1:a, 2:b, 3:c, 4:d)");
      ok(!$$router_test$$router.isActive('child', { one: 'e', two: 'b' }, { three: 'c', four: 'd' }), "!child(1:e, 2:b, 3:c, 4:d)");
      ok(!$$router_test$$router.isActive('child', { one: 'a', two: 'b' }, { three: 'c', four: 'e' }), "!child(1:a, 2:b, 3:c, 4:e)");
    });

    test("isActive supports multiple soaked up string/number params (mixed)", function() {
      ok($$router_test$$router.isActive('child', 'a', 'b', { three: 'c', four: 'd' }));
      ok($$router_test$$router.isActive('child', 'b', { three: 'c', four: 'd' }));
      ok(!$$router_test$$router.isActive('child', 'a', { three: 'c', four: 'd' }));
      ok($$router_test$$router.isActive('child', { one: 'a', two: 'b' }, 'c', 'd'));
      ok($$router_test$$router.isActive('child', { one: 'a', two: 'b' }, 'd'));
      ok(!$$router_test$$router.isActive('child', { one: 'a', two: 'b' }, 'c'));

      ok(!$$router_test$$router.isActive('child', 'a', 'b', { three: 'e', four: 'd' }));
      ok(!$$router_test$$router.isActive('child', 'b', { three: 'e', four: 'd' }));
      ok(!$$router_test$$router.isActive('child', { one: 'e', two: 'b' }, 'c', 'd'));
      ok(!$$router_test$$router.isActive('child', { one: 'e', two: 'b' }, 'd'));
    });

    $$test_helpers$$module("Preservation of params between redirects", {
      setup: function() {
        $$router_test$$expectedUrl = null;

        $$router_test$$map(function(match) {
          match("/").to('index');
          match("/:foo_id").to("foo", function(match) {
            match("/").to("fooIndex");
            match("/:bar_id").to("bar", function(match) {
              match("/").to("barIndex");
            });
          });
        });

        $$router_test$$handlers = {
          foo: {
            model: function(params) {
              this.modelCount = this.modelCount ? this.modelCount + 1 : 1;
              return { id: params.foo_id };
            },
            afterModel: function(_, transition) {
              $$router_test$$router.transitionTo('barIndex', '789');
            }
          },

          bar: {
            model: function(params) {
              this.modelCount = this.modelCount ? this.modelCount + 1 : 1;
              return { id: params.bar_id };
            }
          }
        };
      }
    });

    test("Starting on '/' root index", function() {
      $$test_helpers$$transitionTo($$router_test$$router, '/');

      // Should call model for foo and bar
      $$router_test$$expectedUrl = "/123/789";
      $$test_helpers$$transitionTo($$router_test$$router, 'barIndex', '123', '456');

      equal($$router_test$$handlers.foo.modelCount, 2, "redirect in foo#afterModel should run foo#model twice (since validation failed)");

      deepEqual($$router_test$$handlers.foo.context, { id: '123' });
      deepEqual($$router_test$$handlers.bar.context, { id: '789' }, "bar should have redirected to bar 789");

      // Try setting foo's context to 200; this should redirect
      // bar to '789' but preserve the new foo 200.
      $$router_test$$expectedUrl = "/200/789";
      $$test_helpers$$transitionTo($$router_test$$router, 'fooIndex', '200');

      equal($$router_test$$handlers.foo.modelCount, 4, "redirect in foo#afterModel should re-run foo#model");

      deepEqual($$router_test$$handlers.foo.context, { id: '200' });
      deepEqual($$router_test$$handlers.bar.context, { id: '789' }, "bar should have redirected to bar 789");
    });

    test("Starting on '/' root index, using redirect", function() {

      $$router_test$$handlers.foo.redirect = $$router_test$$handlers.foo.afterModel;
      delete $$router_test$$handlers.foo.afterModel;

      $$test_helpers$$transitionTo($$router_test$$router, '/');

      // Should call model for foo and bar
      $$router_test$$expectedUrl = "/123/789";
      $$test_helpers$$transitionTo($$router_test$$router, 'barIndex', '123', '456');

      equal($$router_test$$handlers.foo.modelCount, 1, "redirect in foo#redirect should NOT run foo#model (since validation succeeded)");

      deepEqual($$router_test$$handlers.foo.context, { id: '123' });
      deepEqual($$router_test$$handlers.bar.context, { id: '789' }, "bar should have redirected to bar 789");

      // Try setting foo's context to 200; this should redirect
      // bar to '789' but preserve the new foo 200.
      $$router_test$$expectedUrl = "/200/789";
      $$test_helpers$$transitionTo($$router_test$$router, 'fooIndex', '200');

      equal($$router_test$$handlers.foo.modelCount, 2, "redirect in foo#redirect should NOT foo#model");

      deepEqual($$router_test$$handlers.foo.context, { id: '200' });
      deepEqual($$router_test$$handlers.bar.context, { id: '789' }, "bar should have redirected to bar 789");
    });

    test("Starting on non root index", function() {
      $$test_helpers$$transitionTo($$router_test$$router, '/123/456');
      deepEqual($$router_test$$handlers.foo.context, { id: '123' });
      deepEqual($$router_test$$handlers.bar.context, { id: '789' }, "bar should have redirected to bar 789");

      // Try setting foo's context to 200; this should redirect
      // bar to '789' but preserve the new foo 200.
      $$router_test$$expectedUrl = "/200/789";

      $$test_helpers$$transitionTo($$router_test$$router, 'fooIndex', '200');

      deepEqual($$router_test$$handlers.foo.context, { id: '200' });
      deepEqual($$router_test$$handlers.bar.context, { id: '789' }, "bar should have redirected to bar 789");
    });

    /* TODO revisit
    test("A failed handler's setup shouldn't prevent future transitions", function() {
      expect(2);

      enableErrorHandlingDeferredActionQueue();

      map(function(match) {
        match("/parent").to('parent', function(match) {
          match("/articles").to('articles');
          match("/login").to('login');
        });
      });

      var error = new Error("blorg");

      handlers = {
        articles: {
          setup: function() {
            ok(true, "articles setup was entered");
            throw error;
          },
          events: {
            error: function() {
              ok(true, "error handled in articles");
              router.transitionTo('login');
            }
          }
        },

        login: {
          setup: function() {
            start();
          }
        }
      };

      router.handleURL('/parent/articles');
      flush(error);
    });
    */

    test("beforeModel shouldn't be refired with incorrect params during redirect", function() {
      // Source: https://github.com/emberjs/ember.js/issues/3407

      expect(3);

      $$router_test$$map(function(match) {
        match("/").to('index');
        match("/people/:id").to('people', function(match) {
          match("/").to('peopleIndex');
          match("/home").to('peopleHome');
        });
      });

      var peopleModels = [null, {}, {}];
      var peopleBeforeModelCalled = false;

      $$router_test$$handlers = {
        people: {
          beforeModel: function() {
            ok(!peopleBeforeModelCalled, "people#beforeModel should only be called once");
            peopleBeforeModelCalled = true;
          },
          model: function(params) {
            ok(params.id, "people#model called");
            return peopleModels[params.id];
          }
        },
        peopleIndex: {
          afterModel: function() {
            $$router_test$$router.transitionTo('peopleHome');
          }
        },
        peopleHome: {
          setup: function() {
            ok(true, "I was entered");
          }
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, '/');
      $$test_helpers$$transitionTo($$router_test$$router, 'peopleIndex', '1');
    });

    $$test_helpers$$module("URL-less routes", {
      setup: function() {
        $$router_test$$handlers = {};
        $$router_test$$expectedUrl = null;

        $$router_test$$map(function(match) {
          match("/index").to("index");
          match("/admin").to("admin", function(match) {
            match("/posts").to("adminPosts");
            match("/articles").to("adminArticles");
          });
        });
      }
    });

    test("Transitioning into a route marked as inaccessibleByURL doesn't update the URL", function() {
      expect(1);

      $$router_test$$handlers = {
        adminPosts: {
          inaccessibleByURL: true
        }
      };

      $$router_test$$router.handleURL('/index').then(function() {
        $$router_test$$url = '/index';
        return $$router_test$$router.transitionTo('adminPosts');
      }).then(function() {
        equal($$router_test$$url, '/index');
      });
    });

    test("Transitioning into a route with a parent route marked as inaccessibleByURL doesn't update the URL", function() {
      expect(2);

      $$router_test$$handlers = {
        admin: {
          inaccessibleByURL: true
        }
      };

      $$test_helpers$$transitionTo($$router_test$$router, '/index');
      $$router_test$$url = '/index';
      $$test_helpers$$transitionTo($$router_test$$router, 'adminPosts');
      equal($$router_test$$url, '/index');
      $$test_helpers$$transitionTo($$router_test$$router, 'adminArticles');
      equal($$router_test$$url, '/index');
    });

    test("Handling a URL on a route marked as inaccessible behaves like a failed url match", function() {

      expect(1);

      $$router_test$$handlers = {
        admin: {
          inaccessibleByURL: true
        }
      };

      $$router_test$$router.handleURL('/index').then(function() {
        return $$router_test$$router.handleURL('/admin/posts');
      }).then($$test_helpers$$shouldNotHappen, function(e) {
        equal(e.name, "UnrecognizedURLError", "error.name is UnrecognizedURLError");
      });
    });

    $$test_helpers$$module("Intermediate transitions", {
      setup: function() {
        $$router_test$$handlers = {};
        $$router_test$$expectedUrl = null;

        $$router_test$$map(function(match) {
          match("/").to("application", function(match) {
            //match("/").to("index");
            match("/foo").to("foo");
            match("/loading").to("loading");
          });
        });
      }
    });

    test("intermediateTransitionTo() forces an immediate intermediate transition that doesn't cancel currently active async transitions", function() {

      expect(11);

      var counter = 1,
          willResolves,
          appModel = {},
          fooModel = {};

      function counterAt(expectedValue, description) {
        equal(counter, expectedValue, "Step " + expectedValue + ": " + description);
        counter++;
      }

      $$router_test$$handlers = {
        application: {
          model: function() {
            return appModel;
          },
          setup: function(obj) {
            counterAt(1, "application#setup");
            equal(obj, appModel, "application#setup is passed the return value from model");
          },
          events: {
            willResolveModel: function(transition, handler) {
              equal(willResolves.shift(), handler, "willResolveModel event fired and passed expanded handler");
            }
          }
        },
        foo: {
          model: function() {
            $$router_test$$router.intermediateTransitionTo('loading');
            counterAt(3, "intermediate transition finished within foo#model");

            return new rsvp$promise$$default(function(resolve) {
              counterAt(4, "foo's model promise resolves");
              resolve(fooModel);
            });
          },
          setup: function(obj) {
            counterAt(6, "foo#setup");
            equal(obj, fooModel, "foo#setup is passed the resolve model promise");
          }
        },
        loading: {
          model: function() {
            ok(false, "intermediate transitions don't call model hooks");
          },
          setup: function() {
            counterAt(2, "loading#setup");
          },
          exit: function() {
            counterAt(5, "loading state exited");
          }
        }
      };

      willResolves = [$$router_test$$handlers.application, $$router_test$$handlers.foo];

      $$test_helpers$$transitionTo($$router_test$$router, '/foo');

      counterAt(7, "original transition promise resolves");
    });

    var $$transition_intent_test$$handlers, $$transition_intent_test$$recognizer;

    // TODO: remove repetition, DRY in to test_helpers.
    $$test_helpers$$module("TransitionIntent", {
      setup: function() {
        $$transition_intent_test$$handlers = {};

        $$transition_intent_test$$handlers.foo = {};
        $$transition_intent_test$$handlers.bar = {};
        $$transition_intent_test$$handlers.articles = {};
        $$transition_intent_test$$handlers.comments = {};

        $$transition_intent_test$$recognizer = {
          handlersFor: function(name) {
            if (name === 'comments') {
              return [
                {
                  handler: 'articles',
                  names: ['article_id']
                },
                {
                  handler: 'comments',
                  names: ['comment_id']
                }
              ];
            }
          },
          recognize: function(url) {
            if (url === '/foo/bar') {
              return [
                {
                  handler: "foo",
                  isDynamic: false,
                  params: {}
                },
                {
                  handler: "bar",
                  isDynamic: false,
                  params: {}
                }
              ];
            } else if (url === '/articles/123/comments/456') {
              return [
                {
                  handler: "articles",
                  isDynamic: true,
                  params: { article_id: '123' }
                },
                {
                  handler: "comments",
                  isDynamic: true,
                  params: { comment_id: '456' }
                }
              ];
            }
          }
        };
      }
    });

    function $$transition_intent_test$$getHandler(name) {
      if ($$transition_intent_test$$handlers[name]) {
        return $$transition_intent_test$$handlers[name];
      } else {
        return $$transition_intent_test$$handlers[name] = {};
      }
    }

    test("URLTransitionIntent can be applied to an empty state", function() {

      var state = new $$transition$state$$default();
      var intent = new $$transition$intent$url$transition$intent$$default({ url: '/foo/bar' });
      var newState = intent.applyToState(state, $$transition_intent_test$$recognizer, $$transition_intent_test$$getHandler);
      var handlerInfos = newState.handlerInfos;

      equal(handlerInfos.length, 2);
      ok(handlerInfos[0] instanceof router$handler$info$$UnresolvedHandlerInfoByParam, "generated state consists of UnresolvedHandlerInfoByParam, 1");
      ok(handlerInfos[1] instanceof router$handler$info$$UnresolvedHandlerInfoByParam, "generated state consists of UnresolvedHandlerInfoByParam, 2");
      equal(handlerInfos[0].handler, $$transition_intent_test$$handlers.foo);
      equal(handlerInfos[1].handler, $$transition_intent_test$$handlers.bar);
    });

    test("URLTransitionIntent applied to single unresolved URL handlerInfo", function() {

      var state = new $$transition$state$$default();

      var startingHandlerInfo = new router$handler$info$$UnresolvedHandlerInfoByParam({
        name: 'foo',
        handler: $$transition_intent_test$$handlers.foo,
        params: {}
      });

      // This single unresolved handler info will be preserved
      // in the new array of handlerInfos.
      // Reason: if it were resolved, we wouldn't want to replace it.
      // So we only want to replace if it's actually known to be
      // different.
      state.handlerInfos = [ startingHandlerInfo ];

      var intent = new $$transition$intent$url$transition$intent$$default({ url: '/foo/bar', });
      var newState = intent.applyToState(state, $$transition_intent_test$$recognizer, $$transition_intent_test$$getHandler);
      var handlerInfos = newState.handlerInfos;

      equal(handlerInfos.length, 2);
      equal(handlerInfos[0], startingHandlerInfo, "The starting foo handlerInfo wasn't overridden because the new one wasn't any different");
      ok(handlerInfos[1] instanceof router$handler$info$$UnresolvedHandlerInfoByParam, "generated state consists of UnresolvedHandlerInfoByParam, 2");
      equal(handlerInfos[1].handler, $$transition_intent_test$$handlers.bar);
    });

    test("URLTransitionIntent applied to an already-resolved handlerInfo", function() {

      var state = new $$transition$state$$default();

      var startingHandlerInfo = new router$handler$info$$ResolvedHandlerInfo({
        name: 'foo',
        handler: $$transition_intent_test$$handlers.foo,
        context: {},
        params: {}
      });

      state.handlerInfos = [ startingHandlerInfo ];

      var intent = new $$transition$intent$url$transition$intent$$default({ url: '/foo/bar', });
      var newState = intent.applyToState(state, $$transition_intent_test$$recognizer, $$transition_intent_test$$getHandler);
      var handlerInfos = newState.handlerInfos;

      equal(handlerInfos.length, 2);
      equal(handlerInfos[0], startingHandlerInfo, "The starting foo resolved handlerInfo wasn't overridden because the new one wasn't any different");
      ok(handlerInfos[1] instanceof router$handler$info$$UnresolvedHandlerInfoByParam, "generated state consists of UnresolvedHandlerInfoByParam, 2");
      equal(handlerInfos[1].handler, $$transition_intent_test$$handlers.bar);
    });

    test("URLTransitionIntent applied to an already-resolved handlerInfo (non-empty params)", function() {

      var state = new $$transition$state$$default();

      var article = {};

      var startingHandlerInfo = new router$handler$info$$ResolvedHandlerInfo({
        name: 'articles',
        handler: {},
        context: article,
        params: { article_id: 'some-other-id' }
      });

      state.handlerInfos = [ startingHandlerInfo ];

      var intent = new $$transition$intent$url$transition$intent$$default({ url: '/articles/123/comments/456', });
      var newState = intent.applyToState(state, $$transition_intent_test$$recognizer, $$transition_intent_test$$getHandler);
      var handlerInfos = newState.handlerInfos;

      equal(handlerInfos.length, 2);
      ok(handlerInfos[0] !== startingHandlerInfo, "The starting foo resolved handlerInfo was overridden because the new had different params");
      ok(handlerInfos[1] instanceof router$handler$info$$UnresolvedHandlerInfoByParam, "generated state consists of UnresolvedHandlerInfoByParam, 2");
      equal(handlerInfos[1].handler, $$transition_intent_test$$handlers.comments);
    });

    test("URLTransitionIntent applied to an already-resolved handlerInfo of different route", function() {

      var state = new $$transition$state$$default();

      var startingHandlerInfo = new router$handler$info$$ResolvedHandlerInfo({
        name: 'alex',
        handler: $$transition_intent_test$$handlers.foo,
        context: {},
        params: {}
      });

      state.handlerInfos = [ startingHandlerInfo ];

      var intent = new $$transition$intent$url$transition$intent$$default({ url: '/foo/bar', });
      var newState = intent.applyToState(state, $$transition_intent_test$$recognizer, $$transition_intent_test$$getHandler);
      var handlerInfos = newState.handlerInfos;

      equal(handlerInfos.length, 2);
      ok(handlerInfos[0] !== startingHandlerInfo, "The starting foo resolved handlerInfo gets overridden because the new one has a different name");
      ok(handlerInfos[1] instanceof router$handler$info$$UnresolvedHandlerInfoByParam, "generated state consists of UnresolvedHandlerInfoByParam, 2");
      equal(handlerInfos[1].handler, $$transition_intent_test$$handlers.bar);
    });

    test("NamedTransitionIntent applied to an already-resolved handlerInfo (non-empty params)", function() {

      var state = new $$transition$state$$default();

      var article = {};
      var comment = {};

      var startingHandlerInfo = new router$handler$info$$ResolvedHandlerInfo({
        name: 'articles',
        handler: {},
        context: article,
        params: { article_id: 'some-other-id' }
      });

      state.handlerInfos = [ startingHandlerInfo ];

      var intent = new $$transition$intent$named$transition$intent$$default({
        name: 'comments',
        contexts: [ article, comment ]
      });

      var newState = intent.applyToState(state, $$transition_intent_test$$recognizer, $$transition_intent_test$$getHandler);
      var handlerInfos = newState.handlerInfos;

      equal(handlerInfos.length, 2);
      equal(handlerInfos[0], startingHandlerInfo);
      equal(handlerInfos[0].context, article);
      ok(handlerInfos[1] instanceof router$handler$info$$UnresolvedHandlerInfoByObject, "generated state consists of UnresolvedHandlerInfoByObject, 2");
      equal(handlerInfos[1].handler, $$transition_intent_test$$handlers.comments);
      equal(handlerInfos[1].context, comment);
    });

    $$test_helpers$$module("TransitionState");

    test("it starts off with default state", function() {
      var state = new $$transition$state$$default();
      deepEqual(state.handlerInfos, [], "it has an array of handlerInfos");
    });

    var $$transition_state_test$$async = router$$default.prototype.async;

    test("#resolve delegates to handleInfo objects' resolve()", function() {

      expect(8);

      var state = new $$transition$state$$default();

      var counter = 0;

      var resolvedHandlerInfos = [{}, {}];

      state.handlerInfos = [
        {
          resolve: function(_, shouldContinue) {
            ++counter;
            equal(counter, 1);
            shouldContinue();
            return $$rsvp$resolve$$default(resolvedHandlerInfos[0]);
          }
        },
        {
          resolve: function(_, shouldContinue) {
            ++counter;
            equal(counter, 2);
            shouldContinue();
            return $$rsvp$resolve$$default(resolvedHandlerInfos[1]);
          }
        },
      ];

      function keepGoing() {
        ok(true, "continuation function was called");
      }

      state.resolve($$transition_state_test$$async, keepGoing).then(function(result) {
        ok(!result.error);
        deepEqual(result.state.handlerInfos, resolvedHandlerInfos);
      });
    });

    test("State resolution can be halted", function() {

      expect(2);

      var state = new $$transition$state$$default();

      state.handlerInfos = [
        {
          resolve: function(_, shouldContinue) {
            return shouldContinue();
          }
        },
        {
          resolve: function() {
            ok(false, "I should not be entered because we threw an error in shouldContinue");
          }
        },
      ];

      function keepGoing() {
        return $$rsvp$reject$$default("NOPE");
      }

      state.resolve($$transition_state_test$$async, keepGoing).catch(function(reason) {
        equal(reason.error, "NOPE");
        ok(reason.wasAborted, "state resolution was correctly marked as aborted");
      });

      $$test_helpers$$flushBackburner();
    });


    test("Integration w/ HandlerInfos", function() {

      expect(5);

      var state = new $$transition$state$$default();

      var fooModel = {};
      var barModel = {};
      var transition = {};

      state.handlerInfos = [
        new router$handler$info$$UnresolvedHandlerInfoByParam({
          name: 'foo',
          params: { foo_id: '123' },
          handler: {
            model: function(params, payload) {
              equal(payload, transition);
              equal(params.foo_id, '123', "foo#model received expected params");
              return $$rsvp$resolve$$default(fooModel);
            }
          }
        }),
        new router$handler$info$$UnresolvedHandlerInfoByObject({
          name: 'bar',
          names: ['bar_id'],
          context: $$rsvp$resolve$$default(barModel),
          handler: {}
        })
      ];

      function noop() {}

      state.resolve($$transition_state_test$$async, noop, transition).then(function(result) {
        var models = result.state.handlerInfos.map(function(handlerInfo) {
          return handlerInfo.context;
        });

        ok(!result.error);
        equal(models[0], fooModel);
        equal(models[1], barModel);
      });
    });



    module("utils");

    test("getChangelist", function() {

      var result = $$utils$$getChangelist({}, { foo: '123' });
      deepEqual(result, { all: { foo: '123' }, changed: { foo: '123' }, removed: {} });

      result = $$utils$$getChangelist({ foo: '123' }, { foo: '123' });
      ok(!result);

      result = $$utils$$getChangelist({ foo: '123' }, {});
      deepEqual(result, { all: {}, changed: {}, removed: { foo: '123' } });

      result = $$utils$$getChangelist({ foo: '123', bar: '456'}, { foo: '123'});
      deepEqual(result, { all: { foo: '123' }, changed: {}, removed: { bar: '456' } });

      result = $$utils$$getChangelist({ foo: '123', bar: '456'}, { foo: '456'});
      deepEqual(result, { all: { foo: '456' }, changed: { foo: '456' }, removed: { bar: '456' } });
    });
}).call(this);

//# sourceMappingURL=router-test-bundle.js.map