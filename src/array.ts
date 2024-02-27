namespace Furple {
    /**
     * Flattens an array of cells into a single cell which holds an array.
     */
    export function flattenArray<T>(cell: Cell<readonly Cell<T>[]>): Cell<readonly T[]> {
        return flatten(cell.map(cells => {
            return Furple.liftAll(cells, (...ts: T[]) => ts);
        }));
    }
    
    /**
     * Performs a map on an array, where the mapping function returns a cell.
     */
    export function mapArray<T, U>(cell: Cell<readonly T[]>, f: (x: T) => Cell<U>): Cell<readonly U[]> {
        return flattenArray(cell.map(ts => ts.map(f)));
    }
    
    /**
     * Performs a select on an array, where the mapping function returns a
     * stream. The resulting stream fires when any of the streams in the cell's
     * array fire, with the value of the earliest one in the array if multiple
     * fire simultaneously.
     */
    export function selectArray<T, U>(cell: Cell<readonly T[]>, f: (x: T) => Stream<U>): Stream<U> {
        return flatten(cell.map(ts => select(...ts.map(f))));
    }
    
    /**
     * Performs a linear fold on an array of cells. If the function `f` is
     * associative and `initialValue` is its identity, use `foldAssociative`
     * instead.
     */
    export function foldArray<T, U>(cell: Cell<readonly Cell<T>[]>, initialValue: U, f: (acc: U, t: T) => U): Cell<U> {
        return flatten(cell.map(cells => {
            return Furple.liftAll(cells, (...ts: T[]) => ts.reduce(f, initialValue));
        }));
    }
    
    /**
     * Performs a divide-and-conquer fold on an array of cells. The function `f`
     * must be an associative operation, and the fold's initial value must be
     * an identity value for the operation.
     * 
     * This function should be preferred to `foldArray` when `f` is associative
     * and has an identity, since the FRP graph for this cell will have a depth
     * of O(log n) instead of O(n).
     */
    export function foldAssociative<T>(cell: Cell<readonly Cell<T>[]>, identityElement: T, f: (t1: T, t2: T) => T): Cell<T> {
        const identityCell = Furple.constant(identityElement);
        return flatten(cell.map(ts => _foldAssociativeSlice(ts, identityCell, f, 0, ts.length)));
    }
    
    function _foldAssociativeSlice<T>(cells: readonly Cell<T>[], identityCell: Cell<T>, f: (t1: T, t2: T) => T, a: number, b: number): Cell<T> {
        if(a === b) {
            return identityCell;
        } else if(a + 1 === b) {
            return cells[a];
        } else {
            const m = (a + b) >>> 1;
            const left = _foldAssociativeSlice(cells, identityCell, f, a, m);
            const right = _foldAssociativeSlice(cells, identityCell, f, m, b);
            return left.lift(right, f);
        }
    }
}
