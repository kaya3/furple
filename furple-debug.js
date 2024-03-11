"use strict";
var Furple;
(function (Furple) {
    /**
     * Flattens an array of cells into a single cell which holds an array.
     */
    function flattenArray(cell) {
        return Furple.flatten(cell.map(cells => {
            return Furple.liftAll(cells, (...ts) => ts);
        }));
    }
    Furple.flattenArray = flattenArray;
    /**
     * Performs a map on an array, where the mapping function returns a cell.
     */
    function mapArray(cell, f) {
        return flattenArray(cell.map(ts => ts.map(f)));
    }
    Furple.mapArray = mapArray;
    /**
     * Performs a select on an array, where the mapping function returns a
     * stream. The resulting stream fires when any of the streams in the cell's
     * array fire, with the value of the earliest one in the array if multiple
     * fire simultaneously.
     */
    function selectArray(cell, f) {
        return Furple.flatten(cell.map(ts => Furple.select(...ts.map(f))));
    }
    Furple.selectArray = selectArray;
    /**
     * Performs a linear fold on an array of cells. If the function `f` is
     * associative and `initialValue` is its identity, use `foldAssociative`
     * instead.
     */
    function foldArray(cell, initialValue, f) {
        return Furple.flatten(cell.map(cells => {
            return Furple.liftAll(cells, (...ts) => ts.reduce(f, initialValue));
        }));
    }
    Furple.foldArray = foldArray;
    /**
     * Performs a divide-and-conquer fold on an array of cells. The function `f`
     * must be an associative operation, and the fold's initial value must be
     * an identity value for the operation.
     *
     * This function should be preferred to `foldArray` when `f` is associative
     * and has an identity, since the FRP graph for this cell will have a depth
     * of O(log n) instead of O(n).
     */
    function foldAssociative(cell, identityElement, f) {
        const identityCell = Furple.constant(identityElement);
        return Furple.flatten(cell.map(ts => _foldAssociativeSlice(ts, identityCell, f, 0, ts.length)));
    }
    Furple.foldAssociative = foldAssociative;
    function _foldAssociativeSlice(cells, identityCell, f, a, b) {
        if (a === b) {
            return identityCell;
        }
        else if (a + 1 === b) {
            return cells[a];
        }
        else {
            const m = (a + b) >>> 1;
            const left = _foldAssociativeSlice(cells, identityCell, f, a, m);
            const right = _foldAssociativeSlice(cells, identityCell, f, m, b);
            return left.lift(right, f);
        }
    }
})(Furple || (Furple = {}));
var Furple;
(function (Furple) {
    const CLOSED = {
        kind: 0 /* RuleKind.CLOSED */,
        engine: undefined,
    };
    /**
     * Sentinel value indicating that a `_forEach` loop should terminate.
     */
    const BREAK = Symbol();
    function _forEachSinkParent(rule, f) {
        const parents = rule.parents;
        if (parents === undefined) {
            return;
        }
        for (let i = parents.length - 1; i >= 0; --i) {
            const conn = parents[i].deref();
            if (conn !== undefined) {
                if (f(conn) === BREAK) {
                    return BREAK;
                }
            }
            else {
                // delete without preserving order
                parents[i] = parents[parents.length - 1];
                parents.pop();
            }
        }
    }
    function _forEachSelectParent(rule, f) {
        const parents = rule.parents;
        for (let i = 0; i < parents.length;) {
            const parent = parents[i].deref();
            if (parent !== undefined) {
                if (f(parent) === BREAK) {
                    return BREAK;
                }
                ++i;
            }
            else {
                // delete preserving order
                parents.splice(i, 1);
            }
        }
    }
    function _forEachNotifiableParent(rule, f) {
        switch (rule.kind) {
            case 0 /* RuleKind.CLOSED */:
            case 16 /* RuleKind.BRANCH_ON */:
                return;
            case 1 /* RuleKind.SINK */: {
                return _forEachSinkParent(rule, f);
            }
            case 2 /* RuleKind.LISTENER */:
            case 3 /* RuleKind.COPY */:
            case 15 /* RuleKind.BRANCH */:
            case 6 /* RuleKind.FOLD */:
            case 4 /* RuleKind.MAP */:
            case 5 /* RuleKind.FILTER */:
            case 11 /* RuleKind.SNAPSHOT */:
            case 12 /* RuleKind.SNAPSHOT_ALL */:
            case 13 /* RuleKind.SNAPSHOT_LIVE */:
            case 14 /* RuleKind.SNAPSHOT_ALL_LIVE */: {
                // cells are not notifiable parents of snapshots
                const parent = rule.parent.deref();
                if (parent !== undefined) {
                    return f(parent);
                }
                return;
            }
            case 7 /* RuleKind.LIFT */: {
                if (f(rule.parent1) === BREAK) {
                    return BREAK;
                }
                return f(rule.parent2);
            }
            case 8 /* RuleKind.LIFT_ALL */: {
                for (const parent of rule.parents) {
                    if (f(parent) === BREAK) {
                        return BREAK;
                    }
                }
                return;
            }
            case 10 /* RuleKind.SELECT */: {
                return _forEachSelectParent(rule, f);
            }
            case 9 /* RuleKind.MERGE */:
            case 17 /* RuleKind.FLATTEN */: {
                const parent1 = rule.parent1.deref(), parent2 = rule.parent2?.deref();
                if (parent1 !== undefined) {
                    if (f(parent1) === BREAK) {
                        return BREAK;
                    }
                }
                if (parent2 !== undefined) {
                    return f(parent2);
                }
                return;
            }
        }
        // exhaustivity check
        const _ = rule;
    }
    function _forEachNonNotifiableParent(rule, f) {
        switch (rule.kind) {
            case 16 /* RuleKind.BRANCH_ON */: {
                const parent = rule.parent.deref();
                if (parent !== undefined) {
                    f(parent);
                }
                return;
            }
            case 13 /* RuleKind.SNAPSHOT_LIVE */: {
                f(rule.cell);
                return;
            }
            case 14 /* RuleKind.SNAPSHOT_ALL_LIVE */: {
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
        if (parent.rule.kind === 15 /* RuleKind.BRANCH */) {
            for (const child of parent.rule.f.values()) {
                f(child);
            }
        }
    }
    /**
     * Sentinel value indicating that a value should not be sent. This may be
     * returned by a callback to `Stream.map`, `Stream.snapshot` or `Stream.snapshotAll`.
     */
    Furple.DO_NOT_SEND = Symbol();
    /**
     * Sentinel value indicating a node has not been updated yet in the current
     * transaction.
     */
    const NOT_UPDATED = Symbol();
    /**
     * Sentinel value indicating that a node represents a stream rather than a
     * cell.
     */
    const IS_STREAM = Symbol();
    const DEFAULT_EQUALITY_FUNCTION = Object.is;
    class Node {
        rule;
        value;
        name = undefined;
        depth = 0;
        newValue = NOT_UPDATED;
        equalityFunc = DEFAULT_EQUALITY_FUNCTION;
        notifiableChildren = [];
        nonNotifiableChildren = [];
        constructor(rule, 
        // using a default `value = IS_STREAM` here is wrong, because an
        // explicit `undefined` value for a cell would become `IS_STREAM`
        value) {
            this.rule = rule;
            this.value = value;
            _forEachNotifiableParent(rule, parent => {
                parent.addNotifiableChild(this);
            });
            this.#fixDepth();
            if (1 /* Config.DEBUG */) {
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
            _forEachParent(this.rule, parent => {
                if (parent.depth >= depth) {
                    depth = parent.depth + 1;
                }
            });
            this.depth = depth;
            // use > instead of !== here, to avoid performance blowup
            // this means depth could eventually exceed MAX_SAFE_INTEGER in pathological cases
            return depth > oldDepth;
        }
        recomputeDepth() {
            if (!this.#fixDepth()) {
                return false;
            }
            const stack = [this];
            while (stack.length > 0) {
                const current = stack.pop();
                _forEachChild(current, child => {
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
            if (child.rule.kind === 16 /* RuleKind.BRANCH_ON */) {
                // BRANCH_ON nodes don't register themselves as a notifiable dependency
                if (1 /* Config.DEBUG */) {
                    if (child.rule.parent.deref() !== this) {
                        throw new AssertionError(`BRANCH_ON node tried to deregister from wrong parent`, [this, child]);
                    }
                    else if (this.rule.kind !== 15 /* RuleKind.BRANCH */ && this.rule.kind !== 0 /* RuleKind.CLOSED */) {
                        throw new AssertionError(`BRANCH_ON node has non-BRANCH node as parent`, child);
                    }
                }
                const parentRule = this.rule;
                parentRule.f.delete(child.rule.key);
            }
            else {
                const children = this.nonNotifiableChildren;
                const i = children.indexOf(child);
                if (i >= 0) {
                    children.splice(i, 1);
                }
            }
        }
        isClosed() {
            return this.rule.kind === 0 /* RuleKind.CLOSED */;
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
            _forEachNotifiableParent(rule, d => {
                if (!d.isClosed()) {
                    close = false;
                    return BREAK;
                }
            });
            if (close) {
                _closeNode(this);
            }
            else if (rule.kind === 9 /* RuleKind.MERGE */) {
                const parent1 = rule.parent1.deref(), parent2 = rule.parent2.deref();
                if (parent1 === undefined || parent1.isClosed()) {
                    this.rule = { kind: 3 /* RuleKind.COPY */, engine: rule.engine, parent: rule.parent2 };
                }
                else if (parent2 === undefined || parent2.isClosed()) {
                    this.rule = { kind: 3 /* RuleKind.COPY */, engine: rule.engine, parent: rule.parent1 };
                }
            }
            else if (rule.kind === 10 /* RuleKind.SELECT */) {
                // _forEachSelectParent already removed the dropped weakrefs
                if (rule.parents.length === 1) {
                    this.rule = { kind: 3 /* RuleKind.COPY */, engine: rule.engine, parent: rule.parents[0] };
                }
            }
        }
        listen(f) {
            const engine = this.rule.engine;
            return engine !== undefined
                ? new Node({ kind: 2 /* RuleKind.LISTENER */, engine, parent: new WeakRef(this), f }, IS_STREAM)
                : this;
        }
        observe(f) {
            if (1 /* Config.DEBUG */) {
                _assertCell(this);
            }
            f(this.value);
            return this.listen(f);
        }
        send(value) {
            _expectEngine(this).send(this, value);
        }
        sendAnd(value, f) {
            const engine = _expectEngine(this);
            engine.run(() => {
                engine.send(this, value);
                f();
            });
        }
        connect(source) {
            _connect(this, source);
            return this;
        }
        sample() {
            if (1 /* Config.DEBUG */) {
                _assertCell(this);
            }
            const engine = this.rule.engine;
            return engine !== undefined ? engine.sample(this) : this.value;
        }
        setEqualityFunction(eq) {
            if (1 /* Config.DEBUG */) {
                _assertCell(this);
            }
            _forEachChild(this, () => {
                throw new Error(`Equality function should only be set when the cell is originally created`);
            });
            if (this.equalityFunc !== DEFAULT_EQUALITY_FUNCTION) {
                throw new Error('This cell already has an equality function');
            }
            this.equalityFunc = eq;
            return this;
        }
        map(f) {
            return _map(this, f);
        }
        lift(otherCell, f) {
            const parent1 = this, parent2 = otherCell, engine = parent1.rule.engine ?? parent2.rule.engine;
            if (1 /* Config.DEBUG */) {
                _assertCell(parent1);
                _assertCell(parent2);
            }
            const intialValue = f(parent1.value, parent2.value);
            if (engine === undefined) {
                return constant(intialValue);
            }
            if (1 /* Config.DEBUG */) {
                _assertOwn(engine, parent1, parent2);
            }
            return new Node({ kind: 7 /* RuleKind.LIFT */, engine, parent1, parent2, f }, intialValue);
        }
        hold(initialValue) {
            const engine = this.rule.engine;
            if (engine === undefined) {
                return constant(initialValue);
            }
            return new Node({ kind: 3 /* RuleKind.COPY */, engine, parent: new WeakRef(this) }, initialValue);
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
            const engine = this.rule.engine, self = this;
            return engine !== undefined
                ? new Node({ kind: 5 /* RuleKind.FILTER */, engine, parent: new WeakRef(self), f }, IS_STREAM)
                : Furple.NEVER;
        }
        gate(p) {
            return this.filter(() => p.sample());
        }
        merge(otherStream, f) {
            const self = this, other = otherStream;
            if (self.isClosed()) {
                return otherStream;
            }
            else if (other.isClosed()) {
                return self;
            }
            const engine = _expectEngine(self);
            if (1 /* Config.DEBUG */) {
                _assertOwn(engine, self, other);
            }
            return new Node({ kind: 9 /* RuleKind.MERGE */, engine, parent1: new WeakRef(self), parent2: new WeakRef(other), f }, IS_STREAM);
        }
        orElse(otherStream) {
            return select(this, otherStream);
        }
        mergeMutex(otherStream) {
            return this.merge(otherStream, () => { throw new Error('Mutually exclusive streams fired simultaneously'); });
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
            if (1 /* Config.DEBUG */ && this.rule.kind !== 0 /* RuleKind.CLOSED */ && this.rule.kind !== 15 /* RuleKind.BRANCH */) {
                throw new AssertionError(`Cannot branch on non-BRANCH node`, this);
            }
            const rule = this.rule, v = this.value === IS_STREAM ? IS_STREAM : this.value === key;
            if (rule.kind === 15 /* RuleKind.BRANCH */) {
                let node = rule.f.get(key);
                if (node === undefined) {
                    node = new Node({ kind: 16 /* RuleKind.BRANCH_ON */, engine: rule.engine, parent: new WeakRef(this), key }, v);
                    rule.f.set(key, node);
                }
                return node;
            }
            else {
                return v !== IS_STREAM ? constant(v) : Furple.NEVER;
            }
        }
    }
    const DONT_FREEZE = [
        Node,
        Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, BigUint64Array,
        Int8Array, Int16Array, Int32Array, BigInt64Array,
        Float32Array, Float64Array,
    ];
    function _freezeValue(value) {
        return DONT_FREEZE.some(cls => value instanceof cls) ? value : Object.freeze(value);
    }
    /**
     * A min-priority queue of nodes, ordered by node depth.
     */
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
            if (1 /* Config.DEBUG */ && depth < this.#currentDepth) {
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
                }
                else {
                    ++this.#currentDepth;
                    ++d;
                }
            }
            return undefined;
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
    /**
     * Creates a new FRP engine instance. Most applications should call this
     * once and retain a reference globally.
     */
    function engine() {
        return new Engine();
    }
    Furple.engine = engine;
    /**
     * An FRP engine, which processes FRP transactions.
     */
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
        #state = 0 /* EngineState.IDLE */;
        /**
         * A rule for sinks with no coalescing functions. Cached here to avoid
         * duplication.
         */
        #nonCoalescingSinkRule = {
            kind: 1 /* RuleKind.SINK */,
            engine: this,
            parents: undefined,
            f: undefined,
        };
        #doSend(node, value) {
            // short-circuit if this is a cell and the value is not changed
            if (node.value !== IS_STREAM && node.equalityFunc(node.value, value)) {
                return;
            }
            const rule = node.rule;
            if (1 /* Config.DEBUG */) {
                if (rule.kind === 0 /* RuleKind.CLOSED */) {
                    throw new AssertionError(`Cannot send to closed node`, node);
                }
                else if (rule.kind !== 1 /* RuleKind.SINK */ && node.newValue !== NOT_UPDATED) {
                    throw new AssertionError(`Node updated twice`, node);
                }
                value = _freezeValue(value);
            }
            if (rule.kind === 1 /* RuleKind.SINK */ && node.newValue !== NOT_UPDATED) {
                const f = rule.f;
                if (f === undefined) {
                    throw new AssertionError(`This sink cannot coalesce simultaneous events`, node);
                }
                node.newValue = f(node.newValue, value);
                // this node has already been marked dirty and propagated; don't propagate again
                return;
            }
            node.newValue = value;
            this.#dirty.push(node);
            _forEachNotifiableChild(node, child => this.#q.enqueue(child));
        }
        #recomputeNode(node) {
            const rule = node.rule;
            switch (rule.kind) {
                case 0 /* RuleKind.CLOSED */:
                case 16 /* RuleKind.BRANCH_ON */:
                    throw new AssertionError(`This node should not be recomputed`, node);
                case 1 /* RuleKind.SINK */: {
                    if (rule.parents === undefined) {
                        if (1 /* Config.DEBUG */ && node.newValue === NOT_UPDATED) {
                            throw new AssertionError(`Stream was not sent anything`, node);
                        }
                        return node.newValue;
                    }
                    const f = rule.f;
                    let v = NOT_UPDATED;
                    _forEachSinkParent(rule, conn => {
                        if (v === NOT_UPDATED) {
                            v = conn.newValue;
                        }
                        else if (conn.newValue !== NOT_UPDATED) {
                            v = f(v, conn.newValue);
                        }
                    });
                    return v !== NOT_UPDATED ? v : Furple.DO_NOT_SEND;
                }
                case 2 /* RuleKind.LISTENER */:
                case 3 /* RuleKind.COPY */: {
                    const of = rule.parent.deref();
                    if (of === undefined) {
                        _closeNode(node);
                        return Furple.DO_NOT_SEND;
                    }
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(of);
                    }
                    return of.newValue;
                }
                case 4 /* RuleKind.MAP */: {
                    const of = rule.parent.deref();
                    if (of === undefined) {
                        _closeNode(node);
                        return Furple.DO_NOT_SEND;
                    }
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(of);
                    }
                    return rule.f(of.newValue);
                }
                case 5 /* RuleKind.FILTER */: {
                    const stream = rule.parent.deref();
                    if (stream === undefined) {
                        _closeNode(node);
                        return Furple.DO_NOT_SEND;
                    }
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(stream);
                    }
                    const value = stream.newValue;
                    return rule.f(value) ? value : Furple.DO_NOT_SEND;
                }
                case 6 /* RuleKind.FOLD */: {
                    const stream = rule.parent.deref();
                    if (stream === undefined) {
                        _closeNode(node);
                        return Furple.DO_NOT_SEND;
                    }
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(stream);
                        if (node.value === IS_STREAM) {
                            throw new AssertionError(`Fold node should have value`, node);
                        }
                    }
                    return rule.f(node.value, stream.newValue);
                }
                case 7 /* RuleKind.LIFT */: {
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(rule.parent1, rule.parent2);
                    }
                    return rule.f(_mostRecentValue(rule.parent1), _mostRecentValue(rule.parent2));
                }
                case 8 /* RuleKind.LIFT_ALL */: {
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(...rule.parents);
                    }
                    const args = rule.parents.map(_mostRecentValue);
                    return rule.f(...args);
                }
                case 9 /* RuleKind.MERGE */: {
                    const s1 = rule.parent1.deref(), s2 = rule.parent2.deref();
                    if (s1 === undefined) {
                        if (s2 === undefined) {
                            _closeNode(node);
                            return Furple.DO_NOT_SEND;
                        }
                        node.rule = { kind: 3 /* RuleKind.COPY */, engine: rule.engine, parent: rule.parent2 };
                        return this.#recomputeNode(node);
                    }
                    else if (s2 === undefined) {
                        node.rule = { kind: 3 /* RuleKind.COPY */, engine: rule.engine, parent: rule.parent1 };
                        return this.#recomputeNode(node);
                    }
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(s1, s2);
                    }
                    return s2.newValue === NOT_UPDATED ? s1.newValue
                        : s1.newValue === NOT_UPDATED ? s2.newValue
                            : rule.f(s1.newValue, s2.newValue);
                }
                case 10 /* RuleKind.SELECT */: {
                    let newValue = Furple.DO_NOT_SEND;
                    _forEachSelectParent(rule, parent => {
                        if (parent.newValue !== NOT_UPDATED) {
                            newValue = parent.newValue;
                            return BREAK;
                        }
                    });
                    if (1 /* Config.DEBUG */ && newValue === Furple.DO_NOT_SEND) {
                        throw new AssertionError(`At least one parent should have been updated`, rule);
                    }
                    return newValue;
                }
                case 11 /* RuleKind.SNAPSHOT */: {
                    const stream = rule.parent.deref();
                    if (stream === undefined) {
                        _closeNode(node);
                        return Furple.DO_NOT_SEND;
                    }
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(stream);
                    }
                    // snapshot always sees cell values from the start of the transaction
                    return rule.f(stream.newValue, rule.cell.value);
                }
                case 12 /* RuleKind.SNAPSHOT_ALL */: {
                    const stream = rule.parent.deref();
                    if (stream === undefined) {
                        _closeNode(node);
                        return Furple.DO_NOT_SEND;
                    }
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(stream);
                    }
                    // snapshot always sees cell values from the start of the transaction
                    const args = rule.cells.map(c => c.value);
                    return rule.f(stream.newValue, ...args);
                }
                case 13 /* RuleKind.SNAPSHOT_LIVE */: {
                    const stream = rule.parent.deref();
                    if (stream === undefined) {
                        _closeNode(node);
                        return Furple.DO_NOT_SEND;
                    }
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(stream);
                    }
                    return rule.f(stream.newValue, _mostRecentValue(rule.cell));
                }
                case 14 /* RuleKind.SNAPSHOT_ALL_LIVE */: {
                    const stream = rule.parent.deref();
                    if (stream === undefined) {
                        _closeNode(node);
                        return Furple.DO_NOT_SEND;
                    }
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(stream);
                    }
                    const args = rule.cells.map(_mostRecentValue);
                    return rule.f(stream.newValue, ...args);
                }
                case 15 /* RuleKind.BRANCH */: {
                    const parent = rule.parent.deref();
                    if (parent === undefined) {
                        _closeNode(node);
                        return Furple.DO_NOT_SEND;
                    }
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(parent);
                    }
                    const newValue = parent.newValue;
                    if (parent.value !== IS_STREAM) {
                        // update two boolean cells
                        const notifyOld = rule.f.get(parent.value), notifyNew = rule.f.get(newValue);
                        if (notifyOld !== undefined) {
                            this.#doSend(notifyOld, false);
                        }
                        if (notifyNew !== undefined) {
                            this.#doSend(notifyNew, true);
                        }
                    }
                    else {
                        // update just one stream
                        const notify = rule.f.get(newValue);
                        if (notify !== undefined) {
                            this.#doSend(notify, newValue);
                        }
                    }
                    return newValue;
                }
                case 17 /* RuleKind.FLATTEN */: {
                    const container = rule.parent1.deref();
                    if (container === undefined) {
                        node.rule = rule.parent2 !== undefined
                            ? { kind: 3 /* RuleKind.COPY */, engine: rule.engine, parent: rule.parent2 }
                            : { kind: 0 /* RuleKind.CLOSED */, engine: undefined };
                        return this.#recomputeNode(node);
                    }
                    const oldSource = rule.parent2?.deref(), newSource = _mostRecentValue(container);
                    if (1 /* Config.DEBUG */) {
                        if (oldSource !== undefined && !(oldSource instanceof Node)) {
                            throw new AssertionError(`Old source must be a node`, oldSource);
                        }
                        else if (newSource !== undefined) {
                            if (!(newSource instanceof Node)) {
                                throw new AssertionError(`New source must be a node`, newSource);
                            }
                            _assertOwn(this, newSource);
                            _assertUpdated(container, newSource);
                        }
                        else {
                            _assertUpdated(container);
                        }
                    }
                    if (oldSource !== newSource) {
                        oldSource?.removeNotifiableChild(node);
                        newSource?.addNotifiableChild(node);
                        rule.parent2 = newSource !== undefined ? new WeakRef(newSource) : undefined;
                        if (node.recomputeDepth()) {
                            this.#q.rebuild();
                        }
                    }
                    return newSource === undefined ? undefined
                        : newSource.newValue !== NOT_UPDATED ? newSource.newValue
                            : newSource.value !== IS_STREAM ? newSource.value
                                : Furple.DO_NOT_SEND;
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
            if (1 /* Config.DEBUG */) {
                _assertOwn(this, node);
            }
            if (node.isClosed()) {
                throw new Error(`Cannot send to this sink; it is closed`);
            }
            switch (this.#state) {
                case 0 /* EngineState.IDLE */: {
                    // start a new transaction
                    this.run(() => this.#doSend(node, value));
                    break;
                }
                case 1 /* EngineState.PREPARING */: {
                    // this is a recursive call which is part of the current transaction
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
            if (this.#state !== 0 /* EngineState.IDLE */) {
                throw new Error(`run() cannot be called during an FRP transaction`);
            }
            try {
                this.#state = 1 /* EngineState.PREPARING */;
                f();
                this.#state = 2 /* EngineState.BUSY */;
                // propagate updates
                const q = this.#q;
                const seen = new Set();
                while (true) {
                    const node = q.poll();
                    if (node === undefined) {
                        break;
                    }
                    if (seen.has(node)) {
                        continue;
                    }
                    seen.add(node);
                    if (_sampleAllowed(node)) {
                        this.#state = 3 /* EngineState.BUSY_BUT_SAMPLE_ALLOWED */;
                    }
                    const v = this.#recomputeNode(node);
                    this.#state = 2 /* EngineState.BUSY */;
                    if (v !== Furple.DO_NOT_SEND) {
                        this.#doSend(node, v);
                    }
                }
                // copy across new cell values, so that it is safe for
                // listeners to sample from other cells
                for (const node of this.#dirty) {
                    if (node.value !== IS_STREAM) {
                        node.value = node.newValue;
                    }
                }
                this.#state = 4 /* EngineState.DISPATCHING */;
                // dispatch events to listeners
                for (const node of this.#dirty) {
                    if (1 /* Config.DEBUG */) {
                        _assertUpdated(node);
                    }
                    if (node.rule.kind === 2 /* RuleKind.LISTENER */) {
                        node.rule.f(node.newValue);
                    }
                }
                this.#state = 5 /* EngineState.FINISHED_DISPATCHING */;
            }
            finally {
                // clean up
                this.#q.reset();
                for (const node of this.#dirty) {
                    node.newValue = NOT_UPDATED;
                }
                this.#dirty.length = 0;
                this.#state = 0 /* EngineState.IDLE */;
            }
        }
        /**
         * Indicates whether this engine is current executing an FRP
         * transaction.
         */
        isBusy() {
            return this.#state === 2 /* EngineState.BUSY */
                || this.#state === 3 /* EngineState.BUSY_BUT_SAMPLE_ALLOWED */;
        }
        /**
         * Samples the current value of a cell. Equivalent to `cell.sample()`.
         */
        sample(cell) {
            if (this.#state === 2 /* EngineState.BUSY */) {
                console.error(`sample() should not be called here`);
            }
            const node = cell;
            if (1 /* Config.DEBUG */) {
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
            return new Node(f !== undefined ? { kind: 1 /* RuleKind.SINK */, engine: this, parents: [], f } : this.#nonCoalescingSinkRule, IS_STREAM);
        }
    }
    Furple.Engine = Engine;
    function _connect(sink, source) {
        const engine = sink.rule.engine;
        if (engine === undefined) {
            throw new Error(`Cannot connect; sink is already closed`);
        }
        if (1 /* Config.DEBUG */) {
            _assertOwn(engine, source);
        }
        if (engine.isBusy()) {
            // this operation cannot be allowed unless idle, because it
            // can increase node depths, and might cause a node to be
            // visited twice in the current transaction
            throw new Error(`Cannot connect during an FRP transaction`);
        }
        else if (sink.rule.kind !== 1 /* RuleKind.SINK */) {
            throw new Error(`Cannot connect; sink is already connected`);
        }
        if (source.value !== IS_STREAM) {
            engine.send(sink, source.value);
        }
        const rule = sink.rule;
        const parent = new WeakRef(source);
        if (rule.parents === undefined) {
            // one connection allowed
            sink.rule = { kind: 3 /* RuleKind.COPY */, engine, parent };
        }
        else {
            rule.parents.push(parent);
        }
        source.addNotifiableChild(sink);
        sink.recomputeDepth();
    }
    function _map(node, f) {
        const engine = node.rule.engine;
        if (engine === undefined && node.value === IS_STREAM) {
            return Furple.NEVER;
        }
        return new Node(engine === undefined ? CLOSED : { kind: 4 /* RuleKind.MAP */, engine, parent: new WeakRef(node), f }, node.value !== IS_STREAM ? f(node.value) : IS_STREAM);
    }
    function _fold(s, initialValue, f) {
        const stream = s, engine = stream.rule.engine;
        return new Node(engine === undefined ? CLOSED : { kind: 6 /* RuleKind.FOLD */, engine, parent: new WeakRef(stream), f }, initialValue);
    }
    function _foldBoth(s, initialValue, f) {
        const stream = s, engine = stream.rule.engine;
        if (engine === undefined) {
            return [constant(initialValue), Furple.NEVER];
        }
        // need to make a stream that doesn't hold the value, so that `.map`
        // will work correctly. normally it's unsound to make a stream from
        // a cell, but for a fold cell this is safe because the cell's
        // value only changes when the accumulated stream fires
        const acc = _fold(s, initialValue, f), accS = new Node({ kind: 3 /* RuleKind.COPY */, engine, parent: new WeakRef(acc) }, IS_STREAM);
        // by copying from a cell, stream events are suppressed when
        // `f(acc, t)` equals `acc` using the given equality function; this
        // behaviour is documented
        return [acc, accS];
    }
    function _snap(s, c, live, f) {
        const stream = s, cell = c, engine = stream.rule.engine;
        if (engine === undefined) {
            return Furple.NEVER;
        }
        if (1 /* Config.DEBUG */) {
            _assertOwn(engine, cell);
        }
        const kind = live ? 13 /* RuleKind.SNAPSHOT_LIVE */ : 11 /* RuleKind.SNAPSHOT */;
        return new Node({ kind, engine, parent: new WeakRef(stream), cell, f }, IS_STREAM);
    }
    function _snapAll(s, cs, live, f) {
        if (cs.length === 0) {
            return s.map(f);
        }
        else if (cs.length === 1) {
            return _snap(s, cs[0], live, f);
        }
        const stream = s, cells = cs, engine = stream.rule.engine;
        if (engine === undefined) {
            return Furple.NEVER;
        }
        if (1 /* Config.DEBUG */) {
            _assertOwn(engine, ...cells);
        }
        const kind = live ? 14 /* RuleKind.SNAPSHOT_ALL_LIVE */ : 12 /* RuleKind.SNAPSHOT_ALL */;
        return new Node({ kind, engine, parent: new WeakRef(stream), cells, f }, IS_STREAM);
    }
    /**
     * A stream which never fires.
     */
    Furple.NEVER = new Node(CLOSED, IS_STREAM);
    /**
     * Creates a new cell with a constant value.
     */
    function constant(value) {
        return new Node(CLOSED, value);
    }
    Furple.constant = constant;
    /**
     * A constant cell with the value `undefined`.
     */
    Furple.UNDEFINED = constant(undefined);
    function liftAll(cells, f) {
        const parents = cells;
        let engine = undefined;
        for (const cell of parents) {
            engine = cell.rule.engine;
            if (engine !== undefined) {
                break;
            }
        }
        if (parents.length === 0) {
            return constant(f());
        }
        else if (parents.length === 1) {
            return parents[0].map(f);
        }
        else if (parents.length === 2) {
            return parents[0].lift(parents[1], f);
        }
        const values = parents.map(c => c.value);
        const initialValue = f(...values);
        if (engine === undefined) {
            return constant(initialValue);
        }
        if (1 /* Config.DEBUG */) {
            _assertOwn(engine, ...parents);
        }
        return new Node({ kind: 8 /* RuleKind.LIFT_ALL */, engine, parents, f }, initialValue);
    }
    Furple.liftAll = liftAll;
    /**
     * Creates a new FRP stream which fires whenever any of the given streams
     * fires. The streams have priority according to the order they are given,
     * so that if multiple fire simultaneously, the value is taken from the
     * earliest stream in the argument list which fired.
     */
    function select(...streams) {
        const parents = streams.filter(p => !p.isClosed());
        if (parents.length === 0) {
            return Furple.NEVER;
        }
        else if (parents.length === 1) {
            return parents[0];
        }
        const engine = _expectEngine(parents[0]);
        if (1 /* Config.DEBUG */) {
            _assertOwn(engine, ...parents);
        }
        return new Node({ kind: 10 /* RuleKind.SELECT */, engine, parents: parents.map(p => new WeakRef(p)) }, IS_STREAM);
    }
    Furple.select = select;
    function branch(of) {
        const node = of;
        const engine = node.rule.engine;
        if (engine === undefined) {
            return node;
        }
        return new Node({ kind: 15 /* RuleKind.BRANCH */, engine, parent: new WeakRef(node), f: new Map() }, node.value);
    }
    Furple.branch = branch;
    function flatten(cell) {
        const node = cell, nested = node.value, engine = node.rule.engine;
        if (engine === undefined) {
            return nested ?? Furple.UNDEFINED;
        }
        if (1 /* Config.DEBUG */ && nested !== undefined && !(nested instanceof Node)) {
            throw new AssertionError(`Inner value must be cell or stream`, nested);
        }
        const rule = {
            kind: 17 /* RuleKind.FLATTEN */,
            engine,
            parent1: new WeakRef(node),
            parent2: nested !== undefined ? new WeakRef(nested) : undefined,
        };
        return new Node(rule, nested?.value);
    }
    Furple.flatten = flatten;
    function persist(key, cell, conv = Furple.Type.STR) {
        const setter = (value) => {
            try {
                window.localStorage.setItem(key, conv.toStr(value));
            }
            catch (e) {
                console.error(`Failed to store '${key}' in local storage`, e);
            }
        };
        try {
            const node = cell, stored = window.localStorage.getItem(key);
            if (stored !== null) {
                node.send(conv.fromStr(stored));
                node.listen(setter);
            }
            else {
                node.observe(setter);
            }
        }
        catch (e) {
            console.warn(`Failed to load '${key}' from local storage`);
        }
    }
    Furple.persist = persist;
    function _expectEngine(node) {
        const engine = node.rule.engine;
        if (engine === undefined) {
            throw new AssertionError(`Node is closed`, node);
        }
        return engine;
    }
    function _mostRecentValue(cell) {
        return cell.newValue !== NOT_UPDATED ? cell.newValue : cell.value;
    }
    function _sampleAllowed(node) {
        const rule = node.rule;
        switch (rule.kind) {
            case 4 /* RuleKind.MAP */:
                return node.value === IS_STREAM;
            case 5 /* RuleKind.FILTER */:
            case 6 /* RuleKind.FOLD */:
            case 9 /* RuleKind.MERGE */:
            case 11 /* RuleKind.SNAPSHOT */:
            case 12 /* RuleKind.SNAPSHOT_ALL */:
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
        _forEachNotifiableParent(rule, parent => parent.removeNotifiableChild(node));
        _forEachNonNotifiableParent(rule, parent => parent.removeNonNotifiableChild(node));
        _forEachChild(node, child => child.tidy());
        // help with garbage collection; lift or live-snapshot nodes do not deregister themselves when one parent closes
        node.notifiableChildren.length = 0;
        node.nonNotifiableChildren.length = 0;
    }
    function _assertCell(node) {
        if (node.value === IS_STREAM) {
            throw new AssertionError(`Expected cell`, node);
        }
    }
    function _assertOwn(engine, ...objs) {
        for (const obj of objs) {
            if (obj.rule.engine !== undefined && obj.rule.engine !== engine) {
                throw new AssertionError('Object is owned by a different FRP engine', [engine, obj]);
            }
        }
    }
    function _assertUpdated(...nodes) {
        if (nodes.every(node => node.newValue === NOT_UPDATED)) {
            throw new AssertionError('At least one of these nodes should have been updated', nodes);
        }
    }
    function _reportDependencyCycle(root) {
        const map = new Map();
        const q = [root];
        while (true) {
            const current = q.shift();
            if (current === undefined) {
                throw new AssertionError(`Expected to report cycle, but no cycle was found!`, root);
            }
            _forEachParent(current.rule, parent => {
                if (parent === root) {
                    const cycle = [];
                    let cur = current;
                    while (cur !== undefined) {
                        cycle.push(cur);
                        cur = map.get(cur);
                    }
                    cycle.reverse();
                    const message = 'Circular dependency:\n---\n' + cycle.map(node => node.name ?? '<anonymous>').join('\n');
                    console.error(message, cycle);
                    throw new Error(`${message}\n---\nSee console for more details`);
                }
                else if (!map.has(parent)) {
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
(function (Furple) {
    /**
     * Contains constants and functions for creating `Serializer` objects,
     * which are used by the `persist(...)` function.
     */
    let Type;
    (function (Type) {
        const id = (s) => s;
        const toStr = (x) => `${x}`;
        /**
         * Serializes boolean values.
         */
        Type.BOOL = {
            toStr: b => b ? 'true' : 'false',
            fromStr: s => s === 'true',
        };
        /**
         * Serializes integer values.
         */
        Type.INT = {
            toStr,
            fromStr: s => parseInt(s),
        };
        /**
         * Serializes BigInt values.
         */
        Type.BIGINT = {
            toStr,
            fromStr: BigInt,
        };
        /**
         * Serializes floating-point numeric values.
         */
        Type.FLOAT = {
            toStr,
            fromStr: parseFloat,
        };
        /**
         * Serializes string values.
         */
        Type.STR = {
            toStr: id,
            fromStr: id,
        };
        /**
         * Creates a Serializer for a homogeneous array.
         */
        function array(conv) {
            return {
                toStr: a => JSON.stringify(a.map(conv.toStr)),
                fromStr: s => JSON.parse(s).map(conv.fromStr),
            };
        }
        Type.array = array;
        /**
         * Creates a Serializer for a homogeneous object.
         */
        function object(conv) {
            return {
                toStr: o => JSON.stringify(_mapObj(o, conv.toStr)),
                fromStr: s => _mapObj(JSON.parse(s), conv.fromStr),
            };
        }
        Type.object = object;
        /**
         * Creates a Serializer for a Map.
         */
        function map(conv) {
            return {
                toStr: m => JSON.stringify(_mapObj(Object.fromEntries(m), conv.toStr)),
                fromStr: s => new Map(Object.entries(_mapObj(JSON.parse(s), conv.fromStr))),
            };
        }
        Type.map = map;
        /**
         * Creates a Serializer for a Set.
         */
        function set(conv) {
            return {
                toStr: s => JSON.stringify([...s].map(conv.toStr)),
                fromStr: s => new Set(JSON.parse(s).map(conv.fromStr)),
            };
        }
        Type.set = set;
        function _mapObj(obj, f) {
            const out = Object.create(null);
            for (const [k, v] of Object.entries(obj)) {
                out[k] = f(v);
            }
            return out;
        }
    })(Type = Furple.Type || (Furple.Type = {}));
})(Furple || (Furple = {}));
