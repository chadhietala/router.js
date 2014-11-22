"use strict";
var router$handler$info$resolved$handler$info$$ = require("./resolved-handler-info"), router$handler$info$unresolved$handler$info$by$object$$ = require("./unresolved-handler-info-by-object"), router$handler$info$unresolved$handler$info$by$param$$ = require("./unresolved-handler-info-by-param");

handlerInfoFactory.klasses = {
  resolved: router$handler$info$resolved$handler$info$$.default,
  param: router$handler$info$unresolved$handler$info$by$param$$.default,
  object: router$handler$info$unresolved$handler$info$by$object$$.default
};

function handlerInfoFactory(name, props) {
  var Ctor = handlerInfoFactory.klasses[name],
      handlerInfo = new Ctor(props || {});
  handlerInfo.factory = handlerInfoFactory;
  return handlerInfo;
}

exports["default"] = handlerInfoFactory;

//# sourceMappingURL=factory.js.map