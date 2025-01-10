"use strict";
Punyt.test(class ConnectTest {
    connectCell() {
        const frp = Furple.engine();
        const sink = frp.cell(4);
        const source = frp.cell(23);
        sink.connect(source);
        Assert.equal(23, sink.sample(), 'Connected sink should take value from source');
        source.send(42);
        Assert.equal(42, sink.sample(), 'Connected sink should receive updated value from source');
    }
    connectStream() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const source = frp.sink();
        sink.connect(source);
        let result = 0;
        sink.listen(x => result = x);
        source.send(23);
        Assert.equal(23, result, 'Connected sink should receive event from source');
    }
    multipleConnections() {
        const frp = Furple.engine();
        const sink = frp.sink((x, y) => x + y);
        const source1 = frp.sink();
        const source2 = frp.sink();
        sink.connect(source1);
        sink.connect(source2);
        let result = 0;
        sink.listen(x => result = x);
        frp.run(() => {
            sink.send(1);
            source1.send(2);
            source2.send(3);
        });
        Assert.equal(6, result, 'Sink should coalesce multiple values sent in same transaction');
    }
    dependencyCycle() {
        const frp = Furple.engine();
        const sink = frp.sink().named('sink');
        const mapped = sink.map(x => x + 1).named('mapped');
        const filtered = mapped.filter(x => x > 0).named('filtered');
        Assert.throwsLike(() => sink.connect(filtered), (e) => e instanceof Error && /sink[^]+filtered[^]+mapped/.test(e.message), 'Connecting sink in a cycle should throw an error');
    }
});
Punyt.test(class FlattenTest {
    flattenCell() {
        const frp = Furple.engine();
        const cell1 = frp.cell(3);
        const cell2 = frp.cell(5);
        const nested = frp.cell(cell1);
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
    flattenMaybe() {
        const frp = Furple.engine();
        const cell1 = frp.cell(3);
        const nested = frp.cell(cell1);
        const flat = Furple.flatten(nested);
        Assert.equal(3, flat.sample(), 'Flattened cell should have value of nested cell');
        cell1.send(4);
        Assert.equal(4, flat.sample(), 'Flattened cell should receive updated value of nested cell');
        nested.send(undefined);
        Assert.equal(undefined, flat.sample(), 'Emptied flattened cell should have undefined value');
        cell1.send(2);
        Assert.equal(undefined, flat.sample(), 'Emptied flattened cell should not receive value from nested cell');
    }
    flattenStream() {
        const frp = Furple.engine();
        const sink1 = frp.sink();
        const sink2 = frp.sink();
        const nested = frp.cell(sink1);
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
    flattenStreamPriority() {
        const frp = Furple.engine();
        const sink1 = frp.sink();
        const sink2 = frp.sink();
        const nested = frp.cell(sink1);
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
    flattenArray() {
        const frp = Furple.engine();
        const cell1 = frp.cell(1);
        const cell2 = frp.cell(2);
        const cell3 = frp.cell(3);
        const cell4 = frp.cell(4);
        const listOfCells = frp.cell([cell1, cell2, cell3]);
        const flat = Furple.flattenArray(listOfCells);
        Assert.shallowEqual([1, 2, 3], flat.sample(), 'Flattened array should contain the values from the cells in the original array');
        cell1.send(5);
        Assert.shallowEqual([5, 2, 3], flat.sample(), 'Updated value of the first cell should be reflected in the flattened array');
        listOfCells.send([cell1, cell2, cell3, cell4]);
        Assert.shallowEqual([5, 2, 3, 4], flat.sample(), 'Updated value of the array should be reflected in the flattened array');
    }
    foldArray() {
        const frp = Furple.engine();
        const cell1 = frp.cell('foo');
        const cell2 = frp.cell('bar');
        const cell3 = frp.cell('baz');
        const cell4 = frp.cell('qux');
        const listOfCells = frp.cell([cell1, cell2, cell3]);
        const folded = Furple.foldArray(listOfCells, '$', (x, y) => `${x} ${y}`);
        Assert.equal('$ foo bar baz', folded.sample(), 'Folded array should contain the result of folding the original values');
        cell1.send('FOO');
        Assert.equal('$ FOO bar baz', folded.sample(), 'Updated value of the first cell should be reflected in the folded array');
        listOfCells.send([cell1, cell2, cell3, cell4]);
        Assert.equal('$ FOO bar baz qux', folded.sample(), 'Updated value of the array should be reflected in the folded array');
    }
    foldAssociative() {
        const frp = Furple.engine();
        const cell1 = frp.cell('foo');
        const cell2 = frp.cell('bar');
        const cell3 = frp.cell('baz');
        const cell4 = frp.cell('qux');
        const listOfCells = frp.cell([cell1, cell2, cell3]);
        const folded = Furple.foldAssociative(listOfCells, '', (x, y) => `${x} ${y}`);
        Assert.equal('foo bar baz', folded.sample(), 'Folded array should contain the result of folding the original values');
        cell1.send('FOO');
        Assert.equal('FOO bar baz', folded.sample(), 'Updated value of the first cell should be reflected in the folded array');
        listOfCells.send([cell1, cell2, cell3, cell4]);
        Assert.equal('FOO bar baz qux', folded.sample(), 'Updated value of the array should be reflected in the folded array');
    }
});
Punyt.test(class FoldTest {
    foldCell() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const folded = sink.fold(0, (x, y) => x + y);
        Assert.equal(0, folded.sample(), 'Folded cell should have initial value');
        sink.send(3);
        Assert.equal(3, folded.sample(), 'Folded cell should have updated value');
        sink.send(4);
        Assert.equal(7, folded.sample(), 'Folded cell should have accumulated value');
    }
    foldStream() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const folded = sink.foldS(0, (x, y) => x + y);
        let result = -1;
        folded.listen(x => result = x);
        Assert.equal(-1, result, 'Folded stream should not immediately invoke listener');
        sink.send(3);
        Assert.equal(3, result, 'Folded stream should fire with updated value');
        sink.send(4);
        Assert.equal(7, result, 'Folded stream should fire with accumulated value');
    }
    foldBoth() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const [foldedCell, foldedStream] = sink.foldBoth(0, (x, y) => x + y);
        let result = -1;
        foldedStream.listen(x => result = x);
        Assert.equal(0, foldedCell.sample(), 'Folded cell should have initial value');
        Assert.equal(-1, result, 'Folded stream should not immediately invoke listener');
        sink.send(3);
        Assert.equal(3, foldedCell.sample(), 'Folded cell should have updated value');
        Assert.equal(3, result, 'Folded stream should fire with updated value');
        sink.send(4);
        Assert.equal(7, foldedCell.sample(), 'Folded cell should have accumulated value');
        Assert.equal(7, result, 'Folded stream should fire with accumulated value');
    }
    supressRepeats() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const folded = sink.foldS(0, (x, y) => x + y);
        let result = -1;
        folded.listen(x => result = x);
        sink.send(0);
        Assert.equal(-1, result, 'Folded stream should not fire when accumulator did not change');
    }
});
Punyt.test(class GateTest {
    gate() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const cell = frp.cell(true);
        const gated = sink.gate(cell);
        let result = 0;
        gated.listen(x => result = x);
        sink.send(3);
        Assert.equal(3, result, 'Gated stream should receive event when predicate is true');
        cell.send(false);
        sink.send(4);
        Assert.equal(3, result, 'Gated stream should not receive event when predicate is false');
    }
    gateLive() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const cell = frp.cell(true);
        const gated = sink.gateLive(cell);
        let result = 0;
        gated.listen(x => result = x);
        sink.send(3);
        Assert.equal(3, result, 'Gated stream should receive event when predicate is true');
        cell.send(false);
        sink.send(4);
        Assert.equal(3, result, 'Gated stream should not receive event when predicate is false');
    }
    gateConstantTrue() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const gated = sink.gate(Furple.constant(true));
        let result = 0;
        gated.listen(x => result = x);
        sink.send(3);
        Assert.equal(3, result, 'Gated stream should receive event when predicate is true');
    }
    gateConstantFalse() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const gated = sink.gate(Furple.constant(false));
        let result = 0;
        gated.listen(x => result = x);
        sink.send(3);
        Assert.equal(0, result, 'Gated stream should not receive event when predicate is false');
    }
    gateLiveConstantTrue() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const gated = sink.gateLive(Furple.constant(true));
        let result = 0;
        gated.listen(x => result = x);
        sink.send(3);
        Assert.equal(3, result, 'Gated stream should receive event when predicate is true');
    }
    gateLiveConstantFalse() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const gated = sink.gateLive(Furple.constant(false));
        let result = 0;
        gated.listen(x => result = x);
        sink.send(3);
        Assert.equal(0, result, 'Gated stream should not receive event when predicate is false');
    }
    gatePriority() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const cell = frp.cell(true);
        const gated = sink.gate(cell);
        let result = 0;
        gated.listen(x => result = x);
        frp.run(() => {
            sink.send(3);
            cell.send(false);
        });
        Assert.equal(3, result, 'Gated stream should receive event when old predicate is true');
        frp.run(() => {
            sink.send(4);
            cell.send(true);
        });
        Assert.equal(3, result, 'Gated stream should not receive event when old predicate is false');
    }
    gateLivePriority() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const cell = frp.cell(true);
        const gated = sink.gateLive(cell);
        let result = 0;
        gated.listen(x => result = x);
        frp.run(() => {
            sink.send(3);
            cell.send(false);
        });
        Assert.equal(0, result, 'Gated stream should not receive event when new predicate is false');
        frp.run(() => {
            sink.send(4);
            cell.send(true);
        });
        Assert.equal(4, result, 'Gated stream should receive event when new predicate is true');
    }
});
Punyt.test(class MeetTest {
    meet() {
        const frp = Furple.engine();
        const a = frp.sink(), b = frp.sink(), meet = a.meet(b, (a, b) => a + b);
        let result = 0;
        meet.listen(x => result = x);
        a.send(3);
        Assert.equal(0, result, 'Meet stream should not receive event from only first child');
        b.send(4);
        Assert.equal(0, result, 'Meet stream should not receive event from only second child');
        frp.run(() => {
            a.send(5);
            b.send(6);
        });
        Assert.equal(11, result, 'Meet stream should merge events from both children');
    }
    meetAll() {
        const frp = Furple.engine();
        const a = frp.sink(), b = frp.sink(), c = frp.sink(), meet = Furple.meetAll([a, b, c], (a, b, c) => a + b + c);
        let result = 0;
        meet.listen(x => result = x);
        a.send(3);
        Assert.equal(0, result, 'Meet stream should not receive event from only first child');
        b.send(4);
        Assert.equal(0, result, 'Meet stream should not receive event from only second child');
        c.send(5);
        Assert.equal(0, result, 'Meet stream should not receive event from only third child');
        frp.run(() => {
            a.send(3);
            b.send(4);
        });
        Assert.equal(0, result, 'Meet stream should not merge events from only two children');
        frp.run(() => {
            a.send(5);
            b.send(6);
            c.send(7);
        });
        Assert.equal(18, result, 'Meet stream should merge events from all three children');
    }
});
Punyt.test(class NodeTest {
    basicListener() {
        const frp = Furple.engine();
        const sink = frp.sink();
        Assert.isTrue(Furple.isStream(sink), 'Sink should be a stream');
        let result = 'foo';
        sink.listen(s => result = s);
        sink.send('bar');
        Assert.equal('bar', result, 'Listener should receive event');
    }
    hold() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const holder = sink.hold('foo');
        Assert.isTrue(Furple.isCell(holder), 'Holder should be a cell');
        Assert.equal('foo', holder.sample(), 'Holder should have intial value');
        sink.send('bar');
        Assert.equal('bar', holder.sample(), 'Holder should receive new value');
    }
    mapCell() {
        const frp = Furple.engine();
        const cell = frp.cell(4);
        const mapped = cell.map(x => x + 1);
        Assert.isTrue(Furple.isCell(mapped), 'Mapped should be a cell');
        Assert.equal(5, mapped.sample(), 'Mapped cell should have initial value');
        cell.send(7);
        Assert.equal(8, mapped.sample(), 'Mapped cell should have updated value');
    }
    mapStream() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const mapped = sink.map(x => x + 1);
        Assert.isTrue(Furple.isStream(mapped), 'Mapped should be a stream');
        let result = 0;
        mapped.listen(x => result = x);
        sink.send(4);
        Assert.equal(5, result, 'Mapped stream should receive event');
    }
    filter() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const filtered = sink.filter(x => x > 0);
        Assert.isTrue(Furple.isStream(filtered), 'Filtered should be a stream');
        let result = 0;
        filtered.listen(x => result = x);
        sink.send(4);
        Assert.equal(4, result, 'Filtered stream should receive event which satisfies predicate');
        sink.send(-5);
        Assert.equal(4, result, 'Filtered stream should not receive event which does not satisfy predicate');
    }
    lift() {
        const frp = Furple.engine();
        const a = frp.cell(4);
        const b = frp.cell(5);
        const lifted = a.lift(b, (x, y) => x + y);
        Assert.isTrue(Furple.isCell(lifted), 'Lifted should be a cell');
        Assert.equal(9, lifted.sample(), 'Lifted cell should have initial value');
        a.send(3);
        Assert.equal(8, lifted.sample(), 'Lifted cell should have updated value');
    }
    liftAll() {
        const frp = Furple.engine();
        const a = frp.cell(1);
        const b = frp.cell(2);
        const c = frp.cell(3);
        const d = frp.cell(4);
        const lifted = Furple.liftAll([a, b, c, d], (x, y, z, w) => x + y + z + w);
        Assert.isTrue(Furple.isCell(lifted), 'Lifted should be a cell');
        Assert.equal(10, lifted.sample(), 'Lifted cell should have initial value');
        d.send(10);
        Assert.equal(16, lifted.sample(), 'Lifted cell should have updated value');
        frp.run(() => {
            a.send(10);
            b.send(20);
            c.send(30);
        });
        Assert.equal(70, lifted.sample(), 'Lifted cell should have updated value reflecting all changes');
    }
    merge() {
        const frp = Furple.engine();
        const a = frp.sink();
        const b = frp.sink();
        const merged = a.merge(b, (x, y) => x + y);
        Assert.isTrue(Furple.isStream(merged), 'Merged should be a stream');
        let result = 0;
        merged.listen(x => result = x);
        a.send(3);
        Assert.equal(3, result, 'Merged stream should receive event from first child');
        b.send(4);
        Assert.equal(4, result, 'Merged stream should receive event from second child');
        frp.run(() => {
            a.send(5);
            b.send(6);
        });
        Assert.equal(11, result, 'Merged stream should merge events from both children');
    }
    select() {
        const frp = Furple.engine();
        const a = frp.sink();
        const b = frp.sink();
        const c = frp.sink();
        const select = Furple.select(a, b, c);
        Assert.isTrue(Furple.isStream(select), 'Select should be a stream');
        let result = 'nothing';
        select.listen(x => result = x);
        frp.run(() => {
            c.send('foo');
            b.send('bar');
        });
        Assert.equal('bar', result, 'Select stream should receive event from first fired child');
    }
    branchCell() {
        const frp = Furple.engine();
        const cell = frp.cell('foo');
        const branched = Furple.branch(cell);
        Assert.isTrue(Furple.isCell(branched), 'Branched should be a cell');
        const cell1 = branched.when('foo');
        const cell2 = branched.when('bar');
        Assert.isTrue(Furple.isCell(cell1), 'Branch should be a cell');
        Assert.isTrue(Furple.isCell(cell2), 'Other branch should also be a cell');
        Assert.isTrue(cell1.sample(), '"foo" branch should be true');
        Assert.isFalse(cell2.sample(), '"bar" branch should be false');
        cell.send('bar');
        Assert.isFalse(cell1.sample(), '"foo" branch should be false after update');
        Assert.isTrue(cell2.sample(), '"bar" branch should be true after update');
        cell.send('baz');
        Assert.isFalse(cell1.sample(), '"foo" branch should be false when nothing matches');
        Assert.isFalse(cell2.sample(), '"bar" branch should be false when nothing matches');
    }
    branchStream() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const branched = Furple.branch(sink);
        const stream1 = branched.when('foo');
        const stream2 = branched.when('bar');
        Assert.isTrue(Furple.isStream(stream1), 'Branch should be a stream');
        Assert.isTrue(Furple.isStream(stream2), 'Other branch should also be a stream');
        let result = 'nothing triggered';
        stream1.listen(() => result = 'foo triggered');
        stream2.listen(() => result = 'bar triggered');
        sink.send('baz');
        Assert.equal('nothing triggered', result, 'Sending "baz" should not trigger either branch');
        sink.send('foo');
        Assert.equal('foo triggered', result, 'Sending "foo" should trigger first branch');
        sink.send('bar');
        Assert.equal('bar triggered', result, 'Sending "bar" should trigger second branch');
    }
    coalesce() {
        const frp = Furple.engine();
        const sink = frp.sink((x, y) => x + y);
        let result = 0;
        sink.listen(x => result = x);
        frp.run(() => {
            sink.send(1);
            sink.send(2);
            sink.send(3);
            sink.send(4);
            sink.send(5);
        });
        Assert.equal(15, result, 'Sink should coalesce multiple values sent in same transaction');
    }
    doNotSend() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const mapped = sink.map(() => Furple.DO_NOT_SEND);
        let result = 0;
        mapped.listen(() => result = 1);
        sink.send(23);
        Assert.equal(0, result, 'DO_NOT_SEND should suppress mapped stream');
    }
    transaction() {
        const frp = Furple.engine();
        const a = frp.cell(4);
        const b = frp.cell(5);
        const lifted = a.lift(b, (x, y) => x + y);
        let result = 0;
        lifted.observe(x => result += x);
        Assert.equal(9, result, 'observe() should invoke listener immediately');
        frp.run(() => {
            a.send(2);
            b.send(10);
        });
        Assert.equal(12, lifted.sample(), 'Lifted cell should be updated when both cells change');
        Assert.equal(21, result, 'Lifted listener should be invoked once even when both cells change');
    }
});
Punyt.test(class SnapshotTest {
    snapshot() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const cell = frp.cell(4);
        const snapped = sink.snapshot(cell, (x, y) => x + y);
        let result = 0;
        snapped.listen(x => result = x);
        Assert.equal(0, result, 'Snapshotted stream should not invoke listener immediately');
        sink.send(3);
        Assert.equal(7, result, 'Snapshotted stream should receive event');
        cell.send(10);
        Assert.equal(7, result, 'Snapshotted stream should not send event on cell change');
        sink.send(4);
        Assert.equal(14, result, 'Snapshotted stream should send event using updated cell value');
        frp.run(() => {
            cell.send(100);
            sink.send(200);
        });
        Assert.equal(210, result, 'Snapshotted stream should not see cell update made in same transaction');
    }
    snapshotAll() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const a = frp.cell(4);
        const b = frp.cell(5);
        const snapped = sink.snapshotAll([a, b], (x, y, z) => x + y + z);
        let result = 0;
        snapped.listen(x => result = x);
        Assert.equal(0, result, 'Snapshotted stream should not invoke listener immediately');
        sink.send(3);
        Assert.equal(12, result, 'Snapshotted stream should receive event');
        a.send(10);
        Assert.equal(12, result, 'Snapshotted stream should not send event on first cell change');
        b.send(10);
        Assert.equal(12, result, 'Snapshotted stream should not send event on second cell change');
        sink.send(4);
        Assert.equal(24, result, 'Snapshotted stream should send event using updated cell values');
        frp.run(() => {
            a.send(100);
            b.send(200);
            sink.send(50);
        });
        Assert.equal(70, result, 'Snapshotted stream should not see cell updates made in same transaction');
    }
    snapLive() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const cell = frp.cell(4);
        const snapped = sink.snapLive(cell, (x, y) => x + y);
        let result = 0;
        snapped.listen(x => result = x);
        Assert.equal(0, result, 'Snapshotted stream should not invoke listener immediately');
        sink.send(3);
        Assert.equal(7, result, 'Snapshotted stream should receive event');
        cell.send(10);
        Assert.equal(7, result, 'Snapshotted stream should not send event on cell change');
        sink.send(4);
        Assert.equal(14, result, 'Snapshotted stream should send event using updated cell value');
        frp.run(() => {
            sink.send(200);
            cell.send(100);
        });
        Assert.equal(300, result, 'Live snapshot should see cell updates made in same transaction');
    }
    snapAllLive() {
        const frp = Furple.engine();
        const sink = frp.sink();
        const a = frp.cell(4);
        const b = frp.cell(5);
        const snapped = sink.snapAllLive([a, b], (x, y, z) => x + y + z);
        let result = 0;
        snapped.listen(x => result = x);
        Assert.equal(0, result, 'Snapshotted stream should not invoke listener immediately');
        sink.send(3);
        Assert.equal(12, result, 'Snapshotted stream should receive event');
        a.send(10);
        Assert.equal(12, result, 'Snapshotted stream should not send event on first cell change');
        b.send(10);
        Assert.equal(12, result, 'Snapshotted stream should not send event on second cell change');
        sink.send(4);
        Assert.equal(24, result, 'Snapshotted stream should send event using updated cell values');
        frp.run(() => {
            sink.send(50);
            a.send(100);
            b.send(200);
        });
        Assert.equal(350, result, 'Live snapshot should see cell updates made in same transaction');
    }
});
