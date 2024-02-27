declare namespace Furple {
    /**
     * Flattens an array of cells into a single cell which holds an array.
     */
    function flattenArray<T>(cell: Cell<readonly Cell<T>[]>): Cell<readonly T[]>;
    /**
     * Performs a map on an array, where the mapping function returns a cell.
     */
    function mapArray<T, U>(cell: Cell<readonly T[]>, f: (x: T) => Cell<U>): Cell<readonly U[]>;
    /**
     * Performs a select on an array, where the mapping function returns a
     * stream. The resulting stream fires when any of the streams in the cell's
     * array fire, with the value of the earliest one in the array if multiple
     * fire simultaneously.
     */
    function selectArray<T, U>(cell: Cell<readonly T[]>, f: (x: T) => Stream<U>): Stream<U>;
    /**
     * Performs a linear fold on an array of cells. If the function `f` is
     * associative and `initialValue` is its identity, use `foldAssociative`
     * instead.
     */
    function foldArray<T, U>(cell: Cell<readonly Cell<T>[]>, initialValue: U, f: (acc: U, t: T) => U): Cell<U>;
    /**
     * Performs a divide-and-conquer fold on an array of cells. The function `f`
     * must be an associative operation, and the fold's initial value must be
     * an identity value for the operation.
     *
     * This function should be preferred to `foldArray` when `f` is associative
     * and has an identity, since the FRP graph for this cell will have a depth
     * of O(log n) instead of O(n).
     */
    function foldAssociative<T>(cell: Cell<readonly Cell<T>[]>, identityElement: T, f: (t1: T, t2: T) => T): Cell<T>;
}
declare namespace Furple {
    /**
     * Sentinel value indicating that a value should not be sent. This may be
     * returned by a callback to `Stream.map`, `Stream.snapshot` or `Stream.snapshotAll`.
     */
    const DO_NOT_SEND: unique symbol;
    type DoNotSend = typeof DO_NOT_SEND;
    /**
     * Creates a new FRP engine instance. Most applications should call this
     * once and retain a reference globally.
     */
    function engine(): Engine;
    /**
     * An FRP engine, which processes FRP transactions.
     */
    class Engine {
        #private;
        /**
         * Sends a value to a sink, initiating an FRP transaction if one is not
         * already being built. Equivalent to `sink.send(value)`.
         *
         * This method cannot be called during an FRP transaction; instead,
         * create a source of events for the sink as part of the FRP graph, and
         * connect it to this sink.
         */
        send<T>(sink: Sink<T>, value: T): void;
        /**
         * Builds and executes an FRP transaction, allowing values to be sent
         * to multiple sinks "simultaneously".
         */
        run(f: () => void): void;
        /**
         * Indicates whether this engine is current executing an FRP
         * transaction.
         */
        isBusy(): boolean;
        /**
         * Samples the current value of a cell. Equivalent to `cell.sample()`.
         */
        sample<T>(cell: Cell<T>): T;
        /**
         * Creates a cell whose value can be changed directly.
         */
        cell<T>(initialValue: T): CellSink<T>;
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
        sink<T>(f?: (a: T, b: T) => T): StreamSink<T>;
    }
    /**
     * A stream which never fires.
     */
    const NEVER: Stream<never>;
    /**
     * Creates a new cell with a constant value.
     */
    function constant<T>(value: T): Cell<T>;
    /**
     * A constant cell with the value `undefined`.
     */
    const UNDEFINED: Cell<undefined>;
    /**
     * Constructs a new FRP cell whose value is determined by applying the
     * given function to these cells' values. The function must be pure.
     */
    function liftAll<T extends Tuple<Cell<unknown>>, R>(cells: T, f: (...ts: Lift<T>) => R): Cell<R>;
    function liftAll<T, R>(cells: readonly Cell<T>[], f: (...ts: T[]) => R): Cell<R>;
    /**
     * Creates a new FRP stream which fires whenever any of the given streams
     * fires. The streams have priority according to the order they are given,
     * so that if multiple fire simultaneously, the value is taken from the
     * earliest stream in the argument list which fired.
     */
    function select<T>(...streams: Stream<T>[]): Stream<T>;
    /**
     * Creates a new FRP cell or stream which allows efficient branching on the
     * value of the given cell or stream, respectively. Branched cells take
     * boolean values indicating whether the original cell equals a particular
     * value; branched streams fire when the original stream fires with a
     * particular value.
     */
    function branch<T>(cell: Cell<T>): BranchCell<T>;
    function branch<T>(stream: Stream<T>): BranchStream<T>;
    /**
     * Creates a new FRP cell whose value is equal to that of the nested cell,
     * or a new FRP stream which fires when the nested stream fires.
     *
     * If a `Cell<Stream<T>>` is updated and both the old and new streams fire
     * simultaneously, the flattened stream fires with the value of the new
     * stream, not the old one.
     */
    function flatten<T>(cell: Cell<Cell<T>>): Cell<T>;
    function flatten<T>(cell: Cell<Cell<T> | undefined>): Cell<T | undefined>;
    function flatten<T>(cell: Cell<Stream<T>>): Stream<T>;
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
    function persist<T extends string>(key: string, cell: CellSink<T>): void;
    function persist<T>(key: string, cell: CellSink<T>, conv: Serializer<T>): void;
}
declare namespace Furple {
    /**
     * Encapsulates two functions, `toStr` and `fromStr`, which are used to
     * serialize and dezerialize a cell's value by the `persist(...)` function.
     */
    interface Serializer<T> {
        toStr(x: T): string;
        fromStr(s: string): T;
    }
    /**
     * Contains constants and functions for creating `Serializer` objects,
     * which are used by the `persist(...)` function.
     */
    namespace Type {
        /**
         * Serializes boolean values.
         */
        const BOOL: Serializer<boolean>;
        /**
         * Serializes integer values.
         */
        const INT: Serializer<number>;
        /**
         * Serializes BigInt values.
         */
        const BIGINT: Serializer<bigint>;
        /**
         * Serializes floating-point numeric values.
         */
        const FLOAT: Serializer<number>;
        /**
         * Serializes string values.
         */
        const STR: Serializer<string>;
        /**
         * Creates a Serializer for a homogeneous array.
         */
        function array<T>(conv: Serializer<T>): Serializer<readonly T[]>;
        /**
         * Creates a Serializer for a homogeneous object.
         */
        function object<K extends string, T>(conv: Serializer<T>): Serializer<{
            readonly [P in K]: T;
        }>;
        /**
         * Creates a Serializer for a Map.
         */
        function map<T>(conv: Serializer<T>): Serializer<ReadonlyMap<string, T>>;
        /**
         * Creates a Serializer for a Set.
         */
        function set<T>(conv: Serializer<T>): Serializer<ReadonlySet<T>>;
    }
}
declare namespace Furple {
    /**
     * A cell holds a value which may change over time.
     */
    interface Cell<out T> {
        /**
         * Registers a callback function which will be called immediately with
         * the cell's current value, and also on any future changes of this
         * cell's value. Changes only occur at the end of FRP transactions, and
         * the callback must not perform operations on the same FRP engine.
         */
        observe(f: (x: T) => void): void;
        /**
         * Gets the current value of this cell. This method should normally be
         * used only outside of an FRP transaction context, but is also safe to
         * use in callbacks passed to `listen()` or `observe()`, in which case
         * the sampled value is from the end of the transaction.
         *
         * This method should not be used in FRP callbacks because it is not
         * pure, and it hides the dependency from the FRP engine, meaning that
         * updates to this cell will not propagate correctly. Use `lift()` or
         * `snapshot()` instead to acquire this cell's value.
         *
         * It is safe to call `sample()` in callback functions passed only to
         * the following methods:
         *
         * - `Stream.map()`
         * - `Stream.filter()`
         * - `Stream.fold()`
         * - `Stream.merge()`
         * - `Stream.snapshot()`
         * - `Stream.snapshotAll()`
         *
         * In these cases, the sampled value will always be from the start of
         * the transaction. However, it may be simpler to use `snapshot()`
         * anyway, and doing so potentially allows the FRP engine to do a bit
         * better job of garbage collection.
         */
        sample(): T;
        /**
         * Sets a name for this cell. May be useful for debugging.
         */
        named(name: string): this;
        /**
         * Sets the equality function for this cell, which is used to detect
         * when a new value is equal to the current value, and therefore
         * discard the update. This typically has no semantic consequences, but
         * may improve performance by not propagating non-changes.
         *
         * The equality function must only be set when the cell is originally
         * created. The function must be pure, and must define an equivalence
         * relation, i.e. it must satisfy
         *
         * - `eq(x, x)` for all x,
         * - `eq(x, y)` if and only if `eq(y, x)`,
         * - If `eq(x, y) && eq(y, z)` then `eq(x, z)`.
         */
        setEqualityFunction(eq: (x: T, y: T) => boolean): this;
        /**
         * Constructs a new FRP cell whose value is determined by applying the
         * given function to this cell's value. The function must be pure.
         */
        map<U>(f: (x: T) => U): Cell<U>;
        /**
         * Constructs a new FRP cell whose value is determined by applying the
         * given function to these two cells' values. The function must be pure.
         */
        lift<U, R>(otherCell: Cell<U>, f: (t: T, u: U) => R): Cell<R>;
    }
    /**
     * A stream represents an event which fires at discrete times, or a channel
     * which data is sent through at discrete times.
     */
    interface Stream<out T = unknown> {
        /**
         * Registers a callback function which will be called on any future
         * values sent on this stream. Values are only sent at the end of FRP
         * transactions, and the callback must not perform operations on the
         * same FRP engine.
         */
        listen(f: (x: T) => void): void;
        /**
         * Sets a name for this stream. Useful for debugging.
         */
        named(name: string): this;
        /**
         * Constructs a new FRP cell whose value is either the most recent
         * value sent on this stream, or otherwise the given initial value if
         * no values have been sent on this stream since the cell was created.
         */
        hold(x: T): Cell<T>;
        /**
         * Constructs a new FRP cell whose value is determined by accumulating
         * the given initial value with all subsequent values sent on this
         * stream, using the given function to combine the accumulator with
         * each new value.
         *
         * The function must be pure.
         */
        fold<U>(x: U, f: (u: U, t: T) => U): Cell<U>;
        /**
         * Constructs a new FRP stream which fires when this stream fires, with
         * values accumulated from the given initial value and all subsequent
         * values sent on this stream, using the given function to combine the
         * accumulator with each new value. The new stream only fires when the
         * accumulator's value changes.
         *
         * The function must be pure.
         */
        foldS<U>(x: U, f: (u: U, t: T) => U): Stream<U>;
        /**
         * Constructs a new FRP cell and stream which take their values by
         * accumulating the given initial value and all subsequent values sent
         * on this stream, using the given function to combine the accumulator
         * with each new value. This is equivalent to `fold` and `foldS`, but
         * may be more efficient.
         *
         * The function must be pure.
         */
        foldBoth<U>(x: U, f: (u: U, t: T) => U): [Cell<U>, Stream<U>];
        /**
         * Constructs a new FRP stream which fires whenever this stream fires,
         * with values determined by applying the given function to each value
         * sent on this stream.
         *
         * The function must be pure. The sentinel value `Furple.DO_NOT_SEND`
         * may be returned to indicate that the mapped stream should not fire.
         */
        map<U>(f: (x: T) => U | DoNotSend): Stream<U>;
        /**
         * Constructs a new FRP stream which fires whenever this stream fires
         * with a value satisfying the given predicate. When the predicate is
         * satisfied, the value is passed on to the filtered stream unchanged.
         *
         * The predicate must be pure.
         */
        filter<U extends T>(f: (x: T) => x is U): Stream<U>;
        filter(f: (x: T) => boolean): Stream<T>;
        /**
         * Constructors a new FRP stream which fires when this stream fires, as
         * long as the given cell contains the value `true`.
         *
         * This is equivalent to `.filter(() => p.sample())`.
         */
        gate(p: Cell<boolean>): Stream<T>;
        /**
         * Constructs a new FRP stream which fires whenever either this stream
         * fires, or the other given stream fires, or both. If both streams
         * fire simultaneously, the value sent on to the merged stream is
         * determined by applying the given function to the values sent on these
         * two streams; otherwise, the value from one stream which fires is
         * passed unchanged.
         *
         * The function must be pure.
         */
        merge<U>(otherStream: Stream<U>, f: (a: T, b: U) => T | U): Stream<T | U>;
        /**
         * Constructs a new FRP stream which fires whenever either this stream
         * fires, or the other given stream fires, or both. If both streams
         * fire simultaneously, the first stream takes priority and the value
         * from the second stream is dropped.
         *
         * This is equivalent to `merge` with the function `(a, b) => a`. If
         * the two streams should not fire simultaneously, use the `mergeMutex`
         * method instead.
         */
        orElse<U>(otherStream: Stream<U>): Stream<T | U>;
        /**
         * Constructs a new FRP stream which fires whenever either this stream
         * or the other stream fires. An error is thrown if both streams fire
         * simultaneously.
         *
         * This is equivalent to `merge` with the function `(a, b) => { throw ...; }`.
         */
        mergeMutex<U>(otherStream: Stream<U>): Stream<T | U>;
        /**
         * Constructs a new FRP stream which fires whenever this stream fires,
         * with a value determined by applying the given function to the value
         * sent on this stream and the current value of the cell. The value of
         * the cell is sampled from the start of the transaction.
         *
         * The function must be pure. The sentinel value `Furple.DO_NOT_SEND`
         * may be returned to indicate that the mapped stream should not fire.
         */
        snapshot<U, R>(cell: Cell<U>, f: (t: T, u: U) => R | DoNotSend): Stream<R>;
        /**
         * Constructs a new FRP stream which fires whenever this stream fires,
         * with a value determined by applying the given function to the value
         * sent on this stream and the most recent value of the cell. If the
         * cell is updated during the transaction, its new value is used.
         *
         * The function must be pure. The sentinel value `Furple.DO_NOT_SEND`
         * may be returned to indicate that the mapped stream should not fire.
         */
        snapLive<U, R>(cell: Cell<U>, f: (t: T, u: U) => R | DoNotSend): Stream<R>;
        /**
         * Constructs a new FRP stream which fires whenever this stream fires,
         * but with the value of the other cell instead of the value sent on
         * this stream. The value of the cell is sampled from the start of the
         * transaction.
         *
         * This is equivalent to `snapshot` with the function `(a, b) => b`.
         */
        as<U>(cell: Cell<U>): Stream<U>;
        /**
         * Constructs a new FRP stream which fires whenever this stream fires,
         * but with the most recent value of the other cell instead of the
         * value sent on this stream. If the cell is updated during this
         * transaction, its new value is used.
         *
         * This is equivalent to `snapLive` with the function `(a, b) => b`.
         */
        asLive<U>(cell: Cell<U>): Stream<U>;
        /**
         * Constructs a new FRP stream which fires whenever this stream fires,
         * but with the given constant value instead of the value sent on this
         * stream.
         *
         * This is equivalent to `map` with the function `() => value`.
         */
        asConstant<U>(value: U): Stream<U>;
        /**
         * Constructs a new FRP stream which fires whenever this stream fires,
         * with a value determined by applying the given function to the value
         * sent on this stream and the current values of the given cells. The
         * cells' values are sampled from the start of the transaction.
         *
         * The function must be pure. The sentinel value `Furple.DO_NOT_SEND`
         * may be returned to indicate that the mapped stream should not fire.
         */
        snapshotAll<U extends Tuple<Cell<unknown>>, R>(cells: U, f: (t: T, ...us: Lift<U>) => R | DoNotSend): Stream<R>;
        /**
         * Constructs a new FRP stream which fires whenever this stream fires,
         * with a value determined by applying the given function to the value
         * sent on this stream and the most recent values of the given cells.
         * If any of the cells are updated during the transaction, their new
         * values are used.
         *
         * The function must be pure. The sentinel value `Furple.DO_NOT_SEND`
         * may be returned to indicate that the mapped stream should not fire.
         */
        snapAllLive<U extends Tuple<Cell<unknown>>, R>(cells: U, f: (t: T, ...us: Lift<U>) => R | DoNotSend): Stream<R>;
    }
    interface BranchCell<in out T> extends Cell<T> {
        /**
         * Constructs a new FRP cell which fires whenever this stream fires
         * with the given value. This is equivalent to `.map(x => x === v)`,
         * but is more efficient when the cell has many branches.
         */
        when(value: T): Cell<boolean>;
    }
    interface BranchStream<in out T> extends Stream<T> {
        /**
         * Constructs a new FRP stream which fires whenever this stream fires
         * with the given value. This is equivalent to `.filter(x => x === v)`,
         * but is more efficient when the stream has many branches.
         */
        when(value: T): Stream<T>;
    }
    interface Sink<in T = unknown> {
        /**
         * Sends a value to this sink. This initiates an FRP transaction unless
         * one is already being built.
         *
         * This method cannot be called during an FRP transaction; instead,
         * create a source of events for the sink as part of the FRP graph, and
         * connect it to this sink.
         */
        send(t: T): void;
        /**
         * Sends a value to this sink, and also executes the given callback
         * function when setting up the same FRP transaction.
         *
         * This method cannot be called during an FRP transaction; instead,
         * create a source of events for the sink as part of the FRP graph, and
         * connect it to this sink.
         */
        sendAnd(t: T, f: () => void): void;
        /**
         * Connects this sink to the given stream, so that events fired on the
         * stream are sent into this sink. This method cannot be called during
         * an FRP transaction.
         */
        connect(source: Stream<T>): void;
        /**
         * Closes this sink, and frees up any resources it holds. The sink can
         * no longer receive values afterwards. This method cannot be called
         * during an FRP transaction.
         */
        close(): this;
    }
    /**
     * A listener token, returned by the `Stream.listen()` or `Cell.observe()`
     * methods, representing a listener from outside of the FRP engine.
     *
     * The listener will continue receiving events until the `close()` method
     * is called on this token.
     */
    interface ListenerToken {
        /**
         * Explicitly cancels this listener, so that no new values will be
         * received.
         */
        close(): void;
    }
    /**
     * A cell which can be directly written to.
     */
    interface CellSink<in out T> extends Cell<T>, Sink<T> {
        /**
         * Connects this cell-sink to the given source:
         *
         * - If the source is a cell, then this cell will always take the same
         *   value as the other cell.
         * - If the source is a stream, then this cell will hold values sent on
         *   that stream.
         *
         * After being connected, this sink can no longer receive values via
         * the `send()` method, nor can it be connected to another source.
         */
        connect(source: Cell<T> | Stream<T>): void;
    }
    /**
     * A stream which can be directly fired.
     */
    interface StreamSink<in out T> extends Stream<T>, Sink<T> {
        /**
         * Connects this sink to the given stream, so that events fired on the
         * stream are sent into this sink.
         *
         * If this sink has a coalescing function, then multiple streams can be
         * connected, and values received from either the `send()` method or
         * connected streams are coalesced in an unspecified order.
         *
         * If this sink has no coalescing function, then after being connected,
         * this sink can no longer receive values via the `send()` method, nor
         * can it be connected to another stream.
         */
        connect(source: Stream<T>): this;
    }
    /**
     * A non-empty readonly array type, which hints to Typescript that a type
     * parameter should be inferred as a tuple.
     */
    type Tuple<T> = readonly [T, ...T[]];
    /**
     * Lifts a tuple of cells to a tuple of their content types.
     */
    type Lift<T extends Tuple<Cell<unknown>>> = {
        [I in keyof T]: T[I] extends Cell<infer U> ? U : never;
    };
}
