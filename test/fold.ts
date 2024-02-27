Punyt.test(class FoldTest {
    foldCell(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const folded = sink.fold(0, (x, y) => x + y);
        
        Assert.equal(0, folded.sample(), 'Folded cell should have initial value');
        
        sink.send(3);
        Assert.equal(3, folded.sample(), 'Folded cell should have updated value');
        
        sink.send(4);
        Assert.equal(7, folded.sample(), 'Folded cell should have accumulated value');
    }
    
    foldStream(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const folded = sink.foldS(0, (x, y) => x + y);
        
        let result: number = -1;
        folded.listen(x => result = x);
        
        Assert.equal(-1, result, 'Folded stream should not immediately invoke listener');
        
        sink.send(3);
        Assert.equal(3, result, 'Folded stream should fire with updated value');
        
        sink.send(4);
        Assert.equal(7, result, 'Folded stream should fire with accumulated value');
    }
    
    foldBoth(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const [foldedCell, foldedStream] = sink.foldBoth(0, (x, y) => x + y);
        
        let result: number = -1;
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
    
    supressRepeats(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const folded = sink.foldS(0, (x, y) => x + y);
        
        let result: number = -1;
        folded.listen(x => result = x);
        
        sink.send(0);
        Assert.equal(-1, result, 'Folded stream should not fire when accumulator did not change');
    }
});
