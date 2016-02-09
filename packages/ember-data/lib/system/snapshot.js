/**
  @module ember-data
*/

var get = Ember.get;
import {
  keysFunc
} from 'ember-data/system/object-polyfills';

import EmptyObject from "ember-data/system/empty-object";

/**
  @class Snapshot
  @namespace DS
  @private
  @constructor
  @param {DS.Model} internalModel The model to create a snapshot from
*/
function Snapshot(internalModel) {
  this._attributes = new EmptyObject();
  this._belongsToRelationships = new EmptyObject();
  this._belongsToIds = new EmptyObject();
  this._hasManyRelationships = new EmptyObject();
  this._hasManyIds = new EmptyObject();

  var record = internalModel.getRecord();
  this.record = record;
  record.eachAttribute(function(keyName) {
    this._attributes[keyName] = get(record, keyName);
  }, this);

  this.id = internalModel.id;
  this._internalModel = internalModel;
  this.type = internalModel.type;
  this.modelName = internalModel.type.modelName;

  this._changedAttributes = record.changedAttributes();

  // The following code is here to keep backwards compatibility when accessing
  // `constructor` directly.
  //
  // With snapshots you should use `type` instead of `constructor`.
  //
  // Remove for Ember Data 1.0.
  if (Ember.platform.hasPropertyAccessors) {
    var callDeprecate = true;

    Ember.defineProperty(this, 'constructor', {
      get: function() {
        // Ugly hack since accessing error.stack (done in `Ember.deprecate()`)
        // causes the internals of Chrome to access the constructor, which then
        // causes an infinite loop if accessed and calls `Ember.deprecate()`
        // again.
        if (callDeprecate) {
          callDeprecate = false;
          Ember.deprecate('Usage of `snapshot.constructor` is deprecated, use `snapshot.type` instead.', false, {
            id: 'ds.snapshot.constructor-deprecator',
            until: '2.0.0'
          });
          callDeprecate = true;
        }

        return this.type;
      }
    });
  } else {
    this.constructor = this.type;
  }
}

Snapshot.prototype = {
  constructor: Snapshot,

  /**
    The id of the snapshot's underlying record

    Example

    ```javascript
    // store.push('post', { id: 1, author: 'Tomster', title: 'Ember.js rocks' });
    postSnapshot.id; // => '1'
    ```

    @property id
    @type {String}
  */
  id: null,

  /**
    The underlying record for this snapshot. Can be used to access methods and
    properties defined on the record.

    Example

    ```javascript
    var json = snapshot.record.toJSON();
    ```

    @property record
    @type {DS.Model}
  */
  record: null,

  /**
    The type of the underlying record for this snapshot, as a DS.Model.

    @property type
    @type {DS.Model}
  */
  type: null,

  /**
    The name of the type of the underlying record for this snapshot, as a string.

    @property modelName
    @type {String}
  */
  modelName: null,

  /**
    Returns the value of an attribute.

    Example

    ```javascript
    // store.push('post', { id: 1, author: 'Tomster', title: 'Ember.js rocks' });
    postSnapshot.attr('author'); // => 'Tomster'
    postSnapshot.attr('title'); // => 'Ember.js rocks'
    ```

    Note: Values are loaded eagerly and cached when the snapshot is created.

    @method attr
    @param {String} keyName
    @return {Object} The attribute value or undefined
  */
  attr: function(keyName) {
    if (keyName in this._attributes) {
      return this._attributes[keyName];
    }
    throw new Ember.Error("Model '" + Ember.inspect(this.record) + "' has no attribute named '" + keyName + "' defined.");
  },

  /**
    Returns all attributes and their corresponding values.

    Example

    ```javascript
    // store.push('post', { id: 1, author: 'Tomster', title: 'Ember.js rocks' });
    postSnapshot.attributes(); // => { author: 'Tomster', title: 'Ember.js rocks' }
    ```

    @method attributes
    @return {Object} All attributes of the current snapshot
  */
  attributes: function() {
    return Ember.copy(this._attributes);
  },

  /**
    Returns all changed attributes and their old and new values.

    Example

    ```javascript
    // store.push('post', { id: 1, author: 'Tomster', title: 'Ember.js rocks' });
    postModel.set('title', 'Ember.js rocks!');
    postSnapshot.changedAttributes(); // => { title: ['Ember.js rocks', 'Ember.js rocks!'] }
    ```

    @method changedAttributes
    @return {Object} All changed attributes of the current snapshot
  */
  changedAttributes: function() {
    let changedAttributes = new EmptyObject();
    let changedAttributeKeys = keysFunc(this._changedAttributes);

    for (let i=0, length = changedAttributeKeys.length; i < length; i++) {
      let key = changedAttributeKeys[i];
      changedAttributes[key] = Ember.copy(this._changedAttributes[key]);
    }

    return changedAttributes;
  },

  /**
    Returns the current value of a belongsTo relationship.

    `belongsTo` takes an optional hash of options as a second parameter,
    currently supported options are:

   - `id`: set to `true` if you only want the ID of the related record to be
      returned.

    Example

    ```javascript
    // store.push('post', { id: 1, title: 'Hello World' });
    // store.createRecord('comment', { body: 'Lorem ipsum', post: post });
    commentSnapshot.belongsTo('post'); // => DS.Snapshot
    commentSnapshot.belongsTo('post', { id: true }); // => '1'

    // store.push('comment', { id: 1, body: 'Lorem ipsum' });
    commentSnapshot.belongsTo('post'); // => undefined
    ```

    Calling `belongsTo` will return a new Snapshot as long as there's any known
    data for the relationship available, such as an ID. If the relationship is
    known but unset, `belongsTo` will return `null`. If the contents of the
    relationship is unknown `belongsTo` will return `undefined`.

    Note: Relationships are loaded lazily and cached upon first access.

    @method belongsTo
    @param {String} keyName
    @param {Object} [options]
    @return {(DS.Snapshot|String|null|undefined)} A snapshot or ID of a known
      relationship or null if the relationship is known but unset. undefined
      will be returned if the contents of the relationship is unknown.
  */
  belongsTo: function(keyName, options) {
    var id = options && options.id;
    var relationship, inverseRecord, hasData;
    var result;

    if (id && keyName in this._belongsToIds) {
      return this._belongsToIds[keyName];
    }

    if (!id && keyName in this._belongsToRelationships) {
      return this._belongsToRelationships[keyName];
    }

    relationship = this._internalModel._relationships.get(keyName);
    if (!(relationship && relationship.relationshipMeta.kind === 'belongsTo')) {
      throw new Ember.Error("Model '" + Ember.inspect(this.record) + "' has no belongsTo relationship named '" + keyName + "' defined.");
    }

    hasData = get(relationship, 'hasData');
    inverseRecord = get(relationship, 'inverseRecord');

    if (hasData) {
      if (inverseRecord && !inverseRecord.isDeleted()) {
        if (id) {
          result = get(inverseRecord, 'id');
        } else {
          result = inverseRecord.createSnapshot();
        }
      } else {
        result = null;
      }
    }

    if (id) {
      this._belongsToIds[keyName] = result;
    } else {
      this._belongsToRelationships[keyName] = result;
    }

    return result;
  },

  /**
    Returns the current value of a hasMany relationship.

    `hasMany` takes an optional hash of options as a second parameter,
    currently supported options are:

   - `ids`: set to `true` if you only want the IDs of the related records to be
      returned.

    Example

    ```javascript
    // store.push('post', { id: 1, title: 'Hello World', comments: [2, 3] });
    postSnapshot.hasMany('comments'); // => [DS.Snapshot, DS.Snapshot]
    postSnapshot.hasMany('comments', { ids: true }); // => ['2', '3']

    // store.push('post', { id: 1, title: 'Hello World' });
    postSnapshot.hasMany('comments'); // => undefined
    ```

    Note: Relationships are loaded lazily and cached upon first access.

    @method hasMany
    @param {String} keyName
    @param {Object} [options]
    @return {(Array|undefined)} An array of snapshots or IDs of a known
      relationship or an empty array if the relationship is known but unset.
      undefined will be returned if the contents of the relationship is unknown.
  */
  hasMany: function(keyName, options) {
    var ids = options && options.ids;
    var relationship, members, hasData;
    var results;

    if (ids && keyName in this._hasManyIds) {
      return this._hasManyIds[keyName];
    }

    if (!ids && keyName in this._hasManyRelationships) {
      return this._hasManyRelationships[keyName];
    }

    relationship = this._internalModel._relationships.get(keyName);
    if (!(relationship && relationship.relationshipMeta.kind === 'hasMany')) {
      throw new Ember.Error("Model '" + Ember.inspect(this.record) + "' has no hasMany relationship named '" + keyName + "' defined.");
    }

    hasData = get(relationship, 'hasData');
    members = get(relationship, 'members');

    if (hasData) {
      results = [];
      members.forEach(function(member) {
        if (!member.isDeleted()) {
          if (ids) {
            results.push(member.id);
          } else {
            results.push(member.createSnapshot());
          }
        }
      });
    }

    if (ids) {
      this._hasManyIds[keyName] = results;
    } else {
      this._hasManyRelationships[keyName] = results;
    }

    return results;
  },

  /**
    Iterates through all the attributes of the model, calling the passed
    function on each attribute.

    Example

    ```javascript
    snapshot.eachAttribute(function(name, meta) {
      // ...
    });
    ```

    @method eachAttribute
    @param {Function} callback the callback to execute
    @param {Object} [binding] the value to which the callback's `this` should be bound
  */
  eachAttribute: function(callback, binding) {
    this.record.eachAttribute(callback, binding);
  },

  /**
    Iterates through all the relationships of the model, calling the passed
    function on each relationship.

    Example

    ```javascript
    snapshot.eachRelationship(function(name, relationship) {
      // ...
    });
    ```

    @method eachRelationship
    @param {Function} callback the callback to execute
    @param {Object} [binding] the value to which the callback's `this` should be bound
  */
  eachRelationship: function(callback, binding) {
    this.record.eachRelationship(callback, binding);
  },

  /**
    @method get
    @param {String} keyName
    @return {Object} The property value
    @deprecated Use [attr](#method_attr), [belongsTo](#method_belongsTo) or [hasMany](#method_hasMany) instead
  */
  get: function(keyName) {
    Ember.deprecate('Using DS.Snapshot.get() is deprecated. Use .attr(), .belongsTo() or .hasMany() instead.', false, {
      id: 'ds.snapshot.get-deprecated',
      until: '2.0.0'
    });

    if (keyName === 'id') {
      return this.id;
    }

    if (keyName in this._attributes) {
      return this.attr(keyName);
    }

    var relationship = this._internalModel._relationships.get(keyName);

    if (relationship && relationship.relationshipMeta.kind === 'belongsTo') {
      return this.belongsTo(keyName);
    }
    if (relationship && relationship.relationshipMeta.kind === 'hasMany') {
      return this.hasMany(keyName);
    }

    return get(this.record, keyName);
  },

  /**
    @method serialize
    @param {Object} options
    @return {Object} an object whose values are primitive JSON values only
   */
  serialize: function(options) {
    return this.record.store.serializerFor(this.modelName).serialize(this, options);
  },

  /**
    @method unknownProperty
    @param {String} keyName
    @return {Object} The property value
    @deprecated Use [attr](#method_attr), [belongsTo](#method_belongsTo) or [hasMany](#method_hasMany) instead
  */
  unknownProperty: function(keyName) {
    return this.get(keyName);
  },

  /**
    @method _createSnapshot
    @private
  */
  _createSnapshot: function() {
    Ember.deprecate("You called _createSnapshot on what's already a DS.Snapshot. You shouldn't manually create snapshots in your adapter since the store passes snapshots to adapters by default.", false, {
      id: 'ds.snapshot.create-snapshot-on-snapshot',
      until: '2.0.0'
    });
    return this;
  }
};

Ember.defineProperty(Snapshot.prototype, 'typeKey', {
  enumerable: false,
  get: function() {
    Ember.deprecate('Snapshot.typeKey is deprecated. Use snapshot.modelName instead.', false, {
      id: 'ds.snapshot.type-key-deprecated',
      until: '2.0.0'
    });
    return this.modelName;
  },
  set: function() {
    Ember.assert('Setting snapshot.typeKey is not supported. In addition, Snapshot.typeKey has been deprecated for Snapshot.modelName.');
  }
});

export default Snapshot;