(function() {
    "use strict";
    var $$router$config$$config = {};

    $$router$config$$config.Promise = function () {
      throw new Error('No Promise constructor provided to router.js. '+ 
                      'Please use router-standalone.umd.js or ' + 
                      'call Router.configure("Promise", myPromiseContructor).');
    };

    $$router$config$$config.RouteRecognizer = function () {
      throw new Error('No RouteRecognizer constructor provided to router.js. '+ 
                      'Please use router-standalone.umd.js or ' + 
                      'call Router.configure("RouteRecognizer", myRouteRecognizer).');
    };

    var $$router$config$$default = $$router$config$$config;
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

    function $$utils$$bind(context, fn) {
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

    function $$utils$$subclass(parentConstructor, proto) {
      function C(props) {
        parentConstructor.call(this, props || {});
      }
      C.prototype = $$utils$$oCreate(parentConstructor.prototype);
      $$utils$$merge(C.prototype, proto);
      return C;
    }

    function $$utils$$resolveHook(obj, hookName) {
      if (!obj) { return; }
      var underscored = "_" + hookName;
      return obj[underscored] && underscored ||
             obj[hookName] && hookName;
    }

    function $$utils$$callHook(obj, hookName) {
      var args = $$utils$$slice.call(arguments, 2);
      return $$utils$$applyHook(obj, hookName, args);
    }

    function $$utils$$applyHook(obj, _hookName, args) {
      var hookName = $$utils$$resolveHook(obj, _hookName);
      if (hookName) {
        return obj[hookName].apply(obj, args);
      }
    }

    function $$handler$info$$HandlerInfo(_props) {
      var props = _props || {};
      $$utils$$merge(this, props);
      this.initialize(props);
    }

    $$handler$info$$HandlerInfo.prototype = {
      name: null,
      handler: null,
      params: null,
      context: null,

      // Injected by the handler info factory.
      factory: null,

      initialize: function() {},

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

      serialize: function() {
        return this.params || {};
      },

      resolve: function(shouldContinue, payload) {
        var checkForAbort  = $$utils$$bind(this, this.checkForAbort,      shouldContinue),
            beforeModel    = $$utils$$bind(this, this.runBeforeModelHook, payload),
            model          = $$utils$$bind(this, this.getModel,           payload),
            afterModel     = $$utils$$bind(this, this.runAfterModelHook,  payload),
            becomeResolved = $$utils$$bind(this, this.becomeResolved,     payload);

        return $$router$config$$default.Promise.resolve(undefined, this.promiseLabel("Start handler"))
               .then(checkForAbort, null, this.promiseLabel("Check for abort"))
               .then(beforeModel, null, this.promiseLabel("Before model"))
               .then(checkForAbort, null, this.promiseLabel("Check if aborted during 'beforeModel' hook"))
               .then(model, null, this.promiseLabel("Model"))
               .then(checkForAbort, null, this.promiseLabel("Check if aborted in 'model' hook"))
               .then(afterModel, null, this.promiseLabel("After model"))
               .then(checkForAbort, null, this.promiseLabel("Check if aborted in 'afterModel' hook"))
               .then(becomeResolved, null, this.promiseLabel("Become resolved"));
      },

      runBeforeModelHook: function(payload) {
        if (payload.trigger) {
          payload.trigger(true, 'willResolveModel', payload, this.handler);
        }
        return this.runSharedModelHook(payload, 'beforeModel', []);
      },

      runAfterModelHook: function(payload, resolvedModel) {
        // Stash the resolved model on the payload.
        // This makes it possible for users to swap out
        // the resolved model in afterModel.
        var name = this.name;
        this.stashResolvedModel(payload, resolvedModel);

        return this.runSharedModelHook(payload, 'afterModel', [resolvedModel])
                   .then(function() {
                     // Ignore the fulfilled value returned from afterModel.
                     // Return the value stashed in resolvedModels, which
                     // might have been swapped out in afterModel.
                     return payload.resolvedModels[name];
                   }, null, this.promiseLabel("Ignore fulfillment value and return model value"));
      },

      runSharedModelHook: function(payload, hookName, args) {
        this.log(payload, "calling " + hookName + " hook");

        if (this.queryParams) {
          args.push(this.queryParams);
        }
        args.push(payload);

        var result = $$utils$$applyHook(this.handler, hookName, args);

        if (result && result.isTransition) {
          result = null;
        }

        return $$router$config$$default.Promise.resolve(result, this.promiseLabel("Resolve value returned from one of the model hooks"));
      },

      // overridden by subclasses
      getModel: null,

      checkForAbort: function(shouldContinue, promiseValue) {
        return $$router$config$$default.Promise.resolve(shouldContinue(), this.promiseLabel("Check for abort")).then(function() {
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
        var params = this.serialize(resolvedContext);

        if (payload) {
          this.stashResolvedModel(payload, resolvedContext);
          payload.params = payload.params || {};
          payload.params[this.name] = params;
        }

        return this.factory('resolved', {
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
               (this.hasOwnProperty('params') && !$$handler$info$$paramsMatch(this.params, other.params));
      }
    };

    function $$handler$info$$paramsMatch(a, b) {
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

    var $$handler$info$$default = $$handler$info$$HandlerInfo;

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

      resolve: function(shouldContinue, payload) {
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
        return $$router$config$$default.Promise.resolve(null, this.promiseLabel("Start transition"))
        .then(resolveOneHandlerInfo, null, this.promiseLabel('Resolve handler'))['catch'](handleError, this.promiseLabel('Handle error'));

        function innerShouldContinue() {
          return $$router$config$$default.Promise.resolve(shouldContinue(), currentState.promiseLabel("Check if should continue"))['catch'](function(reason) {
            // We distinguish between errors that occurred
            // during resolution (e.g. beforeModel/model/afterModel),
            // and aborts due to a rejecting promise from shouldContinue().
            wasAborted = true;
            return Promise.reject(reason);
          }, currentState.promiseLabel("Handle abort"));
        }

        function handleError(error) {
          // This is the only possible
          // reject value of TransitionState#resolve
          var handlerInfos = currentState.handlerInfos;
          var errorHandlerIndex = payload.resolveIndex >= handlerInfos.length ?
                                  handlerInfos.length - 1 : payload.resolveIndex;
          return $$router$config$$default.Promise.reject({
            error: error,
            handlerWithError: currentState.handlerInfos[errorHandlerIndex].handler,
            wasAborted: wasAborted,
            state: currentState
          });
        }

        function proceed(resolvedHandlerInfo) {
          var wasAlreadyResolved = currentState.handlerInfos[payload.resolveIndex].isResolved;

          // Swap the previously unresolved handlerInfo with
          // the resolved handlerInfo
          currentState.handlerInfos[payload.resolveIndex++] = resolvedHandlerInfo;

          if (!wasAlreadyResolved) {
            // Call the redirect hook. The reason we call it here
            // vs. afterModel is so that redirects into child
            // routes don't re-run the model hooks for this
            // already-resolved route.
            var handler = resolvedHandlerInfo.handler;
            $$utils$$callHook(handler, 'redirect', resolvedHandlerInfo.context, payload);
          }

          // Proceed after ensuring that the redirect hook
          // didn't abort this transition by transitioning elsewhere.
          return innerShouldContinue().then(resolveOneHandlerInfo, null, currentState.promiseLabel('Resolve handler'));
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

          return handlerInfo.resolve(innerShouldContinue, payload)
                            .then(proceed, null, currentState.promiseLabel('Proceed'));
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
        this.promise = $$router$config$$default.Promise.reject(error);
        return;
      }

      if (state) {
        this.params = state.params;
        this.queryParams = state.queryParams;
        this.handlerInfos = state.handlerInfos;

        var len = state.handlerInfos.length;
        if (len) {
          this.targetName = state.handlerInfos[len-1].name;
        }

        for (var i = 0; i < len; ++i) {
          var handlerInfo = state.handlerInfos[i];

          // TODO: this all seems hacky
          if (!handlerInfo.isResolved) { break; }
          this.pivotHandler = handlerInfo.handler;
        }

        this.sequence = $$transition$$Transition.currentSequence++;
        this.promise = state.resolve(checkForAbort, this)['catch'](function(result) {
          if (result.wasAborted || transition.isAborted) {
            return $$router$config$$default.Promise.reject($$transition$$logAbort(transition));
          } else {
            transition.trigger('error', result.error, transition, result.handlerWithError);
            transition.abort();
            return $$router$config$$default.Promise.reject(result.error);
          }
        }, $$utils$$promiseLabel('Handle Abort'));
      } else {
        this.promise = $$router$config$$default.Promise.resolve(this.state);
        this.params = {};
      }

      function checkForAbort() {
        if (transition.isAborted) {
          return $$router$config$$default.Promise.reject(undefined, $$utils$$promiseLabel("Transition aborted - reject"));
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
      queryParamsOnly: false,

      isTransition: true,

      isExiting: function(handler) {
        var handlerInfos = this.handlerInfos;
        for (var i = 0, len = handlerInfos.length; i < len; ++i) {
          var handlerInfo = handlerInfos[i];
          if (handlerInfo.name === handler || handlerInfo.handler === handler) {
            return false;
          }
        }
        return true;
      },

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

        @param {Function} onFulfilled
        @param {Function} onRejected
        @param {String} label optional string for labeling the promise.
        Useful for tooling.
        @return {Promise}
       */
      then: function(onFulfilled, onRejected, label) {
        return this.promise.then(onFulfilled, onRejected, label);
      },

      /**
        @public

        Forwards to the internal `promise` property which you can
        use in situations where you want to pass around a thennable,
        but not the Transition itself.

        @method catch
        @param {Function} onRejection
        @param {String} label optional string for labeling the promise.
        Useful for tooling.
        @return {Promise}
       */
      catch: function(onRejection, label) {
        return this.promise.catch(onRejection, label);
      },

      /**
        @public

        Forwards to the internal `promise` property which you can
        use in situations where you want to pass around a thennable,
        but not the Transition itself.

        @method finally
        @param {Function} callback
        @param {String} label optional string for labeling the promise.
        Useful for tooling.
        @return {Promise}
       */
      finally: function(callback, label) {
        return this.promise.finally(callback, label);
      },

      /**
        @public

        Aborts the Transition. Note you can also implicitly abort a transition
        by initiating another transition while a previous one is underway.
       */
      abort: function() {
        if (this.isAborted) { return this; }
        $$utils$$log(this.router, this.sequence, this.targetName + ": transition was aborted");
        this.intent.preTransitionState = this.router.state;
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
          return $$router$config$$default.Promise.reject(reason);
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

    function $$$transition$intent$$TransitionIntent(props) {
      this.initialize(props);

      // TODO: wat
      this.data = this.data || {};
    }

    $$$transition$intent$$TransitionIntent.prototype = {
      initialize: null,
      applyToState: null
    };

    var $$$transition$intent$$default = $$$transition$intent$$TransitionIntent;

    var $$resolved$handler$info$$ResolvedHandlerInfo = $$utils$$subclass($$handler$info$$default, {
      resolve: function(shouldContinue, payload) {
        // A ResolvedHandlerInfo just resolved with itself.
        if (payload && payload.resolvedModels) {
          payload.resolvedModels[this.name] = this.context;
        }
        return $$router$config$$default.Promise.resolve(this, this.promiseLabel("Resolve"));
      },

      getUnresolved: function() {
        return this.factory('param', {
          name: this.name,
          handler: this.handler,
          params: this.params
        });
      },

      isResolved: true
    });

    var $$resolved$handler$info$$default = $$resolved$handler$info$$ResolvedHandlerInfo;

    var $$unresolved$handler$info$by$object$$UnresolvedHandlerInfoByObject = $$utils$$subclass($$handler$info$$default, {
      getModel: function(payload) {
        this.log(payload, this.name + ": resolving provided model");
        return $$router$config$$default.Promise.resolve(this.context);
      },

      initialize: function(props) {
        this.names = props.names || [];
        this.context = props.context;
      },

      /**
        @private

        Serializes a handler using its custom `serialize` method or
        by a default that looks up the expected property name from
        the dynamic segment.

        @param {Object} model the model to be serialized for this handler
      */
      serialize: function(_model) {
        var model = _model || this.context,
            names = this.names,
            handler = this.handler;

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
    });

    var $$unresolved$handler$info$by$object$$default = $$unresolved$handler$info$by$object$$UnresolvedHandlerInfoByObject;

    // Generated by URL transitions and non-dynamic route segments in named Transitions.
    var $$unresolved$handler$info$by$param$$UnresolvedHandlerInfoByParam = $$utils$$subclass ($$handler$info$$default, {
      initialize: function(props) {
        this.params = props.params || {};
      },

      getModel: function(payload) {
        var fullParams = this.params;
        if (payload && payload.queryParams) {
          fullParams = {};
          $$utils$$merge(fullParams, this.params);
          fullParams.queryParams = payload.queryParams;
        }

        var handler = this.handler;
        var hookName = $$utils$$resolveHook(handler, 'deserialize') ||
                       $$utils$$resolveHook(handler, 'model');

        return this.runSharedModelHook(payload, hookName, [fullParams]);
      }
    });

    var $$unresolved$handler$info$by$param$$default = $$unresolved$handler$info$by$param$$UnresolvedHandlerInfoByParam;

    $$$handler$info$factory$$handlerInfoFactory.klasses = {
      resolved: $$resolved$handler$info$$default,
      param: $$unresolved$handler$info$by$param$$default,
      object: $$unresolved$handler$info$by$object$$default
    };

    function $$$handler$info$factory$$handlerInfoFactory(name, props) {
      var Ctor = $$$handler$info$factory$$handlerInfoFactory.klasses[name],
          handlerInfo = new Ctor(props || {});
      handlerInfo.factory = $$$handler$info$factory$$handlerInfoFactory;
      return handlerInfo;
    }

    var $$$handler$info$factory$$default = $$$handler$info$factory$$handlerInfoFactory;

    var $$transition$intent$named$transition$intent$$default = $$utils$$subclass($$$transition$intent$$default, {
      name: null,
      pivotHandler: null,
      contexts: null,
      queryParams: null,

      initialize: function(props) {
        this.name = props.name;
        this.pivotHandler = props.pivotHandler;
        this.contexts = props.contexts || [];
        this.queryParams = props.queryParams;
      },

      applyToState: function(oldState, recognizer, getHandler, isIntermediate) {

        var partitionedArgs     = $$utils$$extractQueryParams([this.name].concat(this.contexts)),
          pureArgs              = partitionedArgs[0],
          queryParams           = partitionedArgs[1],
          handlers              = recognizer.handlersFor(pureArgs[0]);

        var targetRouteName = handlers[handlers.length-1].handler;

        return this.applyToHandlers(oldState, handlers, getHandler, targetRouteName, isIntermediate);
      },

      applyToHandlers: function(oldState, handlers, getHandler, targetRouteName, isIntermediate, checkingIfActive) {

        var i, len;
        var newState = new $$transition$state$$default();
        var objects = this.contexts.slice(0);

        var invalidateIndex = handlers.length;

        // Pivot handlers are provided for refresh transitions
        if (this.pivotHandler) {
          for (i = 0, len = handlers.length; i < len; ++i) {
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
              newHandlerInfo = this.getHandlerInfoForDynamicSegment(name, handler, result.names, objects, oldHandlerInfo, targetRouteName, i);
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

        $$utils$$merge(newState.queryParams, this.queryParams || {});

        return newState;
      },

      invalidateChildren: function(handlerInfos, invalidateIndex) {
        for (var i = invalidateIndex, l = handlerInfos.length; i < l; ++i) {
          var handlerInfo = handlerInfos[i];
          handlerInfos[i] = handlerInfos[i].getUnresolved();
        }
      },

      getHandlerInfoForDynamicSegment: function(name, handler, names, objects, oldHandlerInfo, targetRouteName, i) {

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
          if (this.preTransitionState) {
            var preTransitionHandlerInfo = this.preTransitionState.handlerInfos[i];
            objectToUse = preTransitionHandlerInfo && preTransitionHandlerInfo.context;
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
        }

        return $$$handler$info$factory$$default('object', {
          name: name,
          handler: handler,
          context: objectToUse,
          names: names
        });
      },

      createParamHandlerInfo: function(name, handler, names, objects, oldHandlerInfo) {
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

        return $$$handler$info$factory$$default('param', {
          name: name,
          handler: handler,
          params: params
        });
      }
    });

    var $$transition$intent$url$transition$intent$$default = $$utils$$subclass($$$transition$intent$$default, {
      url: null,

      initialize: function(props) {
        this.url = props.url;
      },

      applyToState: function(oldState, recognizer, getHandler) {
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

          var newHandlerInfo = $$$handler$info$factory$$default('param', {
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
      }
    });

    /**
      Promise reject reasons passed to promise rejection
      handlers for failed transitions.
     */
    function $$transition$intent$url$transition$intent$$UnrecognizedURLError(message) {
      this.message = (message || "UnrecognizedURLError");
      this.name = "UnrecognizedURLError";
    }

    var $$router$router$$pop = Array.prototype.pop;

    function $$router$router$$Router() {
      this.recognizer = new $$router$config$$default.RouteRecognizer();
      this.reset();
    }

    function $$router$router$$getTransitionByIntent(intent, isIntermediate) {
      var wasTransitioning = !!this.activeTransition;
      var oldState = wasTransitioning ? this.activeTransition.state : this.state;
      var newTransition;

      var newState = intent.applyToState(oldState, this.recognizer, this.getHandler, isIntermediate);
      var queryParamChangelist = $$utils$$getChangelist(oldState.queryParams, newState.queryParams);

      if ($$router$router$$handlerInfosEqual(newState.handlerInfos, oldState.handlerInfos)) {

        // This is a no-op transition. See if query params changed.
        if (queryParamChangelist) {
          newTransition = this.queryParamsTransition(queryParamChangelist, wasTransitioning, oldState, newState);
          if (newTransition) {
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
        return $$router$router$$finalizeTransition(newTransition, result.state);
      }, null, $$utils$$promiseLabel("Settle transition promise when transition is finalized"));

      if (!wasTransitioning) {
        $$router$router$$notifyExistingHandlers(this, newState, newTransition);
      }

      $$router$router$$fireQueryParamDidChange(this, newState, queryParamChangelist);

      return newTransition;
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

      queryParamsTransition: function(changelist, wasTransitioning, oldState, newState) {
        var router = this;

        $$router$router$$fireQueryParamDidChange(this, newState, changelist);

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
          var newTransition = new $$transition$$Transition(this);
          newTransition.queryParamsOnly = true;

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
      },

      // NOTE: this doesn't really belong here, but here
      // it shall remain until our ES6 transpiler can
      // handle cyclical deps.
      transitionByIntent: function(intent, isIntermediate) {
        try {
          return $$router$router$$getTransitionByIntent.apply(this, arguments);
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
          $$utils$$forEach(this.state.handlerInfos.slice().reverse(), function(handlerInfo) {
            var handler = handlerInfo.handler;
            $$utils$$callHook(handler, 'exit');
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
        return $$router$router$$doTransition(this, arguments, true);
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
          var handlerParams = handlerInfo.serialize();
          $$utils$$merge(params, handlerParams);
        }
        params.queryParams = queryParams;

        return this.recognizer.generate(handlerName, params);
      },

      applyIntent: function(handlerName, contexts) {
        var intent = new $$transition$intent$named$transition$intent$$default({
          name: handlerName,
          contexts: contexts
        });

        var state = this.activeTransition && this.activeTransition.state || this.state;
        return intent.applyToState(state, this.recognizer, this.getHandler);
      },

      isActiveIntent: function(handlerName, contexts, queryParams) {
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

        var handlersEqual = $$router$router$$handlerInfosEqual(newState.handlerInfos, state.handlerInfos);
        if (!queryParams || !handlersEqual) {
          return handlersEqual;
        }

        // Get a hash of QPs that will still be active on new route
        var activeQPsOnNewHandler = {};
        $$utils$$merge(activeQPsOnNewHandler, queryParams);

        var activeQueryParams  = this.state.queryParams;
        for (var key in activeQueryParams) {
          if (activeQueryParams.hasOwnProperty(key) &&
              activeQPsOnNewHandler.hasOwnProperty(key)) {
            activeQPsOnNewHandler[key] = activeQueryParams[key];
          }
        }

        return handlersEqual && !$$utils$$getChangelist(activeQPsOnNewHandler, queryParams);
      },

      isActive: function(handlerName) {
        var partitionedArgs = $$utils$$extractQueryParams($$utils$$slice.call(arguments, 1));
        return this.isActiveIntent(handlerName, partitionedArgs[0], partitionedArgs[1]);
      },

      trigger: function(name) {
        var args = $$utils$$slice.call(arguments);
        $$utils$$trigger(this, this.currentHandlerInfos, false, args);
      },

      /**
        Hook point for logging transition status updates.

        @param {String} message The message to log.
      */
      log: null,

      _willChangeContextEvent: 'willChangeContext',
      _triggerWillChangeContext: function(handlerInfos, newTransition) {
        $$utils$$trigger(this, handlerInfos, true, [this._willChangeContextEvent, newTransition]);
      },

      _triggerWillLeave: function(handlerInfos, newTransition, leavingChecker) {
        $$utils$$trigger(this, handlerInfos, true, ['willLeave', newTransition, leavingChecker]);
      }
    };

    /**
      @private

      Fires queryParamsDidChange event
    */
    function $$router$router$$fireQueryParamDidChange(router, newState, queryParamChangelist) {
      // If queryParams changed trigger event
      if (queryParamChangelist) {

        // This is a little hacky but we need some way of storing
        // changed query params given that no activeTransition
        // is guaranteed to have occurred.
        router._changedQueryParams = queryParamChangelist.all;
        $$utils$$trigger(router, newState.handlerInfos, true, ['queryParamsDidChange', queryParamChangelist.changed, queryParamChangelist.all, queryParamChangelist.removed]);
        router._changedQueryParams = null;
      }
    }

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

        $$utils$$callHook(handler, 'reset', true, transition);
        $$utils$$callHook(handler, 'exit', transition);
      });

      var oldState = router.oldState = router.state;
      router.state = newState;
      var currentHandlerInfos = router.currentHandlerInfos = partition.unchanged.slice();

      try {
        $$utils$$forEach(partition.reset, function(handlerInfo) {
          var handler = handlerInfo.handler;
          $$utils$$callHook(handler, 'reset', false, transition);
        });

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

      if (enter) {
        $$utils$$callHook(handler, 'enter', transition);
      }
      if (transition && transition.isAborted) {
        throw new $$transition$$TransitionAborted();
      }

      handler.context = context;
      $$utils$$callHook(handler, 'contextDidChange');

      $$utils$$callHook(handler, 'setup', context, transition);
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

      var handlerChanged, contextChanged = false, i, l;

      for (i=0, l=newHandlers.length; i<l; i++) {
        var oldHandler = oldHandlers[i], newHandler = newHandlers[i];

        if (!oldHandler || oldHandler.handler !== newHandler.handler) {
          handlerChanged = true;
        }

        if (handlerChanged) {
          handlers.entered.push(newHandler);
          if (oldHandler) { handlers.exited.unshift(oldHandler); }
        } else if (contextChanged || oldHandler.context !== newHandler.context) {
          contextChanged = true;
          handlers.updatedContext.push(newHandler);
        } else {
          handlers.unchanged.push(oldHandler);
        }
      }

      for (i=newHandlers.length, l=oldHandlers.length; i<l; i++) {
        handlers.exited.unshift(oldHandlers[i]);
      }

      handlers.reset = handlers.updatedContext.slice();
      handlers.reset.reverse();

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
          return $$router$config$$default.Promise.reject($$transition$$logAbort(transition));
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

    function $$router$router$$notifyExistingHandlers(router, newState, newTransition) {
      var oldHandlers = router.state.handlerInfos,
          changing = [],
          leavingIndex = null,
          leaving, leavingChecker, i, oldHandlerLen, oldHandler, newHandler;

      oldHandlerLen = oldHandlers.length;
      for (i = 0; i < oldHandlerLen; i++) {
        oldHandler = oldHandlers[i];
        newHandler = newState.handlerInfos[i];

        if (!newHandler || oldHandler.name !== newHandler.name) {
          leavingIndex = i;
          break;
        }

        if (!newHandler.isResolved) {
          changing.push(oldHandler);
        }
      }

      if (leavingIndex !== null) {
        leaving = oldHandlers.slice(leavingIndex, oldHandlerLen);
        leavingChecker = function(name) {
          for (var h = 0, len = leaving.length; h < len; h++) {
            if (leaving[h].name === name) {
              return true;
            }
          }
          return false;
        };

        router._triggerWillLeave(leaving, newTransition, leavingChecker);
      }

      if (changing.length > 0) {
        router._triggerWillChangeContext(changing, newTransition);
      }

      $$utils$$trigger(router, oldHandlers, true, ['willTransition', newTransition]);
    }

    var $$router$router$$default = $$router$router$$Router;

    function $$router$$configure (key, value) {
      $$router$config$$default[key] = value;
    }

    /* global RSVP, require */
    if (typeof RSVP !== 'undefined') {
      $$router$$configure('Promise', RSVP.Promise);
    } else if (typeof require === 'function') {
      try {
        $$router$$configure('Promise', require('rsvp').Promise);
      } catch (e) {}
    }

    /* global RouteRecognizer, require */
    if (typeof RouteRecognizer !== 'undefined') {
      $$router$$configure('RouteRecognizer', RouteRecognizer);
    } else if (typeof require === 'function') {
      try {
        $$router$$configure('RouteRecognizer', require('route-recognizer'));
      } catch (e) {}
    }

    var $$router$$default = $$router$router$$default;
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

    var $$rsvp$config$$config = {
      instrument: false
    };

    $$rsvp$events$$default.mixin($$rsvp$config$$config);

    function $$rsvp$config$$configure(name, value) {
      if (name === 'onerror') {
        // handle for legacy users that expect the actual
        // error to be passed to their function added via
        // `RSVP.configure('onerror', someFunctionHere);`
        $$rsvp$config$$config.on('error', value);
        return;
      }

      if (arguments.length === 2) {
        $$rsvp$config$$config[name] = value;
      } else {
        return $$rsvp$config$$config[name];
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

    function $$instrument$$instrument(eventName, promise, child) {
      if (1 === $$instrument$$queue.push({
          name: eventName,
          payload: {
            guid: promise._guidKey + promise._id,
            eventName: eventName,
            detail: promise._result,
            childGuid: child && promise._guidKey + child._id,
            label: promise._label,
            timeStamp: $$utils1$$now(),
            stack: new Error(promise._label).stack
          }})) {

            setTimeout(function() {
              var entry;
              for (var i = 0; i < $$instrument$$queue.length; i++) {
                entry = $$instrument$$queue[i];
                $$rsvp$config$$config.trigger(entry.name, entry.payload);
              }
              $$instrument$$queue.length = 0;
            }, 50);
          }
      }
    var $$instrument$$default = $$instrument$$instrument;

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
      $$rsvp$config$$config.async(function(promise) {
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
        if ($$rsvp$config$$config.instrument) {
          $$instrument$$default('fulfilled', promise);
        }
      } else {
        $$rsvp$config$$config.async($$$internal$$publish, promise);
      }
    }

    function $$$internal$$reject(promise, reason) {
      if (promise._state !== $$$internal$$PENDING) { return; }
      promise._state = $$$internal$$REJECTED;
      promise._result = reason;

      $$rsvp$config$$config.async($$$internal$$publishRejection, promise);
    }

    function $$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + $$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + $$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        $$rsvp$config$$config.async($$$internal$$publish, parent);
      }
    }

    function $$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if ($$rsvp$config$$config.instrument) {
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
          $$$internal$$reject(promise, new TypeError('A promises callback cannot return that same promise.'));
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

    function $$enumerator$$makeSettledResult(state, position, value) {
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

    function $$enumerator$$Enumerator(Constructor, input, abortOnReject, label) {
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

    $$enumerator$$Enumerator.prototype._validateInput = function(input) {
      return $$utils1$$isArray(input);
    };

    $$enumerator$$Enumerator.prototype._validationError = function() {
      return new Error('Array Methods must be provided an Array');
    };

    $$enumerator$$Enumerator.prototype._init = function() {
      this._result = new Array(this.length);
    };

    var $$enumerator$$default = $$enumerator$$Enumerator;

    $$enumerator$$Enumerator.prototype._enumerate = function() {
      var length  = this.length;
      var promise = this.promise;
      var input   = this._input;

      for (var i = 0; promise._state === $$$internal$$PENDING && i < length; i++) {
        this._eachEntry(input[i], i);
      }
    };

    $$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
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

    $$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
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

    $$enumerator$$Enumerator.prototype._makeResult = function(state, i, value) {
      return value;
    };

    $$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      $$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt($$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt($$$internal$$REJECTED, i, reason);
      });
    };
    function $$promise$all$$all(entries, label) {
      return new $$enumerator$$default(this, entries, true /* abort on reject */, label).promise;
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

    var $$rsvp$promise$$guidKey = 'rsvp_' + $$utils1$$now() + '-';
    var $$rsvp$promise$$counter = 0;

    function $$rsvp$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function $$rsvp$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }
    var $$rsvp$promise$$default = $$rsvp$promise$$Promise;
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
    function $$rsvp$promise$$Promise(resolver, label) {
      this._id = $$rsvp$promise$$counter++;
      this._label = label;
      this._state = undefined;
      this._result = undefined;
      this._subscribers = [];

      if ($$rsvp$config$$config.instrument) {
        $$instrument$$default('created', this);
      }

      if ($$$internal$$noop !== resolver) {
        if (!$$utils1$$isFunction(resolver)) {
          $$rsvp$promise$$needsResolver();
        }

        if (!(this instanceof $$rsvp$promise$$Promise)) {
          $$rsvp$promise$$needsNew();
        }

        $$$internal$$initializePromise(this, resolver);
      }
    }

    // deprecated
    $$rsvp$promise$$Promise.cast = $$promise$resolve$$default;
    $$rsvp$promise$$Promise.all = $$promise$all$$default;
    $$rsvp$promise$$Promise.race = $$promise$race$$default;
    $$rsvp$promise$$Promise.resolve = $$promise$resolve$$default;
    $$rsvp$promise$$Promise.reject = $$promise$reject$$default;

    $$rsvp$promise$$Promise.prototype = {
      constructor: $$rsvp$promise$$Promise,

      _guidKey: $$rsvp$promise$$guidKey,

      _onerror: function (reason) {
        $$rsvp$config$$config.trigger('error', reason);
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
          if ($$rsvp$config$$config.instrument) {
            $$instrument$$default('chained', this, this);
          }
          return this;
        }

        parent._onerror = null;

        var child = new this.constructor($$$internal$$noop, label);
        var result = parent._result;

        if ($$rsvp$config$$config.instrument) {
          $$instrument$$default('chained', parent, child);
        }

        if (state) {
          var callback = arguments[state - 1];
          $$rsvp$config$$config.async(function(){
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
              var p = new $$rsvp$promise$$default($$$internal$$noop);
              $$$internal$$reject(p, $$rsvp$node$$GET_THEN_ERROR.value);
              return p;
            } else if (promiseInput && promiseInput !== true) {
              arg = $$rsvp$node$$wrapThenable(promiseInput, arg);
            }
          }
          args[i] = arg;
        }

        var promise = new $$rsvp$promise$$default($$$internal$$noop);

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
      return $$rsvp$promise$$default.all(args).then(function(args){
        var result = $$rsvp$node$$tryApply(nodeFunc, self, args);
        if (result === $$rsvp$node$$ERROR) {
          $$$internal$$reject(promise, result.value);
        }
        return promise;
      });
    }

    function $$rsvp$node$$needsPromiseInput(arg) {
      if (arg && typeof arg === 'object') {
        if (arg.constructor === $$rsvp$promise$$default) {
          return true;
        } else {
          return $$rsvp$node$$getThen(arg);
        }
      } else {
        return false;
      }
    }
    function $$rsvp$all$$all(array, label) {
      return $$rsvp$promise$$default.all(array, label);
    }
    var $$rsvp$all$$default = $$rsvp$all$$all;

    function $$rsvp$all$settled$$AllSettled(Constructor, entries, label) {
      this._superConstructor(Constructor, entries, false /* don't abort on reject */, label);
    }

    $$rsvp$all$settled$$AllSettled.prototype = $$utils1$$o_create($$enumerator$$default.prototype);
    $$rsvp$all$settled$$AllSettled.prototype._superConstructor = $$enumerator$$default;
    $$rsvp$all$settled$$AllSettled.prototype._makeResult = $$enumerator$$makeSettledResult;
    $$rsvp$all$settled$$AllSettled.prototype._validationError = function() {
      return new Error('allSettled must be called with an array');
    };

    function $$rsvp$all$settled$$allSettled(entries, label) {
      return new $$rsvp$all$settled$$AllSettled($$rsvp$promise$$default, entries, label).promise;
    }
    var $$rsvp$all$settled$$default = $$rsvp$all$settled$$allSettled;
    function $$rsvp$race$$race(array, label) {
      return $$rsvp$promise$$default.race(array, label);
    }
    var $$rsvp$race$$default = $$rsvp$race$$race;

    function $$promise$hash$$PromiseHash(Constructor, object, label) {
      this._superConstructor(Constructor, object, true, label);
    }

    var $$promise$hash$$default = $$promise$hash$$PromiseHash;

    $$promise$hash$$PromiseHash.prototype = $$utils1$$o_create($$enumerator$$default.prototype);
    $$promise$hash$$PromiseHash.prototype._superConstructor = $$enumerator$$default;
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
      return new $$promise$hash$$default($$rsvp$promise$$default, object, label).promise;
    }
    var $$rsvp$hash$$default = $$rsvp$hash$$hash;

    function $$rsvp$hash$settled$$HashSettled(Constructor, object, label) {
      this._superConstructor(Constructor, object, false, label);
    }

    $$rsvp$hash$settled$$HashSettled.prototype = $$utils1$$o_create($$promise$hash$$default.prototype);
    $$rsvp$hash$settled$$HashSettled.prototype._superConstructor = $$enumerator$$default;
    $$rsvp$hash$settled$$HashSettled.prototype._makeResult = $$enumerator$$makeSettledResult;

    $$rsvp$hash$settled$$HashSettled.prototype._validationError = function() {
      return new Error('hashSettled must be called with an object');
    };

    function $$rsvp$hash$settled$$hashSettled(object, label) {
      return new $$rsvp$hash$settled$$HashSettled($$rsvp$promise$$default, object, label).promise;
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

      deferred.promise = new $$rsvp$promise$$default(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
      }, label);

      return deferred;
    }
    var $$rsvp$defer$$default = $$rsvp$defer$$defer;
    function $$rsvp$map$$map(promises, mapFn, label) {
      return $$rsvp$promise$$default.all(promises, label).then(function(values) {
        if (!$$utils1$$isFunction(mapFn)) {
          throw new TypeError("You must pass a function as map's second argument.");
        }

        var length = values.length;
        var results = new Array(length);

        for (var i = 0; i < length; i++) {
          results[i] = mapFn(values[i]);
        }

        return $$rsvp$promise$$default.all(results, label);
      });
    }
    var $$rsvp$map$$default = $$rsvp$map$$map;
    function $$rsvp$resolve$$resolve(value, label) {
      return $$rsvp$promise$$default.resolve(value, label);
    }
    var $$rsvp$resolve$$default = $$rsvp$resolve$$resolve;
    function $$rsvp$reject$$reject(reason, label) {
      return $$rsvp$promise$$default.reject(reason, label);
    }
    var $$rsvp$reject$$default = $$rsvp$reject$$reject;
    function $$rsvp$filter$$filter(promises, filterFn, label) {
      return $$rsvp$promise$$default.all(promises, label).then(function(values) {
        if (!$$utils1$$isFunction(filterFn)) {
          throw new TypeError("You must pass a function as filter's second argument.");
        }

        var length = values.length;
        var filtered = new Array(length);

        for (var i = 0; i < length; i++) {
          filtered[i] = filterFn(values[i]);
        }

        return $$rsvp$promise$$default.all(filtered, label).then(function(filtered) {
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

    var $$rsvp$asap$$browserGlobal = (typeof window !== 'undefined') ? window : {};
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

    var $$rsvp$asap$$scheduleFlush;

    // Decide what async method to use to triggering processing of queued callbacks:
    if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
      $$rsvp$asap$$scheduleFlush = $$rsvp$asap$$useNextTick();
    } else if ($$rsvp$asap$$BrowserMutationObserver) {
      $$rsvp$asap$$scheduleFlush = $$rsvp$asap$$useMutationObserver();
    } else if ($$rsvp$asap$$isWorker) {
      $$rsvp$asap$$scheduleFlush = $$rsvp$asap$$useMessageChannel();
    } else {
      $$rsvp$asap$$scheduleFlush = $$rsvp$asap$$useSetTimeout();
    }

    // default async is asap;
    $$rsvp$config$$config.async = $$rsvp$asap$$default;
    var rsvp$$cast = $$rsvp$resolve$$default;
    function rsvp$$async(callback, arg) {
      $$rsvp$config$$config.async(callback, arg);
    }

    function rsvp$$on() {
      $$rsvp$config$$config.on.apply($$rsvp$config$$config, arguments);
    }

    function rsvp$$off() {
      $$rsvp$config$$config.off.apply($$rsvp$config$$config, arguments);
    }

    // Set up instrumentation through `window.__PROMISE_INTRUMENTATION__`
    if (typeof window !== 'undefined' && typeof window['__PROMISE_INSTRUMENTATION__'] === 'object') {
      var rsvp$$callbacks = window['__PROMISE_INSTRUMENTATION__'];
      $$rsvp$config$$configure('instrument', true);
      for (var rsvp$$eventName in rsvp$$callbacks) {
        if (rsvp$$callbacks.hasOwnProperty(rsvp$$eventName)) {
          rsvp$$on(rsvp$$eventName, rsvp$$callbacks[rsvp$$eventName]);
        }
      }
    }

    function $$route$recognizer$dsl$$Target(path, matcher, delegate) {
      this.path = path;
      this.matcher = matcher;
      this.delegate = delegate;
    }

    $$route$recognizer$dsl$$Target.prototype = {
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

    function $$route$recognizer$dsl$$Matcher(target) {
      this.routes = {};
      this.children = {};
      this.target = target;
    }

    $$route$recognizer$dsl$$Matcher.prototype = {
      add: function(path, handler) {
        this.routes[path] = handler;
      },

      addChild: function(path, target, callback, delegate) {
        var matcher = new $$route$recognizer$dsl$$Matcher(target);
        this.children[path] = matcher;

        var match = $$route$recognizer$dsl$$generateMatch(path, matcher, delegate);

        if (delegate && delegate.contextEntered) {
          delegate.contextEntered(target, match);
        }

        callback(match);
      }
    };

    function $$route$recognizer$dsl$$generateMatch(startingPath, matcher, delegate) {
      return function(path, nestedCallback) {
        var fullPath = startingPath + path;

        if (nestedCallback) {
          nestedCallback($$route$recognizer$dsl$$generateMatch(fullPath, matcher, delegate));
        } else {
          return new $$route$recognizer$dsl$$Target(startingPath + path, matcher, delegate);
        }
      };
    }

    function $$route$recognizer$dsl$$addRoute(routeArray, path, handler) {
      var len = 0;
      for (var i=0, l=routeArray.length; i<l; i++) {
        len += routeArray[i].path.length;
      }

      path = path.substr(len);
      var route = { path: path, handler: handler };
      routeArray.push(route);
    }

    function $$route$recognizer$dsl$$eachRoute(baseRoute, matcher, callback, binding) {
      var routes = matcher.routes;

      for (var path in routes) {
        if (routes.hasOwnProperty(path)) {
          var routeArray = baseRoute.slice();
          $$route$recognizer$dsl$$addRoute(routeArray, path, routes[path]);

          if (matcher.children[path]) {
            $$route$recognizer$dsl$$eachRoute(routeArray, matcher.children[path], callback, binding);
          } else {
            callback.call(binding, routeArray);
          }
        }
      }
    }

    var $$route$recognizer$dsl$$default = function(callback, addRouteCallback) {
      var matcher = new $$route$recognizer$dsl$$Matcher();

      callback($$route$recognizer$dsl$$generateMatch("", matcher, this.delegate));

      $$route$recognizer$dsl$$eachRoute([], matcher, function(route) {
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

    route$recognizer$$RouteRecognizer.prototype.map = $$route$recognizer$dsl$$default;

    var route$recognizer$$default = route$recognizer$$RouteRecognizer;

    $$router$$configure('Promise', $$rsvp$promise$$default);
    $$router$$configure('RouteRecognizer', route$recognizer$$default);

    var router$standalone$umd$$default = $$router$$default;

    if (typeof module !== 'undefined' && module.exports) {
      module.exports = $$router$$default;
    } else if (typeof define !== 'undefined' && define.amd) {
      define(function() { return $$router$$default; });
    } else if (typeof window !== 'undefined') {
      window.Router = $$router$$default;
    } else if (this) {
      this.Router = $$router$$default;
    }
}).call(this);

//# sourceMappingURL=router-standalone.js.map