"use strict";
var router$utils$$ = require("./utils");

function TransitionIntent(props) {
  this.initialize(props);

  // TODO: wat
  this.data = this.data || {};
}

TransitionIntent.prototype = {
  initialize: null,
  applyToState: null
};

exports["default"] = TransitionIntent;

//# sourceMappingURL=transition-intent.js.map