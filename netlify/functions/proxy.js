export async function handler(event) {
  try {
    // Leer datos enviados por POST
    const body = JSON.parse(event.body);

    // Enviar la misma información al servidor de MathDF
    const res = await fetch("https://eval.mathdf.com/smart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    // Recibir respuesta
    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error en el proxy",
        details: err.message
      })
    };
  }
}
