"use strict";
var Furple;
(function(Furple2) {
  function flattenArray(cell) {
    return Furple2.flatten(cell.map((cells) => {
      return Furple2.liftAll(cells, (...ts) => ts);
    }));
  }
  Furple2.flattenArray = flattenArray;
  function mapArray(cell, f) {
    return flattenArray(cell.map((ts) => ts.map(f)));
  }
  Furple2.mapArray = mapArray;
  function selectArray(cell, f) {
    return Furple2.flatten(cell.map((ts) => Furple2.select(...ts.map(f))));
  }
  Furple2.selectArray = selectArray;
  function foldArray(cell, initialValue, f) {
    return Furple2.flatten(cell.map((cells) => {
      return Furple2.liftAll(cells, (...ts) => ts.reduce(f, initialValue));
    }));
  }
  Furple2.foldArray = foldArray;
  function foldAssociative(cell, identityElement, f) {
    const identityCell = Furple2.constant(identityElement);
    return Furple2.flatten(cell.map((ts) => _foldAssociativeSlice(ts, identityCell, f, 0, ts.length)));
  }
  Furple2.foldAssociative = foldAssociative;
  function _foldAssociativeSlice(cells, identityCell, f, a, b) {
    if (a === b) {
      return identityCell;
    } else if (a + 1 === b) {
      return cells[a];
    } else {
      const m = a + b >>> 1;
      const left = _foldAssociativeSlice(cells, identityCell, f, a, m);
      const right = _foldAssociativeSlice(cells, identityCell, f, m, b);
      return left.lift(right, f);
    }
  }
})(Furple || (Furple = {}));
var Furple;
(function(Furple2) {
  const CLOSED = {
    kind: 0,
    engine: void 0
  };
  const BREAK = Symbol();
  function _forEachSinkParent(rule, f) {
    const parents = rule.parents;
    if (parents === void 0) {
      return;
    }
    for (let i = parents.length - 1; i >= 0; --i) {
      const conn = parents[i].deref();
      if (conn !== void 0) {
        if (f(conn) === BREAK) {
          return BREAK;
        }
      } else {
        parents[i] = parents[parents.length - 1];
        parents.pop();
      }
    }
  }
  function _forEachSelectParent(rule, f) {
    const parents = rule.parents;
    for (let i = 0; i < parents.length; ) {
      const parent = parents[i].deref();
      if (parent !== void 0) {
        if (f(parent) === BREAK) {
          return BREAK;
        }
        ++i;
      } else {
        parents.splice(i, 1);
      }
    }
  }
  function _forEachNotifiableParent(rule, f) {
    switch (rule.kind) {
      case 0:
      case 19:
      case 20:
        return;
      case 1: {
        return _forEachSinkParent(rule, f);
      }
      case 2:
      case 3:
      case 17:
      case 18:
      case 6:
      case 4:
      case 5:
      case 13:
      case 14:
      case 15:
      case 16: {
        const parent = rule.parent.deref();
        if (parent !== void 0) {
          return f(parent);
        }
        return;
      }
      case 7: {
        if (f(rule.parent1) === BREAK) {
          return BREAK;
        }
        return f(rule.parent2);
      }
      case 8: {
        for (const parent of rule.parents) {
          if (f(parent) === BREAK) {
            return BREAK;
          }
        }
        return;
      }
      case 12: {
        return _forEachSelectParent(rule, f);
      }
      case 11: {
        for (const weakParent of rule.parents) {
          const parent = weakParent.deref();
          if (parent !== void 0) {
            if (f(parent) === BREAK) {
              return BREAK;
            }
          }
        }
        return;
      }
      case 9:
      case 10:
      case 21: {
        const parent1 = rule.parent1.deref(), parent2 = rule.parent2?.deref();
        if (parent1 !== void 0) {
          if (f(parent1) === BREAK) {
            return BREAK;
          }
        }
        if (parent2 !== void 0) {
          return f(parent2);
        }
        return;
      }
    }
    const _ = rule;
  }
  function _forEachNonNotifiableParent(rule, f) {
    switch (rule.kind) {
      case 19:
      case 20: {
        const parent = rule.parent.deref();
        if (parent !== void 0) {
          f(parent);
        }
        return;
      }
      case 15: {
        f(rule.cell);
        return;
      }
      case 16: {
        for (const cell of rule.cells) {
          if (f(cell) === BREAK) {
            return;
          }
        }
        return;
      }
    }
  }
  function _forEachParent(rule, f) {
    if (_forEachNotifiableParent(rule, f) === BREAK) {
      return;
    }
    _forEachNonNotifiableParent(rule, f);
  }
  function _forEachNotifiableChild(parent, f) {
    for (const child of parent.notifiableChildren) {
      f(child);
    }
  }
  function _forEachChild(parent, f) {
    _forEachNotifiableChild(parent, f);
    for (const child of parent.nonNotifiableChildren) {
      f(child);
    }
    if (parent.rule.kind === 17 || parent.rule.kind === 18) {
      for (const child of parent.rule.f.values()) {
        f(child);
      }
    }
  }
  Furple2.DO_NOT_SEND = Symbol();
  const NOT_UPDATED = Symbol();
  const IS_STREAM = Symbol();
  const DEFAULT_EQUALITY_FUNCTION = Object.is;
  class Node {
    rule;
    value;
    name = void 0;
    depth = 0;
    newValue = NOT_UPDATED;
    equalityFunc = DEFAULT_EQUALITY_FUNCTION;
    notifiableChildren = [];
    nonNotifiableChildren = [];
    constructor(rule, value) {
      this.rule = rule;
      this.value = value;
      _forEachNotifiableParent(rule, (parent) => {
        parent.addNotifiableChild(this);
      });
      this.#fixDepth();
      if (true) {
        this.value = _freezeValue(value);
      }
    }
    named(name) {
      this.name = name;
      return this;
    }
    #fixDepth() {
      const oldDepth = this.depth;
      let depth = 0;
      _forEachParent(this.rule, (parent) => {
        if (parent.depth >= depth) {
          depth = parent.depth + 1;
        }
      });
      this.depth = depth;
      return depth > oldDepth;
    }
    recomputeDepth() {
      if (!this.#fixDepth()) {
        return false;
      }
      const stack = [this];
      while (stack.length > 0) {
        const current = stack.pop();
        _forEachChild(current, (child) => {
          if (child === this) {
            _reportDependencyCycle(this);
          }
          if (child.#fixDepth()) {
            stack.push(child);
          }
        });
      }
      return true;
    }
    addNotifiableChild(child) {
      this.notifiableChildren.push(child);
    }
    addNonNotifiableDependent(child) {
      this.nonNotifiableChildren.push(child);
    }
    removeNotifiableChild(child) {
      const dependents = this.notifiableChildren;
      const i = dependents.indexOf(child);
      if (i >= 0) {
        dependents.splice(i, 1);
      }
    }
    removeNonNotifiableChild(child) {
      if (child.rule.kind === 19 || child.rule.kind === 20) {
        if (true) {
          if (child.rule.parent.deref() !== this) {
            throw new AssertionError(`BRANCH_ON node tried to deregister from wrong parent`, [this, child]);
          } else if (this.rule.kind !== 17 && this.rule.kind !== 18 && this.rule.kind !== 0) {
            throw new AssertionError(`BRANCH_ON node has non-BRANCH node as parent`, child);
          }
        }
        const parentRule = this.rule;
        parentRule.f.delete(child.rule.key);
      } else {
        const children = this.nonNotifiableChildren;
        const i = children.indexOf(child);
        if (i >= 0) {
          children.splice(i, 1);
        }
      }
    }
    isClosed() {
      return this.rule.kind === 0;
    }
    /**
     * Disconnects this node and frees up resources held by it.
     */
    close() {
      if (this.rule.engine?.isBusy()) {
        throw new Error(`close() cannot be called during an FRP transaction`);
      }
      _closeNode(this);
      return this;
    }
    /**
     * Detects whether this node can no longer receive any updates, and if
     * so, closes it to free up resources. A closed stream is normally
     * eligible for garbage-collection; a closed cell may be retained if it
     * is needed by another node, but its value will stay constant.
     */
    tidy() {
      const rule = this.rule;
      let close = true;
      _forEachNotifiableParent(rule, (d) => {
        if (!d.isClosed()) {
          close = false;
          return BREAK;
        }
      });
      if (close) {
        _closeNode(this);
        return;
      }
      switch (rule.kind) {
        case 9: {
          const parent1 = rule.parent1.deref(), parent2 = rule.parent2.deref();
          if (parent1 === void 0 || parent1.isClosed()) {
            this.rule = { kind: 3, engine: rule.engine, parent: rule.parent2 };
          } else if (parent2 === void 0 || parent2.isClosed()) {
            this.rule = { kind: 3, engine: rule.engine, parent: rule.parent1 };
          }
          break;
        }
        case 10: {
          const parent1 = rule.parent1.deref(), parent2 = rule.parent2.deref();
          if (parent1 === void 0 || parent2 === void 0 || parent1.isClosed() || parent2.isClosed()) {
            _closeNode(this);
          }
          break;
        }
        case 11: {
          for (const weakParent of rule.parents) {
            const parent = weakParent.deref();
            if (parent === void 0 || parent.isClosed()) {
              _closeNode(this);
              break;
            }
          }
          break;
        }
        case 12: {
          if (rule.parents.length === 1) {
            this.rule = { kind: 3, engine: rule.engine, parent: rule.parents[0] };
          }
          break;
        }
      }
    }
    listen(f) {
      const engine2 = this.rule.engine;
      return engine2 !== void 0 ? new Node({ kind: 2, engine: engine2, parent: new WeakRef(this), f }, IS_STREAM) : this;
    }
    observe(f) {
      if (true) {
        _assertCell(this);
      }
      f(this.value);
      return this.listen(f);
    }
    send(value) {
      _expectEngine(this).send(this, value);
    }
    sendAnd(value, f) {
      const engine2 = _expectEngine(this);
      engine2.run(() => {
        engine2.send(this, value);
        f();
      });
    }
    connect(source) {
      _connect(this, source);
      return this;
    }
    sample() {
      if (true) {
        _assertCell(this);
      }
      const engine2 = this.rule.engine;
      return engine2 !== void 0 ? engine2.sample(this) : this.value;
    }
    setEqualityFunction(eq) {
      if (true) {
        _assertCell(this);
      }
      _forEachChild(this, () => {
        throw new Error(`Equality function should only be set when the cell is originally created`);
      });
      if (this.equalityFunc !== DEFAULT_EQUALITY_FUNCTION) {
        throw new Error("This cell already has an equality function");
      }
      this.equalityFunc = eq;
      return this;
    }
    map(f) {
      return _map(this, f);
    }
    lift(otherCell, f) {
      const parent1 = this, parent2 = otherCell, engine2 = parent1.rule.engine ?? parent2.rule.engine;
      if (true) {
        _assertCell(parent1);
        _assertCell(parent2);
      }
      const intialValue = f(parent1.value, parent2.value);
      if (engine2 === void 0) {
        return constant(intialValue);
      }
      if (true) {
        _assertOwn(engine2, parent1, parent2);
      }
      return new Node({ kind: 7, engine: engine2, parent1, parent2, f }, intialValue);
    }
    hold(initialValue) {
      const engine2 = this.rule.engine;
      if (engine2 === void 0) {
        return constant(initialValue);
      }
      return new Node({ kind: 3, engine: engine2, parent: new WeakRef(this) }, initialValue);
    }
    fold(initialValue, f) {
      return _fold(this, initialValue, f);
    }
    foldS(initialValue, f) {
      return _foldBoth(this, initialValue, f)[1];
    }
    foldBoth(initialValue, f) {
      return _foldBoth(this, initialValue, f);
    }
    filter(f) {
      const engine2 = this.rule.engine, self = this;
      return engine2 !== void 0 ? new Node({ kind: 5, engine: engine2, parent: new WeakRef(self), f }, IS_STREAM) : Furple2.NEVER;
    }
    gate(p) {
      return this.filter(() => p.sample());
    }
    gateLive(p) {
      return this.snapLive(p, (s, p2) => p2 ? s : Furple2.DO_NOT_SEND);
    }
    merge(otherStream, f) {
      const self = this, other = otherStream;
      if (self.isClosed()) {
        return otherStream;
      } else if (other.isClosed()) {
        return self;
      }
      const engine2 = _expectEngine(self);
      if (true) {
        _assertOwn(engine2, self, other);
      }
      return new Node({ kind: 9, engine: engine2, parent1: new WeakRef(self), parent2: new WeakRef(other), f }, IS_STREAM);
    }
    orElse(otherStream) {
      return select(this, otherStream);
    }
    mergeMutex(otherStream) {
      return this.merge(otherStream, () => {
        throw new Error("Mutually exclusive streams fired simultaneously");
      });
    }
    meet(otherStream, f) {
      const self = this, other = otherStream;
      if (self.isClosed() || other.isClosed()) {
        return Furple2.NEVER;
      }
      const engine2 = _expectEngine(self);
      if (true) {
        _assertOwn(engine2, self, other);
      }
      return new Node({ kind: 10, engine: engine2, parent1: new WeakRef(self), parent2: new WeakRef(other), f }, IS_STREAM);
    }
    snapshot(c, f) {
      return _snap(this, c, false, f);
    }
    snapLive(c, f) {
      return _snap(this, c, true, f);
    }
    as(cell) {
      return _snap(this, cell, false, (t, u) => u);
    }
    asLive(cell) {
      return _snap(this, cell, true, (t, u) => u);
    }
    asConstant(value) {
      return _map(this, () => value);
    }
    snapshotAll(cells, f) {
      return _snapAll(this, cells, false, f);
    }
    snapAllLive(cells, f) {
      return _snapAll(this, cells, true, f);
    }
    when(key) {
      const rule = this.rule;
      switch (rule.kind) {
        case 0: {
          return this.value !== IS_STREAM ? constant(this.value === key) : Furple2.NEVER;
        }
        case 17: {
          const self = this;
          let node = rule.f.get(key);
          if (node === void 0) {
            node = new Node({ kind: 19, engine: rule.engine, parent: new WeakRef(self), key }, this.value === key);
            rule.f.set(key, node);
          }
          return node;
        }
        case 18: {
          const self = this;
          let node = rule.f.get(key);
          if (node === void 0) {
            node = new Node({ kind: 20, engine: rule.engine, parent: new WeakRef(self), key }, IS_STREAM);
            rule.f.set(key, node);
          }
          return node;
        }
      }
      throw new AssertionError(`Cannot branch on non-BRANCH node`, this);
    }
  }
  const DONT_FREEZE = [
    Node,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    BigUint64Array,
    Int8Array,
    Int16Array,
    Int32Array,
    BigInt64Array,
    Float32Array,
    Float64Array
  ];
  function _freezeValue(value) {
    return DONT_FREEZE.some((cls) => value instanceof cls) ? value : Object.freeze(value);
  }
  class Queue {
    /**
     * An array of bins of nodes, indexed by node depth.
     */
    #nodes = [];
    /**
     * The number of nodes in the queue.
     */
    #size = 0;
    /**
     * A cursor for the current bin in `this.#nodes`. This avoids searching
     * from the start of the array on each `poll()`; it works because nodes
     * can only cause other nodes of greater depth to be enqueued.
     */
    #currentDepth = 0;
    /**
     * Enqueues a node in this min-priority queue. The node's depth must be
     * greater than or equal to the most-recently polled node, unless one
     * of `reset()` or `recomputePriorities()` has since been called.
     */
    enqueue(node) {
      const nodes = this.#nodes, depth = node.depth;
      if (depth < this.#currentDepth) {
        throw new AssertionError(`Enqueued node out of order (expected depth >= ${this.#currentDepth}, was ${depth})`, node);
      }
      while (nodes.length <= depth) {
        nodes.push([]);
      }
      nodes[depth].push(node);
      ++this.#size;
    }
    /**
     * Polls a node of minimum priority from this queue, or returns
     * `undefined` if the queue is empty.
     */
    poll() {
      const nodes = this.#nodes;
      let d = this.#currentDepth;
      while (d < nodes.length) {
        if (nodes[d].length > 0) {
          --this.#size;
          return nodes[d].pop();
        } else {
          ++this.#currentDepth;
          ++d;
        }
      }
      return void 0;
    }
    /**
     * Rebuilds the queue's internal data structure. Must be called after
     * any node's depth may have changed during a transaction.
     */
    rebuild() {
      const flat = this.#nodes.flat();
      this.reset();
      for (const node of flat) {
        this.enqueue(node);
      }
    }
    /**
     * Clears and resets this queue, allowing nodes of any depth to be
     * subsequently enqueued.
     */
    reset() {
      for (const bin of this.#nodes) {
        bin.length = 0;
      }
      this.#size = 0;
      this.#currentDepth = 0;
    }
  }
  function engine() {
    return new Engine();
  }
  Furple2.engine = engine;
  class Engine {
    /**
     * An array of nodes which have been recomputed during the current FRP
     * transaction. Should be empty outside of transactions.
     */
    #dirty = [];
    /**
     * A min-priority queue of nodes which need to be recomputed during the
     * current FRP transaction. Should be empty outside of transactions.
     */
    #q = new Queue();
    /**
     * The current engine state; used to ensure correct behaviour of the
     * `send()` method, and for checking that certain operations are only
     * performed in the correct states.
     */
    #state = 0;
    /**
     * A rule for sinks with no coalescing functions. Cached here to avoid
     * duplication.
     */
    #nonCoalescingSinkRule = {
      kind: 1,
      engine: this,
      parents: void 0,
      f: void 0
    };
    #doSend(node, value) {
      if (node.value !== IS_STREAM && node.equalityFunc(node.value, value)) {
        return;
      }
      const rule = node.rule;
      if (true) {
        if (rule.kind === 0) {
          throw new AssertionError(`Cannot send to closed node`, node);
        } else if (rule.kind !== 1 && node.newValue !== NOT_UPDATED) {
          throw new AssertionError(`Node updated twice`, node);
        }
        value = _freezeValue(value);
      }
      if (rule.kind === 1 && node.newValue !== NOT_UPDATED) {
        const f = rule.f;
        if (f === void 0) {
          throw new AssertionError(`This sink cannot coalesce simultaneous events`, node);
        }
        node.newValue = f(node.newValue, value);
        return;
      }
      node.newValue = value;
      this.#dirty.push(node);
      _forEachNotifiableChild(node, (child) => this.#q.enqueue(child));
    }
    #recomputeNode(node) {
      const rule = node.rule;
      switch (rule.kind) {
        case 0:
        case 19:
        case 20:
          throw new AssertionError(`This node should not be recomputed`, node);
        case 1: {
          if (rule.parents === void 0) {
            if (node.newValue === NOT_UPDATED) {
              throw new AssertionError(`Stream was not sent anything`, node);
            }
            return node.newValue;
          }
          const f = rule.f;
          let v = NOT_UPDATED;
          _forEachSinkParent(rule, (conn) => {
            if (v === NOT_UPDATED) {
              v = conn.newValue;
            } else if (conn.newValue !== NOT_UPDATED) {
              v = f(v, conn.newValue);
            }
          });
          return v !== NOT_UPDATED ? v : Furple2.DO_NOT_SEND;
        }
        case 2:
        case 3: {
          const of = rule.parent.deref();
          if (of === void 0) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(of);
          }
          return of.newValue;
        }
        case 4: {
          const of = rule.parent.deref();
          if (of === void 0) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(of);
          }
          return rule.f(of.newValue);
        }
        case 5: {
          const stream = rule.parent.deref();
          if (stream === void 0) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(stream);
          }
          const value = stream.newValue;
          return rule.f(value) ? value : Furple2.DO_NOT_SEND;
        }
        case 6: {
          const stream = rule.parent.deref();
          if (stream === void 0) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(stream);
            _assertCell(node);
          }
          return rule.f(node.value, stream.newValue);
        }
        case 7: {
          if (true) {
            _assertUpdated(rule.parent1, rule.parent2);
          }
          return rule.f(_mostRecentValue(rule.parent1), _mostRecentValue(rule.parent2));
        }
        case 8: {
          if (true) {
            _assertUpdated(...rule.parents);
          }
          const args = rule.parents.map(_mostRecentValue);
          return rule.f(...args);
        }
        case 9: {
          const s1 = rule.parent1.deref(), s2 = rule.parent2.deref();
          if (s1 === void 0) {
            if (s2 === void 0) {
              _closeNode(node);
              return Furple2.DO_NOT_SEND;
            }
            node.rule = { kind: 3, engine: rule.engine, parent: rule.parent2 };
            return this.#recomputeNode(node);
          } else if (s2 === void 0) {
            node.rule = { kind: 3, engine: rule.engine, parent: rule.parent1 };
            return this.#recomputeNode(node);
          }
          if (true) {
            _assertUpdated(s1, s2);
          }
          return s2.newValue === NOT_UPDATED ? s1.newValue : s1.newValue === NOT_UPDATED ? s2.newValue : rule.f(s1.newValue, s2.newValue);
        }
        case 10: {
          const s1 = rule.parent1.deref(), s2 = rule.parent2.deref();
          if (s1 === void 0 || s2 === void 0 || s1.isClosed() || s2.isClosed()) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(s1, s2);
          }
          return s1.newValue !== NOT_UPDATED && s2.newValue !== NOT_UPDATED ? rule.f(s1.newValue, s2.newValue) : Furple2.DO_NOT_SEND;
        }
        case 11: {
          const args = [];
          for (const weakParent of rule.parents) {
            const parent = weakParent.deref();
            if (parent === void 0 || parent.isClosed()) {
              _closeNode(node);
              return Furple2.DO_NOT_SEND;
            } else if (parent.newValue === NOT_UPDATED) {
              return Furple2.DO_NOT_SEND;
            }
            args.push(parent.newValue);
          }
          return rule.f(...args);
        }
        case 12: {
          let newValue = Furple2.DO_NOT_SEND;
          _forEachSelectParent(rule, (parent) => {
            if (parent.newValue !== NOT_UPDATED) {
              newValue = parent.newValue;
              return BREAK;
            }
          });
          if (newValue === Furple2.DO_NOT_SEND) {
            throw new AssertionError(`At least one parent should have been updated`, rule);
          }
          return newValue;
        }
        case 13: {
          const stream = rule.parent.deref();
          if (stream === void 0) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(stream);
          }
          return rule.f(stream.newValue, rule.cell.value);
        }
        case 14: {
          const stream = rule.parent.deref();
          if (stream === void 0) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(stream);
          }
          const args = rule.cells.map((c) => c.value);
          return rule.f(stream.newValue, ...args);
        }
        case 15: {
          const stream = rule.parent.deref();
          if (stream === void 0) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(stream);
          }
          return rule.f(stream.newValue, _mostRecentValue(rule.cell));
        }
        case 16: {
          const stream = rule.parent.deref();
          if (stream === void 0) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(stream);
          }
          const args = rule.cells.map(_mostRecentValue);
          return rule.f(stream.newValue, ...args);
        }
        case 17: {
          const parent = rule.parent.deref();
          if (parent === void 0) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(parent);
          }
          const newValue = parent.newValue, notifyOld = rule.f.get(parent.value), notifyNew = rule.f.get(newValue);
          if (notifyOld !== void 0) {
            this.#doSend(notifyOld, false);
          }
          if (notifyNew !== void 0) {
            this.#doSend(notifyNew, true);
          }
          return newValue;
        }
        case 18: {
          const parent = rule.parent.deref();
          if (parent === void 0) {
            _closeNode(node);
            return Furple2.DO_NOT_SEND;
          }
          if (true) {
            _assertUpdated(parent);
          }
          const newValue = parent.newValue, notify = rule.f.get(newValue);
          if (notify !== void 0) {
            this.#doSend(notify, newValue);
          }
          return newValue;
        }
        case 21: {
          const container = rule.parent1.deref();
          if (container === void 0) {
            node.rule = rule.parent2 !== void 0 ? { kind: 3, engine: rule.engine, parent: rule.parent2 } : { kind: 0, engine: void 0 };
            return this.#recomputeNode(node);
          }
          const oldSource = rule.parent2?.deref(), newSource = _mostRecentValue(container);
          if (true) {
            if (oldSource !== void 0 && !(oldSource instanceof Node)) {
              throw new AssertionError(`Old source must be a node`, oldSource);
            } else if (newSource !== void 0) {
              if (!(newSource instanceof Node)) {
                throw new AssertionError(`New source must be a node`, newSource);
              }
              _assertOwn(this, newSource);
              _assertUpdated(container, newSource);
            } else {
              _assertUpdated(container);
            }
          }
          if (oldSource !== newSource) {
            oldSource?.removeNotifiableChild(node);
            newSource?.addNotifiableChild(node);
            rule.parent2 = newSource !== void 0 ? new WeakRef(newSource) : void 0;
            if (node.recomputeDepth()) {
              this.#q.rebuild();
            }
          }
          return newSource === void 0 ? void 0 : newSource.newValue !== NOT_UPDATED ? newSource.newValue : newSource.value !== IS_STREAM ? newSource.value : Furple2.DO_NOT_SEND;
        }
      }
    }
    /**
     * Sends a value to a sink, initiating an FRP transaction if one is not
     * already being built. Equivalent to `sink.send(value)`.
     *
     * This method cannot be called during an FRP transaction; instead,
     * create a source of events for the sink as part of the FRP graph, and
     * connect it to this sink.
     */
    send(sink, value) {
      const node = sink;
      if (true) {
        _assertOwn(this, node);
      }
      if (node.isClosed()) {
        throw new Error(`Cannot send to this sink; it is closed`);
      }
      switch (this.#state) {
        case 0: {
          this.run(() => this.#doSend(node, value));
          break;
        }
        case 1: {
          this.#doSend(node, value);
          break;
        }
        default:
          throw new Error(`send() cannot be called during an FRP transaction`);
      }
    }
    /**
     * Builds and executes an FRP transaction, allowing values to be sent
     * to multiple sinks "simultaneously".
     */
    run(f) {
      if (this.#state !== 0) {
        throw new Error(`run() cannot be called during an FRP transaction`);
      }
      try {
        this.#state = 1;
        f();
        this.#state = 2;
        const q = this.#q;
        const seen = /* @__PURE__ */ new Set();
        while (true) {
          const node = q.poll();
          if (node === void 0) {
            break;
          }
          if (seen.has(node)) {
            continue;
          }
          seen.add(node);
          if (_sampleAllowed(node)) {
            this.#state = 3;
          }
          const v = this.#recomputeNode(node);
          this.#state = 2;
          if (v !== Furple2.DO_NOT_SEND) {
            this.#doSend(node, v);
          }
        }
        for (const node of this.#dirty) {
          if (node.value !== IS_STREAM) {
            node.value = node.newValue;
          }
        }
        this.#state = 4;
        for (const node of this.#dirty) {
          if (true) {
            _assertUpdated(node);
          }
          if (node.rule.kind === 2) {
            node.rule.f(node.newValue);
          }
        }
        this.#state = 5;
      } finally {
        this.#q.reset();
        for (const node of this.#dirty) {
          node.newValue = NOT_UPDATED;
        }
        this.#dirty.length = 0;
        this.#state = 0;
      }
    }
    /**
     * Indicates whether this engine is current executing an FRP
     * transaction.
     */
    isBusy() {
      return this.#state === 2 || this.#state === 3;
    }
    /**
     * Samples the current value of a cell. Equivalent to `cell.sample()`.
     */
    sample(cell) {
      if (this.#state === 2) {
        console.error(`sample() should not be called here`);
      }
      const node = cell;
      if (true) {
        _assertCell(node);
      }
      return node.value;
    }
    /**
     * Creates a cell whose value can be changed directly.
     */
    cell(initialValue) {
      return new Node(this.#nonCoalescingSinkRule, initialValue);
    }
    /**
     * Creates a stream which can be fired directly.
     *
     * An optional callback function can be provided, which will be used to
     * coalesce multiple values sent to the sink in the same transaction.
     * The coalescing function must be associative and commutative; values
     * sent in the same transaction are coalesced in an unspecified order.
     *
     * If no coalescing function is provided, an error will be thrown if
     * multiple values are sent in the same transaction.
     */
    sink(f) {
      return new Node(f !== void 0 ? { kind: 1, engine: this, parents: [], f } : this.#nonCoalescingSinkRule, IS_STREAM);
    }
  }
  Furple2.Engine = Engine;
  function _connect(sink, source) {
    const engine2 = sink.rule.engine;
    if (engine2 === void 0) {
      throw new Error(`Cannot connect; sink is already closed`);
    }
    if (true) {
      _assertOwn(engine2, source);
    }
    if (engine2.isBusy()) {
      throw new Error(`Cannot connect during an FRP transaction`);
    } else if (sink.rule.kind !== 1) {
      throw new Error(`Cannot connect; sink is already connected`);
    }
    if (source.value !== IS_STREAM) {
      engine2.send(sink, source.value);
    }
    const rule = sink.rule;
    const parent = new WeakRef(source);
    if (rule.parents === void 0) {
      sink.rule = { kind: 3, engine: engine2, parent };
    } else {
      rule.parents.push(parent);
    }
    source.addNotifiableChild(sink);
    sink.recomputeDepth();
  }
  function _map(node, f) {
    const engine2 = node.rule.engine;
    if (engine2 === void 0 && node.value === IS_STREAM) {
      return Furple2.NEVER;
    }
    return new Node(engine2 === void 0 ? CLOSED : { kind: 4, engine: engine2, parent: new WeakRef(node), f }, node.value !== IS_STREAM ? f(node.value) : IS_STREAM);
  }
  function _fold(s, initialValue, f) {
    const stream = s, engine2 = stream.rule.engine;
    return new Node(engine2 === void 0 ? CLOSED : { kind: 6, engine: engine2, parent: new WeakRef(stream), f }, initialValue);
  }
  function _foldBoth(s, initialValue, f) {
    const stream = s, engine2 = stream.rule.engine;
    if (engine2 === void 0) {
      return [constant(initialValue), Furple2.NEVER];
    }
    const acc = _fold(s, initialValue, f), accS = new Node({ kind: 3, engine: engine2, parent: new WeakRef(acc) }, IS_STREAM);
    return [acc, accS];
  }
  function _snap(s, c, live, f) {
    const stream = s, cell = c, engine2 = stream.rule.engine;
    if (engine2 === void 0) {
      return Furple2.NEVER;
    }
    if (true) {
      _assertOwn(engine2, cell);
    }
    const kind = live ? 15 : 13;
    return new Node({ kind, engine: engine2, parent: new WeakRef(stream), cell, f }, IS_STREAM);
  }
  function _snapAll(s, cs, live, f) {
    if (cs.length === 0) {
      return s.map(f);
    } else if (cs.length === 1) {
      return _snap(s, cs[0], live, f);
    }
    const stream = s, cells = cs, engine2 = stream.rule.engine;
    if (engine2 === void 0) {
      return Furple2.NEVER;
    }
    if (true) {
      _assertOwn(engine2, ...cells);
    }
    const kind = live ? 16 : 14;
    return new Node({ kind, engine: engine2, parent: new WeakRef(stream), cells, f }, IS_STREAM);
  }
  Furple2.NEVER = new Node(CLOSED, IS_STREAM);
  function constant(value) {
    return new Node(CLOSED, value);
  }
  Furple2.constant = constant;
  Furple2.UNDEFINED = constant(void 0);
  function liftAll(cells, f) {
    const parents = cells;
    let engine2 = void 0;
    for (const cell of parents) {
      engine2 = cell.rule.engine;
      if (engine2 !== void 0) {
        break;
      }
    }
    if (parents.length === 0) {
      return constant(f());
    } else if (parents.length === 1) {
      return parents[0].map(f);
    } else if (parents.length === 2) {
      return parents[0].lift(parents[1], f);
    }
    const values = parents.map((c) => c.value);
    const initialValue = f(...values);
    if (engine2 === void 0) {
      return constant(initialValue);
    }
    if (true) {
      _assertOwn(engine2, ...parents);
    }
    return new Node({ kind: 8, engine: engine2, parents, f }, initialValue);
  }
  Furple2.liftAll = liftAll;
  function meetAll(streams, f) {
    const parents = [];
    for (const s of streams) {
      const p = s;
      if (p.isClosed()) {
        return Furple2.NEVER;
      }
      parents.push(new WeakRef(p));
    }
    const engine2 = _expectEngine(streams[0]);
    return new Node({ kind: 11, engine: engine2, parents, f }, IS_STREAM);
  }
  Furple2.meetAll = meetAll;
  function select(...streams) {
    const parents = streams.filter((p) => !p.isClosed());
    if (parents.length === 0) {
      return Furple2.NEVER;
    } else if (parents.length === 1) {
      return parents[0];
    }
    const engine2 = _expectEngine(parents[0]);
    if (true) {
      _assertOwn(engine2, ...parents);
    }
    return new Node({ kind: 12, engine: engine2, parents: parents.map((p) => new WeakRef(p)) }, IS_STREAM);
  }
  Furple2.select = select;
  function branch(of) {
    const node = of, engine2 = node.rule.engine;
    if (engine2 === void 0) {
      return node;
    }
    const kind = node.value !== IS_STREAM ? 17 : 18;
    return new Node({ kind, engine: engine2, parent: new WeakRef(node), f: /* @__PURE__ */ new Map() }, node.value);
  }
  Furple2.branch = branch;
  function flatten(cell) {
    const node = cell, nested = node.value, engine2 = node.rule.engine;
    if (engine2 === void 0) {
      return nested ?? Furple2.UNDEFINED;
    }
    if (nested !== void 0 && !(nested instanceof Node)) {
      throw new AssertionError(`Inner value must be cell or stream`, nested);
    }
    const rule = {
      kind: 21,
      engine: engine2,
      parent1: new WeakRef(node),
      parent2: nested !== void 0 ? new WeakRef(nested) : void 0
    };
    return new Node(rule, nested?.value);
  }
  Furple2.flatten = flatten;
  function persist(key, cell, conv = Furple2.Type.STR) {
    const setter = (value) => {
      try {
        window.localStorage.setItem(key, conv.toStr(value));
      } catch (e) {
        console.error(`Failed to store '${key}' in local storage`, e);
      }
    };
    try {
      const node = cell, stored = window.localStorage.getItem(key);
      if (stored !== null) {
        node.send(conv.fromStr(stored));
        node.listen(setter);
      } else {
        node.observe(setter);
      }
    } catch (e) {
      console.warn(`Failed to load '${key}' from local storage`);
    }
  }
  Furple2.persist = persist;
  function _expectEngine(node) {
    const engine2 = node.rule.engine;
    if (engine2 === void 0) {
      throw new AssertionError(`Node is closed`, node);
    }
    return engine2;
  }
  function _mostRecentValue(cell) {
    return cell.newValue !== NOT_UPDATED ? cell.newValue : cell.value;
  }
  function _sampleAllowed(node) {
    const rule = node.rule;
    switch (rule.kind) {
      case 4:
        return node.value === IS_STREAM;
      case 5:
      case 6:
      case 9:
      case 13:
      case 14:
        return true;
      default:
        return false;
    }
  }
  function _closeNode(node) {
    if (node.isClosed()) {
      return;
    }
    const rule = node.rule;
    node.rule = CLOSED;
    node.depth = 0;
    _forEachNotifiableParent(rule, (parent) => parent.removeNotifiableChild(node));
    _forEachNonNotifiableParent(rule, (parent) => parent.removeNonNotifiableChild(node));
    _forEachChild(node, (child) => child.tidy());
    node.notifiableChildren.length = 0;
    node.nonNotifiableChildren.length = 0;
  }
  function _assertCell(node) {
    if (node.value === IS_STREAM) {
      throw new AssertionError(`Expected cell`, node);
    }
  }
  function _assertOwn(engine2, ...objs) {
    for (const obj of objs) {
      if (obj.rule.engine !== void 0 && obj.rule.engine !== engine2) {
        throw new AssertionError("Object is owned by a different FRP engine", [engine2, obj]);
      }
    }
  }
  function _assertUpdated(...nodes) {
    if (nodes.every((node) => node.newValue === NOT_UPDATED)) {
      throw new AssertionError("At least one of these nodes should have been updated", nodes);
    }
  }
  function _reportDependencyCycle(root) {
    const map = /* @__PURE__ */ new Map();
    const q = [root];
    while (true) {
      const current = q.shift();
      if (current === void 0) {
        throw new AssertionError(`Expected to report cycle, but no cycle was found!`, root);
      }
      _forEachParent(current.rule, (parent) => {
        if (parent === root) {
          const cycle = [];
          let cur = current;
          while (cur !== void 0) {
            cycle.push(cur);
            cur = map.get(cur);
          }
          cycle.reverse();
          const message = "Circular dependency:\n---\n" + cycle.map((node) => node.name ?? "<anonymous>").join("\n");
          console.error(message, cycle);
          throw new Error(`${message}
---
See console for more details`);
        } else if (!map.has(parent)) {
          q.push(parent);
          map.set(parent, current);
        }
      });
    }
  }
  class AssertionError extends Error {
    data;
    constructor(msg, data) {
      super(msg);
      this.data = data;
    }
  }
})(Furple || (Furple = {}));
var Furple;
(function(Furple2) {
  let Type;
  (function(Type2) {
    const id = (s) => s;
    const toStr = (x) => `${x}`;
    Type2.BOOL = {
      toStr: (b) => b ? "true" : "false",
      fromStr: (s) => s === "true"
    };
    Type2.INT = {
      toStr,
      fromStr: (s) => parseInt(s)
    };
    Type2.BIGINT = {
      toStr,
      fromStr: BigInt
    };
    Type2.FLOAT = {
      toStr,
      fromStr: parseFloat
    };
    Type2.STR = {
      toStr: id,
      fromStr: id
    };
    function array(conv) {
      return {
        toStr: (a) => JSON.stringify(a.map(conv.toStr)),
        fromStr: (s) => JSON.parse(s).map(conv.fromStr)
      };
    }
    Type2.array = array;
    function object(conv) {
      return {
        toStr: (o) => JSON.stringify(_mapObj(o, conv.toStr)),
        fromStr: (s) => _mapObj(JSON.parse(s), conv.fromStr)
      };
    }
    Type2.object = object;
    function map(conv) {
      return {
        toStr: (m) => JSON.stringify(_mapObj(Object.fromEntries(m), conv.toStr)),
        fromStr: (s) => new Map(Object.entries(_mapObj(JSON.parse(s), conv.fromStr)))
      };
    }
    Type2.map = map;
    function set(conv) {
      return {
        toStr: (s) => JSON.stringify([...s].map(conv.toStr)),
        fromStr: (s) => new Set(JSON.parse(s).map(conv.fromStr))
      };
    }
    Type2.set = set;
    function _mapObj(obj, f) {
      const out = /* @__PURE__ */ Object.create(null);
      for (const [k, v] of Object.entries(obj)) {
        out[k] = f(v);
      }
      return out;
    }
  })(Type = Furple2.Type || (Furple2.Type = {}));
})(Furple || (Furple = {}));
