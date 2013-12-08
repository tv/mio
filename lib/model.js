try {
  var Emitter = require('emitter');
}
catch (e) {
  var Emitter = require('emitter-component');
}

var utils = require('./utils');

/**
 * Create Model with given `type`.
 *
 * @param {String} type
 * @return {Model}
 * @api public
 */

exports.createModel = function(type) {
  function Model(attributes) {
    this.constructor.emit('initializing', this, attributes || {});

    Object.defineProperties(this, {
      // Where we store attribute values
      attributes: {
        value: Object.create(null)
      },
      // Dirty attributes
      dirtyAttributes: {
        value: []
      },
      // For EventEmitter
      _callbacks: {
        value: Object.create(null)
      },
      // Get primary key
      primary: {
        get: function() {
          if (this.constructor.primaryKey) {
            return this[this.constructor.primaryKey];
          }
          else {
            throw utils.modelError("Primary key has not been defined.", this);
          }
        }
      },
      errors: {
        value: []
      }
    });

    // Create accessors for defined attributes
    utils.forEachObj(this.constructor.attributes, function(name) {
      var params = this.constructor.attributes[name];

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
        enumerable: true
      });

      if (params.default && this.attributes[name] === undefined) {
        this.attributes[name] = typeof params.default === 'function' ?
          params.default.call(this) :
          params.default;
      }
    }, this);

    // Set initial attributes
    if (attributes) {
      for (var name in attributes) {
        if (this.constructor.attributes[name]) {
          this.attributes[name] = attributes[name];
        }
      }
    }

    Object.seal(this);

    this.constructor.emit('initialized', this);
  };

  Model.prototype = {
    constructor: Model,
    isNew: function() {
      if (this.constructor.primaryKey) {
        return !this[this.constructor.primaryKey];
      }
      else {
        throw utils.modelError("Primary key has not been defined.", this);
      }
    },
    isValid: function() {
      this.errors.length = 0;
      for (var len = this.constructor.validators.length, i=0; i<len; i++) {
        this.constructor.validators[i].call(this, this);
      }
      return !this.errors.length;
    },
    isDirty: function() {
      return this.dirtyAttributes.length > 0;
    },
    /**
     * Return attributes changed since last save.
     */
    changed: function() {
      var changed = Object.create(null);

      for (var len = this.dirtyAttributes.length, i=0; i<len; i++) {
        var name = this.dirtyAttributes[i];
        if (this.constructor.attributes[name]) {
          changed[name] = this[name];
        }
      }

      return changed;
    },
    has: function(attr) {
      return this.constructor.attributes[attr] !== undefined;
    },
    set: function(attrs) {
      this.constructor.emit('setting', this, attrs);
      this.emit('setting', attrs);
      for (var attr in attrs) {
        if (this.constructor.attributes[attr]) {
          this[attr] = attrs[attr];
        }
      }
      return this;
    },
    error: function(message, attribute) {
      var error = new Error(message);
      error.model = this;
      error.attribute = attribute;
      this.errors.push(error);
      this.constructor.emit('error', this, error);
      this.emit('error', error);
      return error;
    },
    save: function(callback) {
      if (!callback) callback = function() {};

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
      }.bind(this);

      // If we're already saved, execute callback immediately.
      if (this.primary && !this.isDirty()) {
        return done();
      }

      // Validate before saving
      if (!this.isValid()) {
        var error = new Error("Validations failed.");
        error.model = this;
        throw error;
      }

      // Call our storage adapter's save method, if it exists.
      var save = this.constructor.adapter.save;
      save ? save.call(this, changed, done) : done();

      return this;
    },
    remove: function(callback) {
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
      }.bind(this);

      // Call our storage adapter's remove method, if it exists.
      var remove = this.constructor.adapter.remove;
      remove ? remove.call(this, this.primary, done) : done();

      return this;
    },
    /**
     * Return query methods specific to given relation `name`.
     */
    related: function(name) {
      var model = this;
      var relation = this.constructor.relations[name];
      if (!relation) {
        throw new Error("Relation " + name + " not defined.");
      }

      return {
        add: function(related, callback) {
          if (!(related instanceof Array)) {
            related = Array.prototype.slice.call(arguments);
            callback = related.pop();
          }

          var add = model.constructor.adapter.add;
          add ? add.call(model, related, callback) : callback(new Error(
            "No storage adapter or no storage adapter support for this method."
          ));

          return model;
        },
        all: function(query, callback) {
          if (typeof query === 'function') {
            callback = query;
            query = {};
          }

          query.relation = relation;

          var findAll = model.constructor.findAll;
          findAll ? findAll.call(model.constructor, query, callback) : callback(new Error(
            "No storage adapter or no storage adapter support for this method."
          ));

          return model;
        },
        count: function(query, callback) {
          if (typeof query === 'function') {
            callback = query;
            query = {};
          }

          query.relation = relation;

          var count = model.constructor.count;
          count ? count.call(model.constructor, query, callback) : callback(new Error(
            "No storage adapter or no storage adapter support for this method."
          ));

          return model;
        },
        create: function(attributes, callback) {
          if (typeof attributes === 'function') {
            callback = attributes;
            attributes = Object.create(null);
          }

          var related = new relation.anotherModel(attributes);

          if (relation.through) {
            related.save(function(err) {
              if (err) return callback.call(model, err);
              model.related(name).add(related, function(err) {
                if (err) return callback.call(model, err);
                callback.call(model, null, related);
              });
            });
          }
          else {
            related.save(function(err) {
              if (err) return callback.call(model, err);
              model[relation.foreignKey] = related.primary;
              model.save(function(err) {
                if (err) return callback.call(model, err);
                callback.call(model, null, related);
              });
            });
          }

          return model;
        },
        get: function(query, callback) {
          if (typeof query === 'function') {
            callback = query;
            query = {};
          }

          query.relation = relation;

          var find = model.constructor.find;
          find ? find.call(model.constructor, query, callback) : callback(new Error(
            "No storage adapter or no storage adapter support for this method."
          ));

          return model;
        },
        has: function(related, callback) {
          var has = model.constructor.adapter.has;
          has ? has.call(model, related, callback) : callback(new Error(
            "No storage adapter or no storage adapter support for this method."
          ));

          return model;
        },
        remove: function(related, callback) {
          if (!(related instanceof Array)) {
            related = Array.prototype.slice.call(arguments);
            callback = related.pop();
          }

          var remove = model.constructor.adapter.removeRelated;
          remove ? remove.call(model, related, callback) : callback(new Error(
            "No storage adapter or no storage adapter support for this method."
          ));

          return model;
        }
      };
    }
  };

  Model.type = type.charAt(0).toUpperCase() + type.substr(1);
  Model.primaryKey = null;
  Model.attributes = Object.create(null);
  Model.relations = Object.create(null);
  Model.options = Object.create(null);
  Model.validators = [];
  Array.prototype.push.apply(
    Model.validators,
    require('./validators').validators
  );
  Model.adapter = Object.create(null);

  /**
   * Define a model attribute with the given `name` and `params`.
   *
   * `params` supports the following options:
   *
   *    - primary     Use this attribute as primary key.
   *    - default     Provide default value or function that returns value.
   *    - get         Accessor function. Optional.
   */

  Model.attr = function(name, params) {
    if (this.attributes[name]) return this;

    params = params || Object.create(null);

    if (params.primary) {
      if (this.primaryKey) {
        throw utils.modelError(
          "Primary attribute already exists: " + this.primaryKey, this
        );
      }
      this.primaryKey = name;
    }

    this.attributes[name] = params;

    this.emit('attribute', name, params);
    return this;
  };

  /**
   * Use a plugin function that extends the model.
   */

  Model.use = function(fn) {
    fn.call(this, this);
    return this;
  };

  /**
   * Create a new model and hydrate using an existing object.
   */

  Model.create = function(attrs) {
    return (attrs instanceof this) ? attrs : new (this)(attrs);
  };

  /**
   * Find a model with given `id` or `query`.
   *
   * @param {Number|Object} query
   * @param {Function(err, model)} callback
   * @api public
   */

  Model.find = Model.findOne = Model.get = function(query, callback) {
    if (typeof query == 'number') {
      query = { id: query };
    }

    var done = function(err, attributes) {
      if (err) return callback.call(this, err);

      var model;
      if (attributes) {
        model = new (this)(attributes);
      }

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

  Model.findAll = Model.all = function(query, callback) {
    if (typeof query === 'function') {
      callback = query;
      query = {};
    }

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
      }

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

  Model.count = Model.countAll = function(query, callback) {
    if (typeof query === 'function') {
      callback = query;
      query = {};
    }

    var done = function(err, count) {
      count = count || 0;

      if (err) return callback.call(this, err, count);

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

  Model.removeAll = Model.destroyAll = function(query, callback) {
    if (typeof query === 'function') {
      callback = query;
      query = {};
    }

    var done = function(err) {
      if (err) return callback.call(this, err);
      callback.call(this, null);
    }.bind(this);

    // Call adapter's count method, if it exists.
    var removeAll = this.adapter.removeAll;
    removeAll ? removeAll.call(this, query, done) : done();
  };

  /**
   * Define a "has many" relationship.
   *
   * @example
   *
   *     User.hasMany(Post, { as: 'posts', foreignKey: 'user_id' });
   *
   *     user.related('posts').all(function(err, posts) {
   *       // ...
   *     });
   *
   *     var post = user.related('posts').create();
   *
   * @param {Model} anotherModel
   * @param {Object} params The `foreignKey` name is required.
   * @api public
   */

  Model.hasMany = function(anotherModel, params) {
    if (typeof anotherModel === 'string') {
      params.as = anotherModel;
      anotherModel = params.model;
    }

    params.type = 'has many';
    params.anotherModel = anotherModel;
    params.model = this;

    if (!params.as) {
      params.as = anotherModel.type.toLowerCase() + 's';
    }

    this.relations[params.as] = params;
    anotherModel.relations[params.as] = params;

    return this;
  };

  /**
   * Define a "belongs to" relationship.
   *
   * @example
   *
   *     Post.belongsTo(User, { as: 'author', foreignKey: 'userId' });
   *
   *     post.related('author').get(function(err, user) {
   *       // ...
   *     });
   *
   * @param {Model} Owner
   * @param {Object} params The `foreignKey` name is required.
   * @api public
   */

  Model.belongsTo = function(anotherModel, params) {
    if (!params.as) {
      params.as = anotherModel.type.toLowerCase() + 's';
    }

    params.type = 'belongs to';
    params.anotherModel = anotherModel;
    params.model = this;

    this.relations[params.as] = params;
    anotherModel.relations[params.as] = params;

    return this;
  };

  /**
   * Define a "has and belongs to many" relationship.
   *
   * @example
   *
   *     Post.hasAndBelongsToMany(Tag, {
   *       as: 'tags',
   *       through: PostTag,
   *       fromKey: 'post_id',
   *       toKey: 'tag_id'
   *     });
   *
   *     post.related('tags').all(function(err, tags) {
   *       // ...
   *     });
   *
   *     tag.related('posts').all(function(err, posts) {
   *       // ...
   *     });
   *
   * @param {Model} Model
   * @param {Object} params
   * @api public
   */

  Model.hasAndBelongsToMany = function(anotherModel, params) {
    if (typeof anotherModel === 'string') {
      params.as = anotherModel;
      anotherModel = params.model;
    }

    if (!params.as) {
      params.as = anotherModel.type.toLowerCase() + 's';
    }
    if (!params.fromKey) {
      params.fromKey = (this.type + '_' + this.primaryKey).toLowerCase();
    }
    if (!params.toKey) {
      params.toKey = (anotherModel.type + '_' + anotherModel.primaryKey).toLowerCase();
    }

    if (!params.through) {
      var name = this.type + anotherModel.type;
      if (this.type > anotherModel.type) {
        name = anotherModel.type + this.type;
      }
      params.through = exports.createModel(name);
      params.through.options.tableName = this.type + '_' + anotherModel.type;
      if (this.type > anotherModel.type) {
        params.through.options.tableName = (anotherModel.type + '_' + this.type).toLowerCase();
      }
    }

    params.through.belongsTo(this, { foreignKey: params.fromKey });
    params.through.belongsTo(anotherModel, { foreignKey: params.toKey });

    this.hasMany(anotherModel, {
      as: params.as,
      foreignKey: params.fromKey,
      through: params.through,
      throughKey: params.toKey
    });

    return this;
  };

  Emitter(Model.prototype);
  Emitter(Model);

  return Model;
};