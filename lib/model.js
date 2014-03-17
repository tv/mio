var noop = function() {};

try {
  var Emitter = require('emitter');
}
catch (e) {
  var Emitter = require('emitter-component');
}

/**
 * Create a new model with given `type`.
 *
 * @param {String} type
 * @param {Object} options
 * @return {AbstractModel}
 */

exports.createModel = function(type, options) {
  options = options || Object.create(null);

  // If visionmedia/co module is available, wrap callback methods to return
  // thunks for generator-based flow control.
  if (options.thunks !== false) {
    try {
      require.resolve('co');
      options.thunks = true;
    }
    catch (e) {};
  }

  // If when module is available, wrap callback methods to return promises
  if (options.promises !== false) {
    try {
      require.resolve('when');
      options.promises = true;
    }
    catch (e) {};
  }

  function Model(attributes) {
    if (!attributes) attributes = {};

    this.constructor.emit('initializing', this, attributes);

    Object.defineProperties(this, {
      // For EventEmitter
      _callbacks: {
        value: Object.create(null)
      },
      // Where we store attribute values
      attributes: {
        value: Object.create(null)
      },
      // Dirty attributes
      dirtyAttributes: {
        value: []
      },
      // Errors creating using `model.error()`
      errors: {
        value: []
      },
      // A mutable object for saving extra information
      extras: {
        value: Object.create(null),
        writable: true
      },
      // Primary key
      primary: {
        enumerable: false,
        get: function() {
          if (this.constructor.primaryKey) {
            return this[this.constructor.primaryKey];
          }
          else {
            throw new Error("Primary key has not been defined.");
          }
        },
        set: function(value) {
          if (this.constructor.primaryKey) {
            this[this.constructor.primaryKey] = value;
          }
          else {
            throw new Error("Primary key has not been defined.");
          }
        }
      }
    });

    // Create accessors for defined attributes
    Object.keys(this.constructor.attributes).forEach(function(name) {
      var params = this.constructor.attributes[name];

      if (params.relation === 'has many') {

      }

      Object.defineProperty(this, name, {
        get: params.get || function() {
          return this.attributes[name];
        },
        set: function(value) {
          var changed = this.attributes[name] !== value;

          if (changed) {
            var prev = this.attributes[name];
            this.attributes[name] = value;

            if (!~this.dirtyAttributes.indexOf(name)) {
              this.dirtyAttributes.push(name);
            }

            this.constructor.emit('change', this, name, value, prev);
            this.constructor.emit('change:' + name, this, value, prev);
            this.emit('change', name, value, prev);
            this.emit('change:' + name, value, prev);
          }
        },
        enumerable: params.enumerable === false || params.filtered ? false : true
      }, this);

      if (params.default !== undefined && this.attributes[name] === undefined) {
        if (attributes[name] === undefined) {
          attributes[name] = typeof params.default === 'function' ?
            params.default.call(this) :
            params.default;
        }
      }
      else {
        this.attributes[name] = null;
      }
    }, this);

    // Set initial attributes
    for (var name in attributes) {
      if (this.constructor.attributes[name]) {
        if (this.attributes[name] !== attributes[name]) {
          this.dirtyAttributes.push(name);
        }
        this.attributes[name] = attributes[name];
      }
    }

    Object.seal(this);

    this.constructor.emit('initialized', this);
  };

  Emitter(Model.prototype);
  Emitter(Model);

  Model.type = type.charAt(0).toUpperCase() + type.substr(1);
  Model.primaryKey = null;
  Model.attributes = Object.create(null);
  Model.relations = [];
  Model.options = options;
  Model.validators = [];
  Model.stores = [];

  Model.prototype.constructor = Model;

  // extend model
  for (var key in AbstractModel) {
    Model[key] = AbstractModel[key];
  }

  // extend model prototype
  for (var key in model) {
    Model.prototype[key] = model[key];
  }

  if (options.thunks || options.promises) {
    var somethingify = options.thunks ? thunkify : promisify;
    Model.findAll = somethingify(Model.findAll);
    Model.find = somethingify(Model.find);
    Model.count = somethingify(Model.count);
    Model.prototype.save = somethingify(Model.prototype.save);
    Model.prototype.remove = somethingify(Model.prototype.remove);
  }

  return Model;
};

/**
 * AbstractModel methods
 */

var AbstractModel = Object.create(null);

/**
 * Define a model attribute with the given `name` and `params`.
 *
 * Supported `options`:
 *
 *    - default     Provide default value or function that returns value.
 *    - filtered    Exclude attribute from enumeration.
 *    - get         Accessor function. Optional.
 *    - primary     Use attribute as primary key.
 *
 * @param {String} name
 * @param {Object} options
 * @return {AbstractModel}
 * @api public
 */

AbstractModel.attr = function(name, options) {
  if (this.attributes[name]) return this;

  options = options || Object.create(null);

  if (options.primary) {
    if (this.primaryKey) {
      throw new Error(
        "Primary attribute already exists: " + this.primaryKey
      );
    }
    this.primaryKey = name;
  }

  this.attributes[name] = options;

  this.emit('attribute', name, options);

  return this;
};

/**
 * Use a plugin function that extends the model.
 *
 *     User
 *       .use(require('example-plugin'))
 *       .server(function() {
 *         this.use(require('mio-mysql'));
 *       })
 *       .browser(function() {
 *         this.use(require('mio-ajax'));
 *       });
 *
 * @param {Function} plugin
 * @return {AbstractModel}
 * @api public
 */

AbstractModel.use = function(plugin) {
  plugin.call(this, this);
  return this;
};

/**
 * Use given `fn` only in browser.
 *
 * @param {Function} fn
 * @return {AbstractModel}
 * @api public
 */

AbstractModel.browser = function(fn) {
  if (require('is-browser')) {
    fn.call(this, this);
  }
  return this;
};

/**
 * Use given `fn` only in node.
 *
 * @param {Function} fn
 * @return {AbstractModel}
 * @api public
 */

AbstractModel.server = function(fn) {
  if (!require('is-browser')) {
    fn.call(this, this);
  }
  return this;
};

/**
 * Create a new model and hydrate with given `attrs`,
 * or if `attrs` is already a model return it.
 *
 * @param {Object} attrs
 * @return {AbstractModel}
 * @api public
 */

AbstractModel.create = function(attrs) {
  return (attrs instanceof this) ? attrs : new (this)(attrs);
};

/**
 * Find a model with given `id` or `query`.
 *
 * @param {Number|Object} query
 * @param {Function(err, model)} callback
 * @return {AbstractModel}
 * @api public
 */

AbstractModel.find = function(query, callback) {
  var Model = this;
  var i = 0;

  if (typeof query == 'number') {
    query = { id: query };
  }

  this.emit('before find', query);

  // Call each store's find method until we find the model.
  (function next(err, model) {
    if (err) return done(err);

    if (model || i === Model.stores.length) {
      done(null, model);
    }
    else {
      Model.stores[i++].find.call(Model, query, next);
    }
  })();

  // Handle result and emit `after find` event.
  function done(err, model) {
    if (err) return callback.call(Model, err);

    Model.emit('after find', model);

    callback.call(Model, null, model);
  };

  return this;
};

/**
 * Find collection of models using given `query`.
 *
 * @param {Object} query
 * @param {Function(err, collection)} callback
 * @return {AbstractModel}
 * @api public
 */

AbstractModel.findAll = function(query, callback) {
  var Model = this;
  var i = 0;

  if (typeof query === 'function') {
    callback = query;
    query = {};
  }

  this.emit('before findAll', query);

  // Call each store's findAll method until we have a result.
  (function next(err, collection) {
    if (err) return done(err);

    if ((collection && collection.length) || i === Model.stores.length) {
      done(null, collection);
    }
    else {
      Model.stores[i++].findAll.call(Model, query, next);
    }
  })();

  // Handle result and emit `after findAll` event.
  function done(err, collection) {
    if (err) return callback.call(Model, err);

    if (!collection) {
      collection = [];
    }

    Model.emit('after findAll', collection);
    callback.call(Model, null, collection);
  };

  return this;
};

/**
 * Count models using given `query`.
 *
 * @param {Object} query
 * @param {Function(err, count)} callback
 * @return {AbstractModel}
 * @api public
 */

AbstractModel.count = function(query, callback) {
  var Model = this;
  var i = 0;

  if (typeof query === 'function') {
    callback = query;
    query = {};
  }

  this.emit('before count', query);

  // Call each store's count method until we have a result.
  (function next(err, count) {
    if (err) return done(err);

    if (count !== undefined || i === Model.stores.length) {
      done(null, count);
    }
    else {
      Model.stores[i++].count.call(Model, query, next);
    }
  })();

  // Handle result and emit `after count` event.
  function done(err, count) {
    if (err) return callback.call(Model, err, count);

    if (count === undefined) {
      count = 0;
    }

    Model.emit('after count', count);

    callback.call(Model, null, count);
  };

  return this;
};

// Aliases
AbstractModel.all = AbstractModel.findAll;
AbstractModel.get = AbstractModel.find;
AbstractModel.findOne = AbstractModel.find;

/**
 * Model prototype
 */

var model = Object.create(null);

/**
 * Check if model is new and has not been saved.
 *
 * @return {Boolean}
 */

model.isNew = function() {
  if (this.constructor.primaryKey) {
    return !this[this.constructor.primaryKey];
  }
  else {
    throw this.error("Primary key has not been defined.");
  }
};

/**
 * Run model's validators and return whether the model has errors.
 *
 * @return {Boolean}
 */

model.validate = function() {
  this.errors.length = 0;

  this.constructor.validators.forEach(function(validator) {
    validator(this);
  }, this);

  return !this.errors.length;
};

/**
 * Alias for `model.validate()`.
 *
 * @return {Boolean}
 */

model.isValid = function() {
  return this.validate();
};

/**
 * Check if model is dirty (has any changed attributes)
 *
 * @return {Boolean}
 */

model.isDirty = function() {
  return this.dirtyAttributes.length > 0;
};

/**
 * Return attributes changed since last save.
 *
 * @return {Object}
 */

model.changed = function() {
  var changed = Object.create(null);

  for (var len = this.dirtyAttributes.length, i=0; i<len; i++) {
    var name = this.dirtyAttributes[i];
    if (this.constructor.attributes[name]) {
      changed[name] = this[name];
    }
  }

  return changed;
};

/**
 * Check if model has given `attr`.
 *
 * @param {String} attr
 * @return {Boolean}
 */

model.has = function(attr) {
  return this.constructor.attributes[attr] !== undefined;
};

/**
 * Set given model `attrs`.
 *
 * @param {Object} attrs
 * @return {Model}
 */

model.set = function(attrs) {
  this.constructor.emit('setting', this, attrs);
  this.emit('setting', attrs);

  for (var attr in attrs) {
    if (this.constructor.attributes[attr]) {
      this[attr] = attrs[attr];
    }
  }

  return this;
};

/**
 * Create error for model with given `message`, add it to `model.errors` array,
 * and emit "error" event.
 *
 * @param {String} message
 * @param {Object} extend optional - extend error object
 * @return {Error}
 */

model.error = function(message, extend) {
  var error = new Error(message);

  if (extend) {
    for (var key in extend) {
      error[key] = extend[key];
    }
  }

  this.errors.push(error);

  this.constructor.emit('error', this, error);
  this.emit('error', error);

  return error;
};

/**
 * Save model.
 *
 * @param {Function(err)} callback
 * @return {Model}
 */

model.save = function(callback) {
  if (!callback) callback = noop;

  var model = this;
  var i = 0;

  var changed = this.changed();

  this.constructor.emit('before save', this, changed);
  this.emit('before save', changed);

  // If we're already saved, execute callback immediately.
  if (this.primary && !this.isDirty()) {
    return done();
  }

  // Validate before saving
  if (!this.validate()) {
    return done(this.error("Validations failed.", {
      errors: this.errors.slice(0)
    }));
  }

  next();

  // Call each store's save method.
  function next(err) {
    if (err) return done(err);

    if (i === model.constructor.stores.length) {
      done(null);
    }
    else {
      model.constructor.stores[i++].save.call(model, changed, next);
    }
  };

  function done(err) {
    if (err) return callback.call(model, err);

    model.dirtyAttributes.length = 0;

    model.constructor.emit('after save', model);
    model.emit('after save');

    callback.call(model);
  };

  return this;
};

/**
 * Remove model.
 *
 * @param {Function(err)} callback
 * @return {Model}
 */

model.remove = function(callback) {
  if (!callback) callback = function() {};

  var model = this;
  var i = 0;

  this.constructor.emit('before remove', this);
  this.emit('before remove');

  // Call each store's remove method.
  (function next(err) {
    if (err) return done(err);

    if (i === model.constructor.stores.length) {
      done();
    }
    else {
      model.constructor.stores[i++].remove.call(model, next);
    }
  })();

  function done(err) {
    if (err) return callback.call(model, err);

    // Set primary key to null
    model.attributes[model.constructor.primaryKey] = null;

    model.constructor.emit('after remove', model);
    model.emit('after remove');

    callback.call(model);
  };

  return this;
};

/**
 * Wrap function to return thunk.
 *
 * Assumes `fn`'s last argument is a node-style callback.
 *
 * @see https://github.com/visionmedia/co/#thunks-vs-promises
 * @param {Function} fn
 * @return {Function}
 * @api private
 */

function thunkify(fn) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    var ctx = this;

    return function(cb) {
      args.push(cb);
      fn.apply(ctx, args);
    };
  };
};

/**
 * Wrap functions to return promise.
 *
 * Assumes `fn`'s last argument is a node-style callback.
 *
 * @see https://github.com/cujojs/when/
 * @param {Function} fn
 * @param {Function}
 * @api private
 */

function promisify(fn) {
  var when = require('when');

  return function() {
    var args = Array.prototype.slice.call(arguments);
    var ctx = this;

    // If the last argument is a function, assume a promise is not intended.
    if (typeof args[args.length - 1] === 'function') {
      return fn.apply(ctx, args);
    }

    return when.promise(function(resolve, reject, notify) {
      args.push(function(err, val) {
        if (err) return reject(err);
        resolve(val);
      });

      fn.apply(ctx, args);
    });
  };
};
