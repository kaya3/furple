Punyt.test(class GateTest {
    gate(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
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
    
    gateLive(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
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
    
    gateConstantTrue(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const gated = sink.gate(Furple.constant(true));
        
        let result = 0;
        gated.listen(x => result = x);
        
        sink.send(3);
        Assert.equal(3, result, 'Gated stream should receive event when predicate is true');
    }
    
    gateConstantFalse(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const gated = sink.gate(Furple.constant(false));
        
        let result = 0;
        gated.listen(x => result = x);
        
        sink.send(3);
        Assert.equal(0, result, 'Gated stream should not receive event when predicate is false');
    }
    
    gateLiveConstantTrue(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const gated = sink.gateLive(Furple.constant(true));
        
        let result = 0;
        gated.listen(x => result = x);
        
        sink.send(3);
        Assert.equal(3, result, 'Gated stream should receive event when predicate is true');
    }
    
    gateLiveConstantFalse(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const gated = sink.gateLive(Furple.constant(false));
        
        let result = 0;
        gated.listen(x => result = x);
        
        sink.send(3);
        Assert.equal(0, result, 'Gated stream should not receive event when predicate is false');
    }
    
    gatePriority(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
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
    
    gateLivePriority(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
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
