var validators = module.exports = [];

/**
 * Check attribute type definition.
 *
 * @param {Model} model instance that is being validated
 * @api public
 */

validators.type = function(model) {
  Object.keys(model.constructor.attributes).forEach(function(name) {
    var definition = model.constructor.attributes[name];
    var value = model[name];

    if (value === null || value === undefined || !definition.type) return;

    if (type(value) !== definition.type) {
      model.error(name + " is not of type " + definition.type + ".", {
        type: "validation",
        attribute: name
      });
    }
  });
};

/**
 * Check whether attribute is required.
 *
 * @param {Model} model instance that is being validated
 * @api public
 */

validators.required = function(model) {
  Object.keys(model.constructor.attributes).forEach(function(name) {
    var definition = model.constructor.attributes[name];
    var value = model[name];

    if (!definition.required) return;

    if (value === undefined || value === null || value === "") {
      model.error(name + " is required.", {
        type: "validation",
        attribute: name
      });
    }
  });
};

/**
 * Return type of value.
 *
 * @param {Mixed} val
 * @return {String}
 * @api private
 */

function type(val) {
  switch (toString.call(val)) {
    case '[object Function]': return 'function';
    case '[object Date]': return 'date';
    case '[object RegExp]': return 'regexp';
    case '[object Array]': return 'array';
  }

  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (val === Object(val)) return 'object';

  return typeof val;
};

/**
 * Export validators
 */

module.exports = [
  validators.type,
  validators.required
];
