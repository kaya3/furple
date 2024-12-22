Punyt.test(class NodeTest {
    basicListener(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<string>();
        Assert.isTrue(Furple.isStream(sink), 'Sink should be a stream');
        
        let result = 'foo';
        sink.listen(s => result = s);
        sink.send('bar');
        
        Assert.equal('bar', result, 'Listener should receive event');
    }
    
    hold(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<string>();
        const holder = sink.hold('foo');
        Assert.isTrue(Furple.isCell(holder), 'Holder should be a cell');
        Assert.equal('foo', holder.sample(), 'Holder should have intial value');
        
        sink.send('bar');
        Assert.equal('bar', holder.sample(), 'Holder should receive new value');
    }
    
    mapCell(): void {
        const frp = Furple.engine();
        
        const cell = frp.cell(4);
        const mapped = cell.map(x => x + 1);
        Assert.isTrue(Furple.isCell(mapped), 'Mapped should be a cell');
        Assert.equal(5, mapped.sample(), 'Mapped cell should have initial value');
        
        cell.send(7);
        Assert.equal(8, mapped.sample(), 'Mapped cell should have updated value');
    }
    
    mapStream(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const mapped = sink.map(x => x + 1);
        Assert.isTrue(Furple.isStream(mapped), 'Mapped should be a stream');
        
        let result = 0;
        mapped.listen(x => result = x);
        
        sink.send(4);
        Assert.equal(5, result, 'Mapped stream should receive event');
    }
    
    filter(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const filtered = sink.filter(x => x > 0);
        Assert.isTrue(Furple.isStream(filtered), 'Filtered should be a stream');
        
        let result = 0;
        filtered.listen(x => result = x);
        
        sink.send(4);
        Assert.equal(4, result, 'Filtered stream should receive event which satisfies predicate');
        
        sink.send(-5);
        Assert.equal(4, result, 'Filtered stream should not receive event which does not satisfy predicate');
    }
    
    lift(): void {
        const frp = Furple.engine();
        
        const a = frp.cell(4);
        const b = frp.cell(5);
        const lifted = a.lift(b, (x, y) => x + y);
        
        Assert.isTrue(Furple.isCell(lifted), 'Lifted should be a cell');
        Assert.equal(9, lifted.sample(), 'Lifted cell should have initial value');
        
        a.send(3);
        Assert.equal(8, lifted.sample(), 'Lifted cell should have updated value');
    }
    
    liftAll(): void {
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
    
    merge(): void {
        const frp = Furple.engine();
        
        const a = frp.sink<number>();
        const b = frp.sink<number>();
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
    
    select(): void {
        const frp = Furple.engine();
        
        const a = frp.sink<string>();
        const b = frp.sink<string>();
        const c = frp.sink<string>();
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
    
    branchCell(): void {
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
    
    branchStream(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<string>();
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
        
    coalesce(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>((x, y) => x + y);
        
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
    
    doNotSend(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const mapped = sink.map<never>(() => Furple.DO_NOT_SEND);
        
        let result = 0;
        mapped.listen(() => result = 1);
        sink.send(23);
        
        Assert.equal(0, result, 'DO_NOT_SEND should suppress mapped stream')
    }
    
    transaction(): void {
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
