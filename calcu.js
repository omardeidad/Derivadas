// ─────────────────────────────
//  ZOOM DEL RESULTADO
// ─────────────────────────────

let zoomLevel = 100;

function zoom(val) {
    zoomLevel = val;
    document.getElementById("resultado").style.fontSize = (zoomLevel / 100) + "em";
}


// ─────────────────────────────
//  MODO OSCURO
// ─────────────────────────────

document.getElementById("themeButton").onclick = () => {
    document.body.classList.toggle("dark");
};


// ─────────────────────────────
//  BOTÓN LIMPIAR
// ─────────────────────────────

document.getElementById("btn-limpiar").onclick = () => {
    document.getElementById("funcion").value = "";
    document.getElementById("resultado").innerHTML = "";
};


// ─────────────────────────────
//  BOTÓN DERIVAR (LOCAL SIN PROXY)
// ─────────────────────────────

document.getElementById("btn-derivar").onclick = () => {

    let expr = document.getElementById("funcion").value.trim();
    let variable = document.getElementById("variable").value;

    let resultBlock = document.getElementById("resultado");

    if (!expr) {
        resultBlock.innerHTML = "Ingresa una función";
        return;
    }

    try {
        // Usar el motor derivador local
        let tex = derivar(expr, variable);

        // Render con KaTeX
        resultBlock.innerHTML = "";
        katex.render(tex, resultBlock);

    } catch (err) {
        console.error(err);
        resultBlock.innerHTML = "Error en la expresión";
    }
};
