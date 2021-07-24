const OP_CONST = 0;

const OP_ADD = 1;
const OP_SUB = 2;
const OP_MUL = 3;
const OP_DIV = 4;
const OP_SIN = 5;
const OP_ABS = 6;
const OP_WRAP = 7;

const OP_LESS_THAN = 8;

const OP_DELTA = 9;
const OP_LOAD = 10;
const OP_STORE = 11;

const CONTEXT_NOTE_DELTA = 0;
const CONTEXT_WAVE_DELTA = 1;

class Bytecode {
    constructor() {
        this.registers_count = 0;
        this.storage_count = 0;
        this.instructions = [];
        this.emit = 0;
    }

    serialize() {
        return {
            registers_count: this.registers_count,
            storage_count: this.storage_count,
            instructions: this.instructions,
            emit: this.emit,
        };
    }

    static deserialize(from) {
        const bc = new Bytecode();
        bc.registers_count = from.registers_count;
        bc.storage_count = from.storage_count;
        bc.instructions = from.instructions;
        bc.emit = from.emit;

        return bc;
    }

    evaluate(inputs, proc, delta) {
        if (proc.storage === null || proc.storage.length !== this.storage_count) {
            proc.storage = new Float32Array(this.storage_count);
        }

        const registers = new Float32Array(this.registers_count);
        for (const instr of this.instructions) {
            let value;
            switch (instr[1]) {
            case OP_CONST:
                value = instr[2][0];
                break;
            case OP_ADD:
                value = registers[instr[2][0]] + registers[instr[2][1]];
                break;
            case OP_SUB:
                value = registers[instr[2][0]] - registers[instr[2][1]];
                break;
            case OP_MUL:
                value = registers[instr[2][0]] * registers[instr[2][1]];
                break;
            case OP_DIV:
                value = registers[instr[2][0]] / registers[instr[2][1]];
                break;
            case OP_SIN:
                value = Math.sin(registers[instr[2][0]]);
                break;
            case OP_ABS:
                value = Math.abs(registers[instr[2][0]]);
                break;
            case OP_WRAP:
                value = registers[instr[2][0]];
                value -= registers[instr[2][1]];
                value = ((value % registers[instr[2][2]]) + registers[instr[2][2]]) % registers[instr[2][2]];
                value += registers[instr[2][1]];
                break;
            case OP_LESS_THAN:
                value = registers[instr[2][0]] < registers[instr[2][1]] ? 1 : 0;
                break;
            case OP_DELTA:
                value = delta;
                break;
            case OP_LOAD:
                value = proc.storage[instr[2][0]];
                break;
            case OP_STORE:
                proc.storage[instr[2][0]] = registers[instr[2][1]];
                break;
            default:
                throw "Unimplemented " + instr[1];
            }
            registers[instr[0]] = value;
        }

        return registers[this.emit];
    }
}

class BytecodeBuilder {
    constructor() {
        this.values = [];
        this.values_map = new Map();
        const ctx = [];
        ctx[CONTEXT_NOTE_DELTA] = this.evaluate(OP_DELTA, []);
        ctx[CONTEXT_WAVE_DELTA] = this.evaluate(OP_DELTA, []);
        this.contextStack = [
            ctx
        ];

        this.last_storage = 0;

        this.final = 0;
    }

    contextPush(which, value) {
        const last = this.contextStack[this.contextStack.length - 1].slice();
        last[which] = value;
        console.log('BBB', value);
        this.contextStack.push(last);
    }

    contextPop() {
        this.contextStack.pop();
    }

    contextGet(which) {
        return this.contextStack[this.contextStack.length - 1][which];
    }

    wave(frequency) {
        let time_store = this.storage();
        let time = time_store.load();
        time = this.evaluate(OP_ADD, [time, this.evaluate(OP_MUL, [this.contextGet(CONTEXT_WAVE_DELTA), frequency])]);
        time = this.evaluate(OP_WRAP, [time, this.const(0.0), this.const(1.0)]);
        time_store.store(time);

        return time;
    }

    storage() {
        const id = this.last_storage;
        this.last_storage++;

        return {
            load: () => {
                return this.evaluate(OP_LOAD, [id]);
            },
            store: (value) => {
                return this.evaluate(OP_STORE, [id, value]);
            },
        };
    }

    const(value) {
        return this.evaluate(OP_CONST, [value]);
    }

    evaluate(opcode, operands = []) {
        const string_key = opcode.toString() + ':' + operands.join(':');
        if (opcode != OP_STORE && opcode != OP_LOAD) {
            if (this.values_map.has(string_key)) {
                return this.values_map.get(string_key);
            }
        }
        if (opcode == OP_CONST) {
        } else if (opcode == OP_LOAD) {
        } else if (opcode == OP_STORE) {
            this.values[operands[1]][2]++;
        } else {
            for (const operand of operands) {
                this.values[operand][2]++;
            }
        }
        this.values.push([opcode, operands, 0]);
        this.values_map.set(string_key, this.values.length - 1);
        return this.values.length - 1;
    }

    finish(value) {
        this.values[value][2]++;
        this.final = value;
    }

    transform(desiredResult) {
        const bc = new Bytecode();

        const value_info = [];
        const registers = [];

        const register_for = (value) => {
            registers[value_info[value].register].usesLeft--;
            return value_info[value].register;
        };

        for (const value of this.values) {
            let operands = value[1].slice();
            if (value[0] == OP_CONST || value[0] == OP_LOAD) {
                // do nothing
            } else if (value[0] == OP_STORE) {
                operands[1] = register_for(operands[1]);
            } else {
                operands = operands.map(register_for);
            }
            let register = -1;
            for (let i = 0; i < registers.length; i++) {
                if (registers[i].usesLeft == 0) {
                    register = i;
                    break;
                }
            }

            if (register == -1) {
                register = registers.length;
                registers.push({
                    usesLeft: 0,
                });
            }

            value_info.push({
                register,
            });
            registers[register].usesLeft = value[2];

            bc.instructions.push([
                register,
                value[0],
                operands,
            ]);
        }

        bc.emit = value_info[this.final].register;

        for (const instr of bc.instructions) {
            console.log(instr[0] + ' = ' + ['const', 'add', 'sub', 'mul', 'div', 'sin', 'abs', 'wrap', 'lt', 'delta', 'load', 'store'][instr[1]] + ' ' + instr[2].join(' '));
        }

        bc.registers_count = registers.length;
        bc.storage_count = this.last_storage;

        return bc;
    }
}

function compileRecursive(element, builder) {
    let tag = null;
    for (const cls of element.classList) {
        if (cls.startsWith('editor-value')) {
            tag = cls;
        }
    }

    switch (tag) {
    case 'editor-value-function-call': {
        const fn = functions[element.querySelector('.editor-function-name').textContent];
        const args = {};
        let child = element.firstElementChild;
        let i = 0;
        while (i < fn.args.length) {
            child = child.nextElementSibling;
            child = child.nextElementSibling;

            let el = child;
            args[fn.args[i].name] = () => compileRecursive(el, builder);
            i++;
        }
        return fn.compile(builder, args);
    }
    case 'editor-value-number':
        return builder.evaluate(OP_CONST, [parseFloat(element.textContent)]);
    case 'editor-value-comment':
        return compileRecursive(element.lastElementChild, builder);
    case 'editor-value-variable':
        return compileRecursive(document.querySelector('div[x-variable-decl=\"' + element.getAttribute('x-variable-name') + '\"]').lastElementChild, builder);
    default:
        throw "Idk";
        break;
    }
}

function compile(element) {
    const builder = new BytecodeBuilder();

    const last = compileRecursive(element, builder);
    if (last === null) {
        return null;
    }

    builder.finish(last);

    return builder.transform(last);
}

try {
    const awp = AudioWorkletProcessor;
    class Processor extends awp {
        constructor() {
            super();
            this.port.addEventListener('message', (e) => { this.message(e) });
            this.port.start();

            console.log('foobaraz');

            this.bytecode = null;
            this.storage = null;
        }

        message(e) {
            if (e.data.type == 'update-bytecode') {
                console.log('upd');
                this.bytecode = Bytecode.deserialize(e.data.bytecode);
            }
        }

        process(inputs, outputs, parameters) {
            if (this.bytecode === null) {
                return true;
            }

            const output = outputs[0];
            for (let i = 0; i < output[0].length; i++) {
                let value = this.bytecode.evaluate(null, this, 1 / 44100);
                output[0][i] = value * 0.3;
            }
            return true;
        }
    }

    registerProcessor('processor', Processor);
} catch(e) {
}
