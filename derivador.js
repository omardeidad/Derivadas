//
// ───────────────────────────────────────────────
//      MOTOR COMPLETO DE DERIVACIÓN SIMBÓLICA
//      Funciones básicas + multiplicación implícita
// ───────────────────────────────────────────────
//

// ─────────────────────────────
// 1. TOKENIZADOR (LEXER)
// ─────────────────────────────

function tokenize(input) {
    let raw = [];
    let i = 0;

    const isDigit = c => /\d/.test(c);
    const isLetter = c => /[a-zA-Z]/.test(c);

    while (i < input.length) {
        let c = input[i];

        if (c === ' ') { i++; continue; }

        // NÚMEROS
        if (isDigit(c) || (c === '.' && isDigit(input[i + 1]))) {
            let num = c;
            i++;
            while (i < input.length && (isDigit(input[i]) || input[i] === '.')) {
                num += input[i++];
            }
            raw.push({ type: "number", value: parseFloat(num) });
            continue;
        }

        // VARIABLES O FUNCIONES
        if (isLetter(c)) {
            let name = c;
            i++;
            while (i < input.length && isLetter(input[i])) {
                name += input[i++];
            }
            raw.push({ type: "name", value: name });
            continue;
        }

        // SÍMBOLOS
        if ("+-*/^()".includes(c)) {
            raw.push({ type: c });
            i++;
            continue;
        }

        throw "Carácter inválido: " + c;
    }

    // ─────────────────────────────
    // MULTIPLICACIÓN IMPLÍCITA
    // ─────────────────────────────
    let tokens = [];

    for (let j = 0; j < raw.length; j++) {
        let t = raw[j];
        tokens.push(t);

        let next = raw[j + 1];
        if (!next) continue;

        let left = t.type;
        let right = next.type;

        let insertMul = false;

        // número + variable  →  10x
        if (left === "number" && right === "name") insertMul = true;

        // número + ( →  2(x+1)
        if (left === "number" && right === "(") insertMul = true;

        // variable + ( →  x(x+1)
        if (left === "name" && right === "(") insertMul = true;

        // ) + variable → (x+1)x
        if (left === ")" && right === "name") insertMul = true;

        // variable + número → x2
        if (left === "name" && right === "number") insertMul = true;

        // ) + número
        if (left === ")" && right === "number") insertMul = true;

        // name + name → sinx, cosx, etc.
        if (left === "name" && right === "name") insertMul = true;

        if (insertMul) tokens.push({ type: "*" });
    }

    return tokens;
}


// ─────────────────────────────
// 2. PARSER A AST
// ─────────────────────────────

function parseExpression(tokens) {
    let i = 0;

    function peek() { return tokens[i]; }

    function consume(t) {
        if (peek() && peek().type === t) return tokens[i++];
        throw "Se esperaba: " + t;
    }

    // PRIMARY
    function parsePrimary() {
        let t = peek();

        if (t.type === "number") {
            consume("number");
            return { type: "num", value: t.value };
        }

        if (t.type === "name") {
            let name = t.value;
            consume("name");

            // FUNCIONES → sin(x)
            if (peek() && peek().type === "(") {
                consume("(");
                let inside = parseAddSub();
                consume(")");
                return { type: "func", name, arg: inside };
            }

            // VARIABLE → x
            return { type: "var", name };
        }

        // PARÉNTESIS
        if (t.type === "(") {
            consume("(");
            let expr = parseAddSub();
            consume(")");
            return expr;
        }

        throw "Token inesperado: " + t.type;
    }

    // UNARIO
    function parseUnary() {
        if (peek() && peek().type === "-") {
            consume("-");
            return { type: "neg", value: parseUnary() };
        }
        return parsePrimary();
    }

    // POTENCIAS
    function parsePow() {
        let left = parseUnary();
        while (peek() && peek().type === "^") {
            consume("^");
            let right = parseUnary();
            left = { type: "pow", left, right };
        }
        return left;
    }

    // * /
    function parseMulDiv() {
        let left = parsePow();
        while (peek() && (peek().type === "*" || peek().type === "/")) {
            let op = peek().type;
            consume(op);
            let right = parsePow();
            left = { type: op, left, right };
        }
        return left;
    }

    // + -
    function parseAddSub() {
        let left = parseMulDiv();
        while (peek() && (peek().type === "+" || peek().type === "-")) {
            let op = peek().type;
            consume(op);
            let right = parseMulDiv();
            left = { type: op, left, right };
        }
        return left;
    }

    return parseAddSub();
}


// ─────────────────────────────
// 3. DERIVACIÓN
// ─────────────────────────────

function derive(node, v) {

    switch (node.type) {

        case "num":
            return { type: "num", value: 0 };

        case "var":
            return { type: "num", value: node.name === v ? 1 : 0 };

        case "neg":
            return { type: "neg", value: derive(node.value, v) };

        case "+":
        case "-":
            return {
                type: node.type,
                left: derive(node.left, v),
                right: derive(node.right, v)
            };

        case "*":
            return {
                type: "+",
                left: { type: "*", left: derive(node.left, v), right: node.right },
                right: { type: "*", left: node.left, right: derive(node.right, v) }
            };

        case "/":
            return {
                type: "/",
                left: {
                    type: "-",
                    left: { type: "*", left: derive(node.left, v), right: node.right },
                    right: { type: "*", left: node.left, right: derive(node.right, v) }
                },
                right: { type: "pow", left: node.right, right: { type: "num", value: 2 } }
            };

        case "pow":
            if (node.right.type === "num") {
                return {
                    type: "*",
                    left: { type: "num", value: node.right.value },
                    right: {
                        type: "pow",
                        left: node.left,
                        right: { type: "num", value: node.right.value - 1 }
                    }
                };
            }

            return {
                type: "*",
                left: node,
                right: derive({ type: "func", name: "ln", arg: node.left }, v)
            };

        case "func":
            let d = derive(node.arg, v);

            switch (node.name) {
                case "sin": return { type: "*", left: d, right: { type: "func", name: "cos", arg: node.arg } };
                case "cos": return { type: "*", left: { type: "neg", value: d }, right: { type: "func", name: "sin", arg: node.arg } };
                case "tan": return { type: "*", left: d, right: { type: "pow", left: { type: "func", name: "sec", arg: node.arg }, right: { type: "num", value: 2 } } };
                case "ln":  return { type: "/", left: d, right: node.arg };
                case "log": return { type: "/", left: d, right: node.arg };
                case "exp": return { type: "*", left: d, right: node };
                case "sqrt": return { type: "/", left: d, right: { type: "*", left: { type: "num", value: 2 }, right: node } };
                case "abs": return { type: "*", left: d, right: { type: "func", name: "sgn", arg: node.arg } };
            }

            throw "Función no soportada: " + node.name;
    }
}


// ─────────────────────────────
// 4. GENERADOR DE TEX
// ─────────────────────────────

function toTeX(node) {
    switch (node.type) {

        case "num": return node.value.toString();
        case "var": return node.name;
        case "neg": return "-" + toTeX(node.value);

        case "+": return `${toTeX(node.left)} + ${toTeX(node.right)}`;
        case "-": return `${toTeX(node.left)} - ${toTeX(node.right)}`;

        case "*": return `${toTeX(node.left)} ${toTeX(node.right)}`;
        case "/": return `\\frac{${toTeX(node.left)}}{${toTeX(node.right)}}`;

        case "pow": return `${toTeX(node.left)}^{${toTeX(node.right)}}`;

        case "func":
            return `\\${node.name}(${toTeX(node.arg)})`;
    }
}


// ─────────────────────────────
// 5. FUNCIÓN GLOBAL
// ─────────────────────────────
function derivar(expr, variable = "x") {
    let tokens = tokenize(expr);
    let ast = parseExpression(tokens);
    let d = derive(ast, variable);
    return toTeX(d);
}
