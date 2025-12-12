// ZOOM
let zoomLevel = 100;
function zoom(val) {
    zoomLevel = val;
    document.getElementById("resultado").style.fontSize = (zoomLevel / 100) + "em";
}

// MODO OSCURO
document.getElementById("themeButton").onclick = () => {
    document.body.classList.toggle("dark");
};

// LIMPIAR
document.getElementById("btn-limpiar").onclick = () => {
    document.getElementById("funcion").value = "";
    document.getElementById("resultado").innerHTML = "";
};

// DERIVAR
document.getElementById("btn-derivar").onclick = () => {

    let expr = document.getElementById("funcion").value.trim();
    let variable = document.getElementById("variable").value;
    let resultado = document.getElementById("resultado");

    if (!expr) {
        resultado.innerHTML = "Ingresa una función";
        return;
    }

    try {
        // Usamos math.js
        let derivada = math.derivative(expr, variable);

        // Convertimos a TeX
        let tex = derivada.toTex({ parenthesis: "auto" });

        // Render con KaTeX
        resultado.innerHTML = "";
        katex.render(tex, resultado);

    } catch (e) {
        console.error(e);
        resultado.innerHTML = "Error en la expresión";
    }
};
