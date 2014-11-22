"use strict";
var router$transition$intent$$ = require("../transition-intent"), router$transition$state$$ = require("../transition-state"), router$handler$info$factory$$ = require("../handler-info/factory"), router$utils$$ = require("../utils");

exports["default"] = router$utils$$.subclass(router$transition$intent$$.default, {
  url: null,

  initialize: function(props) {
    this.url = props.url;
  },

  applyToState: function(oldState, recognizer, getHandler) {
    var newState = new router$transition$state$$.default();

    var results = recognizer.recognize(this.url),
        queryParams = {},
        i, len;

    if (!results) {
      throw new UnrecognizedURLError(this.url);
    }

    var statesDiffer = false;

    for (i = 0, len = results.length; i < len; ++i) {
      var result = results[i];
      var name = result.handler;
      var handler = getHandler(name);

      if (handler.inaccessibleByURL) {
        throw new UnrecognizedURLError(this.url);
      }

      var newHandlerInfo = router$handler$info$factory$$.default('param', {
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

    router$utils$$.merge(newState.queryParams, results.queryParams);

    return newState;
  }
});

/**
  Promise reject reasons passed to promise rejection
  handlers for failed transitions.
 */
function UnrecognizedURLError(message) {
  this.message = (message || "UnrecognizedURLError");
  this.name = "UnrecognizedURLError";
}

//# sourceMappingURL=url-transition-intent.js.map