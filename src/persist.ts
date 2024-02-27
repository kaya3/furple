namespace Furple {
    /**
     * Encapsulates two functions, `toStr` and `fromStr`, which are used to
     * serialize and dezerialize a cell's value by the `persist(...)` function.
     */
    export interface Serializer<T> {
        toStr(x: T): string;
        fromStr(s: string): T;
    }
    
    /**
     * Contains constants and functions for creating `Serializer` objects,
     * which are used by the `persist(...)` function.
     */
    export namespace Type {
        const id = (s: string) => s;
        const toStr = (x: unknown) => `${x}`;
        
        /**
         * Serializes boolean values.
         */
        export const BOOL: Serializer<boolean> = {
            toStr: b => b ? 'true' : 'false',
            fromStr: s => s === 'true',
        };
        
        /**
         * Serializes integer values.
         */
        export const INT: Serializer<number> = {
            toStr,
            fromStr: s => parseInt(s),
        };
        
        /**
         * Serializes BigInt values.
         */
        export const BIGINT: Serializer<bigint> = {
            toStr,
            fromStr: BigInt,
        };
        
        /**
         * Serializes floating-point numeric values.
         */
        export const FLOAT: Serializer<number> = {
            toStr,
            fromStr: parseFloat,
        };
        
        /**
         * Serializes string values.
         */
        export const STR: Serializer<string> = {
            toStr: id,
            fromStr: id,
        };
        
        /**
         * Creates a Serializer for a homogeneous array.
         */
        export function array<T>(conv: Serializer<T>): Serializer<readonly T[]> {
            return {
                toStr: a => JSON.stringify(a.map(conv.toStr)),
                fromStr: s => (JSON.parse(s) as string[]).map(conv.fromStr),
            };
        }
        
        /**
         * Creates a Serializer for a homogeneous object.
         */
        export function object<K extends string, T>(conv: Serializer<T>): Serializer<{readonly [P in K]: T}> {
            return {
                toStr: o => JSON.stringify(_mapObj(o, conv.toStr)),
                fromStr: s => _mapObj(JSON.parse(s) as Record<K, string>, conv.fromStr),
            };
        }
        
        /**
         * Creates a Serializer for a Map.
         */
        export function map<T>(conv: Serializer<T>): Serializer<ReadonlyMap<string, T>> {
            return {
                toStr: m => JSON.stringify(_mapObj(Object.fromEntries(m), conv.toStr)),
                fromStr: s => new Map(Object.entries(_mapObj(JSON.parse(s) as Record<string, string>, conv.fromStr))),
            };
        }
        
        /**
         * Creates a Serializer for a Set.
         */
        export function set<T>(conv: Serializer<T>): Serializer<ReadonlySet<T>> {
            return {
                toStr: s => JSON.stringify([...s].map(conv.toStr)),
                fromStr: s => new Set((JSON.parse(s) as string[]).map(conv.fromStr)),
            };
        }
        
        function _mapObj<K extends string, T, U>(obj: {readonly [P in K]: T}, f: (x: T) => U): {readonly [P in K]: U} {
            const out = Object.create(null);
            for(const [k, v] of Object.entries(obj)) {
                out[k] = f(v as T);
            }
            return out;
        }
    }
}
