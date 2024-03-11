namespace Furple {
    const enum RuleKind {
        /**
         * A cell or stream which can never receive a new value. Sinks and
         * listeners can be closed outside of FRP transactions; other nodes can
         * become closed if their children or parents do.
         */
        CLOSED,
        
        /**
         * A cell or stream which can receive values from outside of the FRP
         * graph.
         */
        SINK,
        
        /**
         * A stream which invokes a (presumably side-effectful) callback at the
         * end of an FRP transaction.
         */
        LISTENER,
        
        /**
         * A cell or stream which receives the same values as its parent node.
         */
        COPY,
        
        /**
         * A cell or stream whose value is computed from its parent node based
         * on a given mapping function. If it is a stream, the mapping function
         * may also filter out stream values by returning `DO_NOT_SEND`.
         */
        MAP,
        
        /**
         * A stream which fires with the same value as its parent stream, if
         * the value satisfies a given predicate.
         */
        FILTER,
        
        /**
         * A cell or stream whose value is the fold of all values received from
         * its parent stream, using a given initial value and binary function.
         */
        FOLD,
        
        /**
         * A cell whose value is the result of a binary function applied to two
         * parent cells.
         */
        LIFT,
        
        /**
         * A cell whose value is the result of an n-ary function applied to its
         * list of parent cells.
         */
        LIFT_ALL,
        
        /**
         * A stream which fires when one or both of its parent streams fire,
         * either with the value of one firing parent, or a combined value from
         * both using a given binary function.
         */
        MERGE,
        
        /**
         * A stream which fires when any one of its list of parent streams
         * fires, with the value of its earliest parent in the list.
         */
        SELECT,
        
        /**
         * Equivalent to a `MAP` stream whose mapping function samples a cell.
         */
        SNAPSHOT,
        
        /**
         * Equivalent to a `MAP` stream whose mapping function samples all of a
         * list of cells.
         */
        SNAPSHOT_ALL,
        
        /**
         * A `SNAPSHOT` stream which receives the most recent value from the
         * snapshotted cell, rather than a sample from the start of the
         * transaction.
         */
        SNAPSHOT_LIVE,
        
        /**
         * A `SNAPSHOT_ALL` stream which receives the most recent values from
         * the snapshotted cells, rather than samples from the start of the
         * transaction.
         */
        SNAPSHOT_ALL_LIVE,
        
        /**
         * Either:
         * - A cell which may have multiple `BRANCH_ON` child cells, each of
         *   which is equivalent to a `MAP` of the form `v => v === w` for some
         *   constant `w`.
         * - A stream which may have multiple `BRANCH_ON` child streams, each
         *   of which is equivalent to a `FILTER` of the form `v => v === w`
         *   for some constant `w`.
         * 
         * This exists as an optimisation, when one node would have many such
         * children, so that it does not have to notify every child on every
         * new value.
         */
        BRANCH,
        
        /**
         * Either:
         * - A cell which is equivalent to a `MAP` of the form `v => v === w`
         *   for some constant `w`.
         * - A stream which is equivalent to a `FILTER` of the form
         *   `v => v === w` for some constant `w`.
         * 
         * The parent node must be a `BRANCH`.
         */
        BRANCH_ON,
        
        /**
         * Either:
         * - A cell whose parent is a cell containing either a nested cell, or
         *   the value `undefined`. This cell's value is the nested value, or
         *   `undefined`, respectively.
         * - A stream whose parent is a cell containing either a nested stream,
         *   or the value `undefined`. This stream fires when the nested stream
         *   fires, if there is one.
         */
        FLATTEN,
    }
    
    /**
     * A node which is a dependency of a rule. This is a restricted interface
     * so that the type parameter `T` is covariant.
     */
    interface Parent<out T = unknown> {
        isClosed(): boolean;
        addNotifiableChild<U>(node: Node<U>): void;
        removeNotifiableChild<U>(node: Node<U>): void;
        removeNonNotifiableChild<U>(node: Node<U>): void;
        readonly depth: number;
        readonly rule: Omit<Rule<T>, 'f'>;
        readonly value: T | IsStream;
        readonly newValue: T | NotUpdated;
    }
    
    /**
     * A cell node which is a dependency of a rule. This is a restricted
     * interface so that the type parameter `T` is covariant.
     */
    interface ParentCell<out T = unknown> extends Parent<T> {
        readonly rule: Omit<CellRule<T>, 'f'>;
        readonly value: T;
    }
    
    /**
     * A stream node which is a dependency of a rule. This is a restricted
     * interface so that the type parameter `T` is covariant.
     */
    interface ParentStream<out T = unknown> extends Parent<T> {
        readonly rule: Omit<StreamRule<T>, 'f'>;
    }
    
    type WeakParent<T = unknown> = WeakRef<Parent<T>>
    type WeakParentCell<T = unknown> = WeakRef<ParentCell<T>>
    type WeakParentStream<T = unknown> = WeakRef<ParentStream<T>>
    
    /**
     * A backlink to a node which should be notified when its dependency has a
     * new value.
     */
    interface Child {
        readonly depth: number;
        recomputeDepth(): boolean;
        tidy(): void;
    }
    
    /**
     * A cell node which is a loose dependency of a "snapshot" rule. A snapshot
     * rule only samples a cell's `value`, not its `newValue`, and the snapshot
     * node is not notified when the cell's value changes.
     */
    interface SnapshotCell {readonly value: unknown}
    
    // have to use `any` a lot here, because TS doesn't have existential types
    type Rule<T, K extends RuleKind = RuleKind> = Extract<(
        Readonly<
            | {kind: RuleKind.CLOSED, engine: undefined}
            | {kind: RuleKind.SINK, engine: Engine, parents: undefined, f: undefined}
            | {kind: RuleKind.SINK, engine: Engine, parents: WeakParent<T>[], f: (a: T, b: T) => T}
            | {kind: RuleKind.LISTENER, engine: Engine, parent: WeakParent<T>, f: (x: T) => void}
            | {kind: RuleKind.COPY, engine: Engine, parent: WeakParent<T>}
            | {kind: RuleKind.MAP, engine: Engine, parent: WeakParent, f: (x: any) => T | DoNotSend}
            | {kind: RuleKind.FILTER, engine: Engine, parent: WeakParentStream<T>, f: (x: T) => boolean}
            | {kind: RuleKind.FOLD, engine: Engine, parent: WeakParentStream, f: (acc: T, delta: any) => T}
            | {kind: RuleKind.LIFT, engine: Engine, parent1: ParentCell, parent2: ParentCell, f: (a: any, b: any) => T}
            | {kind: RuleKind.LIFT_ALL, engine: Engine, parents: readonly ParentCell[], f: (...args: any) => T}
            | {kind: RuleKind.MERGE, engine: Engine, parent1: WeakParentStream<T>, parent2: WeakParentStream<T>, f: (a: any, b: any) => T}
            | {kind: RuleKind.SELECT, engine: Engine, parents: WeakParentStream<T>[]}
            | {kind: RuleKind.SNAPSHOT, engine: Engine, parent: WeakParentStream, cell: SnapshotCell, f: (a: any, b: any) => T | DoNotSend}
            | {kind: RuleKind.SNAPSHOT_ALL, engine: Engine, parent: WeakParentStream, cells: readonly SnapshotCell[], f: (...args: any) => T | DoNotSend}
            | {kind: RuleKind.SNAPSHOT_LIVE, engine: Engine, parent: WeakParentStream, cell: ParentCell, f: (a: any, b: any) => T | DoNotSend}
            | {kind: RuleKind.SNAPSHOT_ALL_LIVE, engine: Engine, parent: WeakParentStream, cells: readonly ParentCell[], f: (...args: any) => T | DoNotSend}
            | {kind: RuleKind.BRANCH, engine: Engine, parent: WeakParent<T>, f: Map<T, Node<unknown>>}
            | {kind: RuleKind.BRANCH_ON, engine: Engine, parent: WeakParent, key: unknown}
        > | FlattenRule<T>
    ), {kind: K}>
    
    type FlattenRule<T> = {
        readonly kind: RuleKind.FLATTEN,
        readonly engine: Engine,
        readonly parent1: WeakParentCell<Node<T> | undefined>,
        parent2: WeakParent<T> | undefined,
    }
    
    type CellRuleKind = RuleKind.CLOSED | RuleKind.SINK | RuleKind.COPY | RuleKind.MAP | RuleKind.FOLD | RuleKind.LIFT | RuleKind.LIFT_ALL | RuleKind.BRANCH | RuleKind.BRANCH_ON | RuleKind.FLATTEN
    type StreamRuleKind = RuleKind.CLOSED | RuleKind.SINK | RuleKind.LISTENER | RuleKind.COPY | RuleKind.MAP | RuleKind.FOLD | RuleKind.FILTER | RuleKind.MERGE | RuleKind.SELECT | RuleKind.SNAPSHOT | RuleKind.SNAPSHOT_ALL | RuleKind.SNAPSHOT_LIVE | RuleKind.SNAPSHOT_ALL_LIVE | RuleKind.BRANCH | RuleKind.BRANCH_ON | RuleKind.FLATTEN
    
    type CellRule<T> = Rule<T, CellRuleKind>
    type StreamRule<T> = Rule<T, StreamRuleKind>
    
    const CLOSED: Rule<unknown, RuleKind.CLOSED> = {
        kind: RuleKind.CLOSED,
        engine: undefined,
    };
    
    /**
     * Sentinel value indicating that a `_forEach` loop should terminate.
     */
    const BREAK = Symbol();
    type Break = typeof BREAK;
    
    function _forEachSinkParent<T>(rule: Rule<T, RuleKind.SINK>, f: (x: Parent<T>) => void | Break): void | Break {
        const parents = rule.parents;
        if(parents === undefined) { return; }
        
        for(let i = parents.length - 1; i >= 0; --i) {
            const conn = parents[i].deref();
            if(conn !== undefined) {
                if(f(conn) === BREAK) { return BREAK; }
            } else {
                // delete without preserving order
                parents[i] = parents[parents.length - 1];
                parents.pop();
            }
        }
    }
    
    function _forEachSelectParent<T>(rule: Rule<T, RuleKind.SELECT>, f: (s: ParentStream<T>) => void | Break): void | Break {
        const parents = rule.parents;
        for(let i = 0; i < parents.length;) {
            const parent = parents[i].deref();
            if(parent !== undefined) {
                if(f(parent) === BREAK) { return BREAK; }
                ++i;
            } else {
                // delete preserving order
                parents.splice(i, 1);
            }
        }
    }
    
    function _forEachNotifiableParent<T>(rule: Rule<T>, f: (x: Parent) => void | Break): void | Break {
        switch(rule.kind) {
            case RuleKind.CLOSED:
            case RuleKind.BRANCH_ON:
                return;
            
            case RuleKind.SINK: {
                return _forEachSinkParent(rule, f);
            }
            
            case RuleKind.LISTENER:
            case RuleKind.COPY:
            case RuleKind.BRANCH:
            case RuleKind.FOLD:
            case RuleKind.MAP:
            case RuleKind.FILTER:
            case RuleKind.SNAPSHOT:
            case RuleKind.SNAPSHOT_ALL:
            case RuleKind.SNAPSHOT_LIVE:
            case RuleKind.SNAPSHOT_ALL_LIVE: {
                // cells are not notifiable parents of snapshots
                const parent = rule.parent.deref();
                if(parent !== undefined) { return f(parent); }
                return;
            }
            
            case RuleKind.LIFT: {
                if(f(rule.parent1) === BREAK) { return BREAK; }
                return f(rule.parent2);
            }
            
            case RuleKind.LIFT_ALL: {
                for(const parent of rule.parents) {
                    if(f(parent) === BREAK) { return BREAK; }
                }
                return;
            }
            
            case RuleKind.SELECT: {
                return _forEachSelectParent(rule, f);
            }
            
            case RuleKind.MERGE:
            case RuleKind.FLATTEN: {
                const parent1 = rule.parent1.deref(),
                    parent2 = rule.parent2?.deref();
                if(parent1 !== undefined) {
                    if(f(parent1) === BREAK) { return BREAK; }
                }
                if(parent2 !== undefined) {
                    return f(parent2);
                }
                return;
            }
        }
        
        // exhaustivity check
        const _: never = rule;
    }
    
    function _forEachNonNotifiableParent<T>(rule: Rule<T>, f: (x: Parent) => void | Break): void {
        switch(rule.kind) {
            case RuleKind.BRANCH_ON: {
                const parent = rule.parent.deref();
                if(parent !== undefined) { f(parent); }
                return;
            }
            
            case RuleKind.SNAPSHOT_LIVE: {
                f(rule.cell);
                return;
            }
            
            case RuleKind.SNAPSHOT_ALL_LIVE: {
                for(const cell of rule.cells) {
                    if(f(cell) === BREAK) { return; }
                }
                return;
            }
        }
    }
    
    function _forEachParent<T>(rule: Rule<T>, f: (x: Parent) => void | Break): void {
        if(_forEachNotifiableParent(rule, f) === BREAK) { return; }
        _forEachNonNotifiableParent(rule, f);
    }
    
    function _forEachNotifiableChild<T>(parent: Node<T>, f: (child: Node<unknown>) => void): void {
        for(const child of parent.notifiableChildren) {
            f(child as Node<unknown>);
        }
    }
    function _forEachChild<T>(parent: Node<T>, f: (child: Node<unknown>) => void): void {
        _forEachNotifiableChild(parent, f);
        for(const child of parent.nonNotifiableChildren) {
            f(child as Node<unknown>);
        }
        
        if(parent.rule.kind === RuleKind.BRANCH) {
            for(const child of parent.rule.f.values()) {
                f(child as Node<unknown>);
            }
        }
    }
    
    /**
     * Sentinel value indicating that a value should not be sent. This may be
     * returned by a callback to `Stream.map`, `Stream.snapshot` or `Stream.snapshotAll`.
     */
    export const DO_NOT_SEND = Symbol();
    export type DoNotSend = typeof DO_NOT_SEND
    
    /**
     * Sentinel value indicating a node has not been updated yet in the current
     * transaction.
     */
    const NOT_UPDATED = Symbol();
    type NotUpdated = typeof NOT_UPDATED
    
    /**
     * Sentinel value indicating that a node represents a stream rather than a
     * cell.
     */
    const IS_STREAM = Symbol();
    type IsStream = typeof IS_STREAM
    
    type CellNode<T> = Node<T> & ParentCell<T>
    type StreamNode<T> = Node<T> & ParentStream<T>
    
    interface CleanUp {
        value: unknown,
        newValue: unknown,
        readonly rule: Pick<Rule<any, RuleKind.LISTENER>, 'kind' | 'f'> | {readonly kind: Exclude<RuleKind, RuleKind.LISTENER>},
    }
    
    const DEFAULT_EQUALITY_FUNCTION = Object.is;
    
    class Node<T> implements Parent<T>, CleanUp, BranchCell<T>, BranchStream<T>, CellSink<T>, StreamSink<T>, ListenerToken {
        name: string | undefined = undefined;
        depth: number = 0;
        newValue: T | NotUpdated = NOT_UPDATED;
        
        equalityFunc: (x: T, y: T) => boolean = DEFAULT_EQUALITY_FUNCTION;
        
        notifiableChildren: Child[] = [];
        nonNotifiableChildren: Child[] = [];
        
        constructor(rule: CellRule<T>, value: T);
        constructor(rule: StreamRule<T>, value: IsStream);
        constructor(rule: Rule<T, CellRuleKind & StreamRuleKind>, value: T | IsStream);
        constructor(
            public rule: Rule<T>,
            // using a default `value = IS_STREAM` here is wrong, because an
            // explicit `undefined` value for a cell would become `IS_STREAM`
            public value: T | IsStream,
        ) {
            _forEachNotifiableParent(rule, parent => {
                parent.addNotifiableChild(this);
            });
            this.#fixDepth();
            
            if(Config.DEBUG) {
                this.value = _freezeValue(value);
            }
        }
        
        public named(name: string): this {
            this.name = name;
            return this;
        }
        
        #fixDepth(): boolean {
            const oldDepth = this.depth;
            let depth = 0;
            _forEachParent(this.rule, parent => {
                if(parent.depth >= depth) { depth = parent.depth + 1; }
            });
            this.depth = depth;
            // use > instead of !== here, to avoid performance blowup
            // this means depth could eventually exceed MAX_SAFE_INTEGER in pathological cases
            return depth > oldDepth;
        }
        
        recomputeDepth(): boolean {
            if(!this.#fixDepth()) { return false; }
            
            const stack = [this as Node<unknown>];
            while(stack.length > 0) {
                const current = stack.pop()!;
                
                _forEachChild(current, child => {
                    if(child === this) { _reportDependencyCycle(this as Node<unknown>); }
                    
                    if(child.#fixDepth()) { stack.push(child); }
                });
            }
            
            return true;
        }
        
        addNotifiableChild<U>(child: Node<U>): void {
            this.notifiableChildren.push(child);
        }
        
        addNonNotifiableDependent<U>(child: Node<U>): void {
            this.nonNotifiableChildren.push(child);
        }
        
        removeNotifiableChild<U>(child: Node<U>): void {
            const dependents = this.notifiableChildren;
            const i = dependents.indexOf(child);
            if(i >= 0) { dependents.splice(i, 1); }
        }
        
        removeNonNotifiableChild<U>(child: Node<U>): void {
            if(child.rule.kind === RuleKind.BRANCH_ON) {
                // BRANCH_ON nodes don't register themselves as a notifiable dependency
                if(Config.DEBUG) {
                    if(child.rule.parent.deref() !== this) {
                        throw new AssertionError(`BRANCH_ON node tried to deregister from wrong parent`, [this, child]);
                    } else if(this.rule.kind !== RuleKind.BRANCH && this.rule.kind !== RuleKind.CLOSED) {
                        throw new AssertionError(`BRANCH_ON node has non-BRANCH node as parent`, child);
                    }
                }
                
                const parentRule = this.rule as Rule<unknown, RuleKind.BRANCH>;
                parentRule.f.delete(child.rule.key);
            } else {
                const children = this.nonNotifiableChildren;
                const i = children.indexOf(child);
                if(i >= 0) { children.splice(i, 1); }
            }
        }
        
        isClosed(): boolean {
            return this.rule.kind === RuleKind.CLOSED;
        }
        
        /**
         * Disconnects this node and frees up resources held by it.
         */
        close(): this {
            if(this.rule.engine?.isBusy()) {
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
        tidy(): void {
            const rule = this.rule;
            
            let close = true;
            _forEachNotifiableParent(rule, d => {
                if(!d.isClosed()) {
                    close = false;
                    return BREAK;
                }
            });
            
            if(close) {
                _closeNode(this);
            } else if(rule.kind === RuleKind.MERGE) {
                const parent1 = rule.parent1.deref(), parent2 = rule.parent2.deref();
                if(parent1 === undefined || parent1.isClosed()) {
                    this.rule = {kind: RuleKind.COPY, engine: rule.engine, parent: rule.parent2};
                } else if(parent2 === undefined || parent2.isClosed()) {
                    this.rule = {kind: RuleKind.COPY, engine: rule.engine, parent: rule.parent1};
                }
            } else if(rule.kind === RuleKind.SELECT) {
                // _forEachSelectParent already removed the dropped weakrefs
                if(rule.parents.length === 1) {
                    this.rule = {kind: RuleKind.COPY, engine: rule.engine, parent: rule.parents[0]};
                }
            }
        }
        
        public listen(f: (x: T) => void): ListenerToken {
            const engine = this.rule.engine;
            return engine !== undefined
                ? new Node<T>({kind: RuleKind.LISTENER, engine, parent: new WeakRef(this), f}, IS_STREAM)
                : this;
        }
        
        public observe(f: (x: T) => void): ListenerToken {
            if(Config.DEBUG) { _assertCell(this); }
            
            f(this.value as T);
            return this.listen(f);
        }
        
        public send(value: T): void {
            _expectEngine(this).send(this, value);
        }
        
        public sendAnd(value: T, f: () => void): void {
            const engine = _expectEngine(this);
            engine.run(() => {
                engine.send(this, value);
                f();
            });
        }
        
        public connect(source: Cell<T> | Stream<T>): this {
            _connect(this, source as Node<T>);
            return this;
        }
        
        public sample(): T {
            if(Config.DEBUG) { _assertCell(this); }
            
            const engine = this.rule.engine;
            return engine !== undefined ? engine.sample(this) : this.value as T;
        }
        
        public setEqualityFunction(eq: (x: T, y: T) => boolean): this {
            if(Config.DEBUG) { _assertCell(this); }
            
            _forEachChild(this, () => {
                throw new Error(`Equality function should only be set when the cell is originally created`);
            });
            if(this.equalityFunc !== DEFAULT_EQUALITY_FUNCTION) {
                throw new Error('This cell already has an equality function');
            }
            
            this.equalityFunc = eq;
            return this;
        }
        
        public map<U>(f: (x: T) => U): Cell<U>;
        public map<U>(f: (x: T) => U | DoNotSend): Stream<U>;
        public map<U>(f: (x: T) => U | DoNotSend): Cell<U> | Stream<U> {
            return _map(this, f);
        }
        
        public lift<U, R>(otherCell: Cell<U>, f: (t: T, u: U) => R): Cell<R> {
            const parent1 = this as CellNode<T>,
                parent2 = otherCell as CellNode<U>,
                engine = parent1.rule.engine ?? parent2.rule.engine;
            
            if(Config.DEBUG) { _assertCell<T>(parent1); _assertCell<U>(parent2); }
            
            const intialValue = f(parent1.value, parent2.value);
            if(engine === undefined) { return constant(intialValue); }
            
            if(Config.DEBUG) { _assertOwn(engine, parent1, parent2); }
            return new Node({kind: RuleKind.LIFT, engine, parent1, parent2, f}, intialValue);
        }
        
        public hold(initialValue: T): Cell<T> {
            const engine = this.rule.engine;
            if(engine === undefined) { return constant(initialValue); }
            
            return new Node<T>(
                {kind: RuleKind.COPY, engine, parent: new WeakRef(this)},
                initialValue,
            );
        }
        
        public fold<U>(initialValue: U, f: (acc: U, t: T) => U): Cell<U> {
            return _fold(this, initialValue, f);
        }
        
        public foldS<U>(initialValue: U, f: (acc: U, t: T) => U): Stream<U> {
            return _foldBoth(this, initialValue, f)[1];
        }
        
        public foldBoth<U>(initialValue: U, f: (acc: U, t: T) => U): [Cell<U>, Stream<U>] {
            return _foldBoth(this, initialValue, f);
        }
        
        public filter<U extends T>(f: (x: T) => x is U): Stream<U>;
        public filter(f: (x: T) => boolean): Stream<T>;
        public filter(f: (x: T) => boolean) {
            const engine = this.rule.engine,
                self = this as StreamNode<T>;
            return engine !== undefined
                ? new Node({kind: RuleKind.FILTER, engine, parent: new WeakRef(self), f}, IS_STREAM)
                : NEVER;
        }
        
        public gate(p: Cell<boolean>): Stream<T> {
            return this.filter(() => p.sample());
        }
        
        public merge<U>(otherStream: Stream<U>, f: (a: T, b: U) => T | U): Stream<T | U> {
            const self = this as StreamNode<T>,
                other = otherStream as StreamNode<U>;
            
            if(self.isClosed()) {
                return otherStream;
            } else if(other.isClosed()) {
                return self;
            }
            
            const engine = _expectEngine(self);
            if(Config.DEBUG) { _assertOwn(engine, self, other); }
            return new Node(
                {kind: RuleKind.MERGE, engine, parent1: new WeakRef(self), parent2: new WeakRef(other), f},
                IS_STREAM,
            );
        }
        
        public orElse<U>(otherStream: Stream<U>): Stream<T | U> {
            return select<T | U>(this, otherStream);
        }
        
        public mergeMutex<U>(otherStream: Stream<U>): Stream<T | U> {
            return this.merge(
                otherStream,
                () => { throw new Error('Mutually exclusive streams fired simultaneously'); },
            );
        }
        
        public snapshot<U, R>(c: Cell<U>, f: (t: T, u: U) => R | DoNotSend): Stream<R> {
            return _snap(this, c, false, f);
        }
        
        public snapLive<U, R>(c: Cell<U>, f: (t: T, u: U) => R | DoNotSend): Stream<R> {
            return _snap(this, c, true, f);
        }
        
        public as<U>(cell: Cell<U>): Stream<U> {
            return _snap(this, cell, false, (t, u) => u);
        }
        
        public asLive<U>(cell: Cell<U>): Stream<U> {
            return _snap(this, cell, true, (t, u) => u);
        }
        
        public asConstant<U>(value: U): Stream<U> {
            return _map(this, () => value) as Stream<U>;
        }
        
        public snapshotAll<U extends Tuple<Cell<unknown>>, R>(cells: U, f: (t: T, ...us: Lift<U>) => R | DoNotSend): Stream<R>;
        public snapshotAll<U, R>(cells: readonly Cell<U>[], f: (t: T, ...us: U[]) => R | DoNotSend): Stream<R>;
        public snapshotAll<U, R>(cells: readonly Cell<U>[], f: (t: T, ...us: U[]) => R | DoNotSend): Stream<R> {
            return _snapAll(this, cells, false, f);
        }
        
        public snapAllLive<U extends Tuple<Cell<unknown>>, R>(cells: U, f: (t: T, ...us: Lift<U>) => R | DoNotSend): Stream<R>;
        public snapAllLive<U, R>(cells: readonly Cell<U>[], f: (t: T, ...us: U[]) => R | DoNotSend): Stream<R>;
        public snapAllLive<U, R>(cells: readonly Cell<U>[], f: (t: T, ...us: U[]) => R | DoNotSend): Stream<R> {
            return _snapAll(this, cells, true, f);
        }
        
        public when(key: T): Cell<boolean>;
        public when(key: T): Stream<T>;
        public when(key: T): Cell<boolean> | Stream<T> {
            if(Config.DEBUG && this.rule.kind !== RuleKind.CLOSED && this.rule.kind !== RuleKind.BRANCH) {
                throw new AssertionError(`Cannot branch on non-BRANCH node`, this);
            }
            
            const rule = this.rule,
                v = this.value === IS_STREAM ? IS_STREAM : this.value === key;
            
            if(rule.kind === RuleKind.BRANCH) {
                let node = rule.f.get(key);
                if(node === undefined) {
                    node = new Node<unknown>({kind: RuleKind.BRANCH_ON, engine: rule.engine, parent: new WeakRef(this), key}, v);
                    rule.f.set(key, node);
                }
                return node as Node<T>;
            } else {
                return v !== IS_STREAM ? constant(v) : NEVER;
            }
        }
    }
    
    const DONT_FREEZE = [
        Node,
        Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, BigUint64Array,
        Int8Array, Int16Array, Int32Array, BigInt64Array,
        Float32Array, Float64Array,
    ];
    function _freezeValue<T>(value: T): T {
        return DONT_FREEZE.some(cls => value instanceof cls) ? value : Object.freeze(value);
    }
    
    /**
     * A min-priority queue of nodes, ordered by node depth.
     */
    class Queue {
        /**
         * An array of bins of nodes, indexed by node depth.
         */
        readonly #nodes: Child[][] = [];
        
        /**
         * The number of nodes in the queue.
         */
        #size: number = 0;
        
        /**
         * A cursor for the current bin in `this.#nodes`. This avoids searching
         * from the start of the array on each `poll()`; it works because nodes
         * can only cause other nodes of greater depth to be enqueued.
         */
        #currentDepth: number = 0;
        
        /**
         * Enqueues a node in this min-priority queue. The node's depth must be
         * greater than or equal to the most-recently polled node, unless one
         * of `reset()` or `recomputePriorities()` has since been called.
         */
        enqueue(node: Child): void {
            const nodes = this.#nodes,
                depth = node.depth;
            
            if(Config.DEBUG && depth < this.#currentDepth) {
                throw new AssertionError(`Enqueued node out of order (expected depth >= ${this.#currentDepth}, was ${depth})`, node);
            }
            
            while(nodes.length <= depth) {
                nodes.push([]);
            }
            nodes[depth].push(node);
            ++this.#size;
        }
        
        /**
         * Polls a node of minimum priority from this queue, or returns
         * `undefined` if the queue is empty.
         */
        poll(): Node<unknown> | undefined {
            const nodes = this.#nodes;
            let d = this.#currentDepth;
            while(d < nodes.length) {
                if(nodes[d].length > 0) {
                    --this.#size;
                    return nodes[d].pop() as Node<unknown>;
                } else {
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
        rebuild(): void {
            const flat = this.#nodes.flat();
            this.reset();
            for(const node of flat) { this.enqueue(node); }
        }
        
        /**
         * Clears and resets this queue, allowing nodes of any depth to be
         * subsequently enqueued.
         */
        reset(): void {
            for(const bin of this.#nodes) { bin.length = 0; }
            this.#size = 0;
            this.#currentDepth = 0;
        }
    }
    
    const enum EngineState {
        IDLE,
        PREPARING,
        BUSY,
        BUSY_BUT_SAMPLE_ALLOWED,
        DISPATCHING,
        FINISHED_DISPATCHING,
    }
    
    /**
     * Creates a new FRP engine instance. Most applications should call this
     * once and retain a reference globally.
     */
    export function engine(): Engine {
        return new Engine();
    }
    
    /**
     * An FRP engine, which processes FRP transactions.
     */
    export class Engine {
        /**
         * An array of nodes which have been recomputed during the current FRP
         * transaction. Should be empty outside of transactions.
         */
        readonly #dirty: CleanUp[] = [];
        
        /**
         * A min-priority queue of nodes which need to be recomputed during the
         * current FRP transaction. Should be empty outside of transactions.
         */
        readonly #q = new Queue();
        
        /**
         * The current engine state; used to ensure correct behaviour of the
         * `send()` method, and for checking that certain operations are only
         * performed in the correct states.
         */
        #state: EngineState = EngineState.IDLE;
        
        /**
         * A rule for sinks with no coalescing functions. Cached here to avoid
         * duplication.
         */
        readonly #nonCoalescingSinkRule = {
            kind: RuleKind.SINK,
            engine: this,
            parents: undefined,
            f: undefined,
        } as const satisfies Rule<unknown, RuleKind.SINK>;
        
        #doSend<T>(node: Node<T>, value: T): void {
            // short-circuit if this is a cell and the value is not changed
            if(node.value !== IS_STREAM && node.equalityFunc(node.value, value)) { return; }
            
            const rule = node.rule;
            if(Config.DEBUG) {
                if(rule.kind === RuleKind.CLOSED) {
                    throw new AssertionError(`Cannot send to closed node`, node);
                } else if(rule.kind !== RuleKind.SINK && node.newValue !== NOT_UPDATED) {
                    throw new AssertionError(`Node updated twice`, node);
                }
                value = _freezeValue(value);
            }
            
            if(rule.kind === RuleKind.SINK && node.newValue !== NOT_UPDATED) {
                const f = rule.f;
                if(f === undefined) {
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
        
        #recomputeNode<T>(node: Node<T>): T | DoNotSend {
            const rule = node.rule;
            
            switch(rule.kind) {
                case RuleKind.CLOSED:
                case RuleKind.BRANCH_ON:
                    throw new AssertionError(`This node should not be recomputed`, node);
                
                case RuleKind.SINK: {
                    if(rule.parents === undefined) {
                        if(Config.DEBUG && node.newValue === NOT_UPDATED) {
                            throw new AssertionError(`Stream was not sent anything`, node);
                        }
                        return node.newValue as T;
                    }
                    const f = rule.f;
                    let v: T | NotUpdated = NOT_UPDATED;
                    _forEachSinkParent(rule, conn => {
                        if(v === NOT_UPDATED) {
                            v = conn.newValue;
                        } else if(conn.newValue !== NOT_UPDATED) {
                            v = f(v, conn.newValue);
                        }
                    });
                    return v !== NOT_UPDATED ? v : DO_NOT_SEND;
                }
                
                case RuleKind.LISTENER:
                case RuleKind.COPY: {
                    const of = rule.parent.deref();
                    if(of === undefined) { _closeNode(node); return DO_NOT_SEND; }
                    if(Config.DEBUG) { _assertUpdated(of); }
                    
                    return of.newValue as T;
                }
                
                case RuleKind.MAP: {
                    const of = rule.parent.deref();
                    if(of === undefined) { _closeNode(node); return DO_NOT_SEND; }
                    if(Config.DEBUG) { _assertUpdated(of); }
                    
                    return rule.f(of.newValue);
                }
                
                case RuleKind.FILTER: {
                    const stream = rule.parent.deref();
                    if(stream === undefined) { _closeNode(node); return DO_NOT_SEND; }
                    if(Config.DEBUG) { _assertUpdated(stream); }
                    
                    const value = stream.newValue as T;
                    return rule.f(value) ? value : DO_NOT_SEND;
                }
                
                case RuleKind.FOLD: {
                    const stream = rule.parent.deref();
                    if(stream === undefined) { _closeNode(node); return DO_NOT_SEND; }
                    if(Config.DEBUG) {
                        _assertUpdated(stream);
                        if(node.value === IS_STREAM) {
                            throw new AssertionError(`Fold node should have value`, node);
                        }
                    }
                    
                    return rule.f(node.value as T, stream.newValue);
                }
                
                case RuleKind.LIFT: {
                    if(Config.DEBUG) { _assertUpdated(rule.parent1, rule.parent2); }
                    
                    return rule.f(_mostRecentValue(rule.parent1), _mostRecentValue(rule.parent2));
                }
                
                case RuleKind.LIFT_ALL: {
                    if(Config.DEBUG) { _assertUpdated(...rule.parents); }
                    
                    const args = rule.parents.map(_mostRecentValue);
                    return rule.f(...args);
                }
                
                case RuleKind.MERGE: {
                    const s1 = rule.parent1.deref(), s2 = rule.parent2.deref();
                    if(s1 === undefined) {
                        if(s2 === undefined) { _closeNode(node); return DO_NOT_SEND; }
                        node.rule = {kind: RuleKind.COPY, engine: rule.engine, parent: rule.parent2};
                        return this.#recomputeNode(node);
                    } else if(s2 === undefined) {
                        node.rule = {kind: RuleKind.COPY, engine: rule.engine, parent: rule.parent1};
                        return this.#recomputeNode(node);
                    }
                    
                    if(Config.DEBUG) { _assertUpdated(s1, s2); }
                    
                    return s2.newValue === NOT_UPDATED ? s1.newValue as T
                        : s1.newValue === NOT_UPDATED ? s2.newValue as T
                        : rule.f(s1.newValue, s2.newValue);
                }
                
                case RuleKind.SELECT: {
                    let newValue: T | DoNotSend = DO_NOT_SEND;
                    _forEachSelectParent(rule, parent => {
                        if(parent.newValue !== NOT_UPDATED) {
                            newValue = parent.newValue;
                            return BREAK;
                        }
                    });
                    if(Config.DEBUG && newValue === DO_NOT_SEND) {
                        throw new AssertionError(`At least one parent should have been updated`, rule);
                    }
                    return newValue;
                }
                
                case RuleKind.SNAPSHOT: {
                    const stream = rule.parent.deref();
                    if(stream === undefined) { _closeNode(node); return DO_NOT_SEND; }
                    if(Config.DEBUG) { _assertUpdated(stream); }
                    
                    // snapshot always sees cell values from the start of the transaction
                    return rule.f(stream.newValue, rule.cell.value);
                }
                
                case RuleKind.SNAPSHOT_ALL: {
                    const stream = rule.parent.deref();
                    if(stream === undefined) { _closeNode(node); return DO_NOT_SEND; }
                    if(Config.DEBUG) { _assertUpdated(stream); }
                    
                    // snapshot always sees cell values from the start of the transaction
                    const args = rule.cells.map(c => c.value);
                    return rule.f(stream.newValue, ...args);
                }
                
                case RuleKind.SNAPSHOT_LIVE: {
                    const stream = rule.parent.deref();
                    if(stream === undefined) { _closeNode(node); return DO_NOT_SEND; }
                    if(Config.DEBUG) { _assertUpdated(stream); }
                    
                    return rule.f(stream.newValue, _mostRecentValue(rule.cell));
                }
                
                case RuleKind.SNAPSHOT_ALL_LIVE: {
                    const stream = rule.parent.deref();
                    if(stream === undefined) { _closeNode(node); return DO_NOT_SEND; }
                    if(Config.DEBUG) { _assertUpdated(stream); }
                    
                    const args = rule.cells.map(_mostRecentValue);
                    return rule.f(stream.newValue, ...args);
                }
                
                case RuleKind.BRANCH: {
                    const parent = rule.parent.deref();
                    if(parent === undefined) { _closeNode(node); return DO_NOT_SEND; }
                    if(Config.DEBUG) { _assertUpdated(parent); }
                    
                    const newValue = parent.newValue as T;
                    if(parent.value !== IS_STREAM) {
                        // update two boolean cells
                        const notifyOld = rule.f.get(parent.value),
                            notifyNew = rule.f.get(newValue);
                        if(notifyOld !== undefined) {
                            this.#doSend(notifyOld, false);
                        }
                        if(notifyNew !== undefined) {
                            this.#doSend(notifyNew, true);
                        }
                    } else {
                        // update just one stream
                        const notify = rule.f.get(newValue);
                        if(notify !== undefined) {
                            this.#doSend(notify, newValue);
                        }
                    }
                
                    return newValue;
                }
                
                case RuleKind.FLATTEN: {
                    const container = rule.parent1.deref();
                    if(container === undefined) {
                        node.rule = rule.parent2 !== undefined
                            ? {kind: RuleKind.COPY, engine: rule.engine, parent: rule.parent2}
                            : {kind: RuleKind.CLOSED, engine: undefined};
                        return this.#recomputeNode(node);
                    }
                    
                    const oldSource = rule.parent2?.deref(),
                        newSource = _mostRecentValue(container) as CellNode<T> | undefined;
                    if(Config.DEBUG) {
                        if(oldSource !== undefined && !(oldSource instanceof Node)) {
                            throw new AssertionError(`Old source must be a node`, oldSource);
                        } else if(newSource !== undefined) {
                            if(!(newSource instanceof Node)) {
                                throw new AssertionError(`New source must be a node`, newSource);
                            }
                            _assertOwn(this, newSource);
                            _assertUpdated(container, newSource);
                        } else {
                            _assertUpdated(container);
                        }
                    }
                    
                    if(oldSource !== newSource) {
                        oldSource?.removeNotifiableChild(node);
                        newSource?.addNotifiableChild(node);
                        rule.parent2 = newSource !== undefined ? new WeakRef(newSource) : undefined;
                        if(node.recomputeDepth()) {
                            this.#q.rebuild();
                        }
                    }
                    
                    return newSource === undefined ? undefined as T
                        : newSource.newValue !== NOT_UPDATED ? newSource.newValue
                        : newSource.value !== IS_STREAM ? newSource.value
                        : DO_NOT_SEND;
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
        public send<T>(sink: Sink<T>, value: T): void {
            const node = sink as Node<T>;
            
            if(Config.DEBUG) { _assertOwn(this, node); }
            
            if(node.isClosed()) {
                throw new Error(`Cannot send to this sink; it is closed`);
            }
            
            switch(this.#state) {
                case EngineState.IDLE: {
                    // start a new transaction
                    this.run(() => this.#doSend(node, value));
                    break;
                }
                
                case EngineState.PREPARING: {
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
        public run(f: () => void): void {
            if(this.#state !== EngineState.IDLE) {
                throw new Error(`run() cannot be called during an FRP transaction`);
            }
            
            try {
                this.#state = EngineState.PREPARING;
                f();
                
                this.#state = EngineState.BUSY;
                
                // propagate updates
                const q = this.#q;
                const seen = new Set<object>();
                while(true) {
                    const node = q.poll();
                    if(node === undefined) { break; }
                    if(seen.has(node)) { continue; }
                    seen.add(node);
                    
                    if(_sampleAllowed(node)) { this.#state = EngineState.BUSY_BUT_SAMPLE_ALLOWED; }
                    const v = this.#recomputeNode(node);
                    this.#state = EngineState.BUSY;
                    
                    if(v !== DO_NOT_SEND) { this.#doSend(node, v); }
                }
                
                // copy across new cell values, so that it is safe for
                // listeners to sample from other cells
                for(const node of this.#dirty) {
                    if(node.value !== IS_STREAM) {
                        node.value = node.newValue;
                    }
                }
                
                this.#state = EngineState.DISPATCHING;
                
                // dispatch events to listeners
                for(const node of this.#dirty) {
                    if(Config.DEBUG) { _assertUpdated(node as Parent<unknown>); }
                    
                    if(node.rule.kind === RuleKind.LISTENER) {
                        node.rule.f(node.newValue);
                    }
                }
                
                this.#state = EngineState.FINISHED_DISPATCHING;
            } finally {
                // clean up
                this.#q.reset();
                
                for(const node of this.#dirty) {
                    node.newValue = NOT_UPDATED;
                }
                this.#dirty.length = 0;
                
                this.#state = EngineState.IDLE;
            }
        }
        
        /**
         * Indicates whether this engine is current executing an FRP
         * transaction.
         */
        isBusy(): boolean {
            return this.#state === EngineState.BUSY
                || this.#state === EngineState.BUSY_BUT_SAMPLE_ALLOWED;
        }
        
        /**
         * Samples the current value of a cell. Equivalent to `cell.sample()`.
         */
        public sample<T>(cell: Cell<T>): T {
            if(this.#state === EngineState.BUSY) {
                console.error(`sample() should not be called here`);
            }
            
            const node = cell as Node<T>;
            if(Config.DEBUG) { _assertCell(node); }
            return node.value as T;
        }
        
        /**
         * Creates a cell whose value can be changed directly.
         */
        public cell<T>(initialValue: T): CellSink<T> {
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
        public sink<T>(f?: (a: T, b: T) => T): StreamSink<T> {
            return new Node(
                f !== undefined ? {kind: RuleKind.SINK, engine: this, parents: [], f} : this.#nonCoalescingSinkRule,
                IS_STREAM,
            );
        }
    }
    
    function _connect<T>(sink: Node<T>, source: Node<T>): void {
        const engine = sink.rule.engine;
        if(engine === undefined) {
            throw new Error(`Cannot connect; sink is already closed`);
        }
        
        if(Config.DEBUG) { _assertOwn(engine, source); }
        
        if(engine.isBusy()) {
            // this operation cannot be allowed unless idle, because it
            // can increase node depths, and might cause a node to be
            // visited twice in the current transaction
            throw new Error(`Cannot connect during an FRP transaction`);
        } else if(sink.rule.kind !== RuleKind.SINK) {
            throw new Error(`Cannot connect; sink is already connected`);
        }
        
        if(source.value !== IS_STREAM) {
            engine.send(sink, source.value);
        }
        
        const rule = sink.rule as Rule<T, RuleKind.SINK>;
        const parent = new WeakRef(source);
        if(rule.parents === undefined) {
            // one connection allowed
            sink.rule = {kind: RuleKind.COPY, engine, parent};
        } else {
            rule.parents.push(parent);
        }
        source.addNotifiableChild(sink);
        sink.recomputeDepth();
    }
    
    function _map<T, U>(node: Node<T>, f: (x: T) => U | DoNotSend): Cell<U> | Stream<U> {
        const engine = node.rule.engine;
        
        if(engine === undefined && node.value === IS_STREAM) { return NEVER; }
        
        return new Node<U>(
            engine === undefined ? CLOSED : {kind: RuleKind.MAP, engine, parent: new WeakRef(node), f},
            node.value !== IS_STREAM ? f(node.value) as U : IS_STREAM,
        );
    }
    
    function _fold<T, U>(s: Stream<T>, initialValue: U, f: (acc: U, t: T) => U): Node<U> {
        const stream = s as StreamNode<T>,
            engine = stream.rule.engine;
        
        return new Node(
            engine === undefined ? CLOSED : {kind: RuleKind.FOLD, engine, parent: new WeakRef(stream), f},
            initialValue,
        );
    }
    
    function _foldBoth<T, U>(s: Stream<T>, initialValue: U, f: (acc: U, t: T) => U): [Cell<U>, Stream<U>] {
        const stream = s as StreamNode<T>,
            engine = stream.rule.engine;
        
        if(engine === undefined) {
            return [constant(initialValue), NEVER];
        }
        
        // need to make a stream that doesn't hold the value, so that `.map`
        // will work correctly. normally it's unsound to make a stream from
        // a cell, but for a fold cell this is safe because the cell's
        // value only changes when the accumulated stream fires
        const acc = _fold(s, initialValue, f),
            accS = new Node({kind: RuleKind.COPY, engine, parent: new WeakRef(acc)}, IS_STREAM);
        
        // by copying from a cell, stream events are suppressed when
        // `f(acc, t)` equals `acc` using the given equality function; this
        // behaviour is documented
        return [acc, accS];
    }
    
    function _snap<T, U, R>(s: Stream<T>, c: Cell<U>, live: boolean, f: (t: T, u: U) => R | DoNotSend): Stream<R> {
        const stream = s as StreamNode<T>,
            cell = c as CellNode<U>,
            engine = stream.rule.engine;
        if(engine === undefined) { return NEVER; }
        
        if(Config.DEBUG) { _assertOwn(engine, cell); }
        
        const kind = live ? RuleKind.SNAPSHOT_LIVE : RuleKind.SNAPSHOT;
        return new Node({kind, engine, parent: new WeakRef(stream), cell, f}, IS_STREAM);
    }
    
    function _snapAll<T, U, R>(s: Stream<T>, cs: readonly Cell<U>[], live: boolean, f: (t: T, ...us: U[]) => R | DoNotSend): Stream<R> {
        if(cs.length === 0) {
            return s.map(f);
        } else if(cs.length === 1) {
            return _snap(s, cs[0], live, f);
        }
        
        const stream = s as StreamNode<T>,
            cells = cs as readonly CellNode<any>[],
            engine = stream.rule.engine;
        if(engine === undefined) { return NEVER; }
        
        if(Config.DEBUG) { _assertOwn(engine, ...cells); }
        
        const kind = live ? RuleKind.SNAPSHOT_ALL_LIVE : RuleKind.SNAPSHOT_ALL;
        return new Node({kind, engine, parent: new WeakRef(stream), cells, f}, IS_STREAM);
    }
    
    /**
     * A stream which never fires.
     */
    export const NEVER: Stream<never> = new Node<never>(CLOSED, IS_STREAM);
    
    /**
     * Creates a new cell with a constant value.
     */
    export function constant<T>(value: T): Cell<T> {
        return new Node(CLOSED, value);
    }
    
    /**
     * A constant cell with the value `undefined`.
     */
    export const UNDEFINED = constant(undefined);
    
    /**
     * Constructs a new FRP cell whose value is determined by applying the
     * given function to these cells' values. The function must be pure.
     */
    export function liftAll<T extends Tuple<Cell<unknown>>, R>(cells: T, f: (...ts: Lift<T>) => R): Cell<R>;
    export function liftAll<T, R>(cells: readonly Cell<T>[], f: (...ts: T[]) => R): Cell<R>;
    export function liftAll<T, R>(cells: readonly Cell<T>[], f: (...ts: T[]) => R): Cell<R> {
        const parents = cells as readonly CellNode<T>[];
        
        let engine: Engine | undefined = undefined;
        for(const cell of parents) {
            engine = cell.rule.engine;
            if(engine !== undefined) { break; }
        }
        
        if(parents.length === 0) {
            return constant(f());
        } else if(parents.length === 1) {
            return parents[0].map(f);
        } else if(parents.length === 2) {
            return parents[0].lift(parents[1], f);
        }
        
        const values = parents.map(c => c.value);
        const initialValue = f(...values);
        if(engine === undefined) { return constant(initialValue); }
        
        if(Config.DEBUG) { _assertOwn(engine, ...parents); }
        return new Node<R>(
            {kind: RuleKind.LIFT_ALL, engine, parents, f},
            initialValue,
        );
    }
    
    /**
     * Creates a new FRP stream which fires whenever any of the given streams
     * fires. The streams have priority according to the order they are given,
     * so that if multiple fire simultaneously, the value is taken from the
     * earliest stream in the argument list which fired.
     */
    export function select<T>(...streams: Stream<T>[]): Stream<T> {
        const parents = (streams as StreamNode<T>[]).filter(p => !p.isClosed());
        
        if(parents.length === 0) {
            return NEVER;
        } else if(parents.length === 1) {
            return parents[0];
        }
        
        const engine = _expectEngine(parents[0]);
        if(Config.DEBUG) { _assertOwn(engine, ...parents); }
        
        return new Node(
            {kind: RuleKind.SELECT, engine, parents: parents.map(p => new WeakRef(p))},
            IS_STREAM,
        );
    }
    
    /**
     * Creates a new FRP cell or stream which allows efficient branching on the
     * value of the given cell or stream, respectively. Branched cells take
     * boolean values indicating whether the original cell equals a particular
     * value; branched streams fire when the original stream fires with a
     * particular value.
     */
    export function branch<T>(cell: Cell<T>): BranchCell<T>;
    export function branch<T>(stream: Stream<T>): BranchStream<T>;
    export function branch<T>(of: Cell<T> | Stream<T>): BranchCell<T> | BranchStream<T> {
        const node = of as Node<T>;
        const engine = node.rule.engine;
        if(engine === undefined) { return node; }
        
        return new Node<T>(
            {kind: RuleKind.BRANCH, engine, parent: new WeakRef(node), f: new Map()},
            node.value,
        );
    }
    
    /**
     * Creates a new FRP cell whose value is equal to that of the nested cell,
     * or a new FRP stream which fires when the nested stream fires.
     * 
     * If a `Cell<Stream<T>>` is updated and both the old and new streams fire
     * simultaneously, the flattened stream fires with the value of the new
     * stream, not the old one.
     */
    export function flatten<T>(cell: Cell<Cell<T>>): Cell<T>;
    export function flatten<T>(cell: Cell<Cell<T> | undefined>): Cell<T | undefined>;
    export function flatten<T>(cell: Cell<Stream<T>>): Stream<T>;
    export function flatten<T>(cell: Cell<Cell<T> | undefined> | Cell<Stream<T>>): Cell<T | undefined> | Stream<T> {
        const node = cell as CellNode<Node<T> | undefined>,
            nested = node.value,
            engine = node.rule.engine;
        if(engine === undefined) { return nested ?? UNDEFINED; }
        
        if(Config.DEBUG && nested !== undefined && !(nested instanceof Node)) {
            throw new AssertionError(`Inner value must be cell or stream`, nested);
        }
        
        const rule: FlattenRule<T> = {
            kind: RuleKind.FLATTEN,
            engine,
            parent1: new WeakRef(node),
            parent2: nested !== undefined ? new WeakRef(nested) : undefined,
        };
        return new Node<T | undefined>(rule as FlattenRule<T | undefined>, nested?.value);
    }
    
    /**
     * Persists the value of this cell using the browser's local storage. If a
     * value already exists in local storage for this key, the cell will be
     * updated immediately. Then, the value in local storage is updated after
     * each FRP transaction in which the cell's value changes.
     * 
     * The key used to identify this cell in local storage should be unique.
     * 
     * If the cell's type is not a string, then a pair of conversion functions
     * `toStr` and `fromStr` must be provided, which must be inverses of each
     * other.
     */
    export function persist<T extends string>(key: string, cell: CellSink<T>): void;
    export function persist<T>(key: string, cell: CellSink<T>, conv: Serializer<T>): void;
    export function persist(key: string, cell: CellSink<string> | CellSink<unknown>, conv: Serializer<unknown> = Type.STR): void {
        const setter = (value: unknown): void => {
            try {
                window.localStorage.setItem(key, conv.toStr(value));
            } catch(e) {
                console.error(`Failed to store '${key}' in local storage`, e);
            }
        };
        
        try {
            const node = cell as Node<unknown>,
                stored = window.localStorage.getItem(key);
            if(stored !== null) {
                node.send(conv.fromStr(stored));
                node.listen(setter);
            } else {
                node.observe(setter);
            }
        } catch(e: unknown) {
            console.warn(`Failed to load '${key}' from local storage`);
        }
    }
    
    function _expectEngine(node: {readonly rule: {readonly engine?: Engine}}): Engine {
        const engine = node.rule.engine;
        if(engine === undefined) {
            throw new AssertionError(`Node is closed`, node);
        }
        return engine;
    }
    
    function _mostRecentValue<T>(cell: ParentCell<T>): T {
        return cell.newValue !== NOT_UPDATED ? cell.newValue : cell.value;
    }
    
    function _sampleAllowed<T>(node: Node<T>): boolean {
        const rule = node.rule;
        switch(rule.kind) {
            case RuleKind.MAP:
                return node.value === IS_STREAM;
            
            case RuleKind.FILTER:
            case RuleKind.FOLD:
            case RuleKind.MERGE:
            case RuleKind.SNAPSHOT:
            case RuleKind.SNAPSHOT_ALL:
                return true;
            
            default:
                return false;
        }
    }
    
    function _closeNode<T>(node: Node<T>): void {
        if(node.isClosed()) { return; }
        
        const rule = node.rule;
        node.rule = CLOSED;
        node.depth = 0;
        
        _forEachNotifiableParent<T>(rule, parent => parent.removeNotifiableChild(node));
        _forEachNonNotifiableParent<T>(rule, parent => parent.removeNonNotifiableChild(node));
        
        _forEachChild(node, child => child.tidy());
        
        // help with garbage collection; lift or live-snapshot nodes do not deregister themselves when one parent closes
        node.notifiableChildren.length = 0;
        node.nonNotifiableChildren.length = 0;
    }
    
    function _assertCell<T>(node: Node<T>): void {
        if(node.value === IS_STREAM) {
            throw new AssertionError(`Expected cell`, node);
        }
    }
    
    function _assertOwn(engine: Engine, ...objs: {readonly rule: {readonly engine?: Engine}}[]): void {
        for(const obj of objs) {
            if(obj.rule.engine !== undefined && obj.rule.engine !== engine) {
                throw new AssertionError('Object is owned by a different FRP engine', [engine, obj]);
            }
        }
    }
    
    function _assertUpdated(...nodes: Parent[]): void {
        if(nodes.every(node => node.newValue === NOT_UPDATED)) {
            throw new AssertionError('At least one of these nodes should have been updated', nodes);
        }
    }
    
    function _reportDependencyCycle(root: Node<unknown>): never {
        const map = new Map<Parent, Parent>();
        const q = [root];
        
        while(true) {
            const current = q.shift();
            if(current === undefined) {
                throw new AssertionError(`Expected to report cycle, but no cycle was found!`, root);
            }
            
            _forEachParent(current.rule, parent => {
                if(parent === root) {
                    const cycle: Parent[] = [];
                    let cur: Parent | undefined = current;
                    while(cur !== undefined) {
                        cycle.push(cur);
                        cur = map.get(cur);
                    }
                    cycle.reverse();
                    
                    const message = 'Circular dependency:\n---\n' + cycle.map(node => (node as Node<unknown>).name ?? '<anonymous>').join('\n');
                    console.error(message, cycle);
                    throw new Error(`${message}\n---\nSee console for more details`);
                } else if(!map.has(parent)) {
                    q.push(parent as Node<unknown>);
                    map.set(parent, current);
                }
            });
        }
    }
    
    class AssertionError extends Error {
        constructor(
            msg: string,
            readonly data: unknown,
        ) {
            super(msg);
        }
    }
}
