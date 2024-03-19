namespace Furple {
    /**
     * A cell holds a value which may change over time.
     */
    export interface Cell<out T> {
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
    export interface Stream<out T = unknown> {
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
         * Constructs a new FRP stream which fires when this stream fires, as
         * long as the given cell contains the value `true`. If the cell's
         * value changes in the same transaction, the old value is used.
         * 
         * This is equivalent to `.filter(() => p.sample())`.
         */
        gate(p: Cell<boolean>): Stream<T>;
        
        /**
         * Constructs a new FRP stream which fires when this stream fires, as
         * long as the given cell contains the value `true`. If the cell's
         * value changes in the same transaction, the new value is used.
         * 
         * This is equivalent to `.snapLive(p, (s, p) => p ? s : DO_NOT_SEND)`.
         */
        gateLive(p: Cell<boolean>): Stream<T>;
        
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
    
    export interface BranchCell<in out T> extends Cell<T> {
        /**
         * Constructs a new FRP cell which fires whenever this stream fires
         * with the given value. This is equivalent to `.map(x => x === v)`,
         * but is more efficient when the cell has many branches.
         */
        when(value: T): Cell<boolean>;
    }
    
    export interface BranchStream<in out T> extends Stream<T> {
        /**
         * Constructs a new FRP stream which fires whenever this stream fires
         * with the given value. This is equivalent to `.filter(x => x === v)`,
         * but is more efficient when the stream has many branches.
         */
        when(value: T): Stream<T>;
    }
    
    export interface Sink<in T = unknown> {
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
    export interface ListenerToken {
        /**
         * Explicitly cancels this listener, so that no new values will be
         * received.
         */
        close(): void;
    }
    
    /**
     * A cell which can be directly written to.
     */
    export interface CellSink<in out T> extends Cell<T>, Sink<T> {
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
    export interface StreamSink<in out T> extends Stream<T>, Sink<T> {
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
    export type Tuple<T> = readonly [T, ...T[]]
    
    /**
     * Lifts a tuple of cells to a tuple of their content types.
     */
    export type Lift<T extends Tuple<Cell<unknown>>> = {
        [I in keyof T]: T[I] extends Cell<infer U> ? U : never
    }
}
