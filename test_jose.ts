import { SignJWT, jwtVerify } from "jose";

async function test() {
    const secret = "";
    const secretKey = new TextEncoder().encode(secret);
    const payload = { foo: "bar" };

    try {
        const token = await new SignJWT(payload)
            .setProtectedHeader({ alg: "HS256", typ: "JWT" })
            .sign(secretKey);
        console.log("Signed token:", token);

        const verified = await jwtVerify(token, secretKey, {
            algorithms: ["HS256"],
        });
        console.log("Verified payload:", verified.payload);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
