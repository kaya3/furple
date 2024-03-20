Punyt.test(class MeetTest {
    meet(): void {
        const frp = Furple.engine();
        
        const a = frp.sink<number>(),
            b = frp.sink<number>(),
            meet = a.meet(b, (a, b) => a + b);
        
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
    
    meetAll(): void {
        const frp = Furple.engine();
        
        const a = frp.sink<number>(),
            b = frp.sink<number>(),
            c = frp.sink<number>(),
            meet = Furple.meetAll([a, b, c], (a, b, c) => a + b + c);
        
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
            c.send(7)
        });
        Assert.equal(18, result, 'Meet stream should merge events from all three children');
    }
});
