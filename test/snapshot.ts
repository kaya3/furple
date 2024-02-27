Punyt.test(class SnapshotTest {
    snapshot(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
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
    
    snapshotAll(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
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
    
    snapLive(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
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
    
    snapAllLive(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
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
