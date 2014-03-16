# mio

[![Build Status](https://secure.travis-ci.org/alexmingoia/mio.png)](http://travis-ci.org/alexmingoia/mio) 
[![Coverage Status](https://coveralls.io/repos/alexmingoia/mio/badge.png?branch=master)](https://coveralls.io/r/alexmingoia/mio?branch=master)
[![Bower version](https://badge.fury.io/bo/mio.png)](http://badge.fury.io/bo/mio)
[![NPM version](https://badge.fury.io/js/mio.png)](http://badge.fury.io/js/mio)
[![Dependency Status](https://david-dm.org/alexmingoia/mio.png)](http://david-dm.org/alexmingoia/mio)

Modern idiomatic models for the browser and node.js.

* Restrict enumerable properties to defined model attributes.
* Events emitted for initialization, attribute changes, errors, etc.
* Attribute validators and defaults.
* Computed properties (accessors) and sealed models.
* Usable seamlessly across the browser and server.
* Plugins specific to environment.
* Tests and MIT license.

## Installation

Using [npm][0]:

```sh
npm install mio
```

Using [component][1]:

```sh
component install alexmingoia/mio
```

Using [bower][2]:

```sh
bower install mio
```

## Usage

```javascript
var mio = require('mio');

var User = mio.createModel('user');

User
  .attr('id', {
    primary: true
  })
  .attr('name', {
    required: true
  })
  .attr('created_at', {
    required: true,
    default: function() {
      return new Date();
    }
  });

var user = new User({ name: 'alex' });
```

## Community

* [Plugins](https://github.com/alexmingoia/mio/wiki/Plugins/)
* [Wiki](https://github.com/alexmingoia/mio/wiki/)
* ##mio on irc.freenode.net

## Models

### mio.createModel(name)

Create new model constructor with given `name`.

### Model.attr(name[, options])

Define an attribute with given `name` and `options`.

```javascript
User.attr('created_at', {
  default: function() {
    return new Date();
  }
});
```

#### options

`default` default value or function returning value.
`filtered` if true prevents attribute from being enumerated
`get` getter function returning attribute value
`primary` use this attribute as primary key/id (must be unique)

### Model.use(fn)

Use a plugin function that extends the model. Function is called with `Model` as
the context and `Model` as the argument.

```javascript
User
  .use(require('example-plugin'))
  .browser(function() {
    this.use(require('mio-ajax'));
  })
  .server(function() {
    this.use(require('mio-mysql'));
  });
```

### Model.browser(fn)

Called when installed using bower or component.

### Model.server(fn)

Called when installed using npm.

### Model.type

```javascript
var User = mio.createModel('user');

console.log(User.type);
// => "User"
```

### Model.stores

Array of storage plugins for persistening models. See [Stores][4].

### Model.validators

Array of validator functions. Validation plugins should add their validator
function(s) here. See [Validators][5].

### Model.options

Plugins should use this object to store options.

### Model.find(id|query, callback)

```javascript
User.find(123, function(err, user) {
  // ...
});
```

### Model.findAll(query, callback)

```javascript
User.findAll({
  approved: true
}, function(err, collection) {
  console.log(collection);
  // => [user1, user2, user3, ...]
});
```

### Model.count(query, callback)

```javascript
User.count(function(err, count) {
  console.log(count);
  // => 47
});
```

### Model.removeAll(query, callback)

```javascript
User.removeAll({
  created: '2013-11-01'
}, function(err) {
  // ...
});
```

### Model#save(callback)

```javascript
user.save(function(err) {
  // ...
});
```

### Model#remove(callback)

```javascript
user.remove(function(err) {
  // ...
});
```

### Model#[attr]

### Model#isNew()

### Model#validate()
### Model#isValid()

Runs validators and returns a boolean of whether the model has errors.

### Model#isDirty()

Whether the model has attributes that have changed since last sav.

### Model#changed()

Return attributes changed since last save.

### Model#has(attribute)

### Model#error(message, extend)

Create error, add to `model.errors` array, and emit "error" event.

### Model#errors

Array of validation or other errors the model has encountered.

### Model#extras

A mutable object for saving extra information pertaining to the model instance.

### Events

#### Model events

`after remove`  
`after save`  
`attribute`     Receives arguments `name` and `params`.  
`before remove`  
`before save`  
`change`        Receives arguments `model`, `name`, `value`, and `prev`.  
`change:[attr]` Receives arguments `model`, `value`, and `prev`.  
`initializing`  Receives arguments `model` and `attributes`.  
`initialized`   Receives argument `model`.  
`setting`       Receives arguments `model` and `attributes`.  
`error`         Receives arguments `model` and `error`.  

#### Instance events

`after remove`  
`after save`  
`before remove`  
`before save`  
`change`        Receives arguments `name`, `value`, and `prev`.  
`change:[attr]` Receives arguments `value`, and `prev`.  
 `error`        Receives argument `error`.  
 `setting`      Receives argument `attributes`.  

## Plugins

Plugins are any function registered using `Model.use()`, `Model.browser()`, or `Model.server()`. Functions are invoked with the Model as both context and argument.

```javascript
User.use(function() {
  this.prototype.customModelMethod = function() {
    // ...
  };
});
```

There are two special types of plugins, known as stores and validators:

### Stores

Stores are plugins that persist models to storage layer(s).

A store exposes methods corresponding to `Model.find()`, `Model.findAll()`,
`Model.count()`, `Model.removeAll()`, `Model#save()`, and `Model#remove()`.

If querying for model(s), each store method is called until the model is found.
Conversely, for save and remove methods each store method is called unless an
error occurs.

See [mio-mysql][3] for an example of implementing a storage plugin.

### Validators

Validators are functions added to `Model.validators` array and called with the model instance as arguments. If a validation fails `Model#error()` is called, which adds to the `Model#errors` array. `Model#isValid()`, `Model#validate()`, and `Model#save()` all return the boolean representation of `Model#errors.length`.

```javascript
User.use(function() {
  this.validators.push(function(user) {
    if (typeof user.name !== 'string' || !user.name.length) {
      user.error("Username is required.");
    }
  });
});
```

## MIT Licensed

[0]: https://npmjs.org/
[1]: https://github.com/component/component/
[2]: http://bower.io/
[3]: https://github.com/alexmingoia/mio-mysql/
[4]: #stores
[5]: #validators
