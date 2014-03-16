var noop = function() {}
  , validators = require('./validators');

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
  Model.validators = validators.slice(0);
  Model.adapter = Object.create(null);

  Model.prototype.constructor = Model;

  // extend model
  for (var key in AbstractModel) {
    Model[key] = AbstractModel[key];
  }

  // extend model prototype
  for (var key in model) {
    Model.prototype[key] = model[key];
  }

  if (options.thunks) {
    Model.findAll = thunkify(Model.findAll);
    Model.find = thunkify(Model.find);
    Model.count = thunkify(Model.count);
    Model.removeAll = thunkify(Model.removeAll);
    Model.prototype.save = thunkify(Model.prototype.save);
    Model.prototype.remove = thunkify(Model.prototype.remove);
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
 */

AbstractModel.server = function(fn) {
  if (!require('is-browser')) {
    fn.call(this, this);
  }
  return this;
};

/**
 * Create a new model using given `attrs`. Convenience method for chaining.
 *
 * @param {Object} attrs
 * @return {AbstractModel}
 */

AbstractModel.create = function(attrs) {
  return (attrs instanceof this) ? attrs : new (this)(attrs);
};

/**
 * Find a model with given `id` or `query`.
 *
 * @param {Number|Object} query
 * @param {Function(err, model)} callback
 * @api public
 */

AbstractModel.find = function(query, callback) {
  if (typeof query == 'number') {
    query = { id: query };
  }

  this.emit('before find', query);

  var done = function(err, attributes) {
    if (err) return callback.call(this, err);

    var model;
    if (attributes) {
      model = new (this)(attributes);
      model.dirtyAttributes.length = 0;
    }

    this.emit('after find', model);

    callback.call(this, null, model);
  }.bind(this);

  // Call adapter's find method, if it exists.
  this.adapter.find ? this.adapter.find.call(this, query, done) : done();

  return this;
};

/**
 * Find collection of models using given `query`.
 *
 * @param {Object} query
 * @param {Function(err, collection)} callback
 * @api public
 */

AbstractModel.findAll = function(query, callback) {
  if (typeof query === 'function') {
    callback = query;
    query = {};
  }

  this.emit('before findAll', query);

  var done = function(err, collection) {
    if (err) return callback.call(this, err);

    if (!collection) {
      collection = [];
      // Pagination information.
      collection.total = collection.length;
      collection.offset = query.offset || 0;
      collection.limit = query.limit || 50;
    }

    // Create and hydrate models from results
    for (var len = collection.length, i=0; i<len; i++) {
      collection[i] = new (this)(collection[i]);
      collection[i].dirtyAttributes.length = 0;
    }

    this.emit('after findAll', collection);

    callback.call(this, null, collection);
  }.bind(this);

  // Call adapter's findAll method, if it exists.
  var findAll = this.adapter.findAll;
  findAll ? findAll.call(this, query, done) : done();
};

/**
 * Count models using given `query`.
 *
 * @param {Object} query
 * @param {Function(err, count)} callback
 * @api public
 */

AbstractModel.count = function(query, callback) {
  if (typeof query === 'function') {
    callback = query;
    query = {};
  }

  this.emit('before count', query);

  var done = function(err, count) {
    count = count || 0;

    if (err) return callback.call(this, err, count);

    this.emit('after count', count);

    callback.call(this, null, count);
  }.bind(this);

  // Call adapter's count method, if it exists.
  var count = this.adapter.count;
  count ? count.call(this, query, done) : done();
};

/**
 * Remove models using given `query`.
 *
 * @param {Object} query
 * @param {Function(err, count)} callback
 * @api public
 */

AbstractModel.removeAll = function(query, callback) {
  if (typeof query === 'function') {
    callback = query;
    query = {};
  }

  this.emit('before removeAll', query);

  var done = function(err) {
    if (err) return callback.call(this, err);
    this.emit('after removeAll');
    callback.call(this, null);
  }.bind(this);

  // Call adapter's count method, if it exists.
  var removeAll = this.adapter.removeAll;
  removeAll ? removeAll.call(this, query, done) : done();
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

  var changed = this.changed();

  this.constructor.emit('before save', this, changed);
  this.emit('before save', changed);

  var done = function(err, attributes) {
    if (err) return callback.call(this, err);

    if (attributes) {
      for (var name in attributes) {
        if (this.constructor.attributes[name]) {
          this.attributes[name] = attributes[name];
        }
      }
    }

    this.dirtyAttributes.length = 0;

    this.constructor.emit('after save', this);
    this.emit('after save');
    callback.call(this);
  }
  .bind(this);

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

  // Call our storage adapter's save method, if it exists.
  var save = this.constructor.adapter.save;
  save ? save.call(this, changed, done) : done();

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

  this.constructor.emit('before remove', this);
  this.emit('before remove');

  var done = function(err) {
    if (err) return callback.call(this, err);

    // Set primary key to null
    this.attributes[this.constructor.primaryKey] = null;

    this.constructor.emit('after remove', this);
    this.emit('after remove');
    callback.call(this);
  }
  .bind(this);

  // Call our storage adapter's remove method, if it exists.
  var remove = this.constructor.adapter.remove;
  remove ? remove.call(this, done) : done();

  return this;
};

/**
 * Wrap function to return thunk.
 *
 * See https://github.com/visionmedia/co/#thunks-vs-promises
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
