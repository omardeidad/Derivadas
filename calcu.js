let zoomLevel = 100;

function zoom(val) {
    zoomLevel = val;
    document.getElementById("resultado").style.fontSize = (zoomLevel / 100) + "em";
}


document.getElementById("themeButton").onclick = () => {
    document.body.classList.toggle("dark");
};


document.getElementById("btn-limpiar").onclick = () => {
    document.getElementById("funcion").value = "";
    document.getElementById("resultado").innerHTML = "";
};


document.getElementById("btn-derivar").onclick = async () => {

    let expr = document.getElementById("funcion").value.trim();
    let variable = document.getElementById("variable").value;

    if (!expr) {
        document.getElementById("resultado").innerHTML = "Ingresa una función";
        return;
    }

    let data = {
        code: "derivative",
        expr: expr,
        arg: variable
    };

    let resultBlock = document.getElementById("resultado");
    resultBlock.innerHTML = "Calculando...";

    try {


        const response = await fetch("/.netlify/functions/proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const json = await response.json();

        let tex = json?.rendered?.out ?? "Error";

        resultBlock.innerHTML = "";
        katex.render(tex, resultBlock);

    } catch (error) {
        resultBlock.innerHTML = "Error conectando con el servidor";
    }
};
