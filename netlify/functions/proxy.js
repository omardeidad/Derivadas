export async function handler(event, context) {

    try {
        const body = JSON.parse(event.body);

        const res = await fetch("https://eval.mathdf.com/smart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

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
