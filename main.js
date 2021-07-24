const VARIABLE_CHARACTER = '\'';

let processor = null;

const ctx = new (window.AudioContext || window.webkitAudioContext)();
async function amain() {
    await ctx.audioWorklet.addModule('evaluation.js');

    processor = new AudioWorkletNode(ctx, 'processor');
    processor.connect(ctx.destination);
}

amain();

let expressions = new Map();

class ExprEditor {
    constructor(element, change, complete) {
        this.element = element;
        this.name = null;

        this.change = change;
        this.complete = complete;

        const editable = this.findEditableInDirection("left", false, this.element);

        this.input = document.createElement('span');
        this.input.contentEditable = true;

        this.input.className = 'editor-input';
        this.inputOriginalText = null;

        this.swapInputWithEditable(editable);

        this.handleBlur = 0;

        this.element.addEventListener('mousedown', (e) => {
            if (e.target === this.input) {
                return;
            }

            play(this);
            if (e.target.classList.contains('editor-editable')) {
                this.swapInputWithEditable(e.target);
                e.preventDefault();
            }

            this.selectSideOfInput(true);
        });

        this.input.addEventListener('keypress', (e) => {
            this.onkeypress(e);
        });

        this.input.addEventListener('keydown', (e) => {
            this.onkeydown(e);
        });

        this.input.focus();

        this.input.addEventListener('blur', (e) => {
            // Chrome's blur event timing is different from Firefox.
            // *workaround!*
            if (this.handleBlur === 0) {
                this.expandOrFinish(e);
            }
        });

        this.input.addEventListener('paste', (e) => {
            let paste = (e.clipboardData || window.clipboardData).getData('text');

            const selection = window.getSelection();

            if (!selection.rangeCount) {
                return false;
            }

            selection.deleteFromDocument();
            selection.getRangeAt(0).insertNode(document.createTextNode(paste));
            selection.getRangeAt(0).collapse(false);

            e.preventDefault();
        });
    }

    onkeydown(e) {
        this.handleBlur++;
        switch (e.key) {
        case "Backspace":
        case "Delete": {
            const right = e.key == "Delete";
            if (!this.isAtEndOfInput(right)) {
                break;
            }

            let inside = false;
            let el = this.findEditableInDirection(right ? "right" : "left", true);
            if (!el) {
                break;
            }

            if (el.contains(this.input)) {
                const i = document.createElement('span');
                i.className = 'editor-editable';
                el.parentElement.replaceChild(i, el);

                this.swapInputWithEditable(i);
                this.selectSideOfInput(!right);
            } else {
                this.swapInputWithEditable(el);
                this.selectSideOfInput(!right);
            }

            e.preventDefault();
        } break;
        case "ArrowLeft":
        case "ArrowRight": {
            const right = e.key == "ArrowRight";
            if (!this.isAtEndOfInput(right)) {
                break;
            }

            this.moveInput(() => { e.preventDefault(); }, right);
        } break;
        case "Tab":
            const right = e.shiftKey === false;
            this.moveInput(() => { e.preventDefault(); }, right);
            break;
        }
        this.handleBlur--;
    }

    onkeypress(e) {
        this.handleBlur++;
        switch (e.key) {
        case "Enter":
            e.preventDefault();
            this.expandOrFinish(e);
            break;

        case " ":
            if (!this.isAtEndOfInput(true)) {
                break;
            }

            this.expandOrFinish(e);
            break;
        }
        this.handleBlur--;
    }

    expandOrFinish(e) {
        this.moveInput(() => { e.preventDefault(); }, true, e.key == " ");
    }

    maybeExpandIntoNesting(preventDefault, space) {
        if (space && this.input.classList.contains('editor-comment')) {
            return 'done';
        }

        preventDefault();

        if (this.input.classList.contains('editor-comment')) {
            return 'next';
        }

        if (this.input.classList.contains('editor-variable-decl')) {
            this.onCollapse = (el) => { this.changeDeclName(el); };
            return 'next';
        }

        const tc = this.input.textContent;
        if (tc.length === 0) {
            if (this.input.classList.contains('editor-maybe-empty')) {
                return 'next';
            }

            return 'cancel';
        }

        if (tc == '#') {
            const el = document.createElement('span');
            this.input.parentNode.replaceChild(el, this.input);

            el.className = 'editor-container editor-value-comment';

            let side = document.createElement('span');
            side.className = 'editor-comment';
            side.textContent = '/* ';
            el.appendChild(side);

            el.appendChild(this.input);

            side = document.createElement('span');
            side.className = 'editor-comment';
            side.textContent = ' */ ';
            el.appendChild(side);

            this.input.textContent = '';
            this.input.focus();
            this.input.className = 'editor-input editor-comment editor-editable';

            const actual = document.createElement('span');
            actual.className = 'editor-editable editor-maybe-empty';

            el.appendChild(actual);

            return 'done';
        }

        if (tc[0] == VARIABLE_CHARACTER) {
            this.input.className = 'editor-value-variable editor-editable';
            this.onCollapse = (el) => { this.variableCollapse(el); };

            return 'next';
        }

        if (functions.hasOwnProperty(tc)) {
            const func = functions[tc];
            const el = document.createElement('span');

            this.input.className = 'editor-function';
            this.input.parentNode.replaceChild(el, this.input);

            el.className = 'editor-container editor-value-function-call';
            el.appendChild(document.createTextNode('['));

            const name = document.createElement('span');
            name.className = 'editor-function editor-function-name';
            name.textContent = tc;
            el.appendChild(name);

            let first = true;
            for (const arg of func.args) {
                el.appendChild(document.createTextNode(' '));

                const arg_el = document.createElement('span');
                arg_el.className = 'editor-arg-hint';
                arg_el.textContent = arg.name + ':';
                el.appendChild(arg_el);

                const arg_val = document.createElement('span');
                arg_val.className = 'editor-editable editor-argument';
                el.appendChild(arg_val);

                if (first) {
                    first = false;
                    this.swapInputWithEditable(arg_val);
                }
            }

            el.appendChild(document.createTextNode(']'));

            return 'done';
        }

        if ('0123456789-.'.indexOf(tc[0]) !== -1) {
            this.input.classList.add('editor-value-number');
            return 'next';
        }

        const el = this.input;
        el.classList.add('editor-input-error');
        setTimeout(() => {
            el.classList.remove('editor-input-error');
        }, 20);

        return 'cancel';
    }

    changeDeclName(element) {
        expressionChangeName(this, element.textContent);
    }

    variableCollapse(element) {
        element.setAttribute('x-variable-name', element.textContent.substr(1));
    }

    moveInput(preventDefault, right, space) {
        const result = this.maybeExpandIntoNesting(preventDefault, space);

        if (result == 'cancel') {
            return false;
        }

        if (result == 'done') {
            if (this.input.parentElement === null) {
                this.complete(this);
            }

            return true;
        }

        const editable = this.findEditableInDirection(right ? "right" : "left");
        if (editable !== null) {
            this.swapInputWithEditable(editable);

            this.selectSideOfInput(!right);

            return true;
        }

        this.removeInput();
        this.complete(this);
        return true;
    }

    isAtEndOfInput(right) {
        let selection = window.getSelection();
        if (!selection.rangeCount) {
            return false;
        }

        let range = selection.getRangeAt(0);
        if (this.input.firstChild !== null) {
            let input_range = document.createRange();
            input_range.selectNodeContents(right ? this.input.lastChild : this.input.firstChild);
            if (range.compareBoundaryPoints(right ? Range.END_TO_END : Range.START_TO_START, input_range) != 0) {
                input_range.detach();
                return false;
            }

            input_range.detach();
        }

        return true;
    }

    selectSideOfInput(right) {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            return;
        }

        const range = selection.getRangeAt(0);

        this.input.normalize();

        let node = this.input;
        if (node.firstChild !== null) {
            node = right ? node.lastChild : node.firstChild;
        }
        range.selectNodeContents(node);
        range.collapse(!right);
    }

    findEditableInDirection(direction, cont, ref) {
        ref = (ref === undefined) ? this.input : ref;
        let node = ref;

        let just_moved_parent = false;


        while (node !== null) {
            if (node !== ref && (node.classList.contains('editor-editable') || (cont && node.classList.contains('editor-container')))) {
                return node;
            }

            if (direction == "left") {
                if (node.lastElementChild !== null && !just_moved_parent) {
                    node = node.lastElementChild;
                } else if (node.previousElementSibling !== null) {
                    node = node.previousElementSibling;
                    just_moved_parent = false;
                } else if (node.parentElement !== this.element) {
                    node = node.parentElement;
                    just_moved_parent = true;
                } else {
                    return null;
                }
            } else {
                if (node.firstElementChild !== null && !just_moved_parent) {
                    node = node.firstElementChild;
                } else if (node.nextElementSibling !== null) {
                    node = node.nextElementSibling;
                    just_moved_parent = false;
                } else if (node.parentElement !== this.element) {
                    node = node.parentElement;
                    just_moved_parent = true;
                } else {
                    return null;
                }
            }
        }

        return null;
    }

    removeInput() {
        this.maybeExpandIntoNesting(() => {}, false);

        const put = document.createElement('span');
        put.className = this.input.className;
        put.classList.remove('editor-input');
        put.textContent = this.input.textContent;
        this.input.parentElement.replaceChild(put, this.input);

        if (this.onCollapse) {
            this.onCollapse(put);
            this.onCollapse = undefined;
        }
    }

    swapInputWithEditable(editable) {
        this.handleBlur++;
        if (this.input.parentElement !== null) {
            this.removeInput();
        }

        this.input.textContent = editable.textContent;
        this.input.normalize();

        this.input.className = 'editor-input';

        for (const cls of editable.classList) {
            if (cls.startsWith('editor-value-')) {
                continue;
            }

            this.input.classList.add(cls);
        }

        editable.parentElement.replaceChild(this.input, editable);
        this.input.focus();
        this.inputOriginalText = this.input.textContent;
        this.handleBlur--;
    }

    focus() {
        this.input.focus();
    }
};

let lines = new Set();

let repl_line_index = 0;

function expressionChangeName(expr, name) {
    let old_name = expr.name;
    if (old_name !== null) {
        expressions.delete(expr.name);
    }

    let new_name = name;
    let index = 0;

    while (expressions.has(new_name)) {
        new_name = name + '.' + (index++);
    }

    expressions.set(new_name, expr);
    expr.name = new_name;

    expr.element.querySelector('.editor-editable.editor-variable-decl').textContent = new_name;
    expr.element.setAttribute('x-variable-decl', new_name);

    if (old_name !== null) {
        const uses = document.querySelectorAll('span[x-variable-name="' + old_name + '"]');
        for (const el of uses) {
            el.textContent = VARIABLE_CHARACTER + new_name;
            el.setAttribute('x-variable-name', new_name);
        }
    }
}

function play_(editor) {
    let bytecode;
    try {
        bytecode = compile(editor.element.lastElementChild);
    } catch (e) {
        return false;
    }

    if (processor !== null) {
        processor.port.postMessage({
            type: 'update-bytecode',
            bytecode: bytecode.serialize(),
        });
    }

    return true;
}

let last_evaled = null;

function play(editor) {
    if (!play_(editor)) {
        play_(last_evaled);
    }
}

function new_line() {
    if (repl_line !== null) {
        play(repl_line);
        last_evaled = repl_line;
    }

    const expr = document.createElement('div');
    expr.className = 'expression';

    const chr = document.createElement('span');
    chr.className = 'editor-variable-decl';
    chr.textContent = VARIABLE_CHARACTER;
    expr.appendChild(chr);

    const varname = document.createElement('span');
    varname.className = 'editor-editable editor-variable-decl';
    expr.appendChild(varname);

    expr.appendChild(document.createTextNode(' = '));

    const editable = document.createElement('span');
    editable.className = 'editor-editable';
    expr.appendChild(editable);

    repl_line = new ExprEditor(expr, () => {}, maybe_new_line);
    repl_line._is_repl_line = true;

    expressionChangeName(repl_line, repl_line_index);

    document.querySelector('.editor').appendChild(expr);

    repl_line_index++;

    return repl_line;
}

let repl_line = null;
function maybe_new_line(editor) {
    if (editor._is_repl_line) {
        editor._is_repl_line = false;

        new_line();

        repl_line.focus();
    }
    play(repl_line);
    repl_line.focus();
}

repl_line = null;

for (const fn in functions) {
    const el = document.createElement('div');
    el.className = 'editor-function editor-functions-li';
    el.textContent = fn;
    document.querySelector('.editor').appendChild(el);
}

new_line();

document.addEventListener('mousedown', (e) => {
    ctx.resume();

    setTimeout(() => {
        if (document.activeElement === document.body) {
            repl_line.focus();
        }
    }, 0);
});
