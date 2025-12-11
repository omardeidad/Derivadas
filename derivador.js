//
// MOTOR DE DERIVACIÓN SIMBÓLICA
// Funciones básicas: sin, cos, tan, ln, log, exp, sqrt, abs
//

// ─────────────────────────────
// 1. LÉXICO (TOKENIZADOR)
// ─────────────────────────────
function tokenize(input) {
    let tokens = [];
    let i = 0;

    const isDigit = c => /\d/.test(c);
    const isLetter = c => /[a-zA-Z]/.test(c);

    while (i < input.length) {
        let c = input[i];

        if (c === ' ') { i++; continue; }

        // Números
        if (isDigit(c) || (c === '.' && isDigit(input[i + 1]))) {
            let num = c;
            i++;
            while (i < input.length && (isDigit(input[i]) || input[i] === '.')) {
                num += input[i++];
            }
            tokens.push({ type: "number", value: parseFloat(num) });
            continue;
        }

        // Variables o funciones
        if (isLetter(c)) {
            let name = c;
            i++;
            while (i < input.length && isLetter(input[i])) {
                name += input[i++];
            }
            tokens.push({ type: "name", value: name });
            continue;
        }

        // Símbolos
        if ("+-*/^()".includes(c)) {
            tokens.push({ type: c });
            i++;
            continue;
        }

        throw "Carácter inválido: " + c;
    }

    return tokens;
}

// ─────────────────────────────
// 2. PARSER → AST
// ─────────────────────────────
function parseExpression(tokens) {
    let i = 0;

    function peek() { return tokens[i]; }
    function consume(type) {
        if (tokens[i] && tokens[i].type === type) return tokens[i++];
        throw "Se esperaba: " + type;
    }

    function parsePrimary() {
        let t = peek();

        if (t.type === "number") {
            consume("number");
            return { type: "num", value: t.value };
        }

        if (t.type === "name") {
            let name = t.value;
            consume("name");

            // Función: sin(x)
            if (peek() && peek().type === "(") {
                consume("(");
                let inside = parseAddSub();
                consume(")");
                return { type: "func", name, arg: inside };
            }

            // Variable
            return { type: "var", name };
        }

        if (t.type === "(") {
            consume("(");
            let expr = parseAddSub();
            consume(")");
            return expr;
        }

        throw "Token inesperado: " + t.type;
    }

    function parseUnary() {
        if (peek() && peek().type === "-") {
            consume("-");
            return { type: "neg", value: parseUnary() };
        }
        return parsePrimary();
    }

    function parsePow() {
        let left = parseUnary();
        while (peek() && peek().type === "^") {
            consume("^");
            let right = parseUnary();
            left = { type: "pow", left, right };
        }
        return left;
    }

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
            // Regla del producto: f'g + fg'
            return {
                type: "+",
                left: { type: "*", left: derive(node.left, v), right: node.right },
                right: { type: "*", left: node.left, right: derive(node.right, v) }
            };

        case "/":
            // Regla del cociente
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
            // Solo potencias de variable o número
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
            // Si es más complejo: regla general
            return {
                type: "*",
                left: node,
                right: derive({
                    type: "func",
                    name: "ln",
                    arg: node.left
                }, v)
            };

        case "func":
            let d = derive(node.arg, v);

            switch (node.name) {
                case "sin": return { type: "*", left: d, right: { type: "func", name: "cos", arg: node.arg } };
                case "cos": return { type: "*", left: { type: "neg", value: d }, right: { type: "func", name: "sin", arg: node.arg } };
                case "tan": return { type: "*", left: d,
                    right: { type: "pow", left: { type: "func", name: "sec", arg: node.arg }, right: { type: "num", value: 2 } } };
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
// 5. FUNCIÓN PRINCIPAL
// ─────────────────────────────
function derivar(expr, variable = "x") {
    let tokens = tokenize(expr);
    let ast = parseExpression(tokens);
    let d = derive(ast, variable);
    return toTeX(d);
}
