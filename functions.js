const functions = {
    '+': {
        args: [
            {
                name: "l",
            },
            {
                name: "r",
            },
        ],
        compile(builder, args) {
            return builder.evaluate(OP_ADD, [args.l(), args.r()]);
        },
    },
    '-': {
        args: [
            {
                name: "l",
            },
            {
                name: "r",
            },
        ],
        compile(builder, args) {
            return builder.evaluate(OP_SUB, [args.l(), args.r()]);
        },
    },
    '*': {
        args: [
            {
                name: "l",
            },
            {
                name: "r",
            },
        ],
        compile(builder, args) {
            return builder.evaluate(OP_MUL, [args.l(), args.r()]);
        },
    },
    '/': {
        args: [
            {
                name: "l",
            },
            {
                name: "r",
            },
        ],
        compile(builder, args) {
            return builder.evaluate(OP_DIV, [args.l(), args.r()]);
        },
    },
    sine: {
        args: [
            {
                name: "freq",
                type: "frequency",
            },
        ],
        result: "wave",
        compile(builder, args) {
            const time = builder.wave(args.freq());
            const theta = builder.evaluate(OP_MUL, [time, builder.const(Math.PI * 2.0)]);

            return builder.evaluate(OP_SIN, [theta]);
        },
    },
    square: {
        args: [
            {
                name: "freq",
                type: "frequency",
            },
            {
                name: "duty",
                type: "fraction",
            },
        ],
        result: "wave",
        compile(builder, args) {
            const phase = builder.wave(args.freq());

            return builder.evaluate(OP_SUB, [builder.evaluate(OP_MUL, [builder.evaluate(OP_LESS_THAN, [phase, args.duty()]), builder.const(2.0)]), builder.const(1.0)]);
        },
    },
    saw: {
        args: [
            {
                name: "freq",
                type: "frequency",
            },
        ],
        result: "wave",
        compile(builder, args) {
            const phase = builder.wave(args.freq());
            const up = builder.evaluate(OP_MUL, [phase, builder.const(2)]);
            const center = builder.evaluate(OP_SUB, [up, builder.const(1)]);
            return center;
        },
    },
    triangle: {
        args: [
            {
                name: "freq",
                type: "frequency",
            },
        ],
        result: "wave",
        compile(builder, args) {
            const phase = builder.wave(args.freq());
            // 0 - 0.5 - 0
            const quarter = builder.evaluate(OP_ABS, [builder.evaluate(OP_SUB, [phase, builder.const(0.5)])]);
            // 0 - 2 - 0
            const up = builder.evaluate(OP_MUL, [quarter, builder.const(4)]);
            // 1 - -1 - 1
            const center = builder.evaluate(OP_SUB, [up, builder.const(1)]);
            return center;
        },
    },
    am: {
        args: [
            {
                name: "wave",
                type: "wave",
            },
            {
                name: "amplitude",
                type: "wave",
            },
        ],
        result: "wave",
        compile(builder, args) {
            return builder.evaluate(OP_MUL, [args.wave(), args.amplitude()]);
        },
    },
    fm: {
        args: [
            {
                name: "wave",
                type: "wave",
            },
            {
                name: "freq multiplier",
                type: "wave",
            },
        ],
        result: "wave",
        compile(builder, args) {
            let new_delta = builder.contextGet(CONTEXT_WAVE_DELTA);
            new_delta = builder.evaluate(OP_MUL, [new_delta, args['freq multiplier']()]);
            builder.contextPush(CONTEXT_WAVE_DELTA, new_delta);
            const value = args.wave();
            builder.contextPop();
            return value;
        },
    },
    pm: {
        args: [
            {
                name: "wave",
                type: "wave",
            },
            {
                name: "offset seconds",
                type: "wave",
            },
        ],
        result: "wave",
        compile(builder, args) {
            const prev = builder.storage();
            const old_offset = prev.load();
            const offset_delta = builder.evaluate(OP_SUB, [args['offset seconds'](), old_offset]);
            let new_delta = builder.contextGet(CONTEXT_NOTE_DELTA);
            prev.store(args['offset seconds']());
            new_delta = builder.evaluate(OP_ADD, [new_delta, offset_delta]);
            builder.contextPush(CONTEXT_NOTE_DELTA, new_delta);
            const value = args.wave();
            builder.contextPop();
            return value;
        },
    },
    mix: {
        args: [
            {
                name: "wave1",
                type: "wave",
            },
            {
                name: "wave2",
                type: "wave",
            },
        ],
        result: "wave",
        compile(builder, args) {
            return builder.evaluate(OP_ADD, [args.wave1(), args.wave2()]);
        },
    },
    // softclip: {
    //     args: [
    //         {
    //             name: "wave",
    //             type: "wave",
    //         },
    //         {
    //             name: "multiplier",
    //             type: "multiplier",
    //         },
    //         {
    //             name: "softness",
    //             type: "fraction",
    //         },
    //     ],
    //     result: "wave",
    // },
    wrap: {
        args: [
            {
                name: "wave",
                type: "wave",
            },
            {
                name: "min",
                type: "value",
            },
            {
                name: "max",
                type: "value",
            },
        ],
        result: "wave",
        compile(builder, args) {
            return builder.evaluate(OP_WRAP, [args.wave(), args.min(), args.max()]);
        }
    },
    // quantize: {
    //     args: [
    //         {
    //             name: "wave",
    //             type: "wave",
    //         },
    //         {
    //             name: "levels",
    //             type: "integer",
    //         },
    //     ],
    //     result: "wave",
    // },
    // downsample: {
    //     args: [
    //         {
    //             name: "wave",
    //             name: "wave",
    //         },
    //         {
    //             name: "frequency",
    //             type: "frequency",
    //         },
    //     ],
    //     result: "wave",
    // },
    // map: {
    //     args: [
    //         {
    //             name: "wave",
    //             type: "wave",
    //         },
    //         {
    //             name: "from min",
    //         },
    //         {
    //             name: "from max",
    //         },
    //         {
    //             name: "to min",
    //         },
    //         {
    //             name: "to max",
    //         },
    //     ],
    //     result: "wave",
    // },
    mapwave: {
        args: [
            {
                name: "wave",
                type: "wave",
            },
            {
                name: "min",
            },
            {
                name: "max",
            },
        ],
        result: "wave",
        compile(builder, args) {
            const wave = args.wave();
            const min = args.min();
            const max = args.max();
            const zeroone = builder.evaluate(OP_ADD, [builder.evaluate(OP_MUL, [wave, builder.const(0.5)]), builder.const(0.5)]);
            return builder.evaluate(OP_ADD, [builder.evaluate(OP_MUL, [zeroone, builder.evaluate(OP_SUB, [max, min])]), min]);
        }
    },
    // adsr: {
    //     args: [
    //         {
    //             name: "attack",
    //             type: "time",
    //         },
    //         {
    //             name: "decay",
    //             type: "time",
    //         },
    //         {
    //             name: "sustain",
    //             type: "multiplier",
    //         },
    //         {
    //             name: "release",
    //             type: "time",
    //         },
    //     ],
    //     result: "envelope",
    // },
    // keyboard: {
    //     args: [
    //         {
    //             name: "note",
    //             type: "wave",
    //         },
    //     ],
    //     result: "wave",
    // },
};
