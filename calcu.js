let zoomLevel = 100;

function zoom(val) {
    zoomLevel = val;
    document.getElementById("resultado").style.fontSize = (zoomLevel / 100) + "em";
}

// Cambiar tema
document.getElementById("themeButton").onclick = () => {
    document.body.classList.toggle("dark");
};

// Limpiar
document.getElementById("btn-limpiar").onclick = () => {
    document.getElementById("funcion").value = "";
    document.getElementById("resultado").innerHTML = "";
};

// Derivar usando motor local (sin proxy)
document.getElementById("btn-derivar").onclick = async () => {

    let expr = document.getElementById("funcion").value.trim();
    let variable = document.getElementById("variable").value;

    if (!expr) {
        document.getElementById("resultado").innerHTML = "Ingresa una función";
        return;
    }

    let resultBlock = document.getElementById("resultado");
    resultBlock.innerHTML = "Calculando...";

    try {

        // 🔥 Aquí llamamos al motor local que ya te construí
        let tex = derivar(expr, variable);

        resultBlock.innerHTML = "";
        katex.render(tex, resultBlock);

    } catch (error) {
        resultBlock.innerHTML = "Error al procesar la función";
    }
};
