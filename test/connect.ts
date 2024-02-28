Punyt.test(class ConnectTest {
    connectCell(): void {
        const frp = Furple.engine();
        
        const sink = frp.cell(4);
        const source = frp.cell(23);
        sink.connect(source);
        
        Assert.equal(23, sink.sample(), 'Connected sink should take value from source');
        
        source.send(42);
        Assert.equal(42, sink.sample(), 'Connected sink should receive updated value from source');
    }
    
    connectStream(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>();
        const source = frp.sink<number>();
        sink.connect(source);
        
        let result = 0;
        sink.listen(x => result = x);
        source.send(23);
        
        Assert.equal(23, result, 'Connected sink should receive event from source');
    }
    
    multipleConnections(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>((x, y) => x + y);
        const source1 = frp.sink<number>();
        const source2 = frp.sink<number>();
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
    
    dependencyCycle(): void {
        const frp = Furple.engine();
        
        const sink = frp.sink<number>().named('sink');
        const mapped = sink.map(x => x + 1).named('mapped');
        const filtered = mapped.filter(x => x > 0).named('filtered');
        
        Assert.throwsLike(
            () => sink.connect(filtered),
            (e: unknown) => e instanceof Error && /sink[^]+filtered[^]+mapped/.test(e.message),
            'Connecting sink in a cycle should throw an error',
        );
    }
});
