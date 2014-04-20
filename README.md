# mio

[![Build Status](https://secure.travis-ci.org/alexmingoia/mio.png)](http://travis-ci.org/alexmingoia/mio) 
[![Coverage Status](https://coveralls.io/repos/alexmingoia/mio/badge.png?branch=master)](https://coveralls.io/r/alexmingoia/mio?branch=master)
[![Bower version](https://badge.fury.io/bo/mio.png)](http://badge.fury.io/bo/mio)
[![NPM version](https://badge.fury.io/js/mio.png)](http://badge.fury.io/js/mio)
[![Dependency Status](https://david-dm.org/alexmingoia/mio.png)](http://david-dm.org/alexmingoia/mio)

Modern idiomatic models for the browser and node.js.

* Promise and co/generator support
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

## Example

```javascript
var User = require('mio').createModel('user');

User
  .attr('id', {
    primary: true
  })
  .attr('name')
  .attr('created_at', {
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

## API

### mio.createModel(name[, options])

Create new model constructor with given `name` and `options`.

Options:

* `thunks` If true, wraps methods to return thunks for
  use with visionmedia/co (default:false).
* `promises` Use function to wrap methods to return promises (default: false).

```javascript
var User = require('mio').createModel('user');
```

With promises using [then/promise](https://github.com/then/promise):

```javascript
Var User = require('mio').createModel('user', {
  promisify: function(fn) {
    return require('promise).denodeify(fn);
  }
});

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

### Model#isDirty()

Whether the model has attributes that have changed since last sav.

### Model#changed()

Return attributes changed since last save.

### Model#has(attribute)

### Model#extras

A mutable object for saving extra information pertaining to the model instance.

### Hooks

Hooks are asynchronous function(s) run before or after other model methods.

```javascript
User.before('save', function(model, next) {
  if (typeof model.name !== 'string' || model.name.length < 2) {
    return next(new Error("Name must be longer than 1 character."));
  }
  next();
});

var user = new User({ name: 'A' });

user.save(function(err) {
  console.log(err.message);
  // => "Name must be longer than 1 character."
});
```

Hooks are run in series in the order they have been declared. They receive the
same arguments as the method your are hooking.

If a hook passes an error to its
callback, subsequent hooks are not executed and the hooked method's callback is
invoked with the error.

#### Model.before(method, fn)

Call `fn` before `method` is executed. See [Hooks](#hooks).

Valid methods to hook are `find`, `findAll`, `count`, `save`, and `remove`.

#### Model.after(method, fn)

Call `fn` after `method` is executed. See [Hooks](#hooks).

Valid methods to hook are `find`, `findAll`, `count`, `save`, and `remove`.

### Plugins

Plugins are any function registered using `Model.use()`, `Model.browser()`, or `Model.server()`.
Functions are invoked with the Model as both context and argument.

```javascript
User.use(function() {
  this.prototype.customModelMethod = function() {
    // ...
  };
});
```

### Stores

Stores are plugins that persist models to storage layer(s).

If querying for model(s), each store method is called until the model is found.
Conversely, for save and remove methods each store method is called unless an
error occurs.

See [mio-mysql][3] for an example of implementing a storage plugin.

#### Model.find.use(fn)

Use `fn` to find model.

#### Model.findAll.use(fn)

Use `fn` to find collection of models.

#### Model.count.use(fn)

Use `fn` to return count of model.

#### Model.save.use(fn)

Use `fn` to persist model in storage.

#### Model.remove.use(fn)

Use `fn` to remove model from storage.

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

## MIT Licensed

[0]: https://npmjs.org/
[1]: https://github.com/component/component/
[2]: http://bower.io/
[3]: https://github.com/alexmingoia/mio-mysql/
[4]: #stores
[5]: https://github.com/visionmedia/co/
[6]: https://github.com/cujojs/when/
