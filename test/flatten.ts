Punyt.test(class FlattenTest {
    flattenCell(): void {
        const frp = Furple.engine();
        
        const cell1 = frp.cell(3);
        const cell2 = frp.cell(5);
        const nested = frp.cell<Furple.Cell<number>>(cell1);
        const flat = Furple.flatten(nested);
        
        Assert.equal(3, flat.sample(), 'Flattened cell should have value of first cell');
        
        cell1.send(4);
        Assert.equal(4, flat.sample(), 'Flattened cell should receive updated value of first cell');
        
        nested.send(cell2);
        Assert.equal(5, flat.sample(), 'Updated flattened cell should have value of second cell');
        
        cell1.send(2);
        Assert.equal(5, flat.sample(), 'Updated flattened cell should not receive value from first cell');
        
        cell2.send(6);
        Assert.equal(6, flat.sample(), 'Updated flattened cell should receive updated value from second cell');
    }
    
    flattenMaybe(): void {
        const frp = Furple.engine();
        
        const cell1 = frp.cell(3);
        const nested = frp.cell<Furple.Cell<number> | undefined>(cell1);
        const flat = Furple.flatten(nested);
        
        Assert.equal(3, flat.sample(), 'Flattened cell should have value of nested cell');
        
        cell1.send(4);
        Assert.equal(4, flat.sample(), 'Flattened cell should receive updated value of nested cell');
        
        nested.send(undefined);
        Assert.equal(undefined, flat.sample(), 'Emptied flattened cell should have undefined value');
        
        cell1.send(2);
        Assert.equal(undefined, flat.sample(), 'Emptied flattened cell should not receive value from nested cell');
    }
    
    flattenStream(): void {
        const frp = Furple.engine();
        
        const sink1 = frp.sink<number>();
        const sink2 = frp.sink<number>();
        const nested = frp.cell<Furple.Stream<number>>(sink1);
        const flat = Furple.flatten(nested);
        
        let result = 0;
        flat.listen(x => result = x);
        
        sink1.send(4);
        Assert.equal(4, result, 'Flattened stream should receive event from first sink');
        
        nested.send(sink2);
        Assert.equal(4, result, 'Updated flattened stream should not receive event');
        
        sink1.send(2);
        Assert.equal(4, result, 'Updated flattened stream should not receive event from first sink');
        
        sink2.send(6);
        Assert.equal(6, result, 'Updated flattened stream should receive event from second sink');
    }
    
    flattenStreamPriority(): void {
        const frp = Furple.engine();
        
        const sink1 = frp.sink<number>();
        const sink2 = frp.sink<number>();
        const nested = frp.cell<Furple.Stream<number>>(sink1);
        const flat = Furple.flatten(nested);
        
        let result = 0;
        flat.listen(x => result = x);
        
        frp.run(() => {
            sink2.send(2);
            sink1.send(1);
            nested.send(sink2);
        });
        Assert.equal(2, result, 'Simultaneously-updated flattened stream should receive event from the new stream');
    }
    
    flattenArray(): void {
        const frp = Furple.engine();
        
        const cell1 = frp.cell(1);
        const cell2 = frp.cell(2);
        const cell3 = frp.cell(3);
        const cell4 = frp.cell(4);
        
        const listOfCells = frp.cell<readonly Furple.Cell<number>[]>([cell1, cell2, cell3]);
        const flat = Furple.flattenArray(listOfCells);
        
        Assert.shallowEqual([1, 2, 3], flat.sample(), 'Flattened array should contain the values from the cells in the original array');
        
        cell1.send(5);
        Assert.shallowEqual([5, 2, 3], flat.sample(), 'Updated value of the first cell should be reflected in the flattened array');
        
        listOfCells.send([cell1, cell2, cell3, cell4]);
        Assert.shallowEqual([5, 2, 3, 4], flat.sample(), 'Updated value of the array should be reflected in the flattened array');
    }
    
    foldArray(): void {
        const frp = Furple.engine();
        
        const cell1 = frp.cell('foo');
        const cell2 = frp.cell('bar');
        const cell3 = frp.cell('baz');
        const cell4 = frp.cell('qux');
        
        const listOfCells = frp.cell<readonly Furple.Cell<string>[]>([cell1, cell2, cell3]);
        const folded = Furple.foldArray(listOfCells, '$', (x, y) => `${x} ${y}`);
        
        Assert.equal('$ foo bar baz', folded.sample(), 'Folded array should contain the result of folding the original values');
        
        cell1.send('FOO');
        Assert.equal('$ FOO bar baz', folded.sample(), 'Updated value of the first cell should be reflected in the folded array');
        
        listOfCells.send([cell1, cell2, cell3, cell4]);
        Assert.equal('$ FOO bar baz qux', folded.sample(), 'Updated value of the array should be reflected in the folded array');
    }
    
    foldAssociative(): void {
        const frp = Furple.engine();
        
        const cell1 = frp.cell('foo');
        const cell2 = frp.cell('bar');
        const cell3 = frp.cell('baz');
        const cell4 = frp.cell('qux');
        
        const listOfCells = frp.cell<readonly Furple.Cell<string>[]>([cell1, cell2, cell3]);
        const folded = Furple.foldAssociative(listOfCells, '', (x, y) => `${x} ${y}`);
        
        Assert.equal('foo bar baz', folded.sample(), 'Folded array should contain the result of folding the original values');
        
        cell1.send('FOO');
        Assert.equal('FOO bar baz', folded.sample(), 'Updated value of the first cell should be reflected in the folded array');
        
        listOfCells.send([cell1, cell2, cell3, cell4]);
        Assert.equal('FOO bar baz qux', folded.sample(), 'Updated value of the array should be reflected in the folded array');
    }
});
