"use strict";
var router$handler$info$$ = require("../handler-info"), router$utils$$ = require("router/utils"), router$config$$ = require("../config");

var UnresolvedHandlerInfoByObject = router$utils$$.subclass(router$handler$info$$.default, {
  getModel: function(payload) {
    this.log(payload, this.name + ": resolving provided model");
    return router$config$$.default.Promise.resolve(this.context);
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
    if (router$utils$$.isParam(model)) {
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

exports["default"] = UnresolvedHandlerInfoByObject;

//# sourceMappingURL=unresolved-handler-info-by-object.js.map