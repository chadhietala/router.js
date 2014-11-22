"use strict";
var router$handler$info$$ = require("../handler-info"), router$utils$$ = require("router/utils"), router$config$$ = require("../config");

var ResolvedHandlerInfo = router$utils$$.subclass(router$handler$info$$.default, {
  resolve: function(shouldContinue, payload) {
    // A ResolvedHandlerInfo just resolved with itself.
    if (payload && payload.resolvedModels) {
      payload.resolvedModels[this.name] = this.context;
    }
    return router$config$$.default.Promise.resolve(this, this.promiseLabel("Resolve"));
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

exports["default"] = ResolvedHandlerInfo;

//# sourceMappingURL=resolved-handler-info.js.map